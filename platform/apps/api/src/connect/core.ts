// Hemlo Connect's engine: messages in, replies out, and the automations. Built to cost almost nothing at rest:
//  - a message in is one transaction (the conversation, the message, the lead); the reply runs after the response;
//  - automations run on the hourly tick, which asks one cheap question first (does anyone use Connect?) and stops there
//    if not, so an idle Hemlo never keeps the database awake;
//  - every automatic message goes through the outbox (connect_job), once: a dedupe key per business means a retry, a
//    second tick or a webhook sent twice can never message a customer twice.
import { and, desc, eq, gte, inArray, isNotNull, isNull, lt, lte, or, sql } from 'drizzle-orm';
import { newId } from '@hemlo/core';
import { withOrg, withSystem, type Database } from '@hemlo/db';
import { connectChannel, connectConversation, connectJob, connectMessage, connectRecipe, reContract, reLead, reOwner, reProperty, reReport, reViewing, type ConnectRecipeKey } from '@hemlo/db/schema';
import { addonsActive } from '../addons';
import { openKey, masterSecret } from '../ai/keys';
import { AiError, type JsonSchema } from '../ai/engine';
import { engineFor } from '../ai/router';
import { snapshot, overBudget, record, baghdadStarts, DEFAULT_BUDGET_USD } from '../ai/meter';
import { activity, notice, priceText, settingsOf, SITE, token, typeName } from '../routes/realestate/common';
import { asWants, cardCols } from '../routes/realestate/properties';
import { matchOf, rank, MATCHABLE } from '../routes/realestate/match';
import { HttpError } from '../principal';
import { LIMITS, PLAN_CODES, RECIPES, TEMPLATES, fill, isStart, isStop, planAllows, recipeOf, type PlanCode } from './catalog';
import { metaWa, sandboxWa, WaError, type WaInbound, type WaProvider } from './wa';
import type { Deps } from '../types';

export type Channel = typeof connectChannel.$inferSelect;
type Conversation = typeof connectConversation.$inferSelect;
const rowsOf = (r: any): any[] => (Array.isArray(r) ? r : r?.rows ?? []);
const DAY = 86400_000, WINDOW = DAY;
const arabic = (s: string) => /[؀-ۿ]/.test(s);

// ---------------------------------------------------------------------------------------------------------- the plan
/** Which Connect plan is on (Pro wins over Starter), its monthly limits, and how much of them is used. */
export async function planOf(d: Deps, org: string) {
  const [map, used] = await Promise.all([addonsActive(d.db, org, PLAN_CODES), usageOf(d.db, org)]);
  const plan: PlanCode | null = map['connect-pro']?.active ? 'connect-pro' : map.connect?.active ? 'connect' : null;
  return { plan, limits: plan ? LIMITS[plan] : { messages: 0, ai: 0 }, used, offers: map };
}
/** This month (Baghdad): messages Hemlo started, and the assistant's replies. One indexed count. */
export async function usageOf(db: Database, org: string) {
  const { month } = baghdadStarts();
  const [r] = rowsOf(await withOrg(db, org, (tx) => tx.execute(sql`select
      count(*) filter (where author = 'automation' and status <> 'failed' and coalesce(recipe, '') <> 'opt_out' and not (coalesce(recipe, '') = 'instant_reply' and kind = 'text'))::int as messages, count(*) filter (where author = 'ai')::int as ai
    from connect_message where organization_id = ${org} and created_at >= ${month.toISOString()}`)));
  return { messages: Number(r?.messages ?? 0), ai: Number(r?.ai ?? 0) };
}

// ---------------------------------------------------------------------------------------------------------- sending
/** The way out for this business: WhatsApp itself, or the sandbox. (Tests may hand in their own.) */
export async function providerOf(d: Deps, ch: Channel): Promise<WaProvider> {
  if (d.wa) return d.wa(ch);
  if (ch.provider !== 'meta') return sandboxWa();
  const tokenText = await openKey(masterSecret(d.env), ch.tokenEnc);
  if (!tokenText || !ch.phoneNumberId) throw new HttpError(409, 'CONNECT_NOT_READY');
  return metaWa({ token: tokenText, phoneNumberId: ch.phoneNumberId, wabaId: ch.wabaId });
}
export const windowOpen = (c: Pick<Conversation, 'lastInboundAt'>, now = Date.now()) => !!c.lastInboundAt && now - +c.lastInboundAt < WINDOW;
const approved = (ch: Channel, name: string, lang: string) => ch.provider !== 'meta' || ch.templates?.[`${name}:${lang}`]?.status === 'approved';

type Out = { text: string; template?: { name: string; lang: 'ar' | 'en'; params: string[] }; author: 'agent' | 'ai' | 'automation'; userId?: string | null; recipe?: string | null; meta?: Record<string, unknown> };
/** One message to one customer: free text inside WhatsApp's 24-hour window, else its approved template. Saved either way. */
export async function deliver(d: Deps, ch: Channel, conv: Conversation, out: Out, wa?: WaProvider) {
  const p = wa ?? await providerOf(d, ch);
  const open = windowOpen(conv);
  if (!open && !out.template) throw new HttpError(409, 'WINDOW_CLOSED');
  if (!open && !approved(ch, out.template!.name, out.template!.lang)) throw new HttpError(409, 'TEMPLATE_NOT_APPROVED');
  const viaTemplate = !open;
  let waId: string | null = null, error: string | null = null;
  try { waId = (await p.send(viaTemplate ? { to: conv.phone, template: out.template!.name, lang: out.template!.lang, params: out.template!.params } : { to: conv.phone, text: out.text })).id; }
  catch (e) { error = e instanceof Error ? e.message.slice(0, 300) : 'SEND_FAILED'; }
  const now = new Date();
  const [m] = await withOrg(d.db, conv.organizationId, async (tx) => {
    const row = await tx.insert(connectMessage).values({ id: newId(), organizationId: conv.organizationId, conversationId: conv.id, direction: 'out', author: out.author,
      userId: out.userId ?? null, kind: viaTemplate ? 'template' : 'text', body: out.text, template: viaTemplate ? out.template!.name : null, recipe: out.recipe ?? null,
      status: error ? 'failed' : 'sent', waId, error, meta: out.meta ?? {}, createdAt: now }).returning();
    if (!error) await tx.update(connectConversation).set({ lastMessageAt: now, preview: out.text.slice(0, 160), ...(out.author === 'agent' ? { unread: 0 } : {}) }).where(eq(connectConversation.id, conv.id));
    return row;
  });
  if (error) throw new HttpError(503, 'WHATSAPP_FAILED', error);
  return m;
}

