// Listings: add once, and everything else follows from it — the public page, the WhatsApp message, the matches, the
// viewings, the deal. The lifecycle is a small set of honest moves (a sold home can't be "reserved"), every important
// change lands on the timeline, and publishing answers the agent's next question: "who might want this?"
import { Hono } from 'hono';
import { and, asc, desc, eq, gte, inArray, isNull, lte, ne, or, sql, type SQL } from 'drizzle-orm';
import { newId } from '@hemlo/core';
import type { Database } from '@hemlo/db';
import { reProperty, reMedia, reOwner, reLead, reLeadProperty, reViewing, reDeal, reOffer, reActivity, reDocument, reCollectionItem, reAgent, sysFile, sysSequence } from '@hemlo/db/schema';
import { HttpError } from '../../principal';
import { actor, bad, may, type Actor } from '../sys-common';
import { fileKey, fileUrl, sniffImage, isPdf, MAX_BYTES } from '../../files';
import { withinLimit } from '../../subscription';
import { isDemoOrg } from '../demo';
import {
  inRe, rowsOf, str, amount, intIn, oneOf, words, phone, latLng, dateOnly, newSlug, activity, notice, settingsOf, photosOf, coverFirst, leadScope, memberOf,
  shareText, waLink, like, SITE, RE_TYPES, RE_STATUSES, CURRENCIES,
} from './common';
import { rank, matchOf, MATCHABLE, type LeadWants, type PropertyFacts } from './match';
import type { AppEnv, Deps } from '../../types';

export const MAX_PHOTOS = 40;
/** Which moves a listing can make (anything else is refused with BAD_STATUS_MOVE). */
export const MOVES: Record<string, string[]> = {
  draft: ['available', 'archived'],
  available: ['reserved', 'negotiating', 'sold', 'rented', 'archived', 'draft'],
  negotiating: ['available', 'reserved', 'sold', 'rented', 'archived'],
  reserved: ['available', 'negotiating', 'sold', 'rented', 'archived'],
  sold: ['available', 'archived'], rented: ['available', 'archived'], archived: ['draft', 'available'],
};
/** A public page stays up while the listing is live, and shows "reserved/sold" honestly; drafts and archives never show. */
export const PUBLIC_STATUSES = ['available', 'negotiating', 'reserved', 'sold', 'rented'];

