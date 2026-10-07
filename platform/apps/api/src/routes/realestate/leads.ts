// Leads: what this person wants, and what to do next. A lead's page answers it in one place — their requirements, the
// listings that fit (with why), what was already sent and opened, their viewings, the next follow-up. Owners too: the
// people whose homes the agency sells, with their listings' activity and a report link to send them.
import { Hono } from 'hono';
import { and, asc, desc, eq, inArray, isNull, lte, ne, notInArray, or, sql, type SQL } from 'drizzle-orm';
import { newId } from '@hemlo/core';
import type { Database } from '@hemlo/db';
import { reLead, reLeadProperty, reProperty, reViewing, reFollowup, reDeal, reActivity, reCollection, reOwner, reReport, reDocument } from '@hemlo/db/schema';
import { HttpError } from '../../principal';
import { actor, bad, may, type Actor } from '../sys-common';
import { fileUrl } from '../../files';
import {
  inRe, rowsOf, str, amount, intIn, oneOf, words, phone, activity, notice, settingsOf, leadScope, leadOf, memberOf, like, token, SITE, priceText, waLink,
  RE_TYPES, RE_SOURCES, CURRENCIES,
} from './common';
import { cardCols, withCovers, asWants, shareOf } from './properties';
import { rank } from './match';
import type { AppEnv, Deps } from '../../types';

export const LEAD_STATUSES = ['new', 'active', 'viewing', 'negotiating', 'won', 'lost'] as const;
export const OPEN_LEAD = ['new', 'active', 'viewing', 'negotiating'];

function leadInput(b: any, partial = false) {
  const out: Partial<typeof reLead.$inferInsert> = {};
  if (!partial || b.name !== undefined) out.name = str(b.name, 100, 'BAD_NAME', true)!;
  if (b.phone !== undefined) out.phone = phone(b.phone);
  if (b.whatsapp !== undefined) out.whatsapp = phone(b.whatsapp);
  if (b.email !== undefined) { out.email = str(b.email, 120, 'BAD_EMAIL'); if (out.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(out.email)) bad('BAD_EMAIL'); }
  if (b.lang !== undefined) out.lang = oneOf(b.lang, ['ar', 'en', 'ckb'] as const, 'BAD_LANG', 'ar');
  if (b.purpose !== undefined) out.purpose = oneOf(b.purpose, ['sale', 'rent'] as const, 'BAD_PURPOSE', 'sale');
  if (b.source !== undefined) out.source = oneOf(b.source, RE_SOURCES, 'BAD_SOURCE', 'other');
  if (b.status !== undefined) out.status = oneOf(b.status, LEAD_STATUSES, 'BAD_STATUS');
  if (b.budgetMin !== undefined) out.budgetMin = amount(b.budgetMin, 'BAD_BUDGET');
  if (b.budgetMax !== undefined) out.budgetMax = amount(b.budgetMax, 'BAD_BUDGET');
  if (out.budgetMin != null && out.budgetMax != null && out.budgetMin > out.budgetMax) bad('BAD_BUDGET');
  if (b.currency !== undefined) out.currency = oneOf(b.currency, CURRENCIES, 'BAD_CURRENCY');
  if (b.types !== undefined) { out.types = words(b.types, 10, 20, 'BAD_TYPE'); if (out.types.some((t) => !RE_TYPES.includes(t as any))) bad('BAD_TYPE'); }
  if (b.areas !== undefined) out.areas = words(b.areas, 12, 80, 'BAD_AREA');
  if (b.city !== undefined) out.city = str(b.city, 60, 'BAD_CITY');
  for (const k of ['bedrooms', 'bathrooms'] as const) if (b[k] !== undefined) out[k] = intIn(b[k], 0, 50, 'BAD_ROOMS');
  if (b.sizeMin !== undefined) out.sizeMin = intIn(b.sizeMin, 1, 1_000_000, 'BAD_SIZE');
  if (b.sizeMax !== undefined) out.sizeMax = intIn(b.sizeMax, 1, 1_000_000, 'BAD_SIZE');
  if (b.must !== undefined) out.must = words(b.must, 20, 40, 'BAD_FEATURES');
  if (b.notes !== undefined) out.notes = str(b.notes, 4000, 'BAD_TEXT');
  if (b.consent !== undefined) out.consent = !!b.consent;
  if (b.agentId !== undefined) out.agentId = b.agentId || null;
  return out;
}

