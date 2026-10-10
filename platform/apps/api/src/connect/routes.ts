// /v1/connect: Hemlo Connect in the app (the inbox, the automations, connecting WhatsApp), and /v1/connect/hook, the
// webhook WhatsApp calls with every message (signed by Meta; nothing else is accepted). Who sees what:
//   - an agent sees the chats of their own leads and the unassigned ones (like the leads list); managers see all;
//   - connecting WhatsApp, the assistant and the automations are the agency's set-up (agency:configure).
import { Hono, type Context } from 'hono';
import { and, desc, eq, isNull, lt, or, sql, type SQL } from 'drizzle-orm';
import { withOrg } from '@hemlo/db';
import { connectChannel, connectConversation, connectJob, connectMessage, connectRecipe, reLead, CONNECT_RECIPES } from '@hemlo/db/schema';
import { audit } from '@hemlo/auth/audit';
import { HttpError } from '../principal';
import { actor, bad, may, type Actor } from '../routes/sys-common';
import { sealKey, masterSecret, hintOf } from '../ai/keys';
import { LIMITS, RECIPES, TEMPLATES, planAllows, recipeOf, templateDefs } from './catalog';
import { channelByPhoneId, channelOf, deliver, forgetChannel, planOf, providerOf, receive, statusUpdate, windowOpen } from './core';
import { GRAPH, metaWa, parseWebhook, validSignature, WaError } from './wa';
import type { AppEnv, Deps } from '../types';

const rowsOf = (r: any): any[] => (Array.isArray(r) ? r : r?.rows ?? []);
const PAGE = 40;

/** Which chats this person may open: all (managers, the desk), or their leads' and the unassigned ones. */
function scope(a: Actor): SQL | undefined {
  if (may(a.principal, 'leads', 'read-all')) return undefined;
  const mine = (a.principal as any).memberId as string | null;
  return mine ? or(eq(connectConversation.agentId, mine), isNull(connectConversation.agentId)) : isNull(connectConversation.agentId);
}
const canConfigure = (a: Actor) => may(a.principal, 'agency', 'configure');
/** The channel as the app sees it: never the token. */
const publicChannel = (ch: typeof connectChannel.$inferSelect | null) => ch && ({
  provider: ch.provider, status: ch.status, displayPhone: ch.displayPhone, verifiedName: ch.verifiedName, tokenHint: ch.tokenHint, ai: ch.ai,
  persona: ch.persona, templates: ch.templates, error: ch.error, connectedAt: ch.connectedAt,
});