// ---------------------------------------------------------------------------------------------------------- the channel
/** The channel a webhook belongs to, by WhatsApp's phone-number id. Remembered for a minute per server. */
const byPhoneId = new Map<string, { at: number; ch: Channel | null }>();
export const forgetChannel = (phoneNumberId?: string | null) => { if (phoneNumberId) byPhoneId.delete(phoneNumberId); else byPhoneId.clear(); };
export async function channelByPhoneId(d: Deps, phoneNumberId: string) {
  const hit = byPhoneId.get(phoneNumberId);
  if (hit && Date.now() - hit.at < 60_000) return hit.ch;
  const [ch] = await withSystem(d.db, (tx) => tx.select().from(connectChannel).where(eq(connectChannel.phoneNumberId, phoneNumberId)));
  byPhoneId.set(phoneNumberId, { at: Date.now(), ch: ch ?? null });
  return ch ?? null;
}
export async function channelOf(d: Deps, org: string) {
  const [ch] = await withOrg(d.db, org, (tx) => tx.select().from(connectChannel).where(eq(connectChannel.organizationId, org)));
  return ch ?? null;
}
async function recipesOn(tx: Database, org: string) {
  const rows = await tx.select().from(connectRecipe).where(eq(connectRecipe.organizationId, org));
  return new Map(RECIPES.map((r) => { const row = rows.find((x) => x.key === r.key); return [r.key, { on: row ? row.enabled : r.on, settings: row?.settings ?? {} }]; }));
}

// ---------------------------------------------------------------------------------------------------------- in
/** The conversation for a phone, made (with its lead) if it's someone new. A known owner is linked as an owner. */
async function conversationFor(tx: Database, org: string, phone: string, name: string | null, lang: 'ar' | 'en') {
  const [found] = await tx.select().from(connectConversation).where(and(eq(connectConversation.organizationId, org), eq(connectConversation.phone, phone)));
  if (found) return { conv: found, isNew: false };
  const [lead] = await tx.select({ id: reLead.id, agentId: reLead.agentId }).from(reLead)
    .where(and(eq(reLead.organizationId, org), isNull(reLead.archivedAt), or(eq(reLead.phone, phone), eq(reLead.whatsapp, phone)))).orderBy(desc(reLead.updatedAt)).limit(1);
  const [owner] = lead ? [] : await tx.select({ id: reOwner.id, agentId: reOwner.agentId }).from(reOwner)
    .where(and(eq(reOwner.organizationId, org), isNull(reOwner.archivedAt), or(eq(reOwner.phone, phone), eq(reOwner.whatsapp, phone)))).limit(1);
  let leadId = lead?.id ?? null;
  if (!lead && !owner) {
    leadId = newId();
    await tx.insert(reLead).values({ id: leadId, organizationId: org, name: name || phone, phone, whatsapp: phone, lang, source: 'whatsapp', lastContactAt: new Date() });
    await activity(tx, org, 'lead.whatsapp', { leadId });
    await notice(tx, org, 'lead_new', { leadId }, { source: 'whatsapp' });
  }
  const [conv] = await tx.insert(connectConversation).values({ id: newId(), organizationId: org, phone, name, leadId, ownerId: owner?.id ?? null, agentId: lead?.agentId ?? owner?.agentId ?? null })
    .onConflictDoNothing().returning();
  if (conv) return { conv, isNew: true };
  const [again] = await tx.select().from(connectConversation).where(and(eq(connectConversation.organizationId, org), eq(connectConversation.phone, phone)));
  return { conv: again, isNew: false };
}