const FURNISHED = ['none', 'semi', 'full'] as const, CONDITIONS = ['new', 'excellent', 'good', 'needs_work', 'shell'] as const;
export function propertyInput(b: any, partial = false) {
  const out: Partial<typeof reProperty.$inferInsert> = {};
  const has = (k: string) => !partial || b[k] !== undefined;
  if (has('title')) out.title = str(b.title, 140, 'BAD_TITLE', true)!;
  if (b.titleEn !== undefined) out.titleEn = str(b.titleEn, 140, 'BAD_TITLE');
  if (has('type')) out.type = oneOf(b.type, RE_TYPES, 'BAD_TYPE');
  if (has('purpose')) out.purpose = oneOf(b.purpose, ['sale', 'rent'] as const, 'BAD_PURPOSE', 'sale');
  if (b.price !== undefined) out.price = amount(b.price);
  if (b.currency !== undefined) out.currency = oneOf(b.currency, CURRENCIES, 'BAD_CURRENCY');
  if (b.rentPeriod !== undefined) out.rentPeriod = b.rentPeriod ? oneOf(b.rentPeriod, ['month', 'year'] as const, 'BAD_PERIOD') : null;
  if (b.negotiable !== undefined) out.negotiable = !!b.negotiable;
  if (b.ownerMin !== undefined) out.ownerMin = amount(b.ownerMin, 'BAD_PRICE');
  for (const [k, n] of [['city', 60], ['area', 80], ['address', 200], ['video', 300]] as const) if (b[k] !== undefined) (out as any)[k] = str(b[k], n, 'BAD_TEXT');
  if (out.video && !/^https:\/\/([a-z0-9-]+\.)*(youtube\.com|youtu\.be|instagram\.com|tiktok\.com|facebook\.com|vimeo\.com)\//i.test(out.video)) bad('BAD_VIDEO');
  if (b.lat !== undefined || b.lng !== undefined) Object.assign(out, latLng(b.lat, b.lng));
  if (b.showExact !== undefined) out.showExact = !!b.showExact;
  if (b.size !== undefined) out.size = intIn(b.size, 1, 1_000_000, 'BAD_SIZE');
  if (b.land !== undefined) out.land = intIn(b.land, 1, 100_000_000, 'BAD_SIZE');
  for (const k of ['bedrooms', 'bathrooms', 'floors', 'parking'] as const) if (b[k] !== undefined) out[k] = intIn(b[k], 0, 200, 'BAD_ROOMS');
  if (b.yearBuilt !== undefined) out.yearBuilt = intIn(b.yearBuilt, 1900, new Date().getFullYear() + 5, 'BAD_YEAR');
  if (b.furnished !== undefined) out.furnished = b.furnished ? oneOf(b.furnished, FURNISHED, 'BAD_FURNISHED') : null;
  if (b.condition !== undefined) out.condition = b.condition ? oneOf(b.condition, CONDITIONS, 'BAD_CONDITION') : null;
  if (b.features !== undefined) out.features = words(b.features, 40, 40, 'BAD_FEATURES');
  if (b.description !== undefined) out.description = { ar: str(b.description?.ar, 5000, 'BAD_TEXT') ?? undefined, en: str(b.description?.en, 5000, 'BAD_TEXT') ?? undefined };
  if (b.notes !== undefined) out.notes = str(b.notes, 4000, 'BAD_TEXT');
  if (b.ownerId !== undefined) out.ownerId = b.ownerId || null;
  if (b.agentId !== undefined) out.agentId = b.agentId || null;
  if (b.branchId !== undefined) out.branchId = b.branchId || null;
  if (out.purpose === 'sale') out.rentPeriod = null;
  return out;
}

/** A listing's short card (lists, search, matches, collections). */
export const cardCols = {
  id: reProperty.id, ref: reProperty.ref, slug: reProperty.slug, title: reProperty.title, titleEn: reProperty.titleEn, type: reProperty.type, purpose: reProperty.purpose,
  status: reProperty.status, publishedAt: reProperty.publishedAt, price: reProperty.price, currency: reProperty.currency, rentPeriod: reProperty.rentPeriod, negotiable: reProperty.negotiable,
  city: reProperty.city, area: reProperty.area, lat: reProperty.lat, lng: reProperty.lng, size: reProperty.size, land: reProperty.land, bedrooms: reProperty.bedrooms, bathrooms: reProperty.bathrooms,
  features: reProperty.features, agentId: reProperty.agentId, ownerId: reProperty.ownerId, coverId: reProperty.coverId, stats: reProperty.stats, updatedAt: reProperty.updatedAt, statusAt: reProperty.statusAt, createdAt: reProperty.createdAt,
};
export type Card = { [K in keyof typeof cardCols]: any } & { cover?: string | null };
/** Cards with their cover photo's link. */
export async function withCovers(d: Deps, tx: Database, org: string, rows: any[]): Promise<Card[]> {
  const photos = await photosOf(d, tx, org, rows.map((r) => r.id));
  return rows.map((r) => ({ ...r, cover: coverFirst(photos[r.id], r.coverId)[0]?.url ?? null }));
}
const asFacts = (p: any): PropertyFacts => ({ purpose: p.purpose, type: p.type, status: p.status, area: p.area, city: p.city, price: p.price == null ? null : Number(p.price), currency: p.currency, bedrooms: p.bedrooms, bathrooms: p.bathrooms, size: p.size, features: p.features ?? [] });
export const asWants = (l: any): LeadWants => ({ purpose: l.purpose, types: l.types ?? [], areas: l.areas ?? [], city: l.city, budgetMin: l.budgetMin == null ? null : Number(l.budgetMin), budgetMax: l.budgetMax == null ? null : Number(l.budgetMax),
  currency: l.currency, bedrooms: l.bedrooms, bathrooms: l.bathrooms, sizeMin: l.sizeMin, sizeMax: l.sizeMax, must: l.must ?? [] });

/** Active leads this listing suits, best first (the agent's own leads, unless they see all). */
export async function leadsFor(tx: Database, a: Actor, p: any, usdRate: number) {
  const leads = await tx.select().from(reLead).where(and(isNull(reLead.archivedAt), eq(reLead.purpose, p.purpose), inArray(reLead.status, ['new', 'active', 'viewing', 'negotiating']), leadScope(a))).limit(2000);
  const sent = new Map((await tx.select({ leadId: reLeadProperty.leadId, status: reLeadProperty.status }).from(reLeadProperty).where(eq(reLeadProperty.propertyId, p.id))).map((x) => [x.leadId, x.status]));
  return leads.map((l) => ({ l, m: matchOf(asWants(l), asFacts(p), usdRate) })).filter((x) => x.m && x.m.score >= 60).sort((a, b) => b.m!.score - a.m!.score)
    .map(({ l, m }) => ({ lead: { id: l.id, name: l.name, phone: l.phone, whatsapp: l.whatsapp, lang: l.lang, agentId: l.agentId, status: l.status, consent: l.consent }, score: m!.score, reasons: m!.reasons, sent: sent.get(l.id) ?? null }));
}
/** Listings that look like this one (same owner, or same area + type + close size/rooms): a gentle warning, never a block. */
export async function similarTo(tx: Database, x: { id?: string; ownerId?: string | null; ownerPhone?: string | null; area?: string | null; type?: string; size?: number | null; bedrooms?: number | null; address?: string | null }) {
  const or1: SQL[] = [];
  if (x.ownerId && x.type) or1.push(and(eq(reProperty.ownerId, x.ownerId), eq(reProperty.type, x.type))!);
  if (x.area && x.type) or1.push(and(sql`lower(${reProperty.area}) = lower(${x.area})`, eq(reProperty.type, x.type),
    x.size ? sql`${reProperty.size} between ${Math.floor(x.size * 0.92)} and ${Math.ceil(x.size * 1.08)}` : sql`true`,
    x.bedrooms != null ? sql`coalesce(${reProperty.bedrooms}, ${x.bedrooms}) = ${x.bedrooms}` : sql`true`)!);
  if (x.address && x.address.length > 6) or1.push(sql`lower(${reProperty.address}) = lower(${x.address})`);
  if (x.ownerPhone) or1.push(sql`${reProperty.ownerId} in (select id from re_owner where phone = ${x.ownerPhone})`);
  if (!or1.length) return [];
  return tx.select({ id: reProperty.id, ref: reProperty.ref, title: reProperty.title, status: reProperty.status, area: reProperty.area, price: reProperty.price, currency: reProperty.currency })
    .from(reProperty).where(and(or(...or1), ne(reProperty.status, 'archived'), x.id ? ne(reProperty.id, x.id) : undefined)).limit(5);
}

async function nextRef(tx: Database, org: string) {
  const [s] = await tx.insert(sysSequence).values({ organizationId: org, name: 're_property', value: 1001 })
    .onConflictDoUpdate({ target: [sysSequence.organizationId, sysSequence.name], set: { value: sql`${sysSequence.value} + 1` } }).returning({ value: sysSequence.value });
  return s.value;
}

/** The public link and the ready WhatsApp messages for a listing (Arabic and English). */
export function shareOf(d: Deps, p: any, settings: { shareTemplate: any; whatsapp: string | null }) {
  const url = `${SITE(d)}/p/${p.slug}`;
  const facts = { ...p, price: p.price == null ? null : Number(p.price) };
  return { url, qr: `${url}?s=qr`, text: { ar: shareText(facts, 'ar', url, settings.shareTemplate), en: shareText(facts, 'en', url, settings.shareTemplate) } };
}

export function rePropertyRoutes(d: Deps) {
  const r = new Hono<AppEnv>();
  const one = async (tx: Database, id: string) => {
    const [p] = await tx.select().from(reProperty).where(eq(reProperty.id, id));
    if (!p) throw new HttpError(404, 'PROPERTY_NOT_FOUND');
    return p;
  };
  const checkRefs = async (tx: Database, org: string, x: { ownerId?: string | null; agentId?: string | null }) => {
    if (x.ownerId) { const [o] = await tx.select({ id: reOwner.id }).from(reOwner).where(eq(reOwner.id, x.ownerId)); if (!o) bad('BAD_OWNER'); }
    if (x.agentId) { const [m] = rowsOf(await tx.execute(sql`select 1 from member where id = ${x.agentId} and organization_id = ${org}`)); if (!m) bad('BAD_AGENT'); }
  };

  /** The inventory: filter by anything an agent asks about; newest change first; 30 at a time. */
  r.get('/properties', async (c) => {
    const a = actor(c, 'listings', 'read');
    const q = c.req.query();
    const w: (SQL | undefined)[] = [];
    if (q.status === 'live') w.push(inArray(reProperty.status, ['available', 'negotiating', 'reserved']));
    else if (q.status && q.status !== 'all') w.push(eq(reProperty.status, oneOf(q.status, RE_STATUSES, 'BAD_STATUS')));
    else if (!q.status) w.push(ne(reProperty.status, 'archived'));
    if (q.type) w.push(inArray(reProperty.type, q.type.split(',').filter((t) => RE_TYPES.includes(t as any))));
    if (q.purpose) w.push(eq(reProperty.purpose, oneOf(q.purpose, ['sale', 'rent'] as const, 'BAD_PURPOSE')));
    if (q.agent === 'me') w.push(eq(reProperty.agentId, memberOf(a) ?? '-'));
    else if (q.agent) w.push(eq(reProperty.agentId, q.agent));
    if (q.owner) w.push(eq(reProperty.ownerId, q.owner));
    if (q.area) w.push(like(reProperty.area, q.area));
    if (q.min) w.push(gte(reProperty.price, amount(q.min)!));
    if (q.max) w.push(lte(reProperty.price, amount(q.max)!));
    if (q.currency) w.push(eq(reProperty.currency, oneOf(q.currency, CURRENCIES, 'BAD_CURRENCY')));
    if (q.beds) w.push(gte(reProperty.bedrooms, intIn(q.beds, 0, 50, 'BAD_ROOMS')!));
    if (q.published === '1') w.push(sql`${reProperty.publishedAt} is not null`);
    if (q.map === '1') w.push(sql`${reProperty.lat} is not null`);
    if (q.q) {
      const s = q.q.trim().replace(/^#/, '');
      w.push(/^\d{1,9}$/.test(s) ? or(eq(reProperty.ref, Number(s)), like(reProperty.title, s)) : or(like(reProperty.title, s), like(reProperty.titleEn, s), like(reProperty.area, s), like(reProperty.city, s), like(reProperty.address, s)));
    }
    const limit = Math.min(q.map === '1' ? 500 : 60, Number(q.limit) || 30), offset = Math.max(0, Number(q.offset) || 0);
    const sort = q.sort === 'price' ? [asc(reProperty.price)] : q.sort === 'price_desc' ? [desc(reProperty.price)] : q.sort === 'views' ? [desc(sql`coalesce((${reProperty.stats}->>'views')::int, 0)`)] : [desc(reProperty.updatedAt)];
    const out = await inRe(d, a, async (tx) => {
      const where = and(...w);
      const rows = await tx.select(cardCols).from(reProperty).where(where).orderBy(...sort, desc(reProperty.ref)).limit(limit).offset(offset);
      const [n] = await tx.select({ n: sql<number>`count(*)::int` }).from(reProperty).where(where);
      return { properties: await withCovers(d, tx, a.organizationId, rows), total: n.n };
    });
    return c.json(out);
  });

  /** Everything about one listing, in context: owner, agent, who's interested, viewings, the deal, numbers, timeline. */
  r.get('/properties/:id', async (c) => {
    const a = actor(c, 'listings', 'read');
    const id = c.req.param('id');
    const seesMoney = may(a.principal, 'commission', 'read');
    const out = await inRe(d, a, async (tx) => {
      const p = await one(tx, id);
      const settings = await settingsOf(tx, a.organizationId);
      const [photos, owner, viewings, deals, interested, events, docs, inCollections] = await Promise.all([
        photosOf(d, tx, a.organizationId, [id]),
        p.ownerId ? tx.select().from(reOwner).where(eq(reOwner.id, p.ownerId)).then((x) => x[0] ?? null) : null,
        tx.select({ v: reViewing, lead: { id: reLead.id, name: reLead.name, phone: reLead.phone } }).from(reViewing).leftJoin(reLead, eq(reLead.id, reViewing.leadId))
          .where(eq(reViewing.propertyId, id)).orderBy(desc(reViewing.startsAt)).limit(30),
        tx.select({ deal: reDeal, lead: { id: reLead.id, name: reLead.name } }).from(reDeal).leftJoin(reLead, eq(reLead.id, reDeal.leadId)).where(eq(reDeal.propertyId, id)).orderBy(desc(reDeal.updatedAt)),
        tx.select({ lp: reLeadProperty, lead: { id: reLead.id, name: reLead.name, phone: reLead.phone, whatsapp: reLead.whatsapp, status: reLead.status, agentId: reLead.agentId } })
          .from(reLeadProperty).innerJoin(reLead, eq(reLead.id, reLeadProperty.leadId)).where(and(eq(reLeadProperty.propertyId, id), leadScope(a))).orderBy(desc(reLeadProperty.lastOpenAt), desc(reLeadProperty.sentAt)).limit(50),
        tx.select().from(reActivity).where(eq(reActivity.propertyId, id)).orderBy(desc(reActivity.at)).limit(40),
        tx.select().from(reDocument).where(eq(reDocument.propertyId, id)).orderBy(desc(reDocument.createdAt)),
        tx.select({ n: sql<number>`count(*)::int`, fav: sql<number>`count(*) filter (where favorite)::int` }).from(reCollectionItem).where(eq(reCollectionItem.propertyId, id)),
      ]);
      const dealIds = deals.map((x) => x.deal.id);
      const offers = dealIds.length ? await tx.select().from(reOffer).where(inArray(reOffer.dealId, dealIds)).orderBy(asc(reOffer.at)) : [];
      const matches = PUBLIC_STATUSES.includes(p.status) || p.status === 'draft' ? await leadsFor(tx, a, p, settings.usdRate) : [];
      const s = (p.stats ?? {}) as Record<string, number>;
      const funnel = { views: s.views ?? 0, inquiries: (s.wa ?? 0) + (s.calls ?? 0) + (s.requests ?? 0), viewings: viewings.filter((x) => x.v.status === 'completed').length,
        offers: offers.filter((o) => o.kind === 'offer').length, deal: deals.some((x) => x.deal.stage === 'closed') };
      return {
        property: { ...p, ownerMin: seesMoney ? p.ownerMin : undefined },
        photos: coverFirst(photos[id], p.coverId), owner, viewings: viewings.map((x) => ({ ...x.v, lead: x.lead })),
        deals: deals.map((x) => ({ ...x.deal, lead: x.lead, offers: offers.filter((o) => o.dealId === x.deal.id) })),
        interested: interested.map((x) => ({ ...x.lp, lead: x.lead })), matches: matches.slice(0, 20), matchCount: matches.length,
        activity: events, documents: await Promise.all(docs.map(async (x) => ({ ...x, url: await fileUrl(d.env, a.organizationId, x.fileId, 3600) }))),
        collections: inCollections[0], funnel, share: shareOf(d, p, settings),
      };
    });
    return c.json(out);
  });

  /** Before saving: does this look like a listing we already have? (never blocks) */
  r.post('/properties/similar', async (c) => {
    const a = actor(c, 'listings', 'read');
    const b = await c.req.json<any>();
    const list = await inRe(d, a, (tx) => similarTo(tx, { id: b.id, ownerId: b.ownerId, ownerPhone: phone(b.ownerPhone), area: str(b.area, 80, 'BAD_TEXT'), type: b.type, size: intIn(b.size, 1, 1_000_000, 'BAD_SIZE'), bedrooms: intIn(b.bedrooms, 0, 200, 'BAD_ROOMS'), address: str(b.address, 200, 'BAD_TEXT') }));
    return c.json({ similar: list });
  });

  r.post('/properties', async (c) => {
    const a = actor(c, 'listings', 'create');
    const b = await c.req.json<any>();
    const input = propertyInput(b);
    const status = b.status === 'available' ? 'available' : 'draft';
    // the plan's listing limit (Office: 100), checked before the transaction (it reads the plan on its own connection)
    const [{ n }] = await inRe(d, a, (tx) => tx.select({ n: sql<number>`count(*)::int` }).from(reProperty).where(ne(reProperty.status, 'archived')));
    await withinLimit(d.db, a.organizationId, 'listings', n);
    const out = await inRe(d, a, async (tx) => {
      await checkRefs(tx, a.organizationId, input);
      const settings = await settingsOf(tx, a.organizationId);
      const similar = await similarTo(tx, input as any);
      const id = newId();
      const [row] = await tx.insert(reProperty).values({
        id, organizationId: a.organizationId, ref: await nextRef(tx, a.organizationId), slug: newSlug(input.type!), status, currency: settings.currency, city: settings.city,
        agentId: memberOf(a), createdBy: a.userId, ...input,
      } as any).returning();
      await activity(tx, a.organizationId, 'property.created', { propertyId: id, ownerId: row.ownerId }, { status }, a.userId);
      return { property: row, similar };
    });
    return c.json(out, 201);
  });

  r.patch('/properties/:id', async (c) => {
    const a = actor(c, 'listings', 'update');
    const input = propertyInput(await c.req.json<any>(), true);
    if (input.ownerMin !== undefined && !may(a.principal, 'commission', 'read')) delete input.ownerMin; // only those who see the money
    const row = await inRe(d, a, async (tx) => {
      const p = await one(tx, c.req.param('id'));
      await checkRefs(tx, a.organizationId, input);
      const [row] = await tx.update(reProperty).set({ ...input, updatedAt: new Date() }).where(eq(reProperty.id, p.id)).returning();
      const refs = { propertyId: p.id, ownerId: row.ownerId };
      if (input.price !== undefined && Number(input.price) !== Number(p.price)) await activity(tx, a.organizationId, 'property.price', refs, { from: p.price, to: input.price, currency: row.currency }, a.userId);
      if (input.ownerId !== undefined && input.ownerId !== p.ownerId) await activity(tx, a.organizationId, 'property.owner', refs, { from: p.ownerId, to: input.ownerId }, a.userId);
      if (input.agentId !== undefined && input.agentId !== p.agentId) await activity(tx, a.organizationId, 'property.agent', refs, { from: p.agentId, to: input.agentId }, a.userId);
      return row;
    });
    return c.json({ property: row });
  });

  /** Move a listing along its life. Selling or renting it tells everyone interested (inside the agency). */
  r.post('/properties/:id/status', async (c) => {
    const a = actor(c, 'listings', 'update');
    const b = await c.req.json<{ status?: string }>();
    const to = oneOf(b.status, RE_STATUSES, 'BAD_STATUS');
    if (to === 'archived' && !may(a.principal, 'listings', 'archive') && !may(a.principal, 'listings', 'publish')) throw new HttpError(403, 'NOT_ALLOWED');
    const out = await inRe(d, a, async (tx) => {
      const p = await one(tx, c.req.param('id'));
      if (p.status === to) return { property: p, told: 0 };
      if (!MOVES[p.status]?.includes(to)) throw new HttpError(409, 'BAD_STATUS_MOVE');
      if ((to === 'sold' && p.purpose !== 'sale') || (to === 'rented' && p.purpose !== 'rent')) throw new HttpError(409, 'BAD_STATUS_MOVE');
      const set: Partial<typeof reProperty.$inferInsert> = { status: to, statusAt: new Date(), updatedAt: new Date() };
      if (to === 'draft' || to === 'archived') set.publishedAt = null; // off the internet
      const [row] = await tx.update(reProperty).set(set).where(eq(reProperty.id, p.id)).returning();
      await activity(tx, a.organizationId, 'property.status', { propertyId: p.id, ownerId: p.ownerId }, { from: p.status, to }, a.userId);
      let told = 0;
      if (to === 'sold' || to === 'rented' || to === 'reserved') {
        // everyone it was sent to, or who's viewing it, hears about it on their timeline; the agency gets one notice
        const ids = [...new Set([...(await tx.select({ id: reLeadProperty.leadId }).from(reLeadProperty).where(and(eq(reLeadProperty.propertyId, p.id), ne(reLeadProperty.status, 'dismissed')))).map((x) => x.id),
          ...(await tx.select({ id: reViewing.leadId }).from(reViewing).where(and(eq(reViewing.propertyId, p.id), sql`${reViewing.leadId} is not null`))).map((x) => x.id!)])];
        for (const leadId of ids) await activity(tx, a.organizationId, 'lead.property_gone', { leadId, propertyId: p.id }, { status: to }, a.userId);
        told = ids.length;
        if (told) await notice(tx, a.organizationId, 'property_gone', { propertyId: p.id }, { status: to, leads: told, ref: p.ref, title: p.title });
        // open viewings of a sold home are cancelled, with a reason
        if (to !== 'reserved') await tx.update(reViewing).set({ status: 'cancelled', notes: sql`coalesce(${reViewing.notes} || E'\n', '') || ${to === 'sold' ? 'sold' : 'rented'}`, updatedAt: new Date() })
          .where(and(eq(reViewing.propertyId, p.id), inArray(reViewing.status, ['requested', 'scheduled', 'confirmed']), gte(reViewing.startsAt, new Date())));
      }
      return { property: row, told };
    });
    return c.json(out);
  });

  /** Put the public page up (or take it down). Up: "your property is live", and who may want it. */
  r.post('/properties/:id/publish', async (c) => {
    const a = actor(c, 'listings', 'publish');
    const b = await c.req.json<{ on?: boolean }>().catch(() => ({} as { on?: boolean }));
    const on = b.on !== false;
    const out = await inRe(d, a, async (tx) => {
      let p = await one(tx, c.req.param('id'));
      if (!on) {
        const [row] = await tx.update(reProperty).set({ publishedAt: null, updatedAt: new Date() }).where(eq(reProperty.id, p.id)).returning();
        await activity(tx, a.organizationId, 'property.unpublished', { propertyId: p.id }, {}, a.userId);
        return { property: row, matches: [], matchCount: 0 };
      }
      const [{ n }] = await tx.select({ n: sql<number>`count(*)::int` }).from(reMedia).where(eq(reMedia.propertyId, p.id));
      if (!n) throw new HttpError(409, 'NEEDS_PHOTO');
      if (p.status === 'draft') p = (await tx.update(reProperty).set({ status: 'available', statusAt: new Date() }).where(eq(reProperty.id, p.id)).returning())[0];
      if (!PUBLIC_STATUSES.includes(p.status)) throw new HttpError(409, 'CANT_PUBLISH');
      const [row] = await tx.update(reProperty).set({ publishedAt: p.publishedAt ?? new Date(), updatedAt: new Date() }).where(eq(reProperty.id, p.id)).returning();
      await activity(tx, a.organizationId, 'property.published', { propertyId: p.id, ownerId: p.ownerId }, {}, a.userId);
      const settings = await settingsOf(tx, a.organizationId);
      const matches = MATCHABLE.includes(row.status) ? await leadsFor(tx, a, row, settings.usdRate) : [];
      if (matches.length) await notice(tx, a.organizationId, 'match', { propertyId: p.id, agentId: row.agentId }, { leads: matches.length, ref: row.ref, title: row.title });
      return { property: row, matches: matches.slice(0, 12), matchCount: matches.length, share: shareOf(d, row, settings) };
    });
    return c.json(out);
  });

  /** Who may want this listing, and why (the agent picks, then sends). */
  r.get('/properties/:id/matches', async (c) => {
    const a = actor(c, 'listings', 'read');
    const out = await inRe(d, a, async (tx) => { const p = await one(tx, c.req.param('id')); const s = await settingsOf(tx, a.organizationId); return leadsFor(tx, a, p, s.usdRate); });
    return c.json({ matches: out });
  });

  /** The share sheet's content (and a note on the timeline that it was shared, by which channel). */
  r.post('/properties/:id/share', async (c) => {
    const a = actor(c, 'listings', 'read');
    const b = await c.req.json<{ channel?: string; leadId?: string }>().catch(() => ({} as { channel?: string; leadId?: string }));
    const out = await inRe(d, a, async (tx) => {
      const p = await one(tx, c.req.param('id'));
      const s = await settingsOf(tx, a.organizationId);
      if (b.channel) await activity(tx, a.organizationId, 'property.shared', { propertyId: p.id }, { channel: String(b.channel).slice(0, 20) }, a.userId);
      return shareOf(d, p, s);
    });
    return c.json(out);
  });

  // ---------------- photos ----------------
  /** Add one photo (the app shrinks it to ~250 KB first). The body is the image. ?w=&h= */
  r.post('/properties/:id/photos', async (c) => {
    const a = actor(c, 'listings', 'update');
    if (!d.files) throw new HttpError(503, 'UPLOADS_UNAVAILABLE');
    if (Number(c.req.header('content-length') ?? 0) > MAX_BYTES) throw new HttpError(413, 'FILE_TOO_BIG');
    const body = await c.req.arrayBuffer();
    if (!body.byteLength) bad('EMPTY_FILE');
    if (body.byteLength > MAX_BYTES) throw new HttpError(413, 'FILE_TOO_BIG');
    const mime = sniffImage(body) ?? bad('NOT_AN_IMAGE');
    const dim = (v: string | undefined) => { const n = Number(v); return Number.isInteger(n) && n > 0 && n < 20000 ? n : null; };
    const demo = await isDemoOrg(d, a.organizationId);
    const out = await inRe(d, a, async (tx) => {
      const p = await one(tx, c.req.param('id'));
      const [{ n }] = await tx.select({ n: sql<number>`count(*)::int` }).from(reMedia).where(eq(reMedia.propertyId, p.id));
      if (n >= (demo ? 8 : MAX_PHOTOS)) throw new HttpError(409, 'TOO_MANY_PHOTOS');
      const fileId = newId(), mediaId = newId(), w = dim(c.req.query('w')), h = dim(c.req.query('h'));
      await d.files!.put(fileKey(a.organizationId, fileId), body, mime);
      await tx.insert(sysFile).values({ id: fileId, organizationId: a.organizationId, purpose: 'property', refId: p.id, mime, bytes: body.byteLength, width: w, height: h, createdBy: a.userId });
      await tx.insert(reMedia).values({ id: mediaId, organizationId: a.organizationId, propertyId: p.id, fileId, width: w, height: h, sort: n });
      if (!p.coverId) await tx.update(reProperty).set({ coverId: mediaId, updatedAt: new Date() }).where(eq(reProperty.id, p.id));
      return { photo: { id: mediaId, url: await fileUrl(d.env, a.organizationId, fileId), width: w, height: h, caption: null }, cover: !p.coverId };
    });
    return c.json(out, 201);
  });
  /** Reorder (a list of photo ids, first to last) and choose the cover. */
  r.put('/properties/:id/photos', async (c) => {
    const a = actor(c, 'listings', 'update');
    const b = await c.req.json<{ order?: string[]; coverId?: string }>();
    await inRe(d, a, async (tx) => {
      const p = await one(tx, c.req.param('id'));
      const mine = new Set((await tx.select({ id: reMedia.id }).from(reMedia).where(eq(reMedia.propertyId, p.id))).map((x) => x.id));
      if (b.order) {
        if (!Array.isArray(b.order) || b.order.some((x) => !mine.has(x))) bad('BAD_ORDER');
        for (const [i, id] of b.order.entries()) await tx.update(reMedia).set({ sort: i }).where(eq(reMedia.id, id));
      }
      if (b.coverId !== undefined) { if (!mine.has(b.coverId)) bad('BAD_COVER'); await tx.update(reProperty).set({ coverId: b.coverId, updatedAt: new Date() }).where(eq(reProperty.id, p.id)); }
    });
    return c.json({ ok: true });
  });
  r.delete('/properties/:id/photos/:mediaId', async (c) => {
    const a = actor(c, 'listings', 'update');
    await inRe(d, a, async (tx) => {
      const p = await one(tx, c.req.param('id'));
      const [m] = await tx.delete(reMedia).where(and(eq(reMedia.id, c.req.param('mediaId')), eq(reMedia.propertyId, p.id))).returning();
      if (!m) throw new HttpError(404, 'NOT_FOUND');
      if (m.fileId) { await tx.delete(sysFile).where(eq(sysFile.id, m.fileId)); await d.files?.delete([fileKey(a.organizationId, m.fileId)]).catch(() => {}); }
      if (p.coverId === m.id) {
        const [next] = await tx.select({ id: reMedia.id }).from(reMedia).where(eq(reMedia.propertyId, p.id)).orderBy(asc(reMedia.sort)).limit(1);
        await tx.update(reProperty).set({ coverId: next?.id ?? null, ...(next ? {} : { publishedAt: null }) }).where(eq(reProperty.id, p.id)); // no photos: no public page
      }
    });
    return c.json({ ok: true });
  });

  // ---------------- many at once ----------------
  r.post('/properties/bulk', async (c) => {
    const a = actor(c, 'listings', 'update');
    const b = await c.req.json<{ ids?: string[]; action?: string; agentId?: string; status?: string }>();
    if (!Array.isArray(b.ids) || !b.ids.length || b.ids.length > 200) bad('BAD_IDS');
    const action = oneOf(b.action, ['publish', 'unpublish', 'archive', 'assign', 'status'] as const, 'BAD_ACTION');
    if ((action === 'publish' || action === 'unpublish') && !may(a.principal, 'listings', 'publish')) throw new HttpError(403, 'NOT_ALLOWED');
    const done = await inRe(d, a, async (tx) => {
      const rows = await tx.select().from(reProperty).where(inArray(reProperty.id, b.ids!));
      let n = 0; const skipped: number[] = [];
      for (const p of rows) {
        if (action === 'assign') { await checkRefs(tx, a.organizationId, { agentId: b.agentId }); await tx.update(reProperty).set({ agentId: b.agentId || null, updatedAt: new Date() }).where(eq(reProperty.id, p.id)); await activity(tx, a.organizationId, 'property.agent', { propertyId: p.id }, { from: p.agentId, to: b.agentId || null }, a.userId); n++; continue; }
        if (action === 'unpublish') { if (p.publishedAt) { await tx.update(reProperty).set({ publishedAt: null }).where(eq(reProperty.id, p.id)); n++; } continue; }
        if (action === 'publish') {
          const [{ k }] = await tx.select({ k: sql<number>`count(*)::int` }).from(reMedia).where(eq(reMedia.propertyId, p.id));
          if (!k || !PUBLIC_STATUSES.includes(p.status === 'draft' ? 'available' : p.status)) { skipped.push(p.ref); continue; }
          await tx.update(reProperty).set({ publishedAt: p.publishedAt ?? new Date(), status: p.status === 'draft' ? 'available' : p.status }).where(eq(reProperty.id, p.id)); n++; continue;
        }
        const to = action === 'archive' ? 'archived' : oneOf(b.status, RE_STATUSES, 'BAD_STATUS');
        if (p.status === to) continue;
        if (!MOVES[p.status]?.includes(to)) { skipped.push(p.ref); continue; }
        await tx.update(reProperty).set({ status: to, statusAt: new Date(), updatedAt: new Date(), ...(to === 'archived' || to === 'draft' ? { publishedAt: null } : {}) }).where(eq(reProperty.id, p.id));
        await activity(tx, a.organizationId, 'property.status', { propertyId: p.id }, { from: p.status, to }, a.userId); n++;
      }
      return { done: n, skipped };
    });
    return c.json(done);
  });

  // ---------------- documents ----------------
  /** A document (an image or a PDF) about a listing, an owner or a deal. The body is the file; details in the query. */
  r.post('/documents', async (c) => {
    const a = actor(c, 'listings', 'update');
    if (!d.files) throw new HttpError(503, 'UPLOADS_UNAVAILABLE');
    const q = c.req.query();
    if (Number(c.req.header('content-length') ?? 0) > 8 * 1024 * 1024) throw new HttpError(413, 'FILE_TOO_BIG');
    const body = await c.req.arrayBuffer();
    if (!body.byteLength || body.byteLength > 8 * 1024 * 1024) throw new HttpError(413, 'FILE_TOO_BIG');
    const mime = sniffImage(body) ?? (isPdf(body) ? 'application/pdf' : bad('NOT_A_DOCUMENT'));
    if (await isDemoOrg(d, a.organizationId)) throw new HttpError(403, 'NOT_IN_DEMO');
    const title = str(q.title, 120, 'BAD_TITLE', true)!;
    const kind = oneOf(q.kind, ['deed', 'contract', 'id', 'inspection', 'commission', 'other'] as const, 'BAD_KIND', 'other');
    if (!q.propertyId && !q.ownerId && !q.dealId) bad('BAD_REF');
    const out = await inRe(d, a, async (tx) => {
      if (q.propertyId) await one(tx, q.propertyId);
      if (q.ownerId) { const [o] = await tx.select({ id: reOwner.id }).from(reOwner).where(eq(reOwner.id, q.ownerId)); if (!o) bad('BAD_OWNER'); }
      if (q.dealId) { const [x] = await tx.select({ id: reDeal.id }).from(reDeal).where(eq(reDeal.id, q.dealId)); if (!x) bad('BAD_DEAL'); }
      const fileId = newId(), id = newId();
      await d.files!.put(fileKey(a.organizationId, fileId), body, mime);
      await tx.insert(sysFile).values({ id: fileId, organizationId: a.organizationId, purpose: 'redoc', refId: id, mime, bytes: body.byteLength, createdBy: a.userId });
      const [row] = await tx.insert(reDocument).values({ id, organizationId: a.organizationId, fileId, kind, title, propertyId: q.propertyId || null, ownerId: q.ownerId || null, dealId: q.dealId || null,
        expiresOn: dateOnly(q.expiresOn), notes: str(q.notes, 500, 'BAD_TEXT'), createdBy: a.userId }).returning();
      await activity(tx, a.organizationId, 'document.added', { propertyId: row.propertyId, ownerId: row.ownerId, dealId: row.dealId }, { title, kind }, a.userId);
      return { ...row, url: await fileUrl(d.env, a.organizationId, fileId, 3600) };
    });
    return c.json({ document: out }, 201);
  });
  r.get('/documents', async (c) => {
    const a = actor(c, 'listings', 'read');
    const q = c.req.query();
    const out = await inRe(d, a, async (tx) => {
      const w = q.propertyId ? eq(reDocument.propertyId, q.propertyId) : q.ownerId ? eq(reDocument.ownerId, q.ownerId) : q.dealId ? eq(reDocument.dealId, q.dealId)
        : q.expiring ? and(sql`${reDocument.expiresOn} is not null`, lte(reDocument.expiresOn, new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10))) : undefined;
      const rows = await tx.select().from(reDocument).where(w).orderBy(desc(reDocument.createdAt)).limit(100);
      return Promise.all(rows.map(async (x) => ({ ...x, url: await fileUrl(d.env, a.organizationId, x.fileId, 3600) })));
    });
    return c.json({ documents: out });
  });
  r.delete('/documents/:id', async (c) => {
    const a = actor(c, 'listings', 'archive');
    await inRe(d, a, async (tx) => {
      const [x] = await tx.delete(reDocument).where(eq(reDocument.id, c.req.param('id'))).returning();
      if (!x) throw new HttpError(404, 'NOT_FOUND');
      await tx.delete(sysFile).where(eq(sysFile.id, x.fileId));
      await d.files?.delete([fileKey(a.organizationId, x.fileId)]).catch(() => {});
      await activity(tx, a.organizationId, 'document.removed', { propertyId: x.propertyId, ownerId: x.ownerId, dealId: x.dealId }, { title: x.title }, a.userId);
    });
    return c.json({ ok: true });
  });

  return r;
}
