// Hemlo Connect: the plans, the sandbox, a customer's message answered by the assistant from the agency's real listings
// (and never with a made-up number), a person taking over, "stop", the webhook's signature, the automations (reminders,
// follow-ups, new-listing alerts, rent), the instant reply to a website inquiry, the monthly allowance, and one agency
// never seeing another's chats.
import { describe, it, expect, beforeAll } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { withOrg, withSystem } from '@hemlo/db';
import { hemloAddonEntitlement, reProperty, reLead, reViewing, reContract, connectChannel, connectConversation, connectJob, connectMessage } from '@hemlo/db/schema';
import { newId } from '@hemlo/core';
import { setup, Browser, signInEmail } from './helpers';
import { inventedNumbers, nextRentDue, runOrg, flush, onInquiry, windowOpen, sendingHours } from '../apps/api/src/connect/core';
import { parseWebhook, validSignature, type WaProvider } from '../apps/api/src/connect/wa';
import { fill, isStop } from '../apps/api/src/connect/catalog';
import type { Engine, AskJson } from '../apps/api/src/ai/engine';

const asked: AskJson[] = [];
let next: any = null; // what the fake assistant says next
const fake: Engine = {
  name: 'test',
  async json<T>(req: AskJson) {
    asked.push(req);
    const data = next ?? { reply: 'Happy to help!', handoff: false, refs: [], purpose: '', types: [], areas: [], budgetMax: 0, currency: '', bedrooms: 0, viewingRef: 0, viewingWhen: '', name: '' };
    next = null;
    return { data: data as T, model: 'test', inputTokens: 10, outputTokens: 10, costMicros: 0 };
  },
};
/** A WhatsApp that records what it was asked to send (used by the "meta" channel in these tests). */
const sent: any[] = [];
const recorder: WaProvider = {
  kind: 'meta',
  async send(m) { sent.push(m); return { id: `wamid.${sent.length}` }; },
  async markRead() {}, async templates() { return {}; }, async submitTemplate() {},
};

let t: Awaited<ReturnType<typeof setup>>;
let owner: Browser, org = '', villa = { id: '', ref: 0, slug: '' };
const SECRET = 'meta-app-secret';
const grant = (code: string) => withOrg(t.db, org, (tx) => tx.insert(hemloAddonEntitlement).values({ id: newId(), organizationId: org, addonId: code, edition: 'realestate', status: 'active', billing: 'month', price: 75000 }));
const at = (hours: number) => new Date(Date.now() + hours * 3600_000);
/** The next noon in Baghdad (always after now, so everything stamped "now" is already due by then). */
const NOON = (() => { const b = new Date(Date.now() + 3 * 3600_000); if (b.getUTCHours() >= 12) b.setUTCDate(b.getUTCDate() + 1); b.setUTCHours(12, 0, 0, 0); return new Date(+b - 3 * 3600_000); })();
const daytime = () => NOON;
const fromNoon = (hours: number) => new Date(+NOON + hours * 3600_000);

beforeAll(async () => {
  t = await setup({ META_APP_SECRET: SECRET, META_VERIFY_TOKEN: 'verify-me' }, fake, { wa: (ch) => (ch.provider === 'meta' ? recorder : (undefined as any)) });
  // the sandbox stays the real sandbox: only "meta" channels use the recorder
  const realWa = t.deps.wa!;
  t.deps.wa = (ch) => (ch.provider === 'meta' ? realWa(ch) : { kind: 'sandbox', async send() { return { id: `sandbox.${crypto.randomUUID()}` }; }, async markRead() {}, async templates() { return {}; }, async submitTemplate() {} });
  owner = new Browser(t.app);
  await signInEmail(owner, 'connect-owner@example.com');
  const r = await owner.post('/v1/re/start', { name: 'Nakhla Homes', city: 'Erbil', phone: '07501234567' });
  org = r.json.organizationId;
  await owner.post('/v1/auth/organization/set-active', { organizationId: org });
  await withOrg(t.db, org, async (tx) => {
    const now = new Date();
    const [v] = await tx.insert(reProperty).values({ id: newId(), organizationId: org, ref: 1001, slug: 'villa-abc123', title: 'فيلا في دريم ستي', titleEn: 'Villa in Dream City', type: 'villa', purpose: 'sale',
      status: 'available', publishedAt: now, price: 240000, currency: 'USD', city: 'Erbil', area: 'Dream City', bedrooms: 4, size: 320 }).returning();
    villa = { id: v.id, ref: v.ref, slug: v.slug };
    await tx.insert(reProperty).values({ id: newId(), organizationId: org, ref: 1002, slug: 'apartment-xyz789', title: 'شقة في عنكاوة', titleEn: 'Flat in Ankawa', type: 'apartment', purpose: 'rent',
      status: 'available', publishedAt: now, price: 650, currency: 'USD', rentPeriod: 'month', city: 'Erbil', area: 'Ankawa', bedrooms: 2, size: 120 });
  });
});

