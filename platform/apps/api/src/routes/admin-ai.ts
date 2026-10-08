// The admin dashboard's AI page: which providers Hemlo can use (and their keys, kept encrypted, shown only by their last
// four characters), which model does each AI job in each system (with one to fall back on), the live list of each
// provider's models (free ones, ones that read images, their prices), a test that runs a job on a known sample and says
// how well it did, how fast and at what cost, and the last 30 days of real use. Founder, or a teammate with ai.manage.
import { Hono, type Context } from 'hono';
import { eq, sql } from 'drizzle-orm';
import { withSystem } from '@hemlo/db';
import { hemloAiProvider, hemloAiRoute } from '@hemlo/db/schema';
import { audit } from '@hemlo/auth/audit';
import { HttpError } from '../principal';
import { BUILT_IN, AI_JOBS, aiConfig, engineOf, forgetAiConfig, type Provider } from '../ai/router';
import { sealKey, masterSecret } from '../ai/keys';
import { AiError, type Engine } from '../ai/engine';
import { readInvoice } from '../ai/invoice';
import { readRegister, toRows } from '../ai/register';
import { planQuestion } from '../ai/ask';
import { DESCRIBE, TEXT_SCHEMA, ROUTER, ASK_SCHEMA } from './realestate/ai';
import type { AppEnv, Deps } from '../types';

const rowsOf = (r: any): any[] => (Array.isArray(r) ? r : r?.rows ?? []);
const need = (c: Context<AppEnv>) => {
  const s = c.get('staff');
  if (!s || !s.permissions.includes('ai.manage')) throw new HttpError(403, 'NO_PERMISSION', 'ai.manage');
  return s;
};
const ID = /^[a-z0-9][a-z0-9-]{1,40}$/, MODEL = /^[\w./:@+-]{1,160}$/;