/** A customer's message: saved once (WhatsApp retries webhooks), the chat and the lead brought up to date, then answered. */
export async function receive(d: Deps, ch: Channel, m: WaInbound) {
  const org = ch.organizationId, lang = arabic(m.text) ? 'ar' : 'en';
  const out = await withOrg(d.db, org, async (tx) => {
    const { conv, isNew } = await conversationFor(tx, org, m.from, m.name, lang);
    const [msg] = await tx.insert(connectMessage).values({ id: newId(), organizationId: org, conversationId: conv.id, direction: 'in', author: 'customer',
      kind: m.type === 'text' ? 'text' : 'other', body: m.text, status: 'received', waId: m.waId, meta: m.type === 'text' ? {} : { type: m.type }, createdAt: m.at }).onConflictDoNothing().returning({ id: connectMessage.id });
    if (!msg) return null; // seen already
    const stop = isStop(m.text), start = isStart(m.text);
    const [c] = await tx.update(connectConversation).set({ unread: sql`${connectConversation.unread} + 1`, lastInboundAt: m.at, lastMessageAt: m.at, preview: m.text.slice(0, 160) || `[${m.type}]`,
      status: 'open', ...(m.name ? { name: m.name } : {}), ...(stop ? { optedOut: true } : start ? { optedOut: false } : {}) }).where(eq(connectConversation.id, conv.id)).returning();
    if (conv.leadId) await tx.update(reLead).set({ lastContactAt: m.at, ...(stop ? { consent: false } : start ? { consent: true } : {}) }).where(eq(reLead.id, conv.leadId));
    // the agent hears of a chat when it starts waiting on them (not on every message)
    if (conv.unread === 0 && (c.handoff || !ch.ai)) await notice(tx, org, 'message', { leadId: conv.leadId, agentId: conv.agentId }, { conversationId: conv.id, preview: m.text.slice(0, 120) });
    return { conv: c, isNew, stop, start };
  });
  if (!out) return null;
  const { conv } = out;
  if (out.stop || out.start) {
    const ar = lang === 'ar';
    await deliver(d, ch, conv, { author: 'automation', recipe: 'opt_out', text: out.stop
      ? (ar ? 'تم. لن تصلك منا رسائل تلقائية بعد الآن. لإعادة الاشتراك أرسل: اشتراك' : 'Done. You will not get automatic messages from us again. To subscribe again, send: start')
      : (ar ? 'أهلاً بعودتك. ستصلك منا العروض المناسبة لك.' : 'Welcome back. We will send you listings that suit you.') }).catch(() => {});
    return { conversationId: conv.id };
  }
  const run = () => respond(d, ch, conv.id, out.isNew);
  if (d.later) d.later(run); else await run();
  return { conversationId: conv.id };
}

/** After a message in: the assistant answers (Pro), or a new chat gets a greeting (instant reply on). Never both. */
async function respond(d: Deps, ch: Channel, conversationId: string, isNew: boolean) {
  const replied = await aiReply(d, ch, conversationId).catch((e) => { console.error('[connect ai]', e instanceof Error ? e.message : e); return false; });
  if (replied || !isNew) return;
  const [conv, recipes] = await withOrg(d.db, ch.organizationId, async (tx) => [
    (await tx.select().from(connectConversation).where(eq(connectConversation.id, conversationId)))[0], await recipesOn(tx, ch.organizationId)] as const);
  if (!conv || conv.optedOut || !recipes.get('instant_reply')?.on) return;
  const { plan } = await planOf(d, ch.organizationId);
  if (!plan) return;
  const name = await businessName(d, ch.organizationId), ar = arabic(conv.preview ?? '') || !conv.preview;
  const greeting = (ar ? ch.persona?.greeting?.ar : ch.persona?.greeting?.en)
    || (ar ? `أهلاً بك في ${name}. وصلت رسالتك وسيرد عليك أحد مستشارينا قريباً.` : `Welcome to ${name}. We got your message and one of our advisers will reply shortly.`);
  await deliver(d, ch, conv, { author: 'automation', recipe: 'instant_reply', text: greeting }).catch(() => {});
}

const orgNames = new Map<string, { at: number; name: string }>();
async function businessName(d: Deps, org: string) {
  const hit = orgNames.get(org);
  if (hit && Date.now() - hit.at < 300_000) return hit.name;
  const [r] = rowsOf(await withSystem(d.db, (tx) => tx.execute(sql`select name from organization where id = ${org}`)));
  const name = String(r?.name ?? 'Hemlo');
  orgNames.set(org, { at: Date.now(), name });
  return name;
}

/** Delivery updates for messages out (sent → delivered → read, or failed). Never goes backwards. */
export async function statusUpdate(d: Deps, ch: Channel, waId: string, status: string, error: string | null) {
  const rank = ['sent', 'delivered', 'read'];
  if (status !== 'failed' && !rank.includes(status)) return;
  await withOrg(d.db, ch.organizationId, (tx) => tx.update(connectMessage).set({ status, ...(error ? { error } : {}) })
    .where(and(eq(connectMessage.waId, waId), status === 'failed' ? sql`true` : inArray(connectMessage.status, rank.slice(0, rank.indexOf(status))))));
}

// ---------------------------------------------------------------------------------------------------------- the assistant
export const REPLY_SCHEMA: JsonSchema = {
  type: 'object', additionalProperties: false, required: ['reply', 'handoff', 'refs', 'purpose', 'types', 'areas', 'budgetMax', 'currency', 'bedrooms', 'viewingRef', 'viewingWhen', 'name'],
  properties: {
    reply: { type: 'string' }, handoff: { type: 'boolean' }, refs: { type: 'array', items: { type: 'integer' } },
    purpose: { type: 'string' }, types: { type: 'array', items: { type: 'string' } }, areas: { type: 'array', items: { type: 'string' } },
    budgetMax: { type: 'integer' }, currency: { type: 'string' }, bedrooms: { type: 'integer' },
    viewingRef: { type: 'integer' }, viewingWhen: { type: 'string' }, name: { type: 'string' },
  },
};
export type Reply = { reply: string; handoff: boolean; refs: number[]; purpose: string; types: string[]; areas: string[]; budgetMax: number; currency: string; bedrooms: number; viewingRef: number; viewingWhen: string; name: string };

export const ASSISTANT = (agency: string, persona: Channel['persona']) => `You are the WhatsApp assistant of ${agency}, a real-estate agency in Iraq. You answer its customers.
Rules that never bend:
- Reply in the customer's language (Iraqi-friendly Arabic, English, or Kurdish if they write Kurdish). Warm, short (under 70 words), one question at a time, no emojis.
- Use ONLY the listings and facts given. Never invent a property, a price, a size, an address, a discount or a promise. Never state a price yourself: the listing cards you pick carry it.
- To show listings, put their reference numbers in "refs" (at most 3, only from the list). Say a word about why they fit.
- Learn what they want, gently: buy or rent, area, type, budget, bedrooms. Put what they said in purpose/types/areas/budgetMax/currency/bedrooms (0 or "" or [] when not said).
- If they want to see a listing and give a day or time, set viewingRef and viewingWhen (their words) and say an agent will confirm the time.
- If they ask for a person, negotiate, complain, ask about legal papers, or ask anything the facts don't answer: set handoff true and say a colleague will reply shortly.
- If they tell you their name, put it in "name".
${persona?.hours ? `Office hours: ${persona.hours}.\n` : ''}${persona?.notes ? `About the agency (from the owner): ${persona.notes.slice(0, 600)}\n` : ''}Return JSON only.`;

