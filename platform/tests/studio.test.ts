// Hemlo AI Studio, the agent's AI tools in Connect Pro, one business with its own AI model, and Hemlo's costs and margins:
// every limit checked on the server, images only on a model the team chose and priced, video refused until a provider
// that makes video exists, and a cost that isn't entered reported as unknown.
import { describe, it, expect, beforeAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { withOrg } from '@hemlo/db';
import { hemloAddonEntitlement, reProperty, aiUsage, connectConversation } from '@hemlo/db/schema';
import { newId } from '@hemlo/core';
import { setup, Browser, signInEmail } from './helpers';
import { engineFor, forgetAiConfig } from '../apps/api/src/ai/router';
import { forgetCosts } from '../apps/api/src/costs';
import type { Engine, AskJson } from '../apps/api/src/ai/engine';

const asked: AskJson[] = [];
const fake: Engine = {
  name: 'test', model: 'test-model',
  async json<T>(req: AskJson) {
    asked.push(req);
    const data = /campaign/i.test(req.system)
      ? { headline: { ar: 'فيلا بحديقة في دريم ستي', en: 'A garden villa in Dream City' },
          ar: { whatsapp: 'فيلا 4 غرف في دريم ستي بسعر $240,000. تحب تشوفها؟', instagram: 'فيلا بحديقة', facebook: 'فيلا بحديقة في دريم ستي', hashtags: ['أربيل'] },
          en: { whatsapp: 'A 4-bedroom villa in Dream City at $240,000. Would you like to see it?', instagram: 'Garden villa', facebook: 'A garden villa in Dream City', hashtags: ['Erbil'] } }
      : /plan social media/i.test(req.system) ? { weeks: [{ title: 'Week 1', posts: [{ day: 'Saturday', channel: 'instagram', idea: 'The Dream City villa', ref: 1001 }] }, { title: 'Week 2', posts: [] }] }
      : { text: 'Hello Sara, the villa is still available. Would Saturday suit you for a viewing?' };
    return { data: data as T, model: 'test-model', inputTokens: 10, outputTokens: 10, costMicros: 0 };
  },
};
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...new Array(200).fill(7)]).toString('base64');
const drew: string[] = [];

let t: Awaited<ReturnType<typeof setup>>;
let founder: Browser, owner: Browser, org = '', villa = '';
const grant = (code: string, price: number) => withOrg(t.db, org, (tx) => tx.insert(hemloAddonEntitlement).values({ id: newId(), organizationId: org, addonId: code, edition: 'realestate', status: 'active', billing: 'month', price }));

beforeAll(async () => {
  forgetAiConfig(); forgetCosts();
  t = await setup({ AI: { async run(_model: string, input: any) { drew.push(String(input.prompt)); return { image: PNG }; } } } as any, fake);
  founder = new Browser(t.app);
  await signInEmail(founder, 'founder@hemlohq.com');
  await t.client.query(`update "user" set role = 'admin' where email = 'founder@hemlohq.com'`);
  await signInEmail(founder, 'founder@hemlohq.com');
  owner = new Browser(t.app);
  await signInEmail(owner, 'studio-owner@example.com');
  org = (await owner.post('/v1/re/start', { name: 'Nakhla Homes', city: 'Erbil', phone: '07501234567' })).json.organizationId;
  await owner.post('/v1/auth/organization/set-active', { organizationId: org });
  villa = await withOrg(t.db, org, async (tx) => (await tx.insert(reProperty).values({ id: newId(), organizationId: org, ref: 1001, slug: 'villa-abc123', title: 'فيلا في دريم ستي', titleEn: 'Villa in Dream City',
    type: 'villa', purpose: 'sale', status: 'available', publishedAt: new Date(), price: 240000, currency: 'USD', city: 'Erbil', area: 'Dream City', bedrooms: 4, size: 320 }).returning())[0].id);
});