describe('the pieces', () => {
  it('fills a template, and knows "stop" in Arabic and English', () => {
    expect(fill('hemlo_viewing_reminder', 'en', ['Ahmed', 'Nakhla', 'the villa', 'Saturday 5 PM'])).toBe('Hello Ahmed, this is Nakhla. A reminder of your viewing of the villa on Saturday 5 PM. Please reply to this message to confirm or change the time.');
    expect(isStop('إيقاف')).toBe(true);
    expect(isStop(' STOP ')).toBe(true);
    expect(isStop('stop by tomorrow?')).toBe(false);
  });
  it('catches a number the assistant made up, and lets through the ones it was given', () => {
    const facts = '#1001 | villa | Dream City | 4 bedrooms | 320 m² | $240,000';
    expect(inventedNumbers('The villa has 4 bedrooms and 320 m².', facts)).toEqual([]);
    expect(inventedNumbers('Only $199,000 this week!', facts)).toEqual(['199000']);
    expect(inventedNumbers('٣٥٠ متر', facts)).toEqual(['350']); // Arabic digits too
  });
  it('finds the next rent date, and none after the lease ends', () => {
    const now = new Date('2026-10-10T09:00:00Z');
    expect(nextRentDue({ start: '2026-01-15', payEvery: 'month' }, now)).toBe('2026-10-15');
    expect(nextRentDue({ start: '2026-01-15', payEvery: 'quarter' }, now)).toBe('2026-10-15');
    expect(nextRentDue({ start: '2026-02-01', payEvery: 'half' }, now)).toBe('2027-02-01');
    expect(nextRentDue({ start: '2025-01-01', end: '2026-06-30', payEvery: 'month' }, now)).toBeNull();
  });
  it('reads a WhatsApp webhook, and checks Meta’s signature', async () => {
    const body = { entry: [{ changes: [{ value: { metadata: { phone_number_id: '555' }, contacts: [{ wa_id: '9647701112233', profile: { name: 'Sara' } }],
      messages: [{ from: '9647701112233', id: 'wamid.A', timestamp: '1790000000', type: 'text', text: { body: 'hi' } }], statuses: [{ id: 'wamid.B', status: 'read' }] } }] }] };
    const p = parseWebhook(body);
    expect(p.messages[0]).toMatchObject({ phoneNumberId: '555', from: '+9647701112233', name: 'Sara', waId: 'wamid.A', text: 'hi' });
    expect(p.statuses[0]).toMatchObject({ waId: 'wamid.B', status: 'read' });
    const raw = JSON.stringify(body);
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig = 'sha256=' + Array.from(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw))), (b) => b.toString(16).padStart(2, '0')).join('');
    expect(await validSignature(SECRET, raw, sig)).toBe(true);
    expect(await validSignature(SECRET, raw + ' ', sig)).toBe(false);
    expect(await validSignature(SECRET, raw, 'sha256=00')).toBe(false);
  });
  it('sends only in the daytime, and writes freely only within 24 hours of the customer', () => {
    expect(sendingHours(new Date('2026-10-10T09:00:00Z'))).toBe(true);  // 12:00 Baghdad
    expect(sendingHours(new Date('2026-10-10T20:00:00Z'))).toBe(false); // 23:00 Baghdad
    expect(windowOpen({ lastInboundAt: at(-23) })).toBe(true);
    expect(windowOpen({ lastInboundAt: at(-25) })).toBe(false);
  });
});