export function connectRoutes(d: Deps) {
  const r = new Hono<AppEnv>();

  // ------------------------------------------------------------------------------------------- the webhook (public)
  /** Meta checks the webhook once, when it's set up: echo its challenge if the token matches. */
  r.get('/hook', (c) => {
    const q = c.req.query();
    if (q['hub.mode'] === 'subscribe' && d.env.META_VERIFY_TOKEN && q['hub.verify_token'] === d.env.META_VERIFY_TOKEN) return c.text(q['hub.challenge'] ?? '');
    return c.text('Forbidden', 403);
  });
  /** Every message in, and every delivery update: signed by Meta, answered at once (the reply is sent after). */
  r.post('/hook', async (c) => {
    const raw = await c.req.text();
    if (!d.env.META_APP_SECRET || !(await validSignature(d.env.META_APP_SECRET, raw, c.req.header('x-hub-signature-256')))) return c.text('Forbidden', 403);
    let body: unknown; try { body = JSON.parse(raw); } catch { return c.text('ok'); }
    const { messages, statuses } = parseWebhook(body);
    for (const m of messages) {
      const ch = await channelByPhoneId(d, m.phoneNumberId);
      if (!ch || ch.status !== 'connected') continue;
      if (!(await planOf(d, ch.organizationId)).plan) continue; // the plan ended: messages wait in WhatsApp itself
      await receive(d, ch, m).catch((e) => console.error('[connect hook]', e instanceof Error ? e.message : e));
    }
    for (const s of statuses) {
      const ch = await channelByPhoneId(d, s.phoneNumberId);
      if (ch) await statusUpdate(d, ch, s.waId, s.status, s.error).catch(() => {});
    }
    return c.text('ok'); // always 200: WhatsApp retries anything else, and a retry is deduped anyway
  });

  // ------------------------------------------------------------------------------------------- the overview
  /** Everything the Connect page needs, in one call: the plan and its use, the number, the automations, what's waiting. */
  r.get('/', async (c) => {
    const a = actor(c, 'leads', 'read');
    const org = a.organizationId;
    const [p, data] = await Promise.all([planOf(d, org), withOrg(d.db, org, async (tx) => {
      const [ch] = await tx.select().from(connectChannel).where(eq(connectChannel.organizationId, org));
      const recipes = await tx.select().from(connectRecipe).where(eq(connectRecipe.organizationId, org));
      const [counts] = rowsOf(await tx.execute(sql`select
          (select count(*) from connect_conversation where organization_id = ${org} and unread > 0)::int as unread,
          (select count(*) from connect_conversation where organization_id = ${org} and handoff and status = 'open')::int as waiting,
          (select count(*) from connect_conversation where organization_id = ${org})::int as chats`));
      const [week] = rowsOf(await tx.execute(sql`select count(*) filter (where status = 'done')::int as sent, count(*) filter (where status = 'pending')::int as pending,
          count(*) filter (where status in ('failed', 'skipped'))::int as missed from connect_job where organization_id = ${org} and created_at > now() - interval '7 days'`));
      return { ch: ch ?? null, recipes, counts, week };
    })]);
    const offer = (code: 'connect' | 'connect-pro') => { const o = p.offers[code]?.offer; return o ? { code, name: o.name, description: o.description, priceMonth: o.priceMonth, priceYear: o.priceYear, limits: LIMITS[code] } : null; };
    return c.json({
      plan: p.plan, limits: p.limits, used: p.used, offers: [offer('connect'), offer('connect-pro')].filter(Boolean),
      canConfigure: canConfigure(a), channel: publicChannel(data.ch),
      signup: d.env.META_APP_ID && d.env.META_CONFIG_ID ? { appId: d.env.META_APP_ID, configId: d.env.META_CONFIG_ID } : null,
      recipes: RECIPES.map((x) => {
        const row = data.recipes.find((y) => y.key === x.key);
        return { key: x.key, plan: x.plan, marketing: !!x.marketing, allowed: planAllows(p.plan, x), on: row ? row.enabled : x.on, settings: row?.settings ?? {},
          template: x.template, approved: !x.template || !data.ch || data.ch.provider !== 'meta' || (['ar', 'en'] as const).some((l) => data.ch!.templates?.[`${x.template}:${l}`]?.status === 'approved') };
      }),
      counts: data.counts, week: data.week,
    });
  });

  // ------------------------------------------------------------------------------------------- the inbox
  r.get('/conversations', async (c) => {
    const a = actor(c, 'leads', 'read');
    const f = c.req.query('filter'), q = (c.req.query('q') ?? '').trim().slice(0, 60), before = c.req.query('before');
    const w: (SQL | undefined)[] = [eq(connectConversation.organizationId, a.organizationId), scope(a)];
    if (f === 'unread') w.push(sql`${connectConversation.unread} > 0`);
    if (f === 'waiting') w.push(and(eq(connectConversation.handoff, true), eq(connectConversation.status, 'open')));
    if (f === 'mine') { const me = (a.principal as any).memberId as string | null; w.push(me ? eq(connectConversation.agentId, me) : sql`false`); }
    if (q) { const t = `%${q.replace(/[%_]/g, '')}%`; w.push(or(sql`${connectConversation.name} ilike ${t}`, sql`${connectConversation.phone} ilike ${t}`, sql`${reLead.name} ilike ${t}`)); }
    if (before && !Number.isNaN(Date.parse(before))) w.push(lt(connectConversation.lastMessageAt, new Date(before)));
    const rows = await withOrg(d.db, a.organizationId, (tx) => tx.select({
      id: connectConversation.id, phone: connectConversation.phone, name: connectConversation.name, leadId: connectConversation.leadId, ownerId: connectConversation.ownerId,
      leadName: reLead.name, leadStatus: reLead.status, agentId: connectConversation.agentId, status: connectConversation.status, handoff: connectConversation.handoff,
      optedOut: connectConversation.optedOut, unread: connectConversation.unread, lastMessageAt: connectConversation.lastMessageAt, lastInboundAt: connectConversation.lastInboundAt, preview: connectConversation.preview,
    }).from(connectConversation).leftJoin(reLead, eq(reLead.id, connectConversation.leadId)).where(and(...w)).orderBy(desc(connectConversation.lastMessageAt)).limit(PAGE));
    return c.json({ conversations: rows.map((x) => ({ ...x, open: windowOpen(x) })), more: rows.length === PAGE });
  });

  const one = async (a: Actor, id: string) => {
    const [conv] = await withOrg(d.db, a.organizationId, (tx) => tx.select().from(connectConversation).where(and(eq(connectConversation.id, id), scope(a))));
    if (!conv) throw new HttpError(404, 'CONVERSATION_NOT_FOUND');
    return conv;
  };

  /** One chat: its messages (newest 80, or older with ?before=), the lead in short, and it's marked read. */
  r.get('/conversations/:id', async (c) => {
    const a = actor(c, 'leads', 'read');
    const conv = await one(a, c.req.param('id'));
    const before = c.req.query('before');
    const out = await withOrg(d.db, a.organizationId, async (tx) => {
      const msgs = await tx.select({ id: connectMessage.id, direction: connectMessage.direction, author: connectMessage.author, kind: connectMessage.kind, body: connectMessage.body,
        recipe: connectMessage.recipe, status: connectMessage.status, error: connectMessage.error, meta: connectMessage.meta, createdAt: connectMessage.createdAt })
        .from(connectMessage).where(and(eq(connectMessage.organizationId, a.organizationId), eq(connectMessage.conversationId, conv.id),
          ...(before && !Number.isNaN(Date.parse(before)) ? [lt(connectMessage.createdAt, new Date(before))] : []))).orderBy(desc(connectMessage.createdAt)).limit(80);
      const [lead] = conv.leadId ? await tx.select({ id: reLead.id, name: reLead.name, status: reLead.status, purpose: reLead.purpose, types: reLead.types, areas: reLead.areas,
        budgetMax: reLead.budgetMax, currency: reLead.currency, bedrooms: reLead.bedrooms, consent: reLead.consent, agentId: reLead.agentId }).from(reLead).where(eq(reLead.id, conv.leadId)) : [];
      if (conv.unread) await tx.update(connectConversation).set({ unread: 0 }).where(eq(connectConversation.id, conv.id));
      return { msgs: msgs.reverse(), lead: lead ?? null };
    });
    return c.json({ conversation: { ...conv, unread: 0, open: windowOpen(conv) }, messages: out.msgs, lead: out.lead, more: out.msgs.length === 80 });
  });

  /** An agent writes: the assistant steps back in this chat (a person took over), until they hand it back. */
  r.post('/conversations/:id/messages', async (c) => {
    const a = actor(c, 'leads', 'update');
    const conv = await one(a, c.req.param('id'));
    const b = await c.req.json<{ text?: string }>().catch(() => ({} as { text?: string }));
    const text = typeof b.text === 'string' ? b.text.trim() : '';
    if (!text || text.length > 4000) bad('BAD_TEXT');
    if (conv.optedOut) throw new HttpError(409, 'OPTED_OUT');
    const ch = await channelOf(d, a.organizationId);
    if (!ch || ch.status !== 'connected') throw new HttpError(409, 'CONNECT_NOT_READY');
    if (!(await planOf(d, a.organizationId)).plan) throw new HttpError(402, 'ADDON_NOT_ACTIVE');
    if (!conv.handoff) await withOrg(d.db, a.organizationId, (tx) => tx.update(connectConversation).set({ handoff: true }).where(eq(connectConversation.id, conv.id)));
    const message = await deliver(d, ch, conv, { author: 'agent', userId: a.userId, text });
    return c.json({ message }, 201);
  });

  /** Hand a chat back to the assistant (or take it), or close it. */
  r.patch('/conversations/:id', async (c) => {
    const a = actor(c, 'leads', 'update');
    const conv = await one(a, c.req.param('id'));
    const b = await c.req.json<{ handoff?: boolean; status?: string }>().catch(() => ({} as any));
    const set: Partial<typeof connectConversation.$inferInsert> = {};
    if (typeof b.handoff === 'boolean') set.handoff = b.handoff;
    if (b.status !== undefined) set.status = b.status === 'closed' ? 'closed' : b.status === 'open' ? 'open' : bad('BAD_STATUS');
    const [row] = await withOrg(d.db, a.organizationId, (tx) => tx.update(connectConversation).set(set).where(eq(connectConversation.id, conv.id)).returning());
    return c.json({ conversation: { ...row, open: windowOpen(row) } });
  });

  // ------------------------------------------------------------------------------------------- set-up
  const configure = (c: Context<AppEnv>) => actor(c, 'agency', 'configure');
  const needPlan = async (org: string) => { const p = await planOf(d, org); if (!p.plan) throw new HttpError(402, 'ADDON_NOT_ACTIVE'); return p; };
  const saveChannel = async (org: string, values: Partial<typeof connectChannel.$inferInsert>) => {
    const [row] = await withOrg(d.db, org, async (tx) => {
      const [cur] = await tx.select({ id: connectChannel.organizationId, phoneNumberId: connectChannel.phoneNumberId }).from(connectChannel).where(eq(connectChannel.organizationId, org));
      if (cur) forgetChannel(cur.phoneNumberId);
      return cur ? tx.update(connectChannel).set({ ...values, updatedAt: new Date() }).where(eq(connectChannel.organizationId, org)).returning()
        : tx.insert(connectChannel).values({ organizationId: org, ...values }).returning();
    }).catch((e) => { if (/connect_channel_phone/.test(String(e?.message) + String(e?.cause?.message))) throw new HttpError(409, 'NUMBER_IN_USE'); throw e; });
    forgetChannel(row.phoneNumberId);
    return row;
  };

  /** Try Connect without a number: everything works, nothing leaves Hemlo (write as a customer with /simulate). */
  r.post('/channel/sandbox', async (c) => {
    const a = configure(c);
    await needPlan(a.organizationId);
    const cur = await channelOf(d, a.organizationId);
    if (cur?.provider === 'meta' && cur.status === 'connected') throw new HttpError(409, 'ALREADY_CONNECTED');
    const row = await saveChannel(a.organizationId, { provider: 'sandbox', status: 'connected', phoneNumberId: null, wabaId: null, tokenEnc: null, tokenHint: null, displayPhone: null, verifiedName: null, error: null, connectedAt: new Date() });
    return c.json({ channel: publicChannel(row) });
  });

  /** Connect a WhatsApp Business number: by Meta's Embedded Signup (a code), or by hand (a system-user token). Checks the
   *  number with Meta, subscribes the webhook, and submits Connect's message templates for approval. */
  r.post('/channel/meta', async (c) => {
    const a = configure(c);
    await needPlan(a.organizationId);
    const b = await c.req.json<{ code?: string; token?: string; phoneNumberId?: string; wabaId?: string; pin?: string }>().catch(() => ({} as any));
    const phoneNumberId = /^\d{5,30}$/.test(String(b.phoneNumberId ?? '')) ? String(b.phoneNumberId) : bad('BAD_PHONE_ID');
    const wabaId = /^\d{5,30}$/.test(String(b.wabaId ?? '')) ? String(b.wabaId) : bad('BAD_WABA_ID');
    let token = typeof b.token === 'string' ? b.token.trim() : '';
    if (b.code) {
      if (!d.env.META_APP_ID || !d.env.META_APP_SECRET) throw new HttpError(503, 'SIGNUP_UNAVAILABLE');
      const res = await fetch(`${GRAPH}/oauth/access_token?client_id=${encodeURIComponent(d.env.META_APP_ID)}&client_secret=${encodeURIComponent(d.env.META_APP_SECRET)}&code=${encodeURIComponent(String(b.code))}`);
      const j: any = await res.json().catch(() => ({}));
      if (!res.ok || !j.access_token) throw new HttpError(400, 'SIGNUP_FAILED', String(j?.error?.message ?? res.status).slice(0, 200));
      token = j.access_token;
    }
    if (!token || token.length < 20 || token.length > 1000) bad('BAD_TOKEN');
    const call = async (path: string, body?: unknown) => {
      const res = await fetch(`${GRAPH}/${path}`, { method: body ? 'POST' : 'GET', headers: { authorization: `Bearer ${token}`, ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
      const j: any = await res.json().catch(() => ({}));
      if (!res.ok || j?.error) throw new HttpError(400, 'WHATSAPP_REJECTED', String(j?.error?.message ?? res.status).slice(0, 200));
      return j;
    };
    const info = await call(`${phoneNumberId}?fields=display_phone_number,verified_name,quality_rating`);
    await call(`${wabaId}/subscribed_apps`, {});
    if (b.code && /^\d{6}$/.test(String(b.pin ?? ''))) await call(`${phoneNumberId}/register`, { messaging_product: 'whatsapp', pin: String(b.pin) }).catch(() => {}); // a number already registered says so; that's fine
    const row = await saveChannel(a.organizationId, { provider: 'meta', status: 'connected', phoneNumberId, wabaId, tokenEnc: await sealKey(masterSecret(d.env), token), tokenHint: hintOf(token),
      displayPhone: info.display_phone_number ?? null, verifiedName: info.verified_name ?? null, error: null, connectedAt: new Date() });
    await audit(d.db, { kind: 'connect.whatsapp_connected', organizationId: a.organizationId, userId: a.userId, detail: { phoneNumberId, wabaId } });
    const templates = await syncTemplates(row).catch(() => row.templates);
    return c.json({ channel: publicChannel({ ...row, templates }) }, 201);
  });

  /** Ask WhatsApp where our templates stand, and submit any that are missing. */
  const syncTemplates = async (ch: typeof connectChannel.$inferSelect) => {
    if (ch.provider !== 'meta') return ch.templates;
    const wa = await providerOf(d, ch);
    const have = await wa.templates();
    const state: typeof ch.templates = {};
    for (const t of templateDefs()) {
      const key = `${t.name}:${t.lang}`, cur = have[key];
      if (!cur) { try { await wa.submitTemplate(t); state[key] = { status: 'pending' }; } catch (e) { state[key] = { status: 'rejected', reason: e instanceof WaError ? e.message : 'SUBMIT_FAILED' }; } }
      else state[key] = { status: cur.status === 'approved' ? 'approved' : cur.status === 'rejected' ? 'rejected' : 'pending', reason: cur.reason ?? null };
    }
    await withOrg(d.db, ch.organizationId, (tx) => tx.update(connectChannel).set({ templates: state, updatedAt: new Date() }).where(eq(connectChannel.organizationId, ch.organizationId)));
    return state;
  };
  r.post('/channel/templates', async (c) => {
    const a = configure(c);
    const ch = await channelOf(d, a.organizationId);
    if (!ch || ch.provider !== 'meta') throw new HttpError(409, 'CONNECT_NOT_READY');
    return c.json({ templates: await syncTemplates(ch) });
  });

  r.delete('/channel', async (c) => {
    const a = configure(c);
    const ch = await channelOf(d, a.organizationId);
    if (!ch) return c.json({ ok: true });
    await saveChannel(a.organizationId, { status: 'off', tokenEnc: null, tokenHint: null, phoneNumberId: null });
    await audit(d.db, { kind: 'connect.disconnected', organizationId: a.organizationId, userId: a.userId, detail: { provider: ch.provider } });
    return c.json({ ok: true });
  });

  /** The assistant on or off, and what it should know about the agency (hours, a few lines, the first greeting). */
  r.patch('/settings', async (c) => {
    const a = configure(c);
    const ch = await channelOf(d, a.organizationId);
    if (!ch) throw new HttpError(409, 'CONNECT_NOT_READY');
    const b = await c.req.json<any>().catch(() => ({}));
    const set: Partial<typeof connectChannel.$inferInsert> = {};
    if (typeof b.ai === 'boolean') set.ai = b.ai;
    if (b.persona !== undefined) {
      const s = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) || null : null);
      set.persona = { greeting: { ar: s(b.persona?.greeting?.ar, 400) ?? undefined, en: s(b.persona?.greeting?.en, 400) ?? undefined }, hours: s(b.persona?.hours, 120), notes: s(b.persona?.notes, 800) };
    }
    const row = await saveChannel(a.organizationId, set);
    return c.json({ channel: publicChannel(row) });
  });

  /** An automation on or off (and its few settings). Only what the plan includes can be switched on. */
  r.put('/recipes/:key', async (c) => {
    const a = configure(c);
    const key = c.req.param('key');
    const recipe = recipeOf(key);
    if (!recipe || !(CONNECT_RECIPES as readonly string[]).includes(key)) throw new HttpError(404, 'NOT_FOUND');
    const b = await c.req.json<{ enabled?: boolean; settings?: Record<string, unknown> }>().catch(() => ({} as any));
    const p = await needPlan(a.organizationId);
    if (b.enabled && !planAllows(p.plan, recipe)) throw new HttpError(402, 'NEEDS_PRO');
    const settings: Record<string, unknown> = {};
    if (key === 'cold_lead' && b.settings?.days != null) { const n = Number(b.settings.days); settings.days = Number.isInteger(n) && n >= 7 && n <= 90 ? n : bad('BAD_DAYS'); }
    const values = { organizationId: a.organizationId, key, enabled: !!b.enabled, settings, updatedAt: new Date() };
    const [row] = await withOrg(d.db, a.organizationId, (tx) => tx.insert(connectRecipe).values(values)
      .onConflictDoUpdate({ target: [connectRecipe.organizationId, connectRecipe.key], set: { enabled: values.enabled, settings, updatedAt: values.updatedAt } }).returning());
    return c.json({ recipe: { key: row.key, on: row.enabled, settings: row.settings } });
  });

  /** What the automations did lately: sent, waiting, or why not. */
  r.get('/activity', async (c) => {
    const a = actor(c, 'leads', 'read');
    const rows = await withOrg(d.db, a.organizationId, (tx) => tx.select({ id: connectJob.id, recipe: connectJob.recipe, phone: connectJob.phone, leadId: connectJob.leadId,
      status: connectJob.status, error: connectJob.error, text: sql<string>`${connectJob.payload}->>'text'`, dueAt: connectJob.dueAt, doneAt: connectJob.doneAt })
      .from(connectJob).where(eq(connectJob.organizationId, a.organizationId)).orderBy(desc(connectJob.createdAt)).limit(60));
    return c.json({ jobs: rows });
  });

  /** The sandbox's customer: write as one, and see Connect answer exactly as it would on WhatsApp. */
  r.post('/simulate', async (c) => {
    const a = configure(c);
    const ch = await channelOf(d, a.organizationId);
    if (!ch || ch.provider !== 'sandbox' || ch.status !== 'connected') throw new HttpError(409, 'SANDBOX_ONLY');
    await needPlan(a.organizationId);
    const b = await c.req.json<{ text?: string; phone?: string; name?: string }>().catch(() => ({} as any));
    const text = typeof b.text === 'string' ? b.text.trim().slice(0, 2000) : '';
    if (!text) bad('BAD_TEXT');
    const phone = /^\+\d{8,15}$/.test(String(b.phone ?? '')) ? String(b.phone) : '+9647700000001';
    const out = await receive(d, ch, { phoneNumberId: 'sandbox', from: phone, name: typeof b.name === 'string' ? b.name.slice(0, 60) : 'Sandbox customer', waId: `sim.${crypto.randomUUID()}`, at: new Date(), type: 'text', text });
    return c.json(out ?? {}, 201);
  });

  return r;
}

export { TEMPLATES, metaWa };