// ---------- each provider's models, live (remembered ten minutes per server) ----------
export type ModelInfo = { id: string; name: string; free?: boolean; vision?: boolean; priceIn?: number | null; priceOut?: number | null; context?: number | null };
const models = new Map<string, { at: number; list: ModelInfo[]; live: boolean }>();
/** Workers AI models Hemlo knows work for its jobs (when Cloudflare's own list can't be read). */
const WORKERS_KNOWN: ModelInfo[] = [
  { id: '@cf/meta/llama-4-scout-17b-16e-instruct', name: 'Llama 4 Scout 17B', free: true, vision: true },
  { id: '@cf/mistralai/mistral-small-3.1-24b-instruct', name: 'Mistral Small 3.1 24B', free: true, vision: true },
  { id: '@cf/google/gemma-3-12b-it', name: 'Gemma 3 12B', free: true, vision: true },
  { id: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', name: 'Llama 3.3 70B (fast)', free: true, vision: false },
];
async function listModels(d: Deps, p: Provider): Promise<{ list: ModelInfo[]; live: boolean }> {
  const hit = models.get(p.def.id);
  if (hit && Date.now() - hit.at < 600_000) return hit;
  const get = async (url: string, headers: Record<string, string> = {}) => {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`HTTP_${res.status}`);
    return res.json() as Promise<any>;
  };
  let list: ModelInfo[] = [], live = true;
  try {
    if (p.def.kind === 'workers-ai') {
      const env = d.env as unknown as Record<string, string | undefined>;
      if (!env.CF_API_TOKEN || !env.CF_ACCOUNT_ID) throw new Error('NO_CF_TOKEN');
      const x = await get(`https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/ai/models/search?task=Text%20Generation&per_page=200`, { authorization: `Bearer ${env.CF_API_TOKEN}` });
      list = (x.result ?? []).map((m: any) => ({ id: m.name, name: m.name.split('/').pop(), free: true,
        vision: /vision|scout|gemma-3|mistral-small-3\.1|llava/i.test(m.name) || (m.properties ?? []).some((q: any) => /vision|image/i.test(`${q.property_id} ${q.value}`)) }));
    } else if (p.def.id === 'openrouter') {
      const x = await get('https://openrouter.ai/api/v1/models');
      // models that answer in text only (not image, music or speech makers)
      list = (x.data ?? []).filter((m: any) => { const o = m.architecture?.output_modalities; return !Array.isArray(o) || (o.length === 1 && o[0] === 'text'); }).map((m: any) => {
        const pin = Number(m.pricing?.prompt ?? NaN), pout = Number(m.pricing?.completion ?? NaN);
        return { id: m.id, name: m.name ?? m.id, free: m.id.endsWith(':free') || (pin === 0 && pout === 0), vision: (m.architecture?.input_modalities ?? []).includes('image'),
          priceIn: Number.isFinite(pin) ? Math.round(pin * 1e6 * 1000) / 1000 : null, priceOut: Number.isFinite(pout) ? Math.round(pout * 1e6 * 1000) / 1000 : null, context: m.context_length ?? null };
      });
    } else if (p.def.kind === 'anthropic') {
      if (!p.key) throw new Error('NO_KEY');
      const x = await get('https://api.anthropic.com/v1/models?limit=100', { 'x-api-key': p.key, 'anthropic-version': '2023-06-01' });
      list = (x.data ?? []).map((m: any) => ({ id: m.id, name: m.display_name ?? m.id, vision: true }));
    } else {
      if (!p.key || !p.def.baseUrl) throw new Error('NO_KEY');
      const x = await get(`${p.def.baseUrl.replace(/\/+$/, '')}/models`, { authorization: `Bearer ${p.key}` });
      list = (x.data ?? x.models ?? []).map((m: any) => { const id = String(m.id ?? m.name ?? '').replace(/^models\//, ''); return { id, name: m.display_name ?? id }; }).filter((m: ModelInfo) => m.id);
    }
  } catch {
    live = false;
    list = p.def.kind === 'workers-ai' ? WORKERS_KNOWN : [];
  }
  list.sort((a, b) => Number(!!b.free) - Number(!!a.free) || a.id.localeCompare(b.id));
  const out = { at: Date.now(), list, live };
  if (live) models.set(p.def.id, out);
  return out;
}

// ---------- a test on a known sample: how well, how fast, at what cost ----------
let samples: { invoice?: string; register?: string } = {};
async function sampleImage(d: Deps, name: 'invoice' | 'register') {
  if (samples[name]) return samples[name]!;
  const base = (d.env.SYSTEM_URL ?? 'https://system.hemlohq.com').replace(/\/$/, '');
  const res = await fetch(`${base}/samples/${name}.jpg`, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new HttpError(503, 'SAMPLE_UNAVAILABLE');
  const bytes = new Uint8Array(await res.arrayBuffer());
  let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return (samples[name] = `data:image/jpeg;base64,${btoa(s)}`);
}
// what is written on the register test page (public/samples/register.jpg)
const REGISTER_TRUTH = [['كرار حسين', '07712345601'], ['زينب عباس', '07801234502'], ['مصطفى جاسم', '07501234503'], ['نور الهدى', '07711234504'],
  ['حيدر علي', '0790123450'], ['سارة محمد', '07821234506'], ['علي كريم', '07731234507']] as const;
const TEST_PLANS = [{ id: 'p1', name: 'شهر واحد', duration: 1, unit: 'month' }, { id: 'p3', name: 'ثلاثة أشهر', duration: 3, unit: 'month' }, { id: 'p6', name: 'ستة أشهر', duration: 6, unit: 'month' },
  { id: 'v12', name: '12 زيارة خلال شهر', duration: 1, unit: 'month' }, { id: 'cl', name: 'الكلاسات · شهر', duration: 1, unit: 'month' }];

async function runTest(d: Deps, e: Engine, feature: string): Promise<{ score: string; good: boolean; sample: unknown; usage: { model: string; inputTokens: number; outputTokens: number; costMicros: number } }> {
  const day = new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10);
  if (feature === 'invoice') {
    const out = await readInvoice(e, await sampleImage(d, 'invoice'), []);
    const lines = out.data.lines?.length ?? 0, total = Math.round(Number(out.data.total) || 0);
    const good = lines === 4 && total === 84200 && /بغداد/.test(out.data.supplier ?? '');
    return { score: `lines ${lines}/4 · total ${total === 84200 ? '✓' : '✗'} · supplier ${/بغداد/.test(out.data.supplier ?? '') ? '✓' : '✗'}`, good, sample: { supplier: out.data.supplier, total, lines: out.data.lines?.slice(0, 4) }, usage: out };
  }
  if (feature === 'members') {
    const out = await readRegister(e, await sampleImage(d, 'register'), TEST_PLANS, day);
    const rows = toRows(out.data, TEST_PLANS, day);
    const names = REGISTER_TRUTH.filter(([n]) => rows.some((r) => r.name === n)).length, phones = REGISTER_TRUTH.filter(([, p]) => rows.some((r) => r.phone === p)).length;
    return { score: `names ${names}/7 · phones ${phones}/7`, good: names >= 6 && phones >= 6, sample: rows.map((r) => `${r.name} · ${r.phone} · ${r.plan}`), usage: out };
  }
  if (feature === 'ask') {
    const out = await planQuestion(e, 'شكد ربحت اليوم؟');
    const good = out.data.tool === 'summary' && out.data.period === 'today';
    return { score: `${out.data.tool} · ${out.data.period} ${good ? '✓' : '✗'}`, good, sample: out.data, usage: out };
  }
  if (feature === 're_ask') {
    const out = await e.json<any>({ system: ROUTER, text: 'فلل تحت 200 ألف في دريم ستي', schema: ASK_SCHEMA, maxTokens: 200 });
    const good = out.data.tool === 'find_properties' && /villa/i.test(out.data.type ?? '');
    return { score: `${out.data.tool} · ${out.data.type ?? ''} ${good ? '✓' : '✗'}`, good, sample: out.data, usage: out };
  }
  // re_describe: a description that sticks to the facts it's given
  const facts = { type: 'villa', purpose: 'sale', area: 'Dream City', city: 'Erbil', size: 320, bedrooms: 4, bathrooms: 3, features: 'garden, garage, generator line' };
  const out = await e.json<{ text: string }>({ system: DESCRIBE, text: `Mode: write. Language: ar.\nFacts: ${JSON.stringify(facts)}\nAgent's notes: renovated kitchen`, schema: TEXT_SCHEMA, maxTokens: 900 });
  const text = String(out.data.text ?? ''), latin = text.replace(/[٠-٩]/g, (x) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(x)));
  const stray = (latin.match(/\d+/g) ?? []).filter((n) => !['320', '4', '3'].includes(n));
  const good = text.length > 80 && !stray.length;
  return { score: `${text.length} chars · ${stray.length ? `made-up numbers: ${stray.join(', ')}` : 'facts only ✓'}`, good, sample: text.slice(0, 400), usage: out };
}

export function adminAiRoutes(d: Deps) {
  const r = new Hono<AppEnv>();

  /** Everything the AI page shows. */
  r.get('/ai', async (c) => {
    need(c);
    const cfg = await aiConfig(d);
    const from = new Date(Date.now() - 30 * 86400_000).toISOString();
    // the last 30 days of real use, by system, job and model (a business's edition: its subscription, else its kind)
    const usage = rowsOf(await withSystem(d.db, (tx) => tx.execute(sql`select coalesce(s.edition, case when o.metadata like '%"kind":"gym"%' then 'gym' when o.metadata like '%"kind":"realestate"%' then 'realestate'
          when o.metadata like '%"kind":"dental"%' then 'dental' else 'store' end) as edition, u.feature, u.engine, u.model,
        count(*)::int as calls, count(*) filter (where not u.ok)::int as failed, coalesce(avg(u.ms) filter (where u.ok), 0)::int as ms, coalesce(sum(u.cost_micros), 0)::bigint as cost
      from ai_usage u join organization o on o.id = u.organization_id left join hemlo_subscription s on s.organization_id = u.organization_id
      where u.created_at >= ${from} and u.engine <> 'sample' group by 1, 2, 3, 4 order by calls desc`)));
    const def = d.ai ? { provider: d.ai.name === 'claude' ? 'anthropic' : d.ai.name, model: d.ai.model ?? null } : null;
    return c.json({
      providers: [...cfg.providers.values()].map((p) => ({ id: p.def.id, kind: p.def.kind, label: p.def.label, baseUrl: p.def.baseUrl ?? null, keyUrl: p.def.keyUrl ?? null, envKey: p.def.envKey ?? null,
        custom: !!p.def.custom, enabled: p.enabled, source: p.source, hint: p.hint, ready: p.enabled && (p.def.kind === 'workers-ai' ? p.source === 'built-in' : !!p.key) })),
      jobs: AI_JOBS, routes: [...cfg.routes.values()], default: def,
      usage: usage.map((x) => ({ edition: x.edition, feature: x.feature, engine: x.engine, model: x.model, calls: x.calls, failed: x.failed, ms: x.ms, costMicros: Number(x.cost) })),
    });
  });

  /** A provider's models, live: free ones and ones that read images marked, with prices where known. */
  r.get('/ai/models', async (c) => {
    need(c);
    const cfg = await aiConfig(d);
    const p = cfg.providers.get(String(c.req.query('provider') ?? ''));
    if (!p) throw new HttpError(404, 'NO_PROVIDER');
    return c.json(await listModels(d, p));
  });

  /** A provider's key (set, replace, or remove with null), whether it's on, and (one the team added) its name and address. */
  r.put('/ai/providers/:id', async (c) => {
    const staff = need(c);
    const id = c.req.param('id');
    const b = await c.req.json<{ key?: string | null; enabled?: boolean; label?: string; baseUrl?: string }>().catch(() => ({} as Record<string, never>));
    const def = BUILT_IN.find((x) => x.id === id);
    const [row] = await withSystem(d.db, (tx) => tx.select().from(hemloAiProvider).where(eq(hemloAiProvider.id, id)));
    if (!def && !row) throw new HttpError(404, 'NO_PROVIDER');
    const set: Partial<typeof hemloAiProvider.$inferInsert> = { updatedBy: staff.userId, updatedAt: new Date() };
    if (b.key !== undefined) {
      if (def?.kind === 'workers-ai') throw new HttpError(400, 'NO_KEY_NEEDED');
      if (b.key === null || b.key === '') { set.keyEnc = null; set.keyHint = null; }
      else {
        const key = String(b.key).trim();
        if (key.length < 8 || key.length > 400 || /\s/.test(key)) throw new HttpError(400, 'BAD_KEY');
        set.keyEnc = await sealKey(masterSecret(d.env), key); set.keyHint = key.slice(-4);
      }
    }
    if (b.enabled !== undefined) set.enabled = !!b.enabled;
    if (!def && b.label !== undefined) set.label = String(b.label).trim().slice(0, 60) || row!.label;
    if (!def && b.baseUrl !== undefined) { const u = String(b.baseUrl).trim(); if (!/^https:\/\/[^\s]+$/.test(u)) throw new HttpError(400, 'BAD_URL'); set.baseUrl = u.replace(/\/+$/, ''); }
    await withSystem(d.db, (tx) => tx.insert(hemloAiProvider).values({ id, kind: def?.kind ?? row!.kind, label: def?.label ?? row!.label, ...set })
      .onConflictDoUpdate({ target: hemloAiProvider.id, set }));
    forgetAiConfig(); models.delete(id);
    await audit(d.db, { kind: 'admin.ai_provider_changed', userId: staff.userId, detail: { provider: id, key: b.key === undefined ? undefined : b.key ? 'set' : 'removed', enabled: b.enabled } });
    return c.json({ ok: true });
  });

  /** Another OpenAI-compatible service (DeepSeek, Mistral, Together, a local server…): a name, its address, its key. */
  r.post('/ai/providers', async (c) => {
    const staff = need(c);
    const b = await c.req.json<{ label?: string; baseUrl?: string; key?: string }>().catch(() => ({} as Record<string, never>));
    const label = String(b.label ?? '').trim().slice(0, 60), baseUrl = String(b.baseUrl ?? '').trim().replace(/\/+$/, ''), key = String(b.key ?? '').trim();
    if (label.length < 2) throw new HttpError(400, 'BAD_NAME');
    if (!/^https:\/\/[^\s]+$/.test(baseUrl)) throw new HttpError(400, 'BAD_URL');
    if (key && (key.length < 8 || /\s/.test(key))) throw new HttpError(400, 'BAD_KEY');
    const id = `custom-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'service'}`;
    if (!ID.test(id)) throw new HttpError(400, 'BAD_NAME');
    const [taken] = await withSystem(d.db, (tx) => tx.select({ id: hemloAiProvider.id }).from(hemloAiProvider).where(eq(hemloAiProvider.id, id)));
    if (taken) throw new HttpError(409, 'PROVIDER_EXISTS');
    await withSystem(d.db, async (tx) => tx.insert(hemloAiProvider).values({ id, kind: 'openai', label, baseUrl,
      keyEnc: key ? await sealKey(masterSecret(d.env), key) : null, keyHint: key ? key.slice(-4) : null, updatedBy: staff.userId }));
    forgetAiConfig();
    await audit(d.db, { kind: 'admin.ai_provider_added', userId: staff.userId, detail: { provider: id, label, baseUrl } });
    return c.json({ id }, 201);
  });

  /** Remove a provider the team added (not while a job uses it). */
  r.delete('/ai/providers/:id', async (c) => {
    const staff = need(c);
    const id = c.req.param('id');
    if (!id.startsWith('custom-')) throw new HttpError(400, 'BUILT_IN');
    const cfg = await aiConfig(d);
    if ([...cfg.routes.values()].some((x) => x.provider === id || x.fallbackProvider === id)) throw new HttpError(409, 'PROVIDER_IN_USE');
    await withSystem(d.db, (tx) => tx.delete(hemloAiProvider).where(eq(hemloAiProvider.id, id)));
    forgetAiConfig(); models.delete(id);
    await audit(d.db, { kind: 'admin.ai_provider_removed', userId: staff.userId, detail: { provider: id } });
    return c.json({ ok: true });
  });

  /** Choose the model for one job in one system, and one to fall back on. */
  r.put('/ai/routes/:edition/:feature', async (c) => {
    const staff = need(c);
    const { edition, feature } = c.req.param();
    const job = AI_JOBS.find((x) => x.edition === edition && x.feature === feature);
    if (!job) throw new HttpError(404, 'NO_JOB');
    const b = await c.req.json<{ provider?: string; model?: string; fallbackProvider?: string | null; fallbackModel?: string | null; priceIn?: number | null; priceOut?: number | null }>()
      .catch(() => ({} as Record<string, never>));
    const cfg = await aiConfig(d);
    const provider = String(b.provider ?? ''), model = String(b.model ?? '').trim();
    if (!cfg.providers.has(provider)) throw new HttpError(400, 'NO_PROVIDER');
    if (!MODEL.test(model)) throw new HttpError(400, 'BAD_MODEL');
    const fp = b.fallbackProvider ? String(b.fallbackProvider) : null, fm = b.fallbackModel ? String(b.fallbackModel).trim() : null;
    if (fp && (!cfg.providers.has(fp) || !fm || !MODEL.test(fm))) throw new HttpError(400, 'BAD_FALLBACK');
    const price = (v: unknown) => (v == null || v === '' ? null : Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) < 10_000 ? Number(v) : (() => { throw new HttpError(400, 'BAD_PRICE'); })());
    const row = { id: `${edition}:${feature}`, edition, feature, provider, model, fallbackProvider: fp, fallbackModel: fp ? fm : null, priceIn: price(b.priceIn), priceOut: price(b.priceOut), updatedBy: staff.userId, updatedAt: new Date() };
    await withSystem(d.db, (tx) => tx.insert(hemloAiRoute).values(row).onConflictDoUpdate({ target: hemloAiRoute.id, set: row }));
    forgetAiConfig();
    await audit(d.db, { kind: 'admin.ai_route_changed', userId: staff.userId, detail: { job: row.id, provider, model, fallback: fp ? `${fp} · ${fm}` : null } });
    return c.json({ route: row });
  });

  /** Back to the default engine for this job. */
  r.delete('/ai/routes/:edition/:feature', async (c) => {
    const staff = need(c);
    const id = `${c.req.param('edition')}:${c.req.param('feature')}`;
    await withSystem(d.db, (tx) => tx.delete(hemloAiRoute).where(eq(hemloAiRoute.id, id)));
    forgetAiConfig();
    await audit(d.db, { kind: 'admin.ai_route_changed', userId: staff.userId, detail: { job: id, provider: 'default' } });
    return c.json({ ok: true });
  });

  /** Try a model on one job, on a known sample: did it get it right, how long, what it cost. Nothing is saved. */
  r.post('/ai/test', async (c) => {
    need(c);
    const b = await c.req.json<{ provider?: string; model?: string; feature?: string }>().catch(() => ({} as Record<string, never>));
    const job = AI_JOBS.find((x) => x.feature === b.feature);
    if (!job) throw new HttpError(400, 'NO_JOB');
    const cfg = await aiConfig(d);
    const p = cfg.providers.get(String(b.provider ?? ''));
    const model = String(b.model ?? '').trim();
    if (!p) throw new HttpError(400, 'NO_PROVIDER');
    if (!MODEL.test(model)) throw new HttpError(400, 'BAD_MODEL');
    const e = engineOf(d, { ...p, enabled: true }, model);
    if (!e) throw new HttpError(400, p.def.kind === 'workers-ai' ? 'NO_WORKERS_AI' : 'NO_KEY');
    const t0 = Date.now();
    try {
      const out = await runTest(d, e, job.feature);
      return c.json({ ok: true, good: out.good, score: out.score, sample: out.sample, ms: Date.now() - t0, model: out.usage.model, inputTokens: out.usage.inputTokens, outputTokens: out.usage.outputTokens, costMicros: out.usage.costMicros });
    } catch (err) {
      if (err instanceof HttpError) throw err;
      return c.json({ ok: false, error: err instanceof AiError ? err.message.slice(0, 300) : err instanceof Error ? err.message.slice(0, 300) : 'failed', ms: Date.now() - t0 });
    }
  });

  return r;
}