/** Numbers in a reply that aren't in what the model was given (a made-up price or size): such a reply is not sent. */
export function inventedNumbers(reply: string, facts: string) {
  const known = new Set((facts.match(/\d[\d,.]*/g) ?? []).map((x) => x.replace(/[,.]/g, '')));
  return (reply.replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x660)).match(/\d[\d,.]{1,}/g) ?? []).map((x) => x.replace(/[,.]/g, '')).filter((x) => x.length >= 2 && !known.has(x));
}

/** The assistant's answer to the latest message, or false when it may not answer (plan, quota, a person took over…). */
export async function aiReply(d: Deps, ch: Channel, conversationId: string): Promise<boolean> {
  const org = ch.organizationId;
  if (!ch.ai) return false;
  const { plan, limits, used } = await planOf(d, org);
  if (plan !== 'connect-pro' || used.ai >= limits.ai) return false;
  const ctx = await withOrg(d.db, org, async (tx) => {
    const [conv] = await tx.select().from(connectConversation).where(eq(connectConversation.id, conversationId));
    if (!conv || conv.handoff || conv.optedOut || !windowOpen(conv)) return null;
    const msgs = (await tx.select().from(connectMessage).where(and(eq(connectMessage.organizationId, org), eq(connectMessage.conversationId, conv.id)))
      .orderBy(desc(connectMessage.createdAt)).limit(14)).reverse();
    const last = msgs[msgs.length - 1];
    if (!last || last.direction !== 'in') return null; // answered already
    const [lead] = conv.leadId ? await tx.select().from(reLead).where(eq(reLead.id, conv.leadId)) : [];
    const s = await settingsOf(tx, org);
    const wants = lead ? asWants(lead) : null;
    const pool = await tx.select(cardCols).from(reProperty).where(and(eq(reProperty.organizationId, org), isNotNull(reProperty.publishedAt), inArray(reProperty.status, MATCHABLE),
      ...(wants?.purpose && lead?.status !== 'new' ? [eq(reProperty.purpose, wants.purpose)] : []))).orderBy(desc(reProperty.publishedAt)).limit(400);
    const asNum = pool.map((p) => ({ ...p, price: p.price == null ? null : Number(p.price) }));
    const known = wants && (wants.types.length || wants.areas.length || wants.budgetMax != null || wants.bedrooms != null);
    const list = (known ? rank(wants!, asNum, s.usdRate, 40).map((x) => x.p) : asNum).slice(0, 8);
    return { conv, msgs, last, lead: lead ?? null, list, s };
  });
  if (!ctx) return false;
  const [snap, engine] = await Promise.all([snapshot(d.db, org), engineFor(d, 'realestate', 'connect_reply')]);
  if (snap.off || !engine) return false;
  if (engine.paid && await overBudget(d.db, Number(d.env.AI_BUDGET_USD) || DEFAULT_BUDGET_USD)) return false;
  const agency = await businessName(d, org);
  const ar = arabic(ctx.last.body);
  const facts = ctx.list.map((p) => `#${p.ref} | ${typeName(p.type, 'en')} for ${p.purpose} | ${[p.area, p.city].filter(Boolean).join(', ')} | ${p.bedrooms ?? '-'} bedrooms | ${p.size ?? '-'} m² | ${priceText(p.price, p.currency, 'en', p.purpose === 'rent' ? p.rentPeriod : null)}`).join('\n');
  const chat = ctx.msgs.map((m) => `${m.direction === 'in' ? 'Customer' : 'Agency'}: ${m.body.slice(0, 600)}`).join('\n');
  const text = `Listings available now (the only ones you may mention):\n${facts || '(none listed yet)'}\n\n${ctx.lead ? `What we know of this customer: ${ctx.lead.purpose === 'rent' ? 'wants to rent' : 'wants to buy'}${ctx.lead.areas?.length ? `, areas: ${ctx.lead.areas.join(', ')}` : ''}${ctx.lead.types?.length ? `, types: ${ctx.lead.types.join(', ')}` : ''}${ctx.lead.budgetMax ? `, budget up to ${ctx.lead.budgetMax} ${ctx.lead.currency}` : ''}.\n\n` : ''}The conversation so far:\n${chat}\n\nWrite the agency's next reply.`;
  const t0 = Date.now();
  let out: Reply;
  try {
    const r = await engine.json<Reply>({ system: ASSISTANT(agency, ch.persona), text, schema: REPLY_SCHEMA, maxTokens: 700 });
    out = r.data;
    await record(d.db, org, { userId: null, feature: 'connect_reply', engine: engine.name, model: r.model, inputTokens: r.inputTokens, outputTokens: r.outputTokens, costMicros: r.costMicros, ms: Date.now() - t0, ok: true, counted: false });
  } catch (e) {
    await record(d.db, org, { userId: null, feature: 'connect_reply', engine: engine.name, ms: Date.now() - t0, ok: false, counted: false }).catch(() => {});
    if (!(e instanceof AiError)) console.error('[connect ai]', e instanceof Error ? e.message : e);
    return false;
  }
  const reply = String(out?.reply ?? '').trim().slice(0, 1200);
  const invented = inventedNumbers(reply, `${facts}\n${chat}`);
  let handoff = !!out?.handoff || !reply || invented.length > 0;
  const picks = (Array.isArray(out?.refs) ? out.refs : []).map(Number).map((ref) => ctx.list.find((p) => p.ref === ref)).filter(Boolean).slice(0, 3) as typeof ctx.list;
  const lang = ar ? 'ar' : 'en';
  const cards = picks.map((p) => `▫️ ${lang === 'en' ? p.titleEn || p.title : p.title} · ${priceText(p.price, p.currency, lang, p.purpose === 'rent' ? p.rentPeriod : null)}\n${SITE(d)}/p/${p.slug}`).join('\n\n');
  const safe = ar ? 'شكراً لرسالتك. سيرد عليك أحد زملائنا بعد قليل.' : 'Thank you for your message. A colleague will reply shortly.';
  const body = invented.length || !reply ? safe : cards ? `${reply}\n\n${cards}` : reply;

  // nothing new since we started thinking? (a second message, or an agent who answered) then this answer is stale
  const fresh = await withOrg(d.db, org, async (tx) => {
    const [latest] = await tx.select({ id: connectMessage.id }).from(connectMessage).where(and(eq(connectMessage.organizationId, org), eq(connectMessage.conversationId, ctx.conv.id)))
      .orderBy(desc(connectMessage.createdAt)).limit(1);
    const [c] = await tx.select({ handoff: connectConversation.handoff }).from(connectConversation).where(eq(connectConversation.id, ctx.conv.id));
    return latest?.id === ctx.last.id && !c?.handoff;
  });
  if (!fresh) return true;

  await withOrg(d.db, org, async (tx) => {
    const lead = ctx.lead;
    if (lead) {
      // only fill in what we didn't know: the assistant never overwrites what an agent wrote
      const set: Partial<typeof reLead.$inferInsert> = {};
      if (out.purpose === 'rent' || out.purpose === 'sale') { if (lead.status === 'new' && lead.purpose !== out.purpose) set.purpose = out.purpose; }
      if (!lead.types?.length && Array.isArray(out.types) && out.types.length) set.types = out.types.filter((x) => typeof x === 'string').slice(0, 4).map((x) => x.toLowerCase().slice(0, 30));
      if (!lead.areas?.length && Array.isArray(out.areas) && out.areas.length) set.areas = out.areas.filter((x) => typeof x === 'string').slice(0, 5).map((x) => x.slice(0, 60));
      if (lead.budgetMax == null && Number.isSafeInteger(out.budgetMax) && out.budgetMax > 0) { set.budgetMax = out.budgetMax; if (out.currency === 'IQD' || out.currency === 'USD') set.currency = out.currency; }
      if (lead.bedrooms == null && Number.isInteger(out.bedrooms) && out.bedrooms > 0 && out.bedrooms < 20) set.bedrooms = out.bedrooms;
      if (out.name && (lead.name === lead.phone || lead.name === ctx.conv.phone)) set.name = String(out.name).slice(0, 80);
      if (Object.keys(set).length) await tx.update(reLead).set({ ...set, updatedAt: new Date() }).where(eq(reLead.id, lead.id));
      const v = ctx.list.find((p) => p.ref === Number(out.viewingRef));
      if (v && out.viewingWhen) {
        const [viewing] = await tx.insert(reViewing).values({ id: newId(), organizationId: org, propertyId: v.id, leadId: lead.id, agentId: lead.agentId ?? v.agentId ?? null,
          startsAt: null, status: 'requested', source: 'public', preferred: String(out.viewingWhen).slice(0, 120), notes: 'WhatsApp · Hemlo Connect' }).returning({ id: reViewing.id });
        await notice(tx, org, 'request', { leadId: lead.id, propertyId: v.id, viewingId: viewing.id, agentId: lead.agentId ?? v.agentId ?? null }, { via: 'connect', preferred: out.viewingWhen });
        handoff = true; // a person confirms the time
      }
    }
    if (handoff) {
      await tx.update(connectConversation).set({ handoff: true }).where(eq(connectConversation.id, ctx.conv.id));
      await notice(tx, org, 'message', { leadId: ctx.conv.leadId, agentId: ctx.conv.agentId }, { conversationId: ctx.conv.id, preview: ctx.last.body.slice(0, 120), handoff: true });
    }
  });
  const wa = await providerOf(d, ch);
  await deliver(d, ch, { ...ctx.conv }, { author: 'ai', text: body, meta: { refs: picks.map((p) => p.ref), handoff } }, wa);
  if (ctx.last.waId) await wa.markRead(ctx.last.waId).catch(() => {});
  return true;
}