describe('AI Studio', () => {
  it('is for AI Studio only, checked on the server', async () => {
    expect((await owner.post('/v1/studio/campaign', { propertyIds: [villa] })).status).toBe(402);
    await grant('ai-studio', 50000);
    expect((await owner.get('/v1/studio')).json).toMatchObject({ active: true, allowance: { copy: 200, images: 60, videos: 0 }, used: { copy: 0 }, tools: { copy: true, image: false, video: false } });
  });

  it('writes a campaign in Arabic and English from the listing’s facts only, and checks its numbers', async () => {
    const r = await owner.post('/v1/studio/campaign', { propertyIds: [villa], goal: 'sell', channels: ['whatsapp', 'instagram'] });
    expect(r.status).toBe(200);
    expect(r.json.campaign.en.whatsapp).toContain('$240,000');
    expect(r.json.checked).toBe(true);
    expect(asked.at(-1)!.text).toContain('#1001');
    expect(asked.at(-1)!.schema).toMatchObject({ properties: { ar: { required: ['whatsapp', 'instagram', 'hashtags'] } } });
    expect((await owner.post('/v1/studio/campaign', { propertyIds: [] })).json.error).toBe('PICK_LISTINGS');
    const plan = await owner.post('/v1/studio/plan', { weeks: 1 });
    expect(plan.json.plan.weeks).toHaveLength(1);
    expect((await owner.get('/v1/studio')).json.used.copy).toBe(2);
  });

  it('stops at the month’s allowance', async () => {
    await withOrg(t.db, org, (tx) => tx.insert(aiUsage).values(Array.from({ length: 198 }, () => ({ id: newId(), organizationId: org, userId: null, feature: 'studio_copy', engine: 'test', ms: 1, ok: true, counted: false, createdAt: new Date(Date.now() - 2 * 86400_000) }))));
    expect((await owner.post('/v1/studio/campaign', { propertyIds: [villa] })).json.error).toBe('STUDIO_ALLOWANCE_USED');
  });

  it('draws post images only on a model the team chose; a paid one needs the dollar rate, and counts what it cost', async () => {
    expect((await owner.post('/v1/studio/image', { prompt: 'a villa at sunset' })).json.error).toBe('IMAGE_PROVIDER_MISSING');
    const set = await founder.req('PUT', '/v1/admin/ai/routes/realestate/studio_image', { provider: 'workers-ai', model: '@cf/black-forest-labs/flux-1-schnell', priceIn: 0.004 });
    expect(set.status).toBe(200);
    expect((await owner.get('/v1/studio')).json.tools.image).toBe(true);
    expect((await owner.post('/v1/studio/image', { prompt: 'a villa at sunset' })).json.error).toBe('COSTS_NOT_SET');
    expect((await founder.req('PUT', '/v1/admin/costs', { usdIqd: 1500, mediaBudgetUsd: 10, waRates: { IQ: { marketing: 45, utility: 10, service: 0 }, other: { marketing: 45, utility: 10, service: 0 } } })).status).toBe(200);
    const img = await owner.post('/v1/studio/image', { propertyId: villa, prompt: 'golden hour', style: 'luxury' });
    expect(img.status).toBe(201);
    expect(img.json.file.url).toMatch(/\/v1\/files\//);
    expect(drew.at(-1)).toMatch(/villa in Dream City, Erbil, Iraq, 4 bedrooms\. golden hour\. No text/i);
    const [u] = await withOrg(t.db, org, (tx) => tx.select().from(aiUsage).where(eq(aiUsage.feature, 'studio_image')));
    expect(u).toMatchObject({ kind: 'image', costMicros: 4000, ok: true });
    expect((await owner.post('/v1/studio/video', { prompt: 'a tour' })).json.error).toBe('VIDEO_PROVIDER_MISSING');
  });
});

describe('Connect Pro’s AI tools for the agent', () => {
  let conv = '';
  beforeAll(async () => {
    expect((await owner.post('/v1/connect/channel/sandbox')).status).toBe(200);
    conv = (await owner.post('/v1/connect/simulate', { text: 'Is the Dream City villa still available?', phone: '+9647701112233', name: 'Sara' })).json.conversationId;
  });
  it('suggest a reply and summarise the chat, counted with the assistant; paused at the day’s limit until midnight', async () => {
    const s = await owner.post(`/v1/connect/conversations/${conv}/assist`, { mode: 'suggest' });
    expect(s.status).toBe(200);
    expect(s.json.text).toContain('Saturday');
    expect((await owner.post(`/v1/connect/conversations/${conv}/assist`, { mode: 'summary', lang: 'en' })).status).toBe(200);
    await withOrg(t.db, org, (tx) => tx.insert(aiUsage).values(Array.from({ length: 60 }, () => ({ id: newId(), organizationId: org, userId: null, feature: 'connect_assist', engine: 'test', ms: 1, ok: true, counted: false }))));
    const paused = await owner.post(`/v1/connect/conversations/${conv}/assist`, { mode: 'suggest' });
    expect([paused.status, paused.json.error]).toEqual([429, 'AI_PAUSED']);
    const o = (await owner.get('/v1/connect')).json;
    expect(o.ai).toMatchObject({ open: false, reason: 'day' });
    expect(new Date(o.ai.resetsAt).getTime()).toBeGreaterThan(Date.now());
    // the assistant stays quiet too: a new message waits for a person
    const before = (await withOrg(t.db, org, (tx) => tx.select().from(connectConversation).where(eq(connectConversation.id, conv))))[0];
    await owner.post('/v1/connect/simulate', { text: 'Hello?', phone: '+9647701112233' });
    const msgs = (await owner.get(`/v1/connect/conversations/${conv}`)).json.messages;
    expect(msgs.at(-1)).toMatchObject({ direction: 'in', body: 'Hello?' });
    expect(before).toBeTruthy();
  });
});

describe('one business, its own model', () => {
  it('a model set for one business wins over its system’s, for that business only', async () => {
    const r = await founder.req('PUT', `/v1/admin/ai/routes/realestate/studio_copy?org=${org}`, { provider: 'workers-ai', model: '@cf/meta/llama-4-scout-17b-16e-instruct' });
    expect(r.status).toBe(200);
    expect(r.json.route).toMatchObject({ id: `org:${org}:studio_copy`, organizationId: org });
    expect((await engineFor(t.deps, 'realestate', 'studio_copy', org))?.model).toBe('@cf/meta/llama-4-scout-17b-16e-instruct');
    expect((await engineFor(t.deps, 'realestate', 'studio_copy', 'someone-else'))?.name).toBe('test');
    expect((await founder.get('/v1/admin/ai')).json.routes.find((x: any) => x.organizationId === org)).toMatchObject({ business: 'Nakhla Homes' });
    expect((await founder.get('/v1/admin/ai/businesses?edition=realestate')).json.businesses).toEqual(expect.arrayContaining([{ id: org, name: 'Nakhla Homes' }]));
    expect((await founder.req('DELETE', `/v1/admin/ai/routes/realestate/studio_copy?org=${org}`)).status).toBe(200);
    expect((await engineFor(t.deps, 'realestate', 'studio_copy', org))?.name).toBe('test');
  });
});

describe('costs and margins', () => {
  it('puts each business’s revenue next to what it cost, and says which costs are still unknown', async () => {
    const m = (await founder.get('/v1/admin/margins')).json;
    expect(m.target).toBe(15);
    expect(m.missing).toEqual(['infraIqd']);
    const b = m.businesses.find((x: any) => x.id === org);
    expect(b).toMatchObject({ addons: 'ai-studio', revenue: 50000, costs: { media: 6, infra: null }, unknown: ['infraIqd'] }); // $0.004 × 1,500
    expect(b.margin).toBeGreaterThan(99);
    await founder.req('PUT', '/v1/admin/costs', { usdIqd: 1500, infraIqd: 45000, mediaBudgetUsd: 10, waRates: { IQ: { marketing: 45, utility: 10, service: 0 } } });
    const after = (await founder.get('/v1/admin/margins')).json.businesses.find((x: any) => x.id === org);
    expect(after).toMatchObject({ below: true, unknown: [] }); // 45,000 of running costs on 50,000: under 15%
    expect((await owner.get('/v1/admin/margins')).status).toBe(403);
  });
  it('lets the team change a tier’s price and limits; a price of 0 means free with the System', async () => {
    const r = await founder.req('PATCH', '/v1/admin/addons/connect-pro', { priceMonth: 39000, limits: { aiDay: 80, aiWeek: 400, aiMonth: 1200, waIqd: 12000, waMarketingPct: 40, sendsDay: 300 } });
    expect(r.json.addon).toMatchObject({ priceMonth: 39000, limits: { aiDay: 80 } });
    expect((await founder.req('PATCH', '/v1/admin/addons/connect-pro', { limits: { aiDay: -1 } })).status).toBe(400);
    expect((await new Browser(t.app).get('/v1/plans/addons?edition=realestate')).json.addons.find((x: any) => x.code === 'connect-pro')).toMatchObject({ priceMonth: 39000 });
  });
});