describe('before the plan', () => {
  it('shows both plans with their prices and limits, and nothing works yet', async () => {
    const r = await owner.get('/v1/connect');
    expect(r.status).toBe(200);
    expect(r.json.plan).toBeNull();
    expect(r.json.offers.map((x: any) => [x.code, x.priceMonth])).toEqual([['connect', 35000], ['connect-pro', 75000], ['web-connect', 90000]]);
    expect(r.json.offers[1].limits).toEqual({ messages: 2000, ai: 1500 });
    expect((await owner.post('/v1/connect/channel/sandbox')).status).toBe(402);
  });
});

describe('the assistant (Connect Pro, in the sandbox)', () => {
  beforeAll(async () => {
    await grant('connect-pro');
    const r = await owner.post('/v1/connect/channel/sandbox');
    expect(r.status).toBe(200);
    expect(r.json.channel).toMatchObject({ provider: 'sandbox', status: 'connected', ai: true });
  });

  it('a new customer becomes a lead, and gets an answer from the real listings, with their links', async () => {
    next = { reply: 'أهلاً! عندنا فيلا تناسبك في دريم ستي.', handoff: false, refs: [villa.ref, 9999], purpose: 'sale', types: ['villa'], areas: ['Dream City'], budgetMax: 250000, currency: 'USD', bedrooms: 4, viewingRef: 0, viewingWhen: '', name: 'سارة' };
    const r = await owner.post('/v1/connect/simulate', { text: 'مرحبا، أريد فيلا في دريم ستي بحدود 250 ألف', phone: '+9647701112233', name: 'Sara' });
    expect(r.status).toBe(201);
    expect(asked.at(-1)!.text).toContain('#1001');                 // the model saw the agency's listings…
    expect(asked.at(-1)!.system).toContain('Never invent');
    const chat = (await owner.get(`/v1/connect/conversations/${r.json.conversationId}`)).json;
    expect(chat.messages.map((m: any) => [m.direction, m.author])).toEqual([['in', 'customer'], ['out', 'ai']]);
    expect(chat.messages[1].body).toContain('/p/villa-abc123');      // …and the link is ours, not the model's
    expect(chat.messages[1].body).toContain('$240,000');
    expect(chat.messages[1].body).not.toContain('9999');             // a reference that isn't ours is dropped
    expect(chat.lead).toMatchObject({ name: 'Sara', status: 'new', types: ['villa'], areas: ['Dream City'], budgetMax: 250000, bedrooms: 4 });
    const [lead] = await withOrg(t.db, org, (tx) => tx.select().from(reLead).where(eq(reLead.id, chat.lead.id)));
    expect(lead.source).toBe('whatsapp');
  });

  it('a made-up price is never sent: a person is asked to answer instead', async () => {
    const conv = (await owner.get('/v1/connect/conversations')).json.conversations[0];
    next = { reply: 'This week only $199,000!', handoff: false, refs: [], purpose: '', types: [], areas: [], budgetMax: 0, currency: '', bedrooms: 0, viewingRef: 0, viewingWhen: '', name: '' };
    await owner.post('/v1/connect/simulate', { text: 'any discount?', phone: '+9647701112233' });
    const chat = (await owner.get(`/v1/connect/conversations/${conv.id}`)).json;
    expect(chat.messages.at(-1).body).not.toContain('199');
    expect(chat.messages.at(-1).meta.handoff).toBe(true);
    expect(chat.conversation.handoff).toBe(true);
    // the assistant now stays quiet in this chat until it's handed back
    const before = asked.length;
    await owner.post('/v1/connect/simulate', { text: 'hello?', phone: '+9647701112233' });
    expect(asked.length).toBe(before);
    expect((await owner.req('PATCH', `/v1/connect/conversations/${conv.id}`, { handoff: false })).json.conversation.handoff).toBe(false);
  });

  it('books a viewing request in the agenda, for an agent to confirm', async () => {
    next = { reply: 'تمام، سيؤكد لك زميلنا الموعد.', handoff: false, refs: [], purpose: '', types: [], areas: [], budgetMax: 0, currency: '', bedrooms: 0, viewingRef: villa.ref, viewingWhen: 'السبت 5 العصر', name: '' };
    await owner.post('/v1/connect/simulate', { text: 'أريد أشوفها السبت 5 العصر', phone: '+9647701112233' });
    const v = await withOrg(t.db, org, (tx) => tx.select().from(reViewing).where(eq(reViewing.propertyId, villa.id)));
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({ status: 'requested', preferred: 'السبت 5 العصر', startsAt: null });
  });

  it('an agent answers from the inbox; the assistant steps back', async () => {
    const conv = (await owner.get('/v1/connect/conversations')).json.conversations[0];
    const r = await owner.post(`/v1/connect/conversations/${conv.id}/messages`, { text: 'Saturday 5pm works. See you there.' });
    expect(r.status).toBe(201);
    expect(r.json.message).toMatchObject({ author: 'agent', direction: 'out', kind: 'text' });
    expect((await owner.get(`/v1/connect/conversations/${conv.id}`)).json.conversation.handoff).toBe(true);
  });

  it('"stop" means stop: consent is withdrawn and no automatic message goes to them again', async () => {
    const r = await owner.post('/v1/connect/simulate', { text: 'إيقاف', phone: '+9647701112233' });
    const chat = (await owner.get(`/v1/connect/conversations/${r.json.conversationId}`)).json;
    expect(chat.conversation.optedOut).toBe(true);
    expect(chat.lead.consent).toBe(false);
    expect(chat.messages.at(-1).body).toContain('لن تصلك');
    expect((await owner.post(`/v1/connect/conversations/${r.json.conversationId}/messages`, { text: 'hi' })).json.error).toBe('OPTED_OUT');
  });

  it('lists chats with filters and search, and the overview counts them', async () => {
    expect((await owner.get('/v1/connect/conversations?q=Sara')).json.conversations).toHaveLength(1);
    expect((await owner.get('/v1/connect/conversations?q=nobody')).json.conversations).toHaveLength(0);
    const o = (await owner.get('/v1/connect')).json;
    expect(o.plan).toBe('connect-pro');
    expect(o.used.ai).toBeGreaterThanOrEqual(2);
    expect(o.counts.chats).toBe(1);
    expect(o.recipes.find((x: any) => x.key === 'owner_report')).toMatchObject({ allowed: true, on: false });
  });
});

