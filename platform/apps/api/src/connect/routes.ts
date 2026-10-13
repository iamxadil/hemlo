// /v1/connect: Hemlo Connect in the app (the inbox, the automations, connecting WhatsApp), and /v1/connect/hook, the
// webhook WhatsApp calls with every message (signed by Meta; nothing else is accepted). Who sees what:
//   - an agent sees the chats of their own leads and the unassigned ones (like the leads list); managers see all;
//   - connecting WhatsApp, the assistant and the automations are the agency's set-up (agency:configure).
// A shop (any system without leads) uses the shared connect:read / reply / configure permissions instead, and every
// chat is visible to whoever may read Connect.
import { Hono, type Context } from 'hono';
import { and, desc, eq, isNull, lt, or, sql, type SQL } from 'drizzle-orm';
import { withOrg } from '@hemlo/db';
import { newId } from '@hemlo/core';
import { connectChannel, connectConversation, connectJob, connectMessage, connectRecipe, reLead, shopOrder, sysCustomer, sysProduct, CONNECT_RECIPES } from '@hemlo/db/schema';
import { audit } from '@hemlo/auth/audit';
import { HttpError } from '../principal';
import { actor, bad, may, type Actor } from '../routes/sys-common';
import { sealKey, masterSecret, hintOf } from '../ai/keys';
import { isFree, limitsOf } from '../addons';
import { PLAN_CODES, TEMPLATES, hasAi, planAllows, recipeOf, recipesFor, templateDefs } from './catalog';
import { channelByPhoneId, channelOf, deliver, editionOf, forgetChannel, planOf, providerOf, receive, statusUpdate, windowOpen, weekOf } from './core';
import { iqd, shopOrigin } from './store';
import { fileUrl } from '../files';
import { engineFor } from '../ai/router';
import { record } from '../ai/meter';
import { AiError } from '../ai/engine';
import { priceText, SITE } from '../routes/realestate/common';
import { withCovers } from '../routes/realestate/properties';
import { reProperty, reLeadProperty } from '@hemlo/db/schema';
import { demoReply, type DemoTurn } from './demo';
import { GRAPH, metaWa, parseWebhook, validSignature, WaError } from './wa';
import { isDemoOrg } from '../routes/demo';
import type { AppEnv, Deps } from '../types';

const rowsOf = (r: any): any[] => (Array.isArray(r) ? r : r?.rows ?? []);
const PAGE = 40;