// ---------------------------------------------------------------------------------------------------------- automations
type JobIn = { recipe: ConnectRecipeKey; dedupe: string; phone: string; leadId?: string | null; ownerId?: string | null; lang: 'ar' | 'en'; template: string; params: string[]; dueAt?: Date };
async function queue(tx: Database, org: string, jobs: JobIn[], now = new Date()) {
  if (!jobs.length) return 0;
  const rows = await tx.insert(connectJob).values(jobs.map((j) => ({ id: newId(), organizationId: org, recipe: j.recipe, dedupe: j.dedupe, phone: j.phone, leadId: j.leadId ?? null, ownerId: j.ownerId ?? null,
    payload: { template: j.template, lang: j.lang, params: j.params, text: fill(j.template, j.lang, j.params) }, dueAt: j.dueAt ?? now }))).onConflictDoNothing().returning({ id: connectJob.id });
  return rows.length;
}
const L = (x: string | null | undefined): 'ar' | 'en' => (x === 'en' ? 'en' : 'ar');
const when = (at: Date, lang: 'ar' | 'en') => new Intl.DateTimeFormat(lang === 'ar' ? 'ar-IQ-u-nu-latn' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Baghdad' }).format(at);
const titleOf = (p: { title: string; titleEn?: string | null }, lang: 'ar' | 'en') => (lang === 'en' ? p.titleEn || p.title : p.title);
const first = (name: string | null | undefined) => (name ?? '').trim().split(/\s+/)[0] || '';

/** Each automation decides what is due now. All bounded, all deduped, none sends by itself (the outbox does). */
const GENERATORS: Partial<Record<ConnectRecipeKey, (tx: Database, org: string, agency: string, now: Date, settings: Record<string, unknown>, d: Deps) => Promise<JobIn[]>>> = {
  async viewing_reminder(tx, org, agency, now) {
    const rows = await tx.select({ id: reViewing.id, startsAt: reViewing.startsAt, name: reLead.name, phone: reLead.phone, wa: reLead.whatsapp, lang: reLead.lang, title: reProperty.title, titleEn: reProperty.titleEn })
      .from(reViewing).innerJoin(reLead, eq(reLead.id, reViewing.leadId)).innerJoin(reProperty, eq(reProperty.id, reViewing.propertyId))
      .where(and(eq(reViewing.organizationId, org), inArray(reViewing.status, ['scheduled', 'confirmed']), gte(reViewing.startsAt, new Date(+now + 3600_000)), lte(reViewing.startsAt, new Date(+now + 26 * 3600_000)))).limit(200);
    return rows.filter((r) => r.wa || r.phone).map((r) => { const lang = L(r.lang); return { recipe: 'viewing_reminder', dedupe: `viewing_reminder:${r.id}:${r.startsAt!.toISOString()}`, phone: (r.wa || r.phone)!,
      lang, template: 'hemlo_viewing_reminder', params: [first(r.name), agency, titleOf(r, lang), when(r.startsAt!, lang)], dueAt: new Date(Math.max(+now, +r.startsAt! - DAY)) } as JobIn; });
  },
  async viewing_followup(tx, org, agency, now) {
    const rows = await tx.select({ id: reViewing.id, leadId: reViewing.leadId, name: reLead.name, phone: reLead.phone, wa: reLead.whatsapp, lang: reLead.lang, title: reProperty.title, titleEn: reProperty.titleEn })
      .from(reViewing).innerJoin(reLead, eq(reLead.id, reViewing.leadId)).innerJoin(reProperty, eq(reProperty.id, reViewing.propertyId))
      .where(and(eq(reViewing.organizationId, org), inArray(reViewing.status, ['scheduled', 'confirmed', 'completed']), isNull(reViewing.outcome),
        gte(reViewing.startsAt, new Date(+now - 26 * 3600_000)), lte(reViewing.startsAt, new Date(+now - 2 * 3600_000)))).limit(200);
    return rows.filter((r) => r.wa || r.phone).map((r) => { const lang = L(r.lang); return { recipe: 'viewing_followup', dedupe: `viewing_followup:${r.id}`, phone: (r.wa || r.phone)!, leadId: r.leadId,
      lang, template: 'hemlo_viewing_followup', params: [first(r.name), agency, titleOf(r, lang)] } as JobIn; });
  },
  async new_listing(tx, org, agency, now, _s, d) {
    const fresh = await tx.select(cardCols).from(reProperty).where(and(eq(reProperty.organizationId, org), isNotNull(reProperty.publishedAt), eq(reProperty.status, 'available'),
      gte(reProperty.publishedAt, new Date(+now - 3 * DAY)))).limit(20);
    if (!fresh.length) return [];
    const s = await settingsOf(tx, org);
    const leads = await tx.select().from(reLead).where(and(eq(reLead.organizationId, org), isNull(reLead.archivedAt), eq(reLead.consent, true), inArray(reLead.status, ['new', 'active', 'viewing', 'negotiating']))).limit(3000);
    // at most one alert per buyer every three days, however many homes come in
    const recent = new Set((await tx.select({ leadId: connectJob.leadId }).from(connectJob).where(and(eq(connectJob.organizationId, org), eq(connectJob.recipe, 'new_listing'), gte(connectJob.createdAt, new Date(+now - 3 * DAY))))).map((x) => x.leadId));
    const out: JobIn[] = [];
    for (const p of fresh) {
      const facts = { ...p, price: p.price == null ? null : Number(p.price) };
      const fits = leads.map((l) => ({ l, m: matchOf(asWants(l), facts, s.usdRate) })).filter((x) => x.m && x.m.score >= 70 && !recent.has(x.l.id)).sort((a, b) => b.m!.score - a.m!.score).slice(0, 25);
      for (const { l } of fits) {
        const phone = l.whatsapp || l.phone; if (!phone) continue;
        const lang = L(l.lang);
        recent.add(l.id);
        out.push({ recipe: 'new_listing', dedupe: `new_listing:${p.id}:${l.id}`, phone, leadId: l.id, lang, template: 'hemlo_new_listing',
          params: [first(l.name), agency, titleOf(p, lang), priceText(facts.price, p.currency, lang, p.purpose === 'rent' ? p.rentPeriod : null), `${SITE(d)}/p/${p.slug}`] });
      }
    }
    return out;
  },
  async cold_lead(tx, org, agency, now, settings) {
    const days = Math.min(90, Math.max(7, Number(settings.days) || 21));
    const rows = await tx.select({ id: reLead.id, name: reLead.name, phone: reLead.phone, wa: reLead.whatsapp, lang: reLead.lang, purpose: reLead.purpose, types: reLead.types, areas: reLead.areas })
      .from(reLead).where(and(eq(reLead.organizationId, org), isNull(reLead.archivedAt), eq(reLead.consent, true), inArray(reLead.status, ['new', 'active']),
        lt(reLead.lastContactAt, new Date(+now - days * DAY)),
        sql`not exists (select 1 from connect_job j where j.organization_id = ${org} and j.lead_id = ${reLead.id} and j.recipe = 'cold_lead' and j.created_at > ${new Date(+now - 60 * DAY).toISOString()})`)).limit(30);
    return rows.filter((r) => r.wa || r.phone).map((r) => {
      const lang = L(r.lang), what = `${r.types?.[0] ? typeName(r.types[0], lang) : lang === 'ar' ? 'عقار' : 'a property'}${r.areas?.[0] ? (lang === 'ar' ? ` في ${r.areas[0]}` : ` in ${r.areas[0]}`) : ''}`;
      return { recipe: 'cold_lead', dedupe: `cold_lead:${r.id}:${now.toISOString().slice(0, 7)}`, phone: (r.wa || r.phone)!, leadId: r.id, lang, template: 'hemlo_cold_lead', params: [first(r.name), agency, what] } as JobIn;
    });
  },
  async owner_report(tx, org, agency, now, _s, d) {
    const b = new Date(+now + 3 * 3600_000);
    if (b.getUTCDate() !== 1 || b.getUTCHours() < 10) return []; // the first of the month, from 10 in the morning
    const from = new Date(Date.UTC(b.getUTCFullYear(), b.getUTCMonth() - 1, 1)).toISOString().slice(0, 10), to = new Date(Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), 1)).toISOString().slice(0, 10);
    const rows = rowsOf(await tx.execute(sql`select p.id, p.title, p.title_en, o.id as owner_id, o.name, coalesce(o.whatsapp, o.phone) as phone, o.lang,
        coalesce((select sum(views) from re_stat s where s.organization_id = ${org} and s.property_id = p.id and s.day >= ${from} and s.day < ${to}), 0)::int as views,
        coalesce((select sum(wa + calls + requests) from re_stat s where s.organization_id = ${org} and s.property_id = p.id and s.day >= ${from} and s.day < ${to}), 0)::int as contacts,
        (select count(*) from re_viewing v where v.organization_id = ${org} and v.property_id = p.id and v.starts_at >= ${from}::date and v.starts_at < ${to}::date)::int as viewings
      from re_property p join re_owner o on o.id = p.owner_id
      where p.organization_id = ${org} and p.published_at is not null and p.status in ('available', 'negotiating', 'reserved') and o.archived_at is null and coalesce(o.whatsapp, o.phone) is not null
      limit 300`));
    const month = to.slice(0, 7), out: JobIn[] = [];
    for (const r of rows) {
      const lang = L(r.lang), t = token(12);
      await tx.insert(reReport).values({ id: newId(), organizationId: org, token: t, propertyId: r.id, ownerId: r.owner_id, note: null, createdBy: null, expiresAt: new Date(+now + 45 * DAY) });
      out.push({ recipe: 'owner_report', dedupe: `owner_report:${r.id}:${month}`, phone: r.phone, ownerId: r.owner_id, lang, template: 'hemlo_owner_report',
        params: [first(r.name), agency, lang === 'en' ? r.title_en || r.title : r.title, String(r.views), String(r.contacts), String(r.viewings), `${SITE(d)}/r/${t}`] });
    }
    return out;
  },
  async rent_due(tx, org, agency, now) {
    const rows = await tx.select({ id: reContract.id, lang: reContract.lang, data: reContract.data }).from(reContract)
      .where(and(eq(reContract.organizationId, org), eq(reContract.kind, 'rent'), eq(reContract.status, 'signed'))).limit(500);
    const out: JobIn[] = [];
    for (const r of rows) {
      const due = nextRentDue(r.data.money, now);
      const phone = r.data.second?.phone;
      if (!due || !phone || +new Date(`${due}T00:00:00+03:00`) - +now > 3 * DAY) continue;
      const lang = L(r.lang), amount = r.data.money.rent == null ? '-' : priceText(r.data.money.rent * periodsOf(r.data.money.payEvery, r.data.money.period), r.data.money.currency, lang);
      out.push({ recipe: 'rent_due', dedupe: `rent_due:${r.id}:${due}`, phone, lang, template: 'hemlo_rent_due',
        params: [first(r.data.second.name), agency, r.data.property?.title || (lang === 'ar' ? 'العقار' : 'the property'), due, amount] });
    }
    return out;
  },
};

