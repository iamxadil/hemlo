// Choosing the AI for each job in each system, from the admin dashboard: providers' keys kept encrypted and never shown
// again, the model chosen for a job used by that system only (and its fallback when it fails), the default engine
// everywhere else, a test on a known sample, each provider's models. Outside services are faked (fetch).
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { setup, Browser, signInEmail, createOrg } from './helpers';
import { sealKey, openKey } from '../apps/api/src/ai/keys';
import { openaiCompat, withFallback, AiError, type Engine, type AskJson } from '../apps/api/src/ai/engine';
import { editionOf, forgetAiConfig } from '../apps/api/src/ai/router';
import { withSystem } from '@hemlo/db';
import { hemloAiProvider } from '@hemlo/db/schema';
import { eq } from 'drizzle-orm';

const KEY = 'sk-or-v1-test-secret-key-9f3a';

/** A fake OpenAI-compatible service: answers with what `reply` returns, and remembers what it was sent. */
function fakeService(reply: (body: any, url: string) => { status?: number; json?: unknown }) {
  const sent: { url: string; body: any; headers: Record<string, string> }[] = [];
  const f = (async (url: string, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    sent.push({ url, body, headers: Object.fromEntries(new Headers(init?.headers).entries()) });
    const r = reply(body, url);
    return new Response(JSON.stringify(r.json ?? {}), { status: r.status ?? 200, headers: { 'content-type': 'application/json' } });
  }) as unknown as typeof fetch;
  return { f, sent };
}
const answer = (content: unknown, usage: Record<string, number> = { prompt_tokens: 1000, completion_tokens: 100 }) =>
  ({ json: { model: 'served-model', choices: [{ message: { content: typeof content === 'string' ? content : JSON.stringify(content) } }], usage } });
const ASK: AskJson = { system: 'sys', text: 'hello', schema: { type: 'object' } };

describe('keys', () => {
  it('are sealed with the server’s secret: the database alone can’t read them', async () => {
    const sealed = await sealKey('server-secret', KEY);
    expect(sealed).not.toContain(KEY);
    expect(sealed.startsWith('v1.')).toBe(true);
    expect(await openKey('server-secret', sealed)).toBe(KEY);
    expect(await openKey('another-secret', sealed)).toBeNull();
    expect(await openKey('server-secret', 'garbage')).toBeNull();
    expect(await sealKey('server-secret', KEY)).not.toBe(sealed); // a fresh IV every time
  });
});