describe('WhatsApp itself (the webhook)', () => {
  const sign = async (raw: string) => {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    return 'sha256=' + Array.from(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw))), (b) => b.toString(16).padStart(2, '0')).join('');
  };
  const post = async (body: unknown, sig?: string) => {
    const raw = JSON.stringify(body);
    return t.app.request('http://localhost:8787/v1/connect/hook', { method: 'POST', body: raw, headers: { 'content-type': 'application/json', 'x-hub-signature-256': sig ?? await sign(raw) } });
  };
  const msg = (id: string, text: string) => ({ entry: [{ changes: [{ value: { metadata: { phone_number_id: '1234567' }, contacts: [{ wa_id: '9647709990000', profile: { name: 'Omar' } }],
    messages: [{ from: '9647709990000', id, timestamp: String(Math.floor(Date.now() / 1000)), type: 'text', text: { body: text } }] } }] }] });

  beforeAll(async () => {
    await withOrg(t.db, org, (tx) => tx.update(connectChannel).set({ provider: 'meta', phoneNumberId: '1234567', wabaId: '7654321', tokenEnc: 'x', ai: false }).where(eq(connectChannel.organizationId, org)));
  });

  it('answers Meta’s verification, and refuses a wrong token', async () => {
    const ok = await t.app.request('http://localhost:8787/v1/connect/hook?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=42');
    expect(await ok.text()).toBe('42');
    expect((await t.app.request('http://localhost:8787/v1/connect/hook?hub.mode=subscribe&hub.verify_token=no&hub.challenge=42')).status).toBe(403);
  });

  it('refuses an unsigned message, and takes a signed one once (WhatsApp retries)', async () => {
    expect((await post(msg('wamid.X1', 'hi'), 'sha256=bad')).status).toBe(403);
    expect((await post(msg('wamid.X1', 'Is the Ankawa flat free?'))).status).toBe(200);
    expect((await post(msg('wamid.X1', 'Is the Ankawa flat free?'))).status).toBe(200);
    const rows = await withOrg(t.db, org, (tx) => tx.select().from(connectMessage).where(eq(connectMessage.waId, 'wamid.X1')));
    expect(rows).toHaveLength(1);
    // the assistant is off here, so a new chat gets the greeting (instant reply), sent as text inside the 24-hour window
    expect(sent.at(-1)).toMatchObject({ to: '+9647709990000' });
    expect(sent.at(-1).text).toContain('Nakhla Homes');
  });

  it('records delivery and read, never going backwards', async () => {
    const [out] = await withOrg(t.db, org, (tx) => tx.select().from(connectMessage).where(and(eq(connectMessage.organizationId, org), eq(connectMessage.recipe, 'instant_reply'))));
    const status = (s: string) => ({ entry: [{ changes: [{ value: { metadata: { phone_number_id: '1234567' }, statuses: [{ id: out.waId, status: s }] } }] }] });
    await post(status('read'));
    await post(status('delivered'));
    const [m] = await withOrg(t.db, org, (tx) => tx.select().from(connectMessage).where(eq(connectMessage.id, out.id)));
    expect(m.status).toBe('read');
  });
});