/** Who may do what: an agency's leads and set-up permissions, or a shop's connect permissions. */
type Level = 'read' | 'reply' | 'configure';
function cx(c: Context<AppEnv>, level: Level): Actor {
  try { return actor(c, 'connect', level); }
  catch (e) { if (level === 'configure') return actor(c, 'agency', 'configure'); return actor(c, 'leads', level === 'read' ? 'read' : 'update'); }
}
/** Which chats this person may open: all (managers, the desk, a shop's team), or their leads' and the unassigned ones. */
function scope(a: Actor): SQL | undefined {
  if (may(a.principal, 'leads', 'read-all') || may(a.principal, 'connect', 'read')) return undefined;
  const mine = (a.principal as any).memberId as string | null;
  return mine ? or(eq(connectConversation.agentId, mine), isNull(connectConversation.agentId)) : isNull(connectConversation.agentId);
}
const canConfigure = (a: Actor) => may(a.principal, 'agency', 'configure') || may(a.principal, 'connect', 'configure');
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

  /** The public demo on hemlohq.com: the sample agency's assistant, nothing stored, nothing sent. */
  r.post('/demo', async (c) => {
    const b = await c.req.json<{ lang?: string; messages?: DemoTurn[] }>().catch(() => ({} as any));
    const ip = c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    return c.json(await demoReply(d, ip, b.lang === 'en' ? 'en' : 'ar', Array.isArray(b.messages) ? b.messages : []));
  });

  // ------------------------------------------------------------------------------------------- the overview
  /** Everything the Connect page needs, in one call: the plan and its use, the number, the automations, what's waiting. */
  r.get('/', async (c) => {
    const a = cx(c, 'read');
    const org = a.organizationId, edition = await editionOf(d, org);
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
    // the tiers as the business sees them: what each adds, its price, and its AI limits (never a message count:
    // WhatsApp messaging is simply included, Hemlo pays for it)
    const offers = PLAN_CODES.map((code) => p.offers[code]?.offer).filter((o) => o && o.active && o.public).map((o) => {
      const l = limitsOf(o);
      return { code: o!.code, name: o!.name, description: o!.description, priceMonth: o!.priceMonth, priceYear: o!.priceYear, free: isFree(o), active: !!p.offers[o!.code]?.active,
        ai: { day: l.aiDay, week: l.aiWeek, month: l.aiMonth }, studio: l.studioMonth > 0 };
    });
    return c.json({
      plan: p.plan, offers, via: p.offers[p.plan ?? '']?.via ?? null,
      ai: { ...p.ai, used: p.used.ai, limits: { day: p.limits.aiDay, week: p.limits.aiWeek, month: p.limits.aiMonth } },
      messaging: p.wa,
      canConfigure: canConfigure(a), channel: publicChannel(data.ch),
      signup: d.env.META_APP_ID && d.env.META_CONFIG_ID ? { appId: d.env.META_APP_ID, configId: d.env.META_CONFIG_ID } : null,
      edition, recipes: recipesFor(edition).map((x) => {
        const row = data.recipes.find((y) => y.key === x.key);
        return { key: x.key, plan: x.plan, marketing: !!x.marketing, allowed: planAllows(p.plan, x), on: row ? row.enabled : x.on, settings: row?.settings ?? {},
          template: x.template, approved: !x.template || !data.ch || data.ch.provider !== 'meta' || (['ar', 'en'] as const).some((l) => data.ch!.templates?.[`${x.template}:${l}`]?.status === 'approved') };
      }),
      counts: data.counts, week: data.week, summary: await weekOf(d.db, org),
    });
  });

  // ------------------------------------------------------------------------------------------- the inbox
  r.get('/conversations', async (c) => {
    const a = cx(c, 'read');
    const f = c.req.query('filter'), q = (c.req.query('q') ?? '').trim().slice(0, 60), before = c.req.query('before');
    const w: (SQL | undefined)[] = [eq(connectConversation.organizationId, a.organizationId), scope(a)];
    if (f === 'unread') w.push(sql`${connectConversation.unread} > 0`);
    if (f === 'waiting') w.push(and(eq(connectConversation.handoff, true), eq(connectConversation.status, 'open')));
    if (f === 'mine') { const me = (a.principal as any).memberId as string | null; w.push(me ? eq(connectConversation.agentId, me) : sql`false`); }
    if (q) { const t = `%${q.replace(/[%_]/g, '')}%`; w.push(or(sql`${connectConversation.name} ilike ${t}`, sql`${connectConversation.phone} ilike ${t}`, sql`${reLead.name} ilike ${t}`, sql`${sysCustomer.name} ilike ${t}`)); }
    if (before && !Number.isNaN(Date.parse(before))) w.push(lt(connectConversation.lastMessageAt, new Date(before)));
    const rows = await withOrg(d.db, a.organizationId, (tx) => tx.select({
      id: connectConversation.id, phone: connectConversation.phone, name: connectConversation.name, leadId: connectConversation.leadId, ownerId: connectConversation.ownerId,
      leadName: sql<string | null>`coalesce(${reLead.name}, ${sysCustomer.name})`, leadStatus: reLead.status, customerId: connectConversation.customerId, agentId: connectConversation.agentId, status: connectConversation.status, handoff: connectConversation.handoff,
      optedOut: connectConversation.optedOut, unread: connectConversation.unread, lastMessageAt: connectConversation.lastMessageAt, lastInboundAt: connectConversation.lastInboundAt, preview: connectConversation.preview,
    }).from(connectConversation).leftJoin(reLead, eq(reLead.id, connectConversation.leadId)).leftJoin(sysCustomer, eq(sysCustomer.id, connectConversation.customerId)).where(and(...w)).orderBy(desc(connectConversation.lastMessageAt)).limit(PAGE));
    return c.json({ conversations: rows.map((x) => ({ ...x, open: windowOpen(x) })), more: rows.length === PAGE });
  });

  const one = async (a: Actor, id: string) => {
    const [conv] = await withOrg(d.db, a.organizationId, (tx) => tx.select().from(connectConversation).where(and(eq(connectConversation.id, id), scope(a))));
    if (!conv) throw new HttpError(404, 'CONVERSATION_NOT_FOUND');
    return conv;
  };

  /** One chat: its messages (newest 80, or older with ?before=), the lead in short, and it's marked read. */
  r.get('/conversations/:id', async (c) => {
    const a = cx(c, 'read');
    const conv = await one(a, c.req.param('id'));
    const before = c.req.query('before');
    const out = await withOrg(d.db, a.organizationId, async (tx) => {
      const msgs = await tx.select({ id: connectMessage.id, direction: connectMessage.direction, author: connectMessage.author, kind: connectMessage.kind, body: connectMessage.body,
        recipe: connectMessage.recipe, status: connectMessage.status, error: connectMessage.error, meta: connectMessage.meta, createdAt: connectMessage.createdAt })
        .from(connectMessage).where(and(eq(connectMessage.organizationId, a.organizationId), eq(connectMessage.conversationId, conv.id),
          ...(before && !Number.isNaN(Date.parse(before)) ? [lt(connectMessage.createdAt, new Date(before))] : []))).orderBy(desc(connectMessage.createdAt)).limit(80);
      const [lead] = conv.leadId ? await tx.select({ id: reLead.id, name: reLead.name, status: reLead.status, purpose: reLead.purpose, types: reLead.types, areas: reLead.areas,
        budgetMax: reLead.budgetMax, currency: reLead.currency, bedrooms: reLead.bedrooms, consent: reLead.consent, agentId: reLead.agentId }).from(reLead).where(eq(reLead.id, conv.leadId)) : [];
      // a shop's customer: who they are in the book, what they owe, and their latest online orders
      const [customer] = conv.customerId ? await tx.select({ id: sysCustomer.id, name: sysCustomer.name, phone: sysCustomer.phone, balance: sysCustomer.balance }).from(sysCustomer).where(eq(sysCustomer.id, conv.customerId)) : [];
      const orders = lead ? [] : await tx.select({ id: shopOrder.id, number: shopOrder.number, status: shopOrder.status, total: shopOrder.total, createdAt: shopOrder.createdAt }).from(shopOrder)
        .where(and(eq(shopOrder.organizationId, a.organizationId), eq(shopOrder.phone, conv.phone))).orderBy(desc(shopOrder.createdAt)).limit(3);
      if (conv.unread) await tx.update(connectConversation).set({ unread: 0 }).where(eq(connectConversation.id, conv.id));
      return { msgs: msgs.reverse(), lead: lead ?? null, customer: customer ?? null, orders };
    });
    return c.json({ conversation: { ...conv, unread: 0, open: windowOpen(conv) }, messages: out.msgs, lead: out.lead, customer: out.customer, orders: out.orders, more: out.msgs.length === 80 });
  });

  /** An agent writes: the assistant steps back in this chat (a person took over), until they hand it back. */
  r.post('/conversations/:id/messages', async (c) => {
    const a = cx(c, 'reply');
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

  /** The agency's homes on the market, to send one into a chat (newest first, or by a word). */
  r.get('/listings', async (c) => {
    const a = cx(c, 'read');
    const q = (c.req.query('q') ?? '').trim().slice(0, 60).replace(/[%_]/g, '');
    const out = await withOrg(d.db, a.organizationId, async (tx) => {
      const rows = await tx.select({ id: reProperty.id, ref: reProperty.ref, slug: reProperty.slug, title: reProperty.title, titleEn: reProperty.titleEn, type: reProperty.type, purpose: reProperty.purpose,
        price: reProperty.price, currency: reProperty.currency, rentPeriod: reProperty.rentPeriod, area: reProperty.area, city: reProperty.city, coverId: reProperty.coverId })
        .from(reProperty).where(and(eq(reProperty.organizationId, a.organizationId), sql`${reProperty.publishedAt} is not null`, sql`${reProperty.status} in ('available', 'negotiating')`,
          ...(q ? [or(sql`${reProperty.title} ilike ${`%${q}%`}`, sql`${reProperty.titleEn} ilike ${`%${q}%`}`, sql`${reProperty.area} ilike ${`%${q}%`}`, sql`${reProperty.ref}::text = ${q}`)] : [])))
        .orderBy(desc(reProperty.publishedAt)).limit(24);
      return withCovers(d, tx, a.organizationId, rows);
    });
    return c.json({ listings: out.map((p: any) => ({ id: p.id, ref: p.ref, title: p.title, titleEn: p.titleEn, area: p.area, city: p.city, cover: p.cover ?? null,
      price: priceText(p.price == null ? null : Number(p.price), p.currency, 'ar', p.purpose === 'rent' ? p.rentPeriod : null), priceEn: priceText(p.price == null ? null : Number(p.price), p.currency, 'en', p.purpose === 'rent' ? p.rentPeriod : null) })) });
  });

  /** An agent sends one of the agency's homes into the chat: its title, price and page, and the lead's list remembers it. */
  r.post('/conversations/:id/listing', async (c) => {
    const a = cx(c, 'reply');
    const conv = await one(a, c.req.param('id'));
    const b = await c.req.json<{ propertyId?: string; lang?: string }>().catch(() => ({} as any));
    if (conv.optedOut) throw new HttpError(409, 'OPTED_OUT');
    const ch = await channelOf(d, a.organizationId);
    if (!ch || ch.status !== 'connected') throw new HttpError(409, 'CONNECT_NOT_READY');
    if (!(await planOf(d, a.organizationId)).plan) throw new HttpError(402, 'ADDON_NOT_ACTIVE');
    const [p] = await withOrg(d.db, a.organizationId, (tx) => tx.select().from(reProperty).where(and(eq(reProperty.id, String(b.propertyId ?? '')), eq(reProperty.organizationId, a.organizationId),
      sql`${reProperty.publishedAt} is not null`)));
    if (!p) throw new HttpError(404, 'PROPERTY_NOT_FOUND');
    const lang = b.lang === 'en' ? 'en' : 'ar', price = priceText(p.price == null ? null : Number(p.price), p.currency, lang, p.purpose === 'rent' ? p.rentPeriod : null);
    const text = `${lang === 'en' ? p.titleEn || p.title : p.title} · ${price}\n${[p.area, p.city].filter(Boolean).join(lang === 'en' ? ', ' : '، ')}\n${SITE(d)}/p/${p.slug}${conv.leadId ? `?l=${conv.leadId.slice(0, 10)}` : ''}`;
    if (!conv.handoff) await withOrg(d.db, a.organizationId, (tx) => tx.update(connectConversation).set({ handoff: true }).where(eq(connectConversation.id, conv.id)));
    const message = await deliver(d, ch, conv, { author: 'agent', userId: a.userId, text, meta: { propertyId: p.id, ref: p.ref } });
    if (conv.leadId) await withOrg(d.db, a.organizationId, (tx) => tx.insert(reLeadProperty).values({ id: newId(), organizationId: a.organizationId,
      leadId: conv.leadId!, propertyId: p.id, status: 'sent', sentAt: new Date() }).onConflictDoNothing());
    return c.json({ message }, 201);
  });

  /** A shop's products, to send one into a chat (by a word, or the ones on the online shop first). */
  r.get('/products', async (c) => {
    const a = cx(c, 'read');
    const q = (c.req.query('q') ?? '').trim().slice(0, 60).replace(/[%_]/g, '');
    const out = await withOrg(d.db, a.organizationId, async (tx) => {
      const rows = await tx.select({ id: sysProduct.id, name: sysProduct.name, category: sysProduct.category, price: sysProduct.price, stock: sysProduct.stock, trackStock: sysProduct.trackStock,
        online: sysProduct.online, slug: sysProduct.slug, imageId: sysProduct.imageId }).from(sysProduct)
        .where(and(eq(sysProduct.organizationId, a.organizationId), sql`${sysProduct.archivedAt} is null`, ...(q ? [or(sql`${sysProduct.name} ilike ${`%${q}%`}`, sql`${sysProduct.category} ilike ${`%${q}%`}`, sql`${sysProduct.barcode} = ${q}`)] : [])))
        .orderBy(desc(sysProduct.online), desc(sysProduct.updatedAt)).limit(24);
      return Promise.all(rows.map(async (p) => ({ ...p, image: p.imageId ? await fileUrl(d.env, a.organizationId, p.imageId) : null })));
    });
    return c.json({ products: out });
  });

  /** An agent sends one of the shop's products into the chat: its name, price and (when it's online) its page. */
  r.post('/conversations/:id/product', async (c) => {
    const a = cx(c, 'reply');
    const conv = await one(a, c.req.param('id'));
    const b = await c.req.json<{ productId?: string; lang?: string }>().catch(() => ({} as any));
    if (conv.optedOut) throw new HttpError(409, 'OPTED_OUT');
    const ch = await channelOf(d, a.organizationId);
    if (!ch || ch.status !== 'connected') throw new HttpError(409, 'CONNECT_NOT_READY');
    if (!(await planOf(d, a.organizationId)).plan) throw new HttpError(402, 'ADDON_NOT_ACTIVE');
    const lang = b.lang === 'en' ? 'en' as const : 'ar' as const;
    const found = await withOrg(d.db, a.organizationId, async (tx) => {
      const [p] = await tx.select().from(sysProduct).where(and(eq(sysProduct.id, String(b.productId ?? '')), eq(sysProduct.organizationId, a.organizationId), sql`${sysProduct.archivedAt} is null`));
      return p ? { p, origin: await shopOrigin(tx, a.organizationId) } : null;
    });
    if (!found) throw new HttpError(404, 'PRODUCT_NOT_FOUND');
    const { p, origin } = found;
    const text = `${p.name} · ${iqd(p.price, lang)}${p.online && p.slug && origin ? `\n${origin}/products/${p.slug}` : ''}`;
    if (!conv.handoff) await withOrg(d.db, a.organizationId, (tx) => tx.update(connectConversation).set({ handoff: true }).where(eq(connectConversation.id, conv.id)));
    const message = await deliver(d, ch, conv, { author: 'agent', userId: a.userId, text, meta: { productId: p.id } });
    return c.json({ message }, 201);
  });

  /** The agent's AI tools (Connect Pro and up): a reply to send, in the customer's language, or the chat in a few lines.
   *  Counted with the assistant's replies; when the day's, week's or month's limit is reached they wait for it to reset. */
  r.post('/conversations/:id/assist', async (c) => {
    const a = cx(c, 'read');
    const conv = await one(a, c.req.param('id'));
    const b = await c.req.json<{ mode?: string; lang?: string }>().catch(() => ({} as any));
    const mode = b.mode === 'summary' ? 'summary' : b.mode === 'suggest' ? 'suggest' : bad('BAD_MODE');
    const p = await planOf(d, a.organizationId);
    if (!hasAi(p.plan)) throw new HttpError(402, 'PLAN_PRO_NEEDED');
    if (!p.ai.open) throw new HttpError(429, 'AI_PAUSED', p.ai.resetsAt ?? undefined);
    const edition = await editionOf(d, a.organizationId), agency = edition === 'realestate';
    const engine = await engineFor(d, edition, 'connect_assist', a.organizationId);
    if (!engine) throw new HttpError(503, 'AI_UNAVAILABLE');
    const msgs = await withOrg(d.db, a.organizationId, async (tx) => (await tx.select({ direction: connectMessage.direction, body: connectMessage.body }).from(connectMessage)
      .where(and(eq(connectMessage.organizationId, a.organizationId), eq(connectMessage.conversationId, conv.id))).orderBy(desc(connectMessage.createdAt)).limit(30)).reverse());
    if (!msgs.length) throw new HttpError(409, 'NOTHING_TO_READ');
    const chat = msgs.map((m) => `${m.direction === 'in' ? 'Customer' : agency ? 'Agency' : 'Shop'}: ${m.body.slice(0, 600)}`).join('\n');
    const lang = b.lang === 'en' ? 'English' : 'Arabic';
    const trade = agency ? 'a real-estate agent' : 'a shop';
    const system = mode === 'suggest'
      ? `You help ${trade} in Iraq answer a customer on WhatsApp.` + ' Write the next reply the agent could send: in the customer\'s own language (Iraqi-friendly Arabic, English or Kurdish), warm, under 60 words, one question at a time, no emojis. Never invent a price, size, address or promise that is not in the chat. Return JSON only.'
      : `You summarise a WhatsApp chat between ${agency ? 'a real-estate agency' : 'a shop'} in Iraq and a customer, for the team, in ${lang}: who they are, what they want (${agency ? 'buy or rent, area, type, budget, bedrooms' : 'which products, how many, delivery'}), what was promised, and the next step. At most 5 short lines. Use only what the chat says. Return JSON only.`;
    const t0 = Date.now();
    try {
      const out = await engine.json<{ text: string }>({ system, text: `The chat:\n${chat}`, schema: { type: 'object', additionalProperties: false, required: ['text'], properties: { text: { type: 'string' } } }, maxTokens: 500 });
      await record(d.db, a.organizationId, { userId: a.userId, feature: 'connect_assist', engine: engine.name, model: out.model, inputTokens: out.inputTokens, outputTokens: out.outputTokens, costMicros: out.costMicros, ms: Date.now() - t0, ok: true, counted: false });
      return c.json({ text: String(out.data?.text ?? '').trim().slice(0, 1500) });
    } catch (e) {
      await record(d.db, a.organizationId, { userId: a.userId, feature: 'connect_assist', engine: engine.name, ms: Date.now() - t0, ok: false, counted: false }).catch(() => {});
      throw new HttpError(503, e instanceof AiError && e.message === 'REFUSED' ? 'AI_REFUSED' : 'AI_FAILED');
    }
  });

  /** Hand a chat back to the assistant (or take it), or close it. */
  r.patch('/conversations/:id', async (c) => {
    const a = cx(c, 'reply');
    const conv = await one(a, c.req.param('id'));
    const b = await c.req.json<{ handoff?: boolean; status?: string }>().catch(() => ({} as any));
    const set: Partial<typeof connectConversation.$inferInsert> = {};
    if (typeof b.handoff === 'boolean') set.handoff = b.handoff;
    if (b.status !== undefined) set.status = b.status === 'closed' ? 'closed' : b.status === 'open' ? 'open' : bad('BAD_STATUS');
    const [row] = await withOrg(d.db, a.organizationId, (tx) => tx.update(connectConversation).set(set).where(eq(connectConversation.id, conv.id)).returning());
    return c.json({ conversation: { ...row, open: windowOpen(row) } });
  });

  // ------------------------------------------------------------------------------------------- set-up
  const configure = (c: Context<AppEnv>) => cx(c, 'configure');
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
    if (await isDemoOrg(d, a.organizationId)) throw new HttpError(403, 'NOT_IN_DEMO');
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
    for (const t of templateDefs(await editionOf(d, ch.organizationId))) {
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
      // only what was sent changes: saving the quick replies leaves the greeting alone, and the other way round
      const cur = ch.persona ?? {}, P = b.persona ?? {};
      const quick = Array.isArray(P.quick) ? P.quick.slice(0, 20).map((x: any) => ({ title: s(x?.title, 40), text: s(x?.text, 1000) })).filter((x: any) => x.title && x.text) : (cur.quick ?? []);
      set.persona = {
        greeting: P.greeting !== undefined ? { ar: s(P.greeting?.ar, 400) ?? undefined, en: s(P.greeting?.en, 400) ?? undefined } : cur.greeting,
        hours: P.hours !== undefined ? s(P.hours, 120) : cur.hours ?? null, notes: P.notes !== undefined ? s(P.notes, 800) : cur.notes ?? null, quick,
      };
    }
    const row = await saveChannel(a.organizationId, set);
    return c.json({ channel: publicChannel(row) });
  });

  /** An automation on or off (and its few settings). Only what the plan includes can be switched on. */
  r.put('/recipes/:key', async (c) => {
    const a = configure(c);
    const key = c.req.param('key');
    const recipe = recipeOf(key);
    if (!recipe || !(CONNECT_RECIPES as readonly string[]).includes(key) || !recipesFor(await editionOf(d, a.organizationId)).includes(recipe)) throw new HttpError(404, 'NOT_FOUND');
    const b = await c.req.json<{ enabled?: boolean; settings?: Record<string, unknown> }>().catch(() => ({} as any));
    const p = await needPlan(a.organizationId);
    if (b.enabled && !planAllows(p.plan, recipe)) throw new HttpError(402, 'NEEDS_PRO');
    const settings: Record<string, unknown> = {};
    if (key === 'debt_reminder' && b.settings?.min != null) { const n = Number(b.settings.min); settings.min = Number.isInteger(n) && n >= 1000 && n <= 100_000_000 ? n : bad('BAD_AMOUNT'); }
    if (key === 'cold_lead' && b.settings?.days != null) { const n = Number(b.settings.days); settings.days = Number.isInteger(n) && n >= 7 && n <= 90 ? n : bad('BAD_DAYS'); }
    const values = { organizationId: a.organizationId, key, enabled: !!b.enabled, settings, updatedAt: new Date() };
    const [row] = await withOrg(d.db, a.organizationId, (tx) => tx.insert(connectRecipe).values(values)
      .onConflictDoUpdate({ target: [connectRecipe.organizationId, connectRecipe.key], set: { enabled: values.enabled, settings, updatedAt: values.updatedAt } }).returning());
    return c.json({ recipe: { key: row.key, on: row.enabled, settings: row.settings } });
  });

  /** What the automations did lately: sent, waiting, or why not. */
  r.get('/activity', async (c) => {
    const a = cx(c, 'read');
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