/** Listings for a lead, best first (excluding ones they turned down), with why. */
export async function matchesFor(d: Deps, tx: Database, org: string, lead: any, limit = 30) {
  const s = await settingsOf(tx, org);
  const dismissed = (await tx.select({ id: reLeadProperty.propertyId }).from(reLeadProperty).where(and(eq(reLeadProperty.leadId, lead.id), eq(reLeadProperty.status, 'dismissed')))).map((x) => x.id);
  const w: (SQL | undefined)[] = [eq(reProperty.purpose, lead.purpose), inArray(reProperty.status, ['available', 'negotiating'])];
  if (lead.types?.length) w.push(inArray(reProperty.type, lead.types));
  if (dismissed.length) w.push(notInArray(reProperty.id, dismissed));
  const candidates = await tx.select(cardCols).from(reProperty).where(and(...w)).limit(3000);
  const ranked = rank(asWants(lead), candidates.map((p) => ({ ...p, price: p.price == null ? null : Number(p.price) })), s.usdRate);
  const sent = new Map((await tx.select({ id: reLeadProperty.propertyId, status: reLeadProperty.status, opens: reLeadProperty.opens }).from(reLeadProperty).where(eq(reLeadProperty.leadId, lead.id))).map((x) => [x.id, x]));
  const top = ranked.slice(0, limit);
  const cards = await withCovers(d, tx, org, top.map((x) => x.p));
  return { total: ranked.length, matches: top.map((x, i) => ({ property: cards[i], score: x.m.score, reasons: x.m.reasons, sent: sent.get(x.p.id) ?? null })) };
}