describe('the automations', () => {
  let lead = '';
  beforeAll(async () => {
    await withOrg(t.db, org, async (tx) => {
      const [l] = await tx.insert(reLead).values({ id: newId(), organizationId: org, name: 'Ali Hassan', phone: '+9647705550000', whatsapp: '+9647705550000', lang: 'en', consent: true,
        purpose: 'sale', types: ['villa'], areas: ['Dream City'], budgetMax: 260000, bedrooms: 3 }).returning();
      lead = l.id;
      await tx.insert(reViewing).values({ id: newId(), organizationId: org, propertyId: villa.id, leadId: lead, startsAt: fromNoon(20), status: 'scheduled' });
      await tx.insert(reViewing).values({ id: newId(), organizationId: org, propertyId: villa.id, leadId: lead, startsAt: fromNoon(-5), status: 'completed' });
      await tx.insert(reContract).values({ id: newId(), organizationId: org, number: 1, kind: 'rent', status: 'signed', lang: 'en', data: {
        purpose: 'rent', date: '2026-01-01', first: { name: 'Kamal' }, second: { name: 'Zaid Omar', phone: '+9647706660000' }, agency: { name: 'Nakhla Homes' },
        property: { title: 'Flat in Ankawa' }, money: { currency: 'USD', rent: 650, period: 'month', payEvery: 'month', start: new Date(+NOON + 2 * 86400_000 + 3 * 3600_000).toISOString().slice(0, 10) }, clauses: [], witnesses: [] } as any });
    });
    for (const key of ['new_listing', 'rent_due']) expect((await owner.put(`/v1/connect/recipes/${key}`, { enabled: true })).status).toBe(200);
  });

  it('queues each message once and sends it in the daytime: reminder, follow-up, new listing, rent', async () => {
    // templates aren't approved at WhatsApp yet: nothing outside the 24-hour window may go
    const first = await runOrg(t.deps, org, daytime());
    expect(first.queued).toBe(4);
    const jobs = await withOrg(t.db, org, (tx) => tx.select().from(connectJob).where(eq(connectJob.organizationId, org)));
    expect(jobs.map((j) => j.recipe).sort()).toEqual(['new_listing', 'rent_due', 'viewing_followup', 'viewing_reminder']);
    expect(jobs.filter((j) => j.recipe !== 'instant_reply').every((j) => j.status === 'skipped' && j.error === 'TEMPLATE_NOT_APPROVED')).toBe(true);
    expect((await runOrg(t.deps, org, daytime())).queued).toBe(0); // deduped: the same message is never queued twice
  });

  it('once WhatsApp approves the templates, they go out as templates with their blanks filled', async () => {
    const approved = Object.fromEntries(['hemlo_viewing_reminder', 'hemlo_viewing_followup', 'hemlo_new_listing', 'hemlo_rent_due', 'hemlo_inquiry_reply'].flatMap((n) => [[`${n}:en`, { status: 'approved' as const }], [`${n}:ar`, { status: 'approved' as const }]]));
    await withOrg(t.db, org, async (tx) => {
      await tx.update(connectChannel).set({ templates: approved }).where(eq(connectChannel.organizationId, org));
      await tx.update(connectJob).set({ status: 'pending', error: null }).where(eq(connectJob.organizationId, org));
    });
    const before = sent.length;
    const out = await flush(t.deps, org, daytime());
    expect(out.sent).toBe(4);
    const batch = sent.slice(before);
    const reminder = batch.find((m) => m.template === 'hemlo_viewing_reminder');
    expect(reminder).toMatchObject({ to: '+9647705550000', lang: 'en' });
    expect(reminder.params.slice(0, 3)).toEqual(['Ali', 'Nakhla Homes', 'Villa in Dream City']);
    expect(batch.find((m) => m.template === 'hemlo_new_listing').params[4]).toContain('/p/villa-abc123');
    expect(batch.find((m) => m.template === 'hemlo_rent_due')).toMatchObject({ to: '+9647706660000' });
    expect(batch.find((m) => m.template === 'hemlo_rent_due').params[4]).toBe('$650');
    // the inbox shows what the customer read
    const [m] = await withOrg(t.db, org, (tx) => tx.select().from(connectMessage).where(and(eq(connectMessage.organizationId, org), eq(connectMessage.recipe, 'viewing_reminder'))));
    expect(m).toMatchObject({ kind: 'template', author: 'automation' });
    expect(m.body).toContain('Hello Ali, this is Nakhla Homes. A reminder of your viewing of Villa in Dream City');
  });

  it('a website inquiry is answered on WhatsApp within seconds', async () => {
    const [l] = await withOrg(t.db, org, (tx) => tx.insert(reLead).values({ id: newId(), organizationId: org, name: 'Huda Kareem', phone: '+9647707770000', whatsapp: '+9647707770000', lang: 'ar', source: 'website' }).returning());
    const before = sent.length;
    await onInquiry(t.deps, org, l.id, 'فيلا في دريم ستي');
    expect(sent.slice(before)).toEqual([expect.objectContaining({ to: '+9647707770000', template: 'hemlo_inquiry_reply', lang: 'ar', params: ['Huda', 'Nakhla Homes', 'فيلا في دريم ستي'] })]);
    await onInquiry(t.deps, org, l.id, 'فيلا في دريم ستي');
    expect(sent.length).toBe(before + 1); // twice the same day: once
  });

  it('stops at the plan’s monthly allowance', async () => {
    await withOrg(t.db, org, async (tx) => {
      const [conv] = await tx.select().from(connectConversation).where(eq(connectConversation.organizationId, org)).limit(1);
      await tx.insert(connectMessage).values(Array.from({ length: 2000 }, () => ({ id: newId(), organizationId: org, conversationId: conv.id, direction: 'out', author: 'automation', body: 'x', status: 'sent' })));
      await tx.insert(connectJob).values({ id: newId(), organizationId: org, recipe: 'viewing_reminder', dedupe: 'over-the-limit', phone: '+9647705550000', dueAt: new Date(0), payload: { template: 'hemlo_viewing_reminder', lang: 'en', params: ['a', 'b', 'c', 'd'], text: 'x' } });
    });
    await flush(t.deps, org, daytime());
    const [j] = await withOrg(t.db, org, (tx) => tx.select().from(connectJob).where(and(eq(connectJob.organizationId, org), eq(connectJob.dedupe, 'over-the-limit'))));
    expect(j).toMatchObject({ status: 'skipped', error: 'MONTHLY_LIMIT' });
  });

  it('Pro-only automations can’t be switched on with Starter', async () => {
    await withOrg(t.db, org, (tx) => tx.update(hemloAddonEntitlement).set({ addonId: 'connect' }).where(eq(hemloAddonEntitlement.organizationId, org)));
    expect((await owner.put('/v1/connect/recipes/owner_report', { enabled: true })).json.error).toBe('NEEDS_PRO');
    expect((await owner.put('/v1/connect/recipes/viewing_reminder', { enabled: true })).status).toBe(200);
    expect((await owner.get('/v1/connect')).json.plan).toBe('connect');
    await withOrg(t.db, org, (tx) => tx.update(hemloAddonEntitlement).set({ addonId: 'connect-pro' }).where(eq(hemloAddonEntitlement.organizationId, org)));
  });
});