describe('an OpenAI-compatible engine', () => {
  it('asks for JSON in the shape wanted, with the photo, and reads back the cost', async () => {
    const svc = fakeService(() => answer({ ok: 1 }, { prompt_tokens: 1200, completion_tokens: 80, cost: 0.0021 }));
    const e = openaiCompat({ name: 'openrouter', baseUrl: 'https://openrouter.ai/api/v1/', apiKey: KEY, model: 'google/gemini-2.5-flash', paid: true, fetch: svc.f, headers: { 'X-Title': 'Hemlo' } });
    const out = await e.json<{ ok: number }>({ ...ASK, image: 'data:image/jpeg;base64,AAAA' });
    expect(out).toMatchObject({ data: { ok: 1 }, model: 'served-model', inputTokens: 1200, outputTokens: 80, costMicros: 2100 });
    const [s] = svc.sent;
    expect(s.url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(s.headers.authorization).toBe(`Bearer ${KEY}`);
    expect(s.headers['x-title']).toBe('Hemlo');
    expect(s.body.model).toBe('google/gemini-2.5-flash');
    expect(s.body.response_format.type).toBe('json_schema');
    expect(s.body.messages[1].content[1]).toEqual({ type: 'image_url', image_url: { url: 'data:image/jpeg;base64,AAAA' } });
    expect(s.body.usage).toEqual({ include: true });
  });
  it('a service without JSON-schema support is asked for a JSON object, with the shape in the instructions', async () => {
    const svc = fakeService((b) => (b.response_format.type === 'json_schema' ? { status: 400, json: { error: 'unsupported' } } : answer('```json\n{"ok":2}\n```')));
    const e = openaiCompat({ name: 'groq', baseUrl: 'https://api.groq.com/openai/v1', apiKey: KEY, model: 'llama', paid: true, price: { input: 1, output: 2 }, fetch: svc.f });
    const out = await e.json<{ ok: number }>(ASK);
    expect(out.data.ok).toBe(2);
    expect(out.costMicros).toBe(1000 * 1 + 100 * 2); // no cost reported: the route's price
    expect(svc.sent[1].body.response_format.type).toBe('json_object');
    expect(svc.sent[1].body.messages[0].content).toContain('JSON Schema');
  });
  it('failures say so; a refusal is a refusal; a fallback steps in for failures only', async () => {
    const down = openaiCompat({ name: 'openai', baseUrl: 'https://x/v1', apiKey: KEY, model: 'm', paid: true, fetch: fakeService(() => ({ status: 500, json: { error: 'boom' } })).f });
    await expect(down.json(ASK)).rejects.toThrow(/HTTP_500/);
    const refuses = openaiCompat({ name: 'openai', baseUrl: 'https://x/v1', apiKey: KEY, model: 'm', paid: true, fetch: fakeService(() => ({ json: { choices: [{ message: { refusal: 'no' } }] } })).f });
    await expect(refuses.json(ASK)).rejects.toThrow('REFUSED');
    const backup: Engine = { name: 'workers-ai', paid: false, json: async <T,>() => ({ data: { ok: 3 } as T, model: 'b', inputTokens: 0, outputTokens: 0, costMicros: 0 }) };
    expect((await withFallback(down, backup).json<{ ok: number }>(ASK)).data.ok).toBe(3);
    await expect(withFallback(refuses, backup).json(ASK)).rejects.toThrow('REFUSED');
    expect(withFallback(down, undefined)).toBe(down);
  });
  it('a business’s system: its subscription, or (a demo) the kind of business it is', () => {
    expect(editionOf({ status: 'trial', edition: 'gym' }, null)).toBe('gym');
    expect(editionOf({ status: 'free', edition: 'store' }, 'gym')).toBe('gym');
    expect(editionOf({ status: 'free', edition: 'store' }, 'perfume')).toBe('store');
    expect(editionOf({ status: 'active', edition: 'dental' }, 'gym')).toBe('dental');
  });
});

// ---------------------------------------------------------------- the dashboard, and the systems using its choices
let t: Awaited<ReturnType<typeof setup>>;
let founder: Browser, gym: Browser, shop: Browser;
const asked: { engine: string }[] = [];
// the default engine (no choice made): free, and it answers both jobs
const fallbackDefault: Engine = {
  name: 'workers-ai', model: 'default-model', paid: false,
  async json<T>(req: AskJson) {
    asked.push({ engine: 'default' });
    const data = req.image && /register|سجل/i.test(req.system)
      ? { rows: [{ name: 'Default Row', phone: '07700000001', plan: '', planIndex: -1, startsOn: '', endsOn: '', paid: 0, owes: 0, notes: '' }] }
      : { supplier: 'Default', invoiceNo: '', date: '', currency: 'IQD', total: 1000, lines: [{ name: 'X', qty: 1, unitCost: 1000, total: 1000, sku: '', barcode: '', match: -1 }] };
    return { data: data as T, model: 'default-model', inputTokens: 10, outputTokens: 10, costMicros: 0 };
  },
};
let svc: ReturnType<typeof fakeService>;
const realFetch = globalThis.fetch;

beforeAll(async () => {
  forgetAiConfig();
  t = await setup({}, fallbackDefault);
  founder = new Browser(t.app);
  await signInEmail(founder, 'founder@hemlohq.com');
  await t.client.query(`update "user" set role = 'admin' where email = 'founder@hemlohq.com'`);
  await signInEmail(founder, 'founder@hemlohq.com');

  gym = new Browser(t.app);
  await signInEmail(gym, 'owner@lion-gym.iq');
  const g = await gym.post('/v1/gym/start', { name: 'Lion Gym', city: 'Erbil', lang: 'en' });
  await gym.post('/v1/auth/organization/set-active', { organizationId: g.json.organizationId });
  shop = new Browser(t.app);
  await signInEmail(shop, 'owner@shop.iq');
  await createOrg(shop, 'Corner Shop');

  // OpenRouter, faked: reads the register; its model list
  svc = fakeService((b, url) => {
    if (url.endsWith('/models')) return { json: { data: [
      { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash', pricing: { prompt: '0.0000003', completion: '0.0000025' }, architecture: { input_modalities: ['text', 'image'] }, context_length: 1000000 },
      { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B (free)', pricing: { prompt: '0', completion: '0' }, architecture: { input_modalities: ['text'] } },
    ] } };
    if (JSON.stringify(b?.messages ?? '').includes('شكد')) return answer({ tool: 'summary', period: 'today', limit: 5 });
    return answer({ rows: [{ name: 'Karrar Hussein', phone: '07712345601', plan: 'One month', planIndex: 0, startsOn: '', endsOn: '', paid: 40000, owes: 0, notes: '' }] },
      { prompt_tokens: 1500, completion_tokens: 200, cost: 0.0042 });
  });
  vi.stubGlobal('fetch', (async (url: any, init?: RequestInit) => (/openrouter\.ai|api\.openai\.com/.test(String(url)) ? svc.f(String(url), init) : realFetch(url, init))) as typeof fetch);
});
afterAll(() => { vi.unstubAllGlobals(); forgetAiConfig(); });

describe('the AI page', () => {
  it('is for the founder, or a teammate allowed to manage AI', async () => {
    expect((await gym.get('/v1/admin/ai')).status).toBe(403);
    const r = await founder.get('/v1/admin/ai');
    expect(r.status).toBe(200);
    expect(r.json.providers.map((p: any) => p.id)).toEqual(['workers-ai', 'anthropic', 'openai', 'openrouter', 'gemini', 'groq']);
    expect(r.json.jobs.map((j: any) => `${j.edition}:${j.feature}`)).toContain('gym:members');
    expect(r.json.routes).toEqual([]);
    expect(r.json.default).toEqual({ provider: 'workers-ai', model: 'default-model' });
  });
  it('a key goes in, is kept encrypted, and only its last four characters ever come back', async () => {
    expect((await founder.put('/v1/admin/ai/providers/openrouter', { key: 'short' })).json.error).toBe('BAD_KEY');
    expect((await founder.put('/v1/admin/ai/providers/workers-ai', { key: KEY })).json.error).toBe('NO_KEY_NEEDED');
    expect((await founder.put('/v1/admin/ai/providers/openrouter', { key: KEY })).status).toBe(200);
    const r = await founder.get('/v1/admin/ai');
    expect(JSON.stringify(r.json)).not.toContain(KEY);
    expect(r.json.providers.find((p: any) => p.id === 'openrouter')).toMatchObject({ hint: '9f3a', source: 'dashboard', ready: true });
    const [stored] = await withSystem(t.db, (tx) => tx.select().from(hemloAiProvider).where(eq(hemloAiProvider.id, 'openrouter')));
    expect(stored.keyHint).toBe('9f3a');
    expect(stored.keyEnc).not.toContain(KEY);
  });
  it('lists a provider’s models: free ones and ones that read photos marked, prices per million tokens', async () => {
    const r = await founder.get('/v1/admin/ai/models?provider=openrouter');
    expect(r.json.live).toBe(true);
    expect(r.json.list[0]).toMatchObject({ id: 'meta-llama/llama-3.3-70b-instruct:free', free: true, vision: false }); // free ones first
    expect(r.json.list[1]).toMatchObject({ id: 'google/gemini-2.5-flash', free: false, vision: true, priceIn: 0.3, priceOut: 2.5 });
    expect((await founder.get('/v1/admin/ai/models?provider=nope')).status).toBe(404);
  });
  it('a test runs one job on a known sample and says how it did, how fast, and what it cost', async () => {
    const r = await founder.post('/v1/admin/ai/test', { provider: 'openrouter', model: 'google/gemini-2.5-flash', feature: 'ask' });
    expect(r.json).toMatchObject({ ok: true, good: true });
    expect(typeof r.json.ms).toBe('number');
    expect((await founder.post('/v1/admin/ai/test', { provider: 'openai', model: 'gpt-5-mini', feature: 'ask' })).json.error).toBe('NO_KEY');
    expect((await founder.post('/v1/admin/ai/test', { provider: 'openrouter', model: 'x', feature: 'dance' })).json.error).toBe('NO_JOB');
  });
});

describe('each system uses the model chosen for its job', () => {
  it('the gym reads its register with the chosen model; the shop still uses the default', async () => {
    const set = await founder.put('/v1/admin/ai/routes/gym/members', { provider: 'openrouter', model: 'google/gemini-2.5-flash', fallbackProvider: 'workers-ai', fallbackModel: '@cf/meta/llama-4-scout-17b-16e-instruct' });
    expect(set.status).toBe(200);
    expect((await founder.put('/v1/admin/ai/routes/gym/dance', { provider: 'openrouter', model: 'x' })).status).toBe(404);
    expect((await founder.put('/v1/admin/ai/routes/gym/members', { provider: 'nobody', model: 'x' })).json.error).toBe('NO_PROVIDER');
    expect((await founder.put('/v1/admin/ai/routes/gym/members', { provider: 'openrouter', model: 'bad model name' })).json.error).toBe('BAD_MODEL');

    const before = svc.sent.length;
    const r = await gym.post('/v1/sys/ai/members', { image: 'data:image/jpeg;base64,AAAA' });
    expect(r.status).toBe(200);
    expect(r.json.engine).toBe('openrouter');
    expect(r.json.rows[0]).toMatchObject({ name: 'Karrar Hussein', phone: '07712345601' });
    expect(svc.sent.length).toBe(before + 1);
    expect(svc.sent.at(-1)!.body.model).toBe('google/gemini-2.5-flash');
    expect(svc.sent.at(-1)!.headers.authorization).toBe(`Bearer ${KEY}`); // the key, opened on the server only

    const s = await shop.post('/v1/sys/ai/invoice', { image: 'data:image/jpeg;base64,AAAA' });
    expect(s.json.engine).toBe('workers-ai'); // no choice made for the shop's invoices: the default
    expect(svc.sent.length).toBe(before + 1);

    const page = (await founder.get('/v1/admin/ai')).json;
    expect(page.routes[0]).toMatchObject({ id: 'gym:members', provider: 'openrouter', model: 'google/gemini-2.5-flash', fallbackProvider: 'workers-ai' });
    const used = page.usage.find((u: any) => u.edition === 'gym' && u.feature === 'members');
    expect(used).toMatchObject({ engine: 'openrouter', calls: 1, failed: 0, costMicros: 4200 }); // the cost OpenRouter reported
  });
  it('a chosen provider that can’t run (no key, switched off) falls back; back to the default when the choice is cleared', async () => {
    await founder.put('/v1/admin/ai/routes/store/invoice', { provider: 'openai', model: 'gpt-5-mini' }); // no OpenAI key
    expect((await shop.post('/v1/sys/ai/invoice', { image: 'data:image/jpeg;base64,AAAA' })).json.engine).toBe('workers-ai');
    await founder.put('/v1/admin/ai/providers/openrouter', { enabled: false });
    expect((await gym.post('/v1/sys/ai/members', { image: 'data:image/jpeg;base64,AAAA' })).json.engine).toBe('workers-ai'); // its fallback can't run here either (no Workers AI): the default
    await founder.put('/v1/admin/ai/providers/openrouter', { enabled: true });
    expect((await founder.req('DELETE', '/v1/admin/ai/routes/gym/members')).status).toBe(200);
    expect((await gym.post('/v1/sys/ai/members', { image: 'data:image/jpeg;base64,AAAA' })).json.engine).toBe('workers-ai');
  });
  it('another OpenAI-compatible service can be added, used, and removed (not while a job uses it)', async () => {
    expect((await founder.post('/v1/admin/ai/providers', { label: 'DeepSeek', baseUrl: 'http://insecure.example/v1' })).json.error).toBe('BAD_URL');
    const add = await founder.post('/v1/admin/ai/providers', { label: 'DeepSeek', baseUrl: 'https://api.openai.com/v1/', key: 'sk-deepseek-123456' });
    expect(add.status).toBe(201);
    expect(add.json.id).toBe('custom-deepseek');
    expect((await founder.post('/v1/admin/ai/providers', { label: 'DeepSeek', baseUrl: 'https://x.example/v1' })).json.error).toBe('PROVIDER_EXISTS');
    await founder.put('/v1/admin/ai/routes/gym/members', { provider: 'custom-deepseek', model: 'deepseek-chat' });
    const r = await gym.post('/v1/sys/ai/members', { image: 'data:image/jpeg;base64,AAAA' });
    expect(r.json.engine).toBe('custom-deepseek');
    expect(svc.sent.at(-1)!.headers.authorization).toBe('Bearer sk-deepseek-123456');
    expect((await founder.req('DELETE', '/v1/admin/ai/providers/custom-deepseek')).json.error).toBe('PROVIDER_IN_USE');
    expect((await founder.req('DELETE', '/v1/admin/ai/providers/openrouter')).json.error).toBe('BUILT_IN');
    await founder.req('DELETE', '/v1/admin/ai/routes/gym/members');
    expect((await founder.req('DELETE', '/v1/admin/ai/providers/custom-deepseek')).status).toBe(200);
    expect((await founder.get('/v1/admin/ai')).json.providers.some((p: any) => p.id === 'custom-deepseek')).toBe(false);
  });
  it('a key can be removed', async () => {
    await founder.put('/v1/admin/ai/providers/openrouter', { key: null });
    expect((await founder.get('/v1/admin/ai')).json.providers.find((p: any) => p.id === 'openrouter')).toMatchObject({ hint: null, source: null, ready: false });
  });
});