/** The next rent date on or after today, from the lease's start and how often it is paid; none after the lease ends. */
export function nextRentDue(m: { start?: string | null; end?: string | null; payEvery?: string | null }, now: Date): string | null {
  if (!m.start || !/^\d{4}-\d{2}-\d{2}$/.test(m.start)) return null;
  const step = { month: 1, quarter: 3, half: 6, year: 12 }[m.payEvery ?? 'month'] ?? 1;
  const today = new Date(+now + 3 * 3600_000).toISOString().slice(0, 10);
  const [y, mo, da] = m.start.split('-').map(Number);
  for (let i = 0; i < 600; i += step) {
    const d = new Date(Date.UTC(y, mo - 1 + i, Math.min(da, 28))).toISOString().slice(0, 10);
    if (m.end && d > m.end) return null;
    if (d >= today) return d;
  }
  return null;
}
/** Monthly rent × months per payment (a yearly rent is already one payment a year). */
const periodsOf = (payEvery?: string | null, period?: string | null) => (period === 'year' ? 1 : ({ month: 1, quarter: 3, half: 6, year: 12 }[payEvery ?? 'month'] ?? 1));

/** Baghdad 9:00–21:00: an automatic message never arrives at night. */
export const sendingHours = (now: Date) => { const h = new Date(+now + 3 * 3600_000).getUTCHours(); return h >= 9 && h < 21; };