describe('the public demo on hemlohq.com', () => {
  const ask = async (messages: unknown, ip = '10.9.9.9') => {
    const r = await t.app.request('http://localhost:8787/v1/connect/demo', { method: 'POST', body: JSON.stringify({ lang: 'en', messages }),
      headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip, origin: 'http://localhost:4321' } });
    return { status: r.status, json: await r.json() as any };
  };
  it('answers from the sample agency, with our own cards and links, and needs no sign-in', async () => {
    next = { reply: 'Two villas fit what you asked for.', handoff: false, refs: [1001, 4242], purpose: 'sale', types: ['villa'], areas: [], budgetMax: 0, currency: '', bedrooms: 0, viewingRef: 0, viewingWhen: '', name: '' };
    const r = await ask([{ from: 'customer', text: 'Hi, a villa in Dream City?' }]);
    expect(r.status).toBe(200);
    expect(r.json.reply).toBe('Two villas fit what you asked for.');
    expect(r.json.cards).toHaveLength(1); // 4242 isn't one of the sample's homes
    expect(r.json.cards[0].href).toMatch(/^https:\/\/business\.hemlohq\.com\/s\/sample\/properties\//);
    expect(asked.at(-1)!.text).toContain('#1001');
  });
  it('never sends a made-up number, and books nothing it can’t', async () => {
    next = { reply: 'Only $99,999 today!', handoff: false, refs: [1001], purpose: '', types: [], areas: [], budgetMax: 0, currency: '', bedrooms: 0, viewingRef: 0, viewingWhen: '', name: '' };
    const r = await ask([{ from: 'customer', text: 'any discount?' }]);
    expect(r.json.reply).not.toContain('99');
    expect(r.json).toMatchObject({ cards: [], handoff: true });
  });
  it('refuses an empty chat, and slows down a visitor who asks too much', async () => {
    expect((await ask([{ from: 'agency', text: 'hello' }])).status).toBe(400);
    let last = 0;
    for (let i = 0; i < 21; i++) last = (await ask([{ from: 'customer', text: 'hi' }], '10.7.7.7')).status;
    expect(last).toBe(429);
  });
});

describe('privacy', () => {
  it('another agency sees none of these chats, and can’t open one', async () => {
    const other = new Browser(t.app);
    await signInEmail(other, 'other-agency@example.com');
    const r = await other.post('/v1/re/start', { name: 'Other Homes', city: 'Baghdad', phone: '07801234567' });
    await other.post('/v1/auth/organization/set-active', { organizationId: r.json.organizationId });
    expect((await other.get('/v1/connect/conversations')).json.conversations).toEqual([]);
    const [conv] = await withSystem(t.db, (tx) => tx.select().from(connectConversation).where(eq(connectConversation.organizationId, org)).limit(1));
    expect((await other.get(`/v1/connect/conversations/${conv.id}`)).status).toBe(404);
    expect((await other.post('/v1/connect/simulate', { text: 'hi' })).status).toBe(409);
  });
  it('needs a signed-in person', async () => {
    expect((await new Browser(t.app).get('/v1/connect')).status).toBe(401);
  });
});