export function reLeadRoutes(d: Deps) {
  const r = new Hono<AppEnv>();
  const checkAgent = async (tx: Database, org: string, agentId: string | null | undefined) => {
    if (!agentId) return;
    const [m] = rowsOf(await tx.execute(sql`select 1 from member where id = ${agentId} and organization_id = ${org}`));
    if (!m) bad('BAD_AGENT');
  };

  r.get('/leads', async (c) => {
    const a = actor(c, 'leads', 'read');
    const q = c.req.query();
    const w: (SQL | undefined)[] = [leadScope(a), q.archived === '1' ? sql`${reLead.archivedAt} is not null` : isNull(reLead.archivedAt)];
    if (q.status === 'open') w.push(inArray(reLead.status, OPEN_LEAD));
    else if (q.status) w.push(eq(reLead.status, oneOf(q.status, LEAD_STATUSES, 'BAD_STATUS')));
    if (q.agent === 'me') w.push(eq(reLead.agentId, memberOf(a) ?? '-'));
    else if (q.agent === 'none') w.push(isNull(reLead.agentId));
    else if (q.agent) w.push(eq(reLead.agentId, q.agent));
    if (q.source) w.push(eq(reLead.source, oneOf(q.source, RE_SOURCES, 'BAD_SOURCE')));
    if (q.purpose) w.push(eq(reLead.purpose, oneOf(q.purpose, ['sale', 'rent'] as const, 'BAD_PURPOSE')));
    if (q.due === '1') w.push(lte(reLead.nextFollowAt, new Date()));
    if (q.quiet === '1') w.push(and(inArray(reLead.status, OPEN_LEAD), or(isNull(reLead.lastContactAt), lte(reLead.lastContactAt, new Date(Date.now() - 7 * 86400_000))), isNull(reLead.nextFollowAt)));
    if (q.q) { const s = q.q.trim(); const digits = s.replace(/\D/g, ''); w.push(or(like(reLead.name, s), digits.length >= 4 ? like(reLead.phone, digits.slice(-9)) : undefined, like(reLead.email, s))); }
    const limit = Math.min(100, Number(q.limit) || 40), offset = Math.max(0, Number(q.offset) || 0);
    const out = await inRe(d, a, async (tx) => {
      const where = and(...w);
      const rows = await tx.select().from(reLead).where(where).orderBy(sql`${reLead.nextFollowAt} asc nulls last`, desc(reLead.updatedAt)).limit(limit).offset(offset);
      const [n] = await tx.select({ n: sql<number>`count(*)::int` }).from(reLead).where(where);
      return { leads: rows, total: n.n };
    });
    return c.json(out);
  });

  /** One lead, in context: what they want, what fits, what they've seen, what's next. */
  r.get('/leads/:id', async (c) => {
    const a = actor(c, 'leads', 'read');
    const out = await inRe(d, a, async (tx) => {
      const lead = await leadOf(tx, a, c.req.param('id'));
      const [m, sentRows, viewings, followups, deals, events, collections] = await Promise.all([
        matchesFor(d, tx, a.organizationId, lead, 12),
        tx.select({ lp: reLeadProperty, p: cardCols }).from(reLeadProperty).innerJoin(reProperty, eq(reProperty.id, reLeadProperty.propertyId)).where(eq(reLeadProperty.leadId, lead.id)).orderBy(desc(reLeadProperty.sentAt)).limit(60),
        tx.select({ v: reViewing, p: { id: reProperty.id, ref: reProperty.ref, title: reProperty.title, area: reProperty.area, slug: reProperty.slug } }).from(reViewing).innerJoin(reProperty, eq(reProperty.id, reViewing.propertyId)).where(eq(reViewing.leadId, lead.id)).orderBy(desc(reViewing.startsAt)),
        tx.select().from(reFollowup).where(and(eq(reFollowup.leadId, lead.id), isNull(reFollowup.doneAt))).orderBy(asc(reFollowup.dueAt)),
        tx.select({ deal: reDeal, p: { id: reProperty.id, ref: reProperty.ref, title: reProperty.title } }).from(reDeal).innerJoin(reProperty, eq(reProperty.id, reDeal.propertyId)).where(eq(reDeal.leadId, lead.id)).orderBy(desc(reDeal.updatedAt)),
        tx.select().from(reActivity).where(eq(reActivity.leadId, lead.id)).orderBy(desc(reActivity.at)).limit(50),
        tx.select().from(reCollection).where(and(eq(reCollection.leadId, lead.id), isNull(reCollection.archivedAt))).orderBy(desc(reCollection.createdAt)),
      ]);
      const sentCards = await withCovers(d, tx, a.organizationId, sentRows.map((x) => x.p));
      return {
        lead, matches: m.matches, matchCount: m.total,
        sent: sentRows.map((x, i) => ({ ...x.lp, property: sentCards[i] })),
        viewings: viewings.map((x) => ({ ...x.v, property: x.p })), followups, deals: deals.map((x) => ({ ...x.deal, property: x.p })), activity: events,
        collections: collections.map((x) => ({ ...x, url: `${SITE(d)}/c/${x.token}` })),
      };
    });
    return c.json(out);
  });

  r.get('/leads/:id/matches', async (c) => {
    const a = actor(c, 'leads', 'read');
    const out = await inRe(d, a, async (tx) => matchesFor(d, tx, a.organizationId, await leadOf(tx, a, c.req.param('id')), 60));
    return c.json(out);
  });

  /** A new lead. The same phone already here? Say so (and which lead), instead of making a twin. */
  r.post('/leads', async (c) => {
    const a = actor(c, 'leads', 'create');
    const b = await c.req.json<any>();
    const input = leadInput(b);
    if (input.agentId && input.agentId !== memberOf(a) && !may(a.principal, 'leads', 'assign')) throw new HttpError(403, 'NOT_ALLOWED');
    const out = await inRe(d, a, async (tx) => {
      await checkAgent(tx, a.organizationId, input.agentId);
      if (input.phone && !b.force) {
        const [twin] = await tx.select({ id: reLead.id, name: reLead.name, agentId: reLead.agentId }).from(reLead).where(and(eq(reLead.phone, input.phone), isNull(reLead.archivedAt)));
        if (twin) throw Object.assign(new HttpError(409, 'LEAD_EXISTS'), { twin });
      }
      const settings = await settingsOf(tx, a.organizationId);
      const id = newId();
      const [lead] = await tx.insert(reLead).values({ id, organizationId: a.organizationId, currency: settings.currency, city: settings.city, agentId: input.agentId === undefined ? memberOf(a) : input.agentId,
        createdBy: a.userId, lastContactAt: new Date(), ...input, whatsapp: input.whatsapp ?? input.phone ?? null } as any).returning();
      await activity(tx, a.organizationId, 'lead.created', { leadId: id }, { source: lead.source }, a.userId);
      const m = await matchesFor(d, tx, a.organizationId, lead, 8);
      return { lead, matches: m.matches, matchCount: m.total };
    }).catch((e) => { if (e?.twin) return { error: 'LEAD_EXISTS', twin: e.twin } as const; throw e; });
    if ('error' in out) return c.json(out, 409);
    return c.json(out, 201);
  });

  r.patch('/leads/:id', async (c) => {
    const a = actor(c, 'leads', 'update');
    const input = leadInput(await c.req.json<any>(), true);
    const row = await inRe(d, a, async (tx) => {
      const lead = await leadOf(tx, a, c.req.param('id'));
      if (input.agentId !== undefined && input.agentId !== lead.agentId) {
        if (!may(a.principal, 'leads', 'assign') && !(lead.agentId == null && input.agentId === memberOf(a))) throw new HttpError(403, 'NOT_ALLOWED'); // an agent may take an unassigned lead
        await checkAgent(tx, a.organizationId, input.agentId);
      }
      const [row] = await tx.update(reLead).set({ ...input, updatedAt: new Date() }).where(eq(reLead.id, lead.id)).returning();
      if (input.agentId !== undefined && input.agentId !== lead.agentId) {
        await activity(tx, a.organizationId, 'lead.assigned', { leadId: lead.id }, { from: lead.agentId, to: input.agentId }, a.userId);
        if (input.agentId) await notice(tx, a.organizationId, 'lead_assigned', { leadId: lead.id, agentId: input.agentId }, { name: lead.name });
      }
      if (input.status && input.status !== lead.status) await activity(tx, a.organizationId, 'lead.status', { leadId: lead.id }, { from: lead.status, to: input.status }, a.userId);
      const req = ['budgetMin', 'budgetMax', 'types', 'areas', 'bedrooms', 'sizeMin', 'sizeMax', 'purpose', 'must'].filter((k) => (input as any)[k] !== undefined);
      if (req.length) await activity(tx, a.organizationId, 'lead.requirements', { leadId: lead.id }, { changed: req }, a.userId);
      return row;
    });
    return c.json({ lead: row });
  });

  r.post('/leads/:id/archive', async (c) => {
    const a = actor(c, 'leads', 'update');
    const b = await c.req.json<{ on?: boolean; reason?: string }>().catch(() => ({} as any));
    const row = await inRe(d, a, async (tx) => {
      const lead = await leadOf(tx, a, c.req.param('id'));
      const on = b.on !== false;
      const [row] = await tx.update(reLead).set({ archivedAt: on ? new Date() : null, status: on && OPEN_LEAD.includes(lead.status) ? 'lost' : lead.status, updatedAt: new Date() }).where(eq(reLead.id, lead.id)).returning();
      if (on) await tx.update(reFollowup).set({ doneAt: new Date() }).where(and(eq(reFollowup.leadId, lead.id), isNull(reFollowup.doneAt)));
      await activity(tx, a.organizationId, on ? 'lead.archived' : 'lead.restored', { leadId: lead.id }, { reason: str(b.reason, 200, 'BAD_TEXT') }, a.userId);
      return row;
    });
    return c.json({ lead: row });
  });

  /** Send listings to a lead: remembered (so they're never sent twice by mistake), and one WhatsApp message ready to go. */
  r.post('/leads/:id/send', async (c) => {
    const a = actor(c, 'leads', 'update');
    const b = await c.req.json<{ propertyIds?: string[]; channel?: string }>();
    if (!Array.isArray(b.propertyIds) || !b.propertyIds.length || b.propertyIds.length > 10) bad('BAD_IDS');
    const out = await inRe(d, a, async (tx) => {
      const lead = await leadOf(tx, a, c.req.param('id'));
      const props = await tx.select().from(reProperty).where(and(inArray(reProperty.id, b.propertyIds!), sql`${reProperty.publishedAt} is not null`));
      if (props.length !== b.propertyIds!.length) throw new HttpError(409, 'NOT_PUBLISHED'); // only listings with a page can be sent
      const s = await settingsOf(tx, a.organizationId);
      const lang = lead.lang === 'en' ? 'en' : 'ar';
      const now = new Date();
      for (const p of props) {
        await tx.insert(reLeadProperty).values({ id: newId(), organizationId: a.organizationId, leadId: lead.id, propertyId: p.id, status: 'sent', sentAt: now })
          .onConflictDoUpdate({ target: [reLeadProperty.leadId, reLeadProperty.propertyId], set: { sentAt: now, status: sql`case when ${reLeadProperty.status} = 'dismissed' then 'sent' else ${reLeadProperty.status} end` } });
        await activity(tx, a.organizationId, 'lead.sent', { leadId: lead.id, propertyId: p.id }, { channel: b.channel ?? 'whatsapp' }, a.userId);
      }
      await tx.update(reLead).set({ lastContactAt: now, status: lead.status === 'new' ? 'active' : lead.status, updatedAt: now }).where(eq(reLead.id, lead.id));
      // one message: a single listing's full message, or a short list with each link (the lead tracks opens per link)
      const link = (p: any) => `${SITE(d)}/p/${p.slug}?l=${lead.id.slice(0, 10)}`;
      const text = props.length === 1 ? shareOf(d, { ...props[0], slug: `${props[0].slug}?l=${lead.id.slice(0, 10)}` }, s).text[lang]
        : [lang === 'ar' ? `مرحباً ${lead.name}، هذه عقارات قد تناسبك:` : `Hi ${lead.name}, here are some homes that may suit you:`,
          ...props.map((p, i) => `\n${i + 1}. ${(lang === 'en' && p.titleEn) || p.title}\n${priceText(p.price == null ? null : Number(p.price), p.currency, lang, p.purpose === 'rent' ? p.rentPeriod : null)}${p.area ? ' · ' + p.area : ''}\n${link(p)}`)].join('\n');
      return { text, wa: waLink(lead.whatsapp ?? lead.phone, text), sent: props.length };
    });
    return c.json(out);
  });

  /** "I called / messaged them": the last contact, and what was said. */
  r.post('/leads/:id/contact', async (c) => {
    const a = actor(c, 'leads', 'update');
    const b = await c.req.json<{ channel?: string; note?: string }>().catch(() => ({} as any));
    await inRe(d, a, async (tx) => {
      const lead = await leadOf(tx, a, c.req.param('id'));
      await tx.update(reLead).set({ lastContactAt: new Date(), status: lead.status === 'new' ? 'active' : lead.status, updatedAt: new Date() }).where(eq(reLead.id, lead.id));
      await activity(tx, a.organizationId, 'lead.contacted', { leadId: lead.id }, { channel: oneOf(b.channel, ['call', 'whatsapp', 'meeting', 'note'] as const, 'BAD_CHANNEL', 'call'), note: str(b.note, 1000, 'BAD_TEXT') }, a.userId);
    });
    return c.json({ ok: true });
  });

  /** "Not for them": the matcher stops offering this listing to this lead. */
  r.post('/leads/:id/dismiss', async (c) => {
    const a = actor(c, 'leads', 'update');
    const b = await c.req.json<{ propertyId?: string; undo?: boolean }>();
    await inRe(d, a, async (tx) => {
      const lead = await leadOf(tx, a, c.req.param('id'));
      if (!b.propertyId) bad('BAD_PROPERTY');
      if (b.undo) await tx.delete(reLeadProperty).where(and(eq(reLeadProperty.leadId, lead.id), eq(reLeadProperty.propertyId, b.propertyId!), eq(reLeadProperty.status, 'dismissed')));
      else await tx.insert(reLeadProperty).values({ id: newId(), organizationId: a.organizationId, leadId: lead.id, propertyId: b.propertyId!, status: 'dismissed' })
        .onConflictDoUpdate({ target: [reLeadProperty.leadId, reLeadProperty.propertyId], set: { status: 'dismissed' } });
    });
    return c.json({ ok: true });
  });

  // ================= owners =================
  const ownerInput = (b: any, partial = false) => {
    const out: Partial<typeof reOwner.$inferInsert> = {};
    if (!partial || b.name !== undefined) out.name = str(b.name, 100, 'BAD_NAME', true)!;
    if (b.phone !== undefined) out.phone = phone(b.phone);
    if (b.whatsapp !== undefined) out.whatsapp = phone(b.whatsapp);
    if (b.email !== undefined) out.email = str(b.email, 120, 'BAD_EMAIL');
    if (b.lang !== undefined) out.lang = oneOf(b.lang, ['ar', 'en', 'ckb'] as const, 'BAD_LANG', 'ar');
    if (b.notes !== undefined) out.notes = str(b.notes, 4000, 'BAD_TEXT');
    if (b.agentId !== undefined) out.agentId = b.agentId || null;
    if (b.commission !== undefined) out.commission = b.commission ? { kind: oneOf(b.commission.kind, ['percent', 'fixed'] as const, 'BAD_COMMISSION'), value: amount(b.commission.value, 'BAD_COMMISSION', false)!, note: str(b.commission.note, 200, 'BAD_TEXT') ?? undefined } : null;
    return out;
  };

  r.get('/owners', async (c) => {
    const a = actor(c, 'listings', 'read');
    const q = c.req.query();
    const w: (SQL | undefined)[] = [isNull(reOwner.archivedAt)];
    if (q.q) { const s = q.q.trim(); const dg = s.replace(/\D/g, ''); w.push(or(like(reOwner.name, s), dg.length >= 4 ? like(reOwner.phone, dg.slice(-9)) : undefined)); }
    const rows = await inRe(d, a, async (tx) => tx.select({ o: reOwner, listings: sql<number>`(select count(*)::int from re_property p where p.owner_id = ${reOwner.id} and p.status <> 'archived')`,
      live: sql<number>`(select count(*)::int from re_property p where p.owner_id = ${reOwner.id} and p.status in ('available','negotiating','reserved'))` })
      .from(reOwner).where(and(...w)).orderBy(desc(reOwner.updatedAt)).limit(Math.min(100, Number(q.limit) || 50)).offset(Math.max(0, Number(q.offset) || 0)));
    return c.json({ owners: rows.map((x) => ({ ...x.o, listings: x.listings, live: x.live })) });
  });

  r.get('/owners/:id', async (c) => {
    const a = actor(c, 'listings', 'read');
    const out = await inRe(d, a, async (tx) => {
      const [owner] = await tx.select().from(reOwner).where(eq(reOwner.id, c.req.param('id')));
      if (!owner) throw new HttpError(404, 'OWNER_NOT_FOUND');
      const props = await tx.select(cardCols).from(reProperty).where(eq(reProperty.ownerId, owner.id)).orderBy(desc(reProperty.updatedAt));
      const ids = props.map((p) => p.id);
      const [viewings, deals, events, docs] = ids.length ? await Promise.all([
        tx.select({ propertyId: reViewing.propertyId, n: sql<number>`count(*) filter (where ${reViewing.status} = 'completed')::int`, upcoming: sql<number>`count(*) filter (where ${reViewing.status} in ('scheduled','confirmed') and ${reViewing.startsAt} > now())::int` })
          .from(reViewing).where(inArray(reViewing.propertyId, ids)).groupBy(reViewing.propertyId),
        tx.select().from(reDeal).where(inArray(reDeal.propertyId, ids)).orderBy(desc(reDeal.updatedAt)),
        tx.select().from(reActivity).where(or(eq(reActivity.ownerId, owner.id), inArray(reActivity.propertyId, ids))).orderBy(desc(reActivity.at)).limit(40),
        tx.select().from(reDocument).where(eq(reDocument.ownerId, owner.id)).orderBy(desc(reDocument.createdAt)),
      ]) : [[], [], await tx.select().from(reActivity).where(eq(reActivity.ownerId, owner.id)).orderBy(desc(reActivity.at)).limit(40), await tx.select().from(reDocument).where(eq(reDocument.ownerId, owner.id))];
      const v = new Map(viewings.map((x: any) => [x.propertyId, x]));
      return { owner, properties: (await withCovers(d, tx, a.organizationId, props)).map((p) => ({ ...p, viewings: v.get(p.id)?.n ?? 0, upcoming: v.get(p.id)?.upcoming ?? 0 })),
        deals, activity: events, documents: await Promise.all((docs as any[]).map(async (x) => ({ ...x, url: await fileUrl(d.env, a.organizationId, x.fileId, 3600) }))) };
    });
    return c.json(out);
  });

  r.post('/owners', async (c) => {
    const a = actor(c, 'listings', 'create');
    const b = await c.req.json<any>();
    const input = ownerInput(b);
    const out = await inRe(d, a, async (tx) => {
      if (input.phone && !b.force) {
        const [twin] = await tx.select({ id: reOwner.id, name: reOwner.name }).from(reOwner).where(and(eq(reOwner.phone, input.phone), isNull(reOwner.archivedAt)));
        if (twin) return { error: 'OWNER_EXISTS', twin } as const;
      }
      const [row] = await tx.insert(reOwner).values({ id: newId(), organizationId: a.organizationId, agentId: memberOf(a), createdBy: a.userId, ...input, whatsapp: input.whatsapp ?? input.phone ?? null } as any).returning();
      await activity(tx, a.organizationId, 'owner.created', { ownerId: row.id }, {}, a.userId);
      return { owner: row };
    });
    if ('error' in out) return c.json(out, 409);
    return c.json(out, 201);
  });
  r.patch('/owners/:id', async (c) => {
    const a = actor(c, 'listings', 'update');
    const input = ownerInput(await c.req.json<any>(), true);
    const [row] = await inRe(d, a, (tx) => tx.update(reOwner).set({ ...input, updatedAt: new Date() }).where(eq(reOwner.id, c.req.param('id'))).returning());
    if (!row) throw new HttpError(404, 'OWNER_NOT_FOUND');
    return c.json({ owner: row });
  });

  /** A report link for an owner (one listing's activity), valid 60 days, with the WhatsApp message to send it. */
  r.post('/owners/reports', async (c) => {
    const a = actor(c, 'listings', 'read');
    const b = await c.req.json<{ propertyId?: string; note?: string }>();
    const out = await inRe(d, a, async (tx) => {
      const [p] = await tx.select().from(reProperty).where(eq(reProperty.id, String(b.propertyId ?? '')));
      if (!p) throw new HttpError(404, 'PROPERTY_NOT_FOUND');
      const [o] = p.ownerId ? await tx.select().from(reOwner).where(eq(reOwner.id, p.ownerId)) : [];
      const t = token(12);
      await tx.insert(reReport).values({ id: newId(), organizationId: a.organizationId, token: t, propertyId: p.id, ownerId: p.ownerId, note: str(b.note, 600, 'BAD_TEXT'), createdBy: a.userId, expiresAt: new Date(Date.now() + 60 * 86400_000) });
      await activity(tx, a.organizationId, 'owner.report', { propertyId: p.id, ownerId: p.ownerId }, {}, a.userId);
      const url = `${SITE(d)}/r/${t}`, lang = o?.lang === 'en' ? 'en' : 'ar';
      const text = lang === 'ar' ? `مرحباً ${o?.name ?? ''}، هذا تقرير عقارك (${p.title}) حتى اليوم: المشاهدات والاستفسارات والمعاينات والعروض.\n${url}` : `Hello ${o?.name ?? ''}, here is your property's report (${p.titleEn || p.title}) so far: views, inquiries, viewings and offers.\n${url}`;
      return { url, text, wa: o ? waLink(o.whatsapp ?? o.phone, text) : null };
    });
    return c.json(out, 201);
  });

  return r;
}