/** Send what's due for one business: within its plan's monthly allowance, never to someone who said stop. */
export async function flush(d: Deps, org: string, now = new Date(), limit = 60, only?: ConnectRecipeKey) {
  const ch = await channelOf(d, org);
  if (!ch || ch.status !== 'connected') return { sent: 0, skipped: 0, failed: 0 };
  const { plan, limits, used } = await planOf(d, org);
  const jobs = await withOrg(d.db, org, (tx) => tx.select().from(connectJob).where(and(eq(connectJob.organizationId, org), eq(connectJob.status, 'pending'), lte(connectJob.dueAt, now), ...(only ? [eq(connectJob.recipe, only)] : [])))
    .orderBy(connectJob.dueAt).limit(limit));
  if (!jobs.length) return { sent: 0, skipped: 0, failed: 0 };
  const wa = await providerOf(d, ch);
  const recipes = await withOrg(d.db, org, (tx) => recipesOn(tx, org));
  let room = limits.messages - used.messages, sent = 0, skipped = 0, failed = 0;
  for (const j of jobs) {
    const recipe = recipeOf(j.recipe);
    const finish = (status: 'done' | 'skipped' | 'failed', error: string | null = null) => withOrg(d.db, org, (tx) => tx.update(connectJob)
      .set({ status, error, doneAt: new Date(), tries: j.tries + 1 }).where(eq(connectJob.id, j.id)));
    if (!recipe || !planAllows(plan, recipe) || !recipes.get(recipe.key)?.on) { await finish('skipped', 'OFF'); skipped++; continue; }
    if (room <= 0) { await finish('skipped', 'MONTHLY_LIMIT'); skipped++; continue; }
    const { conv } = await withOrg(d.db, org, (tx) => conversationFor(tx, org, j.phone, null, j.payload.lang));
    if (conv.optedOut) { await finish('skipped', 'OPTED_OUT'); skipped++; continue; }
    try {
      await deliver(d, ch, conv, { author: 'automation', recipe: j.recipe, text: j.payload.text, template: { name: j.payload.template, lang: j.payload.lang, params: j.payload.params } }, wa);
      await finish('done'); sent++; room--;
    } catch (e) {
      const code = e instanceof HttpError ? e.code : 'SEND_FAILED';
      if (code === 'TEMPLATE_NOT_APPROVED' || code === 'WINDOW_CLOSED' || j.tries >= 2) { await finish(code === 'TEMPLATE_NOT_APPROVED' ? 'skipped' : 'failed', code); failed++; }
      else { await withOrg(d.db, org, (tx) => tx.update(connectJob).set({ tries: j.tries + 1, error: code, dueAt: new Date(+now + (j.tries + 1) * 15 * 60_000) }).where(eq(connectJob.id, j.id))); failed++; }
    }
  }
  return { sent, skipped, failed };
}

/** One business's automations: decide what's due, then send it (in the daytime). */
export async function runOrg(d: Deps, org: string, now = new Date()) {
  const { plan } = await planOf(d, org);
  if (!plan) return { queued: 0, sent: 0 };
  const agency = await businessName(d, org);
  const queued = await withOrg(d.db, org, async (tx) => {
    const recipes = await recipesOn(tx, org);
    let n = 0;
    for (const r of RECIPES) {
      const gen = GENERATORS[r.key];
      if (!gen || !planAllows(plan, r) || !recipes.get(r.key)?.on) continue;
      n += await queue(tx, org, await gen(tx, org, agency, now, recipes.get(r.key)!.settings, d), now);
    }
    return n;
  });
  const out = sendingHours(now) ? await flush(d, org, now) : { sent: 0 };
  return { queued, sent: out.sent };
}

/** The hourly tick, for every business on Connect. One small query when nobody is. */
export async function tick(d: Deps, now = new Date()) {
  const orgs = rowsOf(await withSystem(d.db, (tx) => tx.execute(sql`select organization_id from connect_channel where status = 'connected' limit 5000`))).map((r) => String(r.organization_id));
  let queued = 0, sent = 0;
  for (const org of orgs) {
    try { const r = await runOrg(d, org, now); queued += r.queued; sent += r.sent; }
    catch (e) { console.error('[connect tick]', org, e instanceof Error ? e.message : e); }
  }
  return { businesses: orgs.length, queued, sent };
}

/** A website inquiry: the customer hears back on WhatsApp within seconds (the inquiry-reply template, or the assistant). */
export async function onInquiry(d: Deps, org: string, leadId: string, about: string | null) {
  const ch = await channelOf(d, org);
  if (!ch || ch.status !== 'connected') return;
  const { plan } = await planOf(d, org);
  if (!plan) return;
  const job = await withOrg(d.db, org, async (tx) => {
    if (!(await recipesOn(tx, org)).get('instant_reply')?.on) return 0;
    const [l] = await tx.select().from(reLead).where(eq(reLead.id, leadId));
    const phone = l?.whatsapp || l?.phone;
    if (!l || !phone) return 0;
    const lang = L(l.lang), agency = await businessName(d, org);
    return queue(tx, org, [{ recipe: 'instant_reply', dedupe: `instant_reply:${leadId}:${new Date().toISOString().slice(0, 10)}`, phone, leadId, lang, template: 'hemlo_inquiry_reply',
      params: [first(l.name), agency, about || (lang === 'ar' ? 'عقاراتنا' : 'our listings')] }]);
  });
  if (job) await flush(d, org, new Date(), 5, 'instant_reply'); // they just wrote to us: any hour is fine
}

export { TEMPLATES };
