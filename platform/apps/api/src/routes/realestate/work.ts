// The agent's work between "interested" and "closed": collections (one link for a shortlist), viewings (no double
// bookings), follow-ups (nobody forgotten), deals (the negotiation step by step) and the commission. Each change keeps
// the rest honest: a closed deal sells the home, wins the lead and sets the other offers aside.
import { Hono } from 'hono';
import { and, asc, desc, eq, gte, inArray, isNull, lt, lte, ne, or, sql, type SQL } from 'drizzle-orm';
import { newId } from '@hemlo/core';
import type { Database } from '@hemlo/db';
import { reCollection, reCollectionItem, reProperty, reLead, reLeadProperty, reViewing, reFollowup, reDeal, reOffer, rePayment, reOwner, reActivity, reAgent, reDocument } from '@hemlo/db/schema';
import { HttpError } from '../../principal';
import { actor, bad, may, type Actor } from '../sys-common';
import { fileUrl } from '../../files';
import { inRe, rowsOf, str, amount, intIn, oneOf, when, dateOnly, activity, notice, settingsOf, leadOf, leadScope, memberOf, token, SITE, waLink, today, dayStart } from './common';
import { cardCols, withCovers } from './properties';
import type { AppEnv, Deps } from '../../types';

export const VIEWING_STATUSES = ['requested', 'scheduled', 'confirmed', 'completed', 'cancelled', 'no_show'] as const;
export const DEAL_STAGES = ['interested', 'viewing', 'offer', 'negotiation', 'reserved', 'closed', 'lost'] as const;
export const OPEN_DEAL = ['interested', 'viewing', 'offer', 'negotiation', 'reserved'];
export const FOLLOW_KINDS = ['call', 'whatsapp', 'send', 'viewing', 'negotiation', 'other'] as const;

/** The commission a deal brings (on the agreed price, else the asking), and the agent's part of it. */
export function commissionOf(x: { agreed: number | null; asking: number | null; commissionKind: string; commissionValue: number; agentShare: number }) {
  const price = Number(x.agreed ?? x.asking ?? 0);
  const total = x.commissionKind === 'fixed' ? Number(x.commissionValue) : Math.round((price * Number(x.commissionValue)) / 10_000);
  return { total, agent: Math.round((total * x.agentShare) / 10_000) };
}
/** An agent sees their own deals' money; managers and accountants see everyone's. */
const dealScope = (a: Actor): SQL | undefined => (may(a.principal, 'leads', 'read-all') || may(a.principal, 'commission', 'read') ? undefined : or(eq(reDeal.agentId, memberOf(a) ?? '-'), isNull(reDeal.agentId)));
const money = (a: Actor, deal: any) => may(a.principal, 'commission', 'read') || deal.agentId === memberOf(a);

/** The lead's next follow-up date (the earliest open one), kept on the lead for lists and the brief. */
export async function refreshNext(tx: Database, leadId: string | null | undefined) {
  if (!leadId) return;
  await tx.update(reLead).set({ nextFollowAt: sql`(select min(due_at) from re_followup where lead_id = ${leadId} and done_at is null)` }).where(eq(reLead.id, leadId));
}

/** WhatsApp texts for a viewing: confirm it, or remind them. */
export function viewingText(kind: 'confirm' | 'remind', lang: 'ar' | 'en', v: { startsAt: Date | null }, p: { title: string; titleEn?: string | null; area: string | null; slug: string }, name: string, agentName: string | null, site: string) {
  const t = v.startsAt ? new Intl.DateTimeFormat(lang === 'ar' ? 'ar-IQ' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Baghdad' }).format(v.startsAt) : '';
  const title = (lang === 'en' && p.titleEn) || p.title, link = `${site}/p/${p.slug}`;
  if (lang === 'ar') return kind === 'confirm'
    ? `مرحباً ${name}، تم تأكيد موعد معاينة ${title}${p.area ? ' في ' + p.area : ''}:\n🗓 ${t}${agentName ? `\nسيكون معك ${agentName}.` : ''}\n${link}`
    : `تذكير لطيف يا ${name}: معاينة ${title} ${t}.\nإذا تغيّر شيء أخبرنا هنا.\n${link}`;
  return kind === 'confirm'
    ? `Hi ${name}, your viewing of ${title}${p.area ? ' in ' + p.area : ''} is confirmed:\n🗓 ${t}${agentName ? `\n${agentName} will meet you there.` : ''}\n${link}`
    : `A quick reminder, ${name}: your viewing of ${title} is ${t}.\nIf anything changes, just reply here.\n${link}`;
}

export function reWorkRoutes(d: Deps) {
  const r = new Hono<AppEnv>();
  const prop = async (tx: Database, id: string) => { const [p] = await tx.select().from(reProperty).where(eq(reProperty.id, id)); if (!p) throw new HttpError(404, 'PROPERTY_NOT_FOUND'); return p; };
  const agentName = async (tx: Database, memberId: string | null) => { if (!memberId) return null; const [x] = rowsOf(await tx.execute(sql`select coalesce(a.name, u.name) as name from member m join "user" u on u.id = m.user_id left join re_agent a on a.member_id = m.id where m.id = ${memberId}`)); return (x?.name as string) ?? null; };

  // ================= collections =================
  r.get('/collections', async (c) => {
    const a = actor(c, 'listings', 'read');
    const leadId = c.req.query('leadId');
    const rows = await inRe(d, a, (tx) => tx.select({ c: reCollection, items: sql<number>`(select count(*)::int from re_collection_item i where i.collection_id = ${reCollection.id})`,
      favs: sql<number>`(select count(*)::int from re_collection_item i where i.collection_id = ${reCollection.id} and i.favorite)`, lead: { id: reLead.id, name: reLead.name } })
      .from(reCollection).leftJoin(reLead, eq(reLead.id, reCollection.leadId)).where(and(isNull(reCollection.archivedAt), leadId ? eq(reCollection.leadId, leadId) : undefined)).orderBy(desc(reCollection.createdAt)).limit(100));
    return c.json({ collections: rows.map((x) => ({ ...x.c, items: x.items, favorites: x.favs, lead: x.lead, url: `${SITE(d)}/c/${x.c.token}` })) });
  });
  r.get('/collections/:id', async (c) => {
    const a = actor(c, 'listings', 'read');
    const out = await inRe(d, a, async (tx) => {
      const [col] = await tx.select().from(reCollection).where(eq(reCollection.id, c.req.param('id')));
      if (!col) throw new HttpError(404, 'NOT_FOUND');
      const items = await tx.select({ i: reCollectionItem, p: cardCols }).from(reCollectionItem).innerJoin(reProperty, eq(reProperty.id, reCollectionItem.propertyId)).where(eq(reCollectionItem.collectionId, col.id)).orderBy(asc(reCollectionItem.sort));
      const cards = await withCovers(d, tx, a.organizationId, items.map((x) => x.p));
      const [lead] = col.leadId ? await tx.select({ id: reLead.id, name: reLead.name, phone: reLead.phone, whatsapp: reLead.whatsapp, lang: reLead.lang }).from(reLead).where(eq(reLead.id, col.leadId)) : [];
      return { collection: { ...col, url: `${SITE(d)}/c/${col.token}` }, lead: lead ?? null, items: items.map((x, i) => ({ ...x.i, property: cards[i] })) };
    });
    return c.json(out);
  });
  /** A shortlist for someone, as one link (and the WhatsApp message that carries it). */
  r.post('/collections', async (c) => {
    const a = actor(c, 'listings', 'read');
    const b = await c.req.json<any>();
    const title = str(b.title, 100, 'BAD_TITLE', true)!;
    if (!Array.isArray(b.propertyIds) || b.propertyIds.length > 30) bad('BAD_IDS');
    const out = await inRe(d, a, async (tx) => {
      const lead = b.leadId ? await leadOf(tx, a, b.leadId) : null;
      const props = b.propertyIds.length ? await tx.select({ id: reProperty.id, publishedAt: reProperty.publishedAt }).from(reProperty).where(inArray(reProperty.id, b.propertyIds)) : [];
      if (props.length !== b.propertyIds.length) bad('BAD_IDS');
      if (props.some((p) => !p.publishedAt)) throw new HttpError(409, 'NOT_PUBLISHED');
      const id = newId(), t = token(10);
      const [col] = await tx.insert(reCollection).values({ id, organizationId: a.organizationId, token: t, title, note: str(b.note, 600, 'BAD_TEXT'), leadId: lead?.id ?? null, agentId: memberOf(a), createdBy: a.userId }).returning();
      for (const [i, pid] of (b.propertyIds as string[]).entries()) await tx.insert(reCollectionItem).values({ id: newId(), organizationId: a.organizationId, collectionId: id, propertyId: pid, sort: i });
      const url = `${SITE(d)}/c/${t}`;
      if (lead) {
        const now = new Date();
        for (const pid of b.propertyIds as string[]) await tx.insert(reLeadProperty).values({ id: newId(), organizationId: a.organizationId, leadId: lead.id, propertyId: pid, status: 'sent', sentAt: now })
          .onConflictDoUpdate({ target: [reLeadProperty.leadId, reLeadProperty.propertyId], set: { sentAt: now } });
        await tx.update(reLead).set({ lastContactAt: now, status: lead.status === 'new' ? 'active' : lead.status }).where(eq(reLead.id, lead.id));
        await activity(tx, a.organizationId, 'lead.collection', { leadId: lead.id }, { collectionId: id, title, count: b.propertyIds.length }, a.userId);
      }
      const lang = lead?.lang === 'en' ? 'en' : 'ar';
      const text = lang === 'ar' ? `مرحباً${lead ? ' ' + lead.name : ''}، جهّزنا لك مجموعة عقارات مختارة (${b.propertyIds.length}). تصفّحها واحفظ ما يعجبك:\n${url}` : `Hi${lead ? ' ' + lead.name : ''}, we've put together a selection of ${b.propertyIds.length} homes for you. Browse and save the ones you like:\n${url}`;
      return { collection: { ...col, url }, text, wa: lead ? waLink(lead.whatsapp ?? lead.phone, text) : null };
    });
    return c.json(out, 201);
  });
  r.patch('/collections/:id', async (c) => {
    const a = actor(c, 'listings', 'read');
    const b = await c.req.json<any>();
    const set: Partial<typeof reCollection.$inferInsert> = {};
    if (b.title !== undefined) set.title = str(b.title, 100, 'BAD_TITLE', true)!;
    if (b.note !== undefined) set.note = str(b.note, 600, 'BAD_TEXT');
    if (b.archived !== undefined) set.archivedAt = b.archived ? new Date() : null;
    const [row] = await inRe(d, a, (tx) => tx.update(reCollection).set(set).where(eq(reCollection.id, c.req.param('id'))).returning());
    if (!row) throw new HttpError(404, 'NOT_FOUND');
    return c.json({ collection: row });
  });
  r.post('/collections/:id/items', async (c) => {
    const a = actor(c, 'listings', 'read');
    const b = await c.req.json<{ propertyId?: string; remove?: boolean }>();
    await inRe(d, a, async (tx) => {
      const [col] = await tx.select().from(reCollection).where(eq(reCollection.id, c.req.param('id')));
      if (!col) throw new HttpError(404, 'NOT_FOUND');
      const p = await prop(tx, String(b.propertyId ?? ''));
      if (b.remove) { await tx.delete(reCollectionItem).where(and(eq(reCollectionItem.collectionId, col.id), eq(reCollectionItem.propertyId, p.id))); return; }
      if (!p.publishedAt) throw new HttpError(409, 'NOT_PUBLISHED');
      const [n] = rowsOf(await tx.execute(sql`select coalesce(max(sort), -1)::int + 1 as n from re_collection_item where collection_id = ${col.id}`));
      await tx.insert(reCollectionItem).values({ id: newId(), organizationId: a.organizationId, collectionId: col.id, propertyId: p.id, sort: n.n }).onConflictDoNothing();
    });
    return c.json({ ok: true });
  });

  // ================= viewings =================
  const viewingCols = { v: reViewing, p: { id: reProperty.id, ref: reProperty.ref, title: reProperty.title, titleEn: reProperty.titleEn, area: reProperty.area, city: reProperty.city, slug: reProperty.slug, address: reProperty.address, lat: reProperty.lat, lng: reProperty.lng, coverId: reProperty.coverId, status: reProperty.status },
    lead: { id: reLead.id, name: reLead.name, phone: reLead.phone, whatsapp: reLead.whatsapp, lang: reLead.lang } };
  r.get('/viewings', async (c) => {
    const a = actor(c, 'viewings', 'read');
    const q = c.req.query();
    const from = when(q.from) ?? new Date(Date.now() - 86400_000), to = when(q.to) ?? new Date(Date.now() + 14 * 86400_000);
    const w: (SQL | undefined)[] = [q.status === 'requested' ? eq(reViewing.status, 'requested') : or(and(gte(reViewing.startsAt, from), lt(reViewing.startsAt, to)), eq(reViewing.status, 'requested'))];
    if (q.agent === 'me') w.push(eq(reViewing.agentId, memberOf(a) ?? '-'));
    else if (q.agent) w.push(eq(reViewing.agentId, q.agent));
    if (q.propertyId) w.push(eq(reViewing.propertyId, q.propertyId));
    const out = await inRe(d, a, async (tx) => {
      const rows = await tx.select(viewingCols).from(reViewing).innerJoin(reProperty, eq(reProperty.id, reViewing.propertyId)).leftJoin(reLead, eq(reLead.id, reViewing.leadId))
        .where(and(...w)).orderBy(sql`${reViewing.startsAt} asc nulls first`).limit(300);
      const covers = await withCovers(d, tx, a.organizationId, rows.map((x) => ({ id: x.p.id, coverId: x.p.coverId })));
      return rows.map((x, i) => ({ ...x.v, property: { ...x.p, cover: covers[i].cover }, lead: x.lead }));
    });
    return c.json({ viewings: out });
  });

  /** Book a viewing. Same agent or same home already booked at that time? Say so (the agent may still insist). */
  r.post('/viewings', async (c) => {
    const a = actor(c, 'viewings', 'manage');
    const b = await c.req.json<any>();
    const startsAt = when(b.startsAt, 'BAD_TIME');
    const minutes = intIn(b.minutes, 10, 480, 'BAD_MINUTES') ?? 45;
    const out = await inRe(d, a, async (tx) => {
      const p = await prop(tx, String(b.propertyId ?? ''));
      if (!['available', 'negotiating', 'reserved'].includes(p.status)) throw new HttpError(409, 'PROPERTY_UNAVAILABLE');
      const lead = b.leadId ? await leadOf(tx, a, b.leadId) : null;
      const agentId = b.agentId || p.agentId || memberOf(a);
      if (startsAt && !b.force) {
        const end = new Date(startsAt.getTime() + minutes * 60_000);
        const [clash] = await tx.select({ id: reViewing.id, startsAt: reViewing.startsAt, propertyId: reViewing.propertyId, agentId: reViewing.agentId }).from(reViewing)
          .where(and(inArray(reViewing.status, ['scheduled', 'confirmed']), or(eq(reViewing.propertyId, p.id), agentId ? eq(reViewing.agentId, agentId) : undefined),
            lt(reViewing.startsAt, end), sql`${reViewing.startsAt} + make_interval(mins => ${reViewing.minutes}) > ${startsAt.toISOString()}`)).limit(1);
        if (clash) return { error: 'VIEWING_CONFLICT', clash } as const;
      }
      const id = newId();
      const [v] = await tx.insert(reViewing).values({ id, organizationId: a.organizationId, propertyId: p.id, leadId: lead?.id ?? null, agentId, startsAt, minutes,
        status: startsAt ? 'scheduled' : 'requested', notes: str(b.notes, 1000, 'BAD_TEXT'), createdBy: a.userId }).returning();
      if (lead) {
        await tx.update(reLead).set({ status: ['new', 'active'].includes(lead.status) ? 'viewing' : lead.status, lastContactAt: new Date(), updatedAt: new Date() }).where(eq(reLead.id, lead.id));
        await tx.update(reFollowup).set({ doneAt: new Date() }).where(and(eq(reFollowup.leadId, lead.id), eq(reFollowup.kind, 'viewing'), isNull(reFollowup.doneAt)));
        await refreshNext(tx, lead.id);
      }
      await activity(tx, a.organizationId, 'viewing.booked', { propertyId: p.id, leadId: lead?.id }, { viewingId: id, at: startsAt }, a.userId);
      const text = lead ? viewingText('confirm', lead.lang === 'en' ? 'en' : 'ar', v, p, lead.name, await agentName(tx, agentId), SITE(d)) : null;
      return { viewing: v, text, wa: lead && text ? waLink(lead.whatsapp ?? lead.phone, text) : null };
    });
    if ('error' in out) return c.json(out, 409);
    return c.json(out, 201);
  });

  /** Reschedule, confirm, mark done (with how it went), cancel or no-show. After a viewing: "schedule a follow-up?" */
  r.patch('/viewings/:id', async (c) => {
    const a = actor(c, 'viewings', 'manage');
    const b = await c.req.json<any>();
    const out = await inRe(d, a, async (tx) => {
      const [v] = await tx.select().from(reViewing).where(eq(reViewing.id, c.req.param('id')));
      if (!v) throw new HttpError(404, 'NOT_FOUND');
      const set: Partial<typeof reViewing.$inferInsert> = { updatedAt: new Date() };
      if (b.startsAt !== undefined) { set.startsAt = when(b.startsAt, 'BAD_TIME'); if (set.startsAt && ['requested', 'cancelled', 'no_show'].includes(v.status) && b.status === undefined) set.status = 'scheduled'; }
      if (b.minutes !== undefined) set.minutes = intIn(b.minutes, 10, 480, 'BAD_MINUTES') ?? v.minutes;
      if (b.status !== undefined) set.status = oneOf(b.status, VIEWING_STATUSES, 'BAD_STATUS');
      if (b.outcome !== undefined) set.outcome = b.outcome ? oneOf(b.outcome, ['liked', 'maybe', 'no'] as const, 'BAD_OUTCOME') : null;
      if (b.feedback !== undefined) set.feedback = str(b.feedback, 2000, 'BAD_TEXT');
      if (b.notes !== undefined) set.notes = str(b.notes, 2000, 'BAD_TEXT');
      if (b.agentId !== undefined) set.agentId = b.agentId || null;
      if ((set.status === 'scheduled' || set.status === 'confirmed') && !(set.startsAt ?? v.startsAt)) bad('BAD_TIME');
      const [row] = await tx.update(reViewing).set(set).where(eq(reViewing.id, v.id)).returning();
      const refs = { propertyId: v.propertyId, leadId: v.leadId };
      if (set.startsAt && v.startsAt && +set.startsAt !== +v.startsAt) await activity(tx, a.organizationId, 'viewing.moved', refs, { viewingId: v.id, from: v.startsAt, to: set.startsAt }, a.userId);
      if (set.status && set.status !== v.status) await activity(tx, a.organizationId, `viewing.${set.status}`, refs, { viewingId: v.id, outcome: row.outcome }, a.userId);
      if (row.status === 'completed' && v.leadId) {
        await tx.insert(reLeadProperty).values({ id: newId(), organizationId: a.organizationId, leadId: v.leadId, propertyId: v.propertyId, status: 'viewed' })
          .onConflictDoUpdate({ target: [reLeadProperty.leadId, reLeadProperty.propertyId], set: { status: 'viewed' } });
        await tx.update(reLead).set({ lastContactAt: new Date() }).where(eq(reLead.id, v.leadId));
      }
      if (v.leadId && (b.status !== undefined || b.startsAt !== undefined)) {
        const p = await prop(tx, v.propertyId);
        const [lead] = await tx.select().from(reLead).where(eq(reLead.id, v.leadId));
        const text = lead && row.startsAt && ['scheduled', 'confirmed'].includes(row.status) ? viewingText('confirm', lead.lang === 'en' ? 'en' : 'ar', row, p, lead.name, await agentName(tx, row.agentId), SITE(d)) : null;
        return { viewing: row, text, wa: text && lead ? waLink(lead.whatsapp ?? lead.phone, text) : null, suggestFollowup: row.status === 'completed' };
      }
      return { viewing: row, suggestFollowup: row.status === 'completed' };
    });
    return c.json(out);
  });
  /** The reminder message for tomorrow's viewing (sent by the agent from their own WhatsApp). */
  r.get('/viewings/:id/message', async (c) => {
    const a = actor(c, 'viewings', 'read');
    const kind = c.req.query('kind') === 'confirm' ? 'confirm' : 'remind';
    const out = await inRe(d, a, async (tx) => {
      const [v] = await tx.select().from(reViewing).where(eq(reViewing.id, c.req.param('id')));
      if (!v || !v.leadId) throw new HttpError(404, 'NOT_FOUND');
      const [lead] = await tx.select().from(reLead).where(eq(reLead.id, v.leadId));
      const p = await prop(tx, v.propertyId);
      const text = viewingText(kind, lead.lang === 'en' ? 'en' : 'ar', v, p, lead.name, await agentName(tx, v.agentId), SITE(d));
      return { text, wa: waLink(lead.whatsapp ?? lead.phone, text) };
    });
    return c.json(out);
  });

  // ================= follow-ups =================
  r.get('/followups', async (c) => {
    const a = actor(c, 'leads', 'read');
    const q = c.req.query();
    const until = new Date(Date.now() + (Number(q.days) || 7) * 86400_000);
    const out = await inRe(d, a, async (tx) => {
      const rows = await tx.select({ f: reFollowup, lead: { id: reLead.id, name: reLead.name, phone: reLead.phone, whatsapp: reLead.whatsapp, status: reLead.status }, p: { id: reProperty.id, ref: reProperty.ref, title: reProperty.title } })
        .from(reFollowup).leftJoin(reLead, eq(reLead.id, reFollowup.leadId)).leftJoin(reProperty, eq(reProperty.id, reFollowup.propertyId))
        .where(and(isNull(reFollowup.doneAt), lte(reFollowup.dueAt, until), q.agent === 'me' ? eq(reFollowup.agentId, memberOf(a) ?? '-') : q.agent ? eq(reFollowup.agentId, q.agent) : undefined,
          or(isNull(reFollowup.leadId), sql`${reFollowup.leadId} in (select id from re_lead where ${leadScope(a) ?? sql`true`})`)))
        .orderBy(asc(reFollowup.dueAt)).limit(300);
      const endToday = +dayStart(1), now = Date.now();
      return rows.map((x) => ({ ...x.f, lead: x.lead, property: x.p?.id ? x.p : null, when: +x.f.dueAt < now ? 'overdue' : +x.f.dueAt < endToday ? 'today' : 'upcoming' }));
    });
    return c.json({ followups: out });
  });
  r.post('/followups', async (c) => {
    const a = actor(c, 'leads', 'update');
    const b = await c.req.json<any>();
    const out = await inRe(d, a, async (tx) => {
      const lead = b.leadId ? await leadOf(tx, a, b.leadId) : null;
      if (!lead && !b.dealId && !b.ownerId) bad('BAD_REF');
      const [f] = await tx.insert(reFollowup).values({ id: newId(), organizationId: a.organizationId, leadId: lead?.id ?? null, propertyId: b.propertyId || null, dealId: b.dealId || null, ownerId: b.ownerId || null,
        agentId: b.agentId || lead?.agentId || memberOf(a), kind: oneOf(b.kind, FOLLOW_KINDS, 'BAD_KIND', 'call'), note: str(b.note, 500, 'BAD_TEXT'), dueAt: when(b.dueAt, 'BAD_DATE') ?? bad('BAD_DATE'), createdBy: a.userId }).returning();
      await refreshNext(tx, lead?.id);
      if (lead) await activity(tx, a.organizationId, 'followup.added', { leadId: lead.id, propertyId: f.propertyId }, { kind: f.kind, dueAt: f.dueAt, note: f.note }, a.userId);
      return f;
    });
    return c.json({ followup: out }, 201);
  });
  /** Done, snoozed (a new time), or edited. */
  r.patch('/followups/:id', async (c) => {
    const a = actor(c, 'leads', 'update');
    const b = await c.req.json<any>();
    const out = await inRe(d, a, async (tx) => {
      const [f] = await tx.select().from(reFollowup).where(eq(reFollowup.id, c.req.param('id')));
      if (!f) throw new HttpError(404, 'NOT_FOUND');
      if (f.leadId) await leadOf(tx, a, f.leadId);
      const set: Partial<typeof reFollowup.$inferInsert> = {};
      if (b.done !== undefined) set.doneAt = b.done ? new Date() : null;
      if (b.dueAt !== undefined) set.dueAt = when(b.dueAt, 'BAD_DATE') ?? bad('BAD_DATE');
      if (b.note !== undefined) set.note = str(b.note, 500, 'BAD_TEXT');
      if (b.kind !== undefined) set.kind = oneOf(b.kind, FOLLOW_KINDS, 'BAD_KIND');
      const [row] = await tx.update(reFollowup).set(set).where(eq(reFollowup.id, f.id)).returning();
      await refreshNext(tx, f.leadId);
      if (f.leadId && b.done) {
        await tx.update(reLead).set({ lastContactAt: new Date() }).where(eq(reLead.id, f.leadId));
        await activity(tx, a.organizationId, 'followup.done', { leadId: f.leadId, propertyId: f.propertyId }, { kind: f.kind, note: b.result ? str(b.result, 1000, 'BAD_TEXT') : f.note }, a.userId);
      }
      return row;
    });
    return c.json({ followup: out });
  });

  // ================= deals =================
  const dealOut = (a: Actor, x: any) => { const m = money(a, x); const cm = commissionOf(x); return { ...x, commission: m ? cm : null, commissionValue: m ? x.commissionValue : null, agentShare: m ? x.agentShare : null }; };
  r.get('/deals', async (c) => {
    const a = actor(c, 'deals', 'read');
    const q = c.req.query();
    const out = await inRe(d, a, async (tx) => {
      const rows = await tx.select({ deal: reDeal, p: cardCols, lead: { id: reLead.id, name: reLead.name, phone: reLead.phone, whatsapp: reLead.whatsapp } })
        .from(reDeal).innerJoin(reProperty, eq(reProperty.id, reDeal.propertyId)).leftJoin(reLead, eq(reLead.id, reDeal.leadId))
        .where(and(dealScope(a), q.stage === 'open' ? inArray(reDeal.stage, OPEN_DEAL) : q.stage ? eq(reDeal.stage, oneOf(q.stage, DEAL_STAGES, 'BAD_STAGE')) : or(inArray(reDeal.stage, OPEN_DEAL), gte(reDeal.updatedAt, new Date(Date.now() - 60 * 86400_000)))))
        .orderBy(desc(reDeal.updatedAt)).limit(300);
      const cards = await withCovers(d, tx, a.organizationId, rows.map((x) => x.p));
      const ids = rows.map((x) => x.deal.id);
      const last = ids.length ? rowsOf(await tx.execute(sql`select distinct on (deal_id) deal_id, kind, amount, at from re_offer where deal_id in (select json_array_elements_text(${JSON.stringify(ids)}::json)) order by deal_id, at desc`)) : [];
      const lastOf = new Map(last.map((x) => [x.deal_id, { kind: x.kind, amount: x.amount == null ? null : Number(x.amount), at: x.at }]));
      return rows.map((x, i) => ({ ...dealOut(a, x.deal), property: cards[i], lead: x.lead, lastOffer: lastOf.get(x.deal.id) ?? null }));
    });
    return c.json({ deals: out });
  });
  r.get('/deals/:id', async (c) => {
    const a = actor(c, 'deals', 'read');
    const out = await inRe(d, a, async (tx) => {
      const [deal] = await tx.select().from(reDeal).where(and(eq(reDeal.id, c.req.param('id')), dealScope(a)));
      if (!deal) throw new HttpError(404, 'DEAL_NOT_FOUND');
      const [p] = await tx.select(cardCols).from(reProperty).where(eq(reProperty.id, deal.propertyId));
      const [card] = await withCovers(d, tx, a.organizationId, [p]);
      const [lead] = deal.leadId ? await tx.select().from(reLead).where(eq(reLead.id, deal.leadId)) : [];
      const [owner] = deal.ownerId ? await tx.select().from(reOwner).where(eq(reOwner.id, deal.ownerId)) : [];
      const offers = await tx.select().from(reOffer).where(eq(reOffer.dealId, deal.id)).orderBy(asc(reOffer.at));
      const payments = money(a, deal) ? await tx.select().from(rePayment).where(eq(rePayment.dealId, deal.id)).orderBy(asc(rePayment.paidOn)) : [];
      const events = await tx.select().from(reActivity).where(eq(reActivity.dealId, deal.id)).orderBy(desc(reActivity.at)).limit(40);
      const docs = await tx.select().from(reDocument).where(eq(reDocument.dealId, deal.id));
      const paid = payments.reduce((n, x) => n + Number(x.amount), 0);
      return { deal: { ...dealOut(a, deal), paid: money(a, deal) ? paid : null }, property: card, lead: lead ?? null, owner: owner ?? null, offers, payments, activity: events,
        documents: await Promise.all(docs.map(async (x) => ({ ...x, url: await fileUrl(d.env, a.organizationId, x.fileId, 3600) }))) };
    });
    return c.json(out);
  });
  r.post('/deals', async (c) => {
    const a = actor(c, 'deals', 'manage');
    const b = await c.req.json<any>();
    const out = await inRe(d, a, async (tx) => {
      const p = await prop(tx, String(b.propertyId ?? ''));
      if (!['available', 'negotiating', 'reserved'].includes(p.status)) throw new HttpError(409, 'PROPERTY_UNAVAILABLE');
      const lead = b.leadId ? await leadOf(tx, a, b.leadId) : null;
      if (lead) { const [open] = await tx.select({ id: reDeal.id }).from(reDeal).where(and(eq(reDeal.propertyId, p.id), eq(reDeal.leadId, lead.id), inArray(reDeal.stage, OPEN_DEAL))); if (open) return { error: 'DEAL_EXISTS', id: open.id } as const; }
      const s = await settingsOf(tx, a.organizationId);
      const [owner] = p.ownerId ? await tx.select().from(reOwner).where(eq(reOwner.id, p.ownerId)) : [];
      const agentId = b.agentId || lead?.agentId || p.agentId || memberOf(a);
      const [card] = agentId ? await tx.select().from(reAgent).where(eq(reAgent.memberId, agentId)) : [];
      const agreement = owner?.commission;
      const id = newId();
      const [deal] = await tx.insert(reDeal).values({ id, organizationId: a.organizationId, propertyId: p.id, leadId: lead?.id ?? null, ownerId: p.ownerId, agentId, purpose: p.purpose,
        stage: oneOf(b.stage, DEAL_STAGES, 'BAD_STAGE', 'interested'), asking: p.price, currency: p.currency,
        commissionKind: agreement?.kind ?? 'percent', commissionValue: agreement?.value ?? s.defaultCommission, agentShare: card?.agentShare ?? 4000, notes: str(b.notes, 2000, 'BAD_TEXT'), createdBy: a.userId }).returning();
      if (p.price != null) await tx.insert(reOffer).values({ id: newId(), organizationId: a.organizationId, dealId: id, kind: 'asking', amount: p.price, userId: a.userId });
      await activity(tx, a.organizationId, 'deal.created', { dealId: id, propertyId: p.id, leadId: lead?.id, ownerId: p.ownerId }, { stage: deal.stage }, a.userId);
      return { deal: dealOut(a, deal) };
    });
    if ('error' in out) return c.json(out, 409);
    return c.json(out, 201);
  });

  /** Move a deal. Closing it sells (or rents) the home, wins the lead, and sets the home's other deals aside. */
  r.patch('/deals/:id', async (c) => {
    const a = actor(c, 'deals', 'manage');
    const b = await c.req.json<any>();
    const out = await inRe(d, a, async (tx) => {
      const [deal] = await tx.select().from(reDeal).where(and(eq(reDeal.id, c.req.param('id')), dealScope(a)));
      if (!deal) throw new HttpError(404, 'DEAL_NOT_FOUND');
      const set: Partial<typeof reDeal.$inferInsert> = { updatedAt: new Date() };
      if (b.stage !== undefined) set.stage = oneOf(b.stage, DEAL_STAGES, 'BAD_STAGE');
      if (b.agreed !== undefined) set.agreed = amount(b.agreed);
      if (b.notes !== undefined) set.notes = str(b.notes, 2000, 'BAD_TEXT');
      if (b.lostReason !== undefined) set.lostReason = str(b.lostReason, 300, 'BAD_TEXT');
      if (b.commissionKind !== undefined || b.commissionValue !== undefined || b.agentShare !== undefined) {
        if (!may(a.principal, 'commission', 'manage')) throw new HttpError(403, 'NOT_ALLOWED');
        if (b.commissionKind !== undefined) set.commissionKind = oneOf(b.commissionKind, ['percent', 'fixed'] as const, 'BAD_COMMISSION');
        if (b.commissionValue !== undefined) set.commissionValue = amount(b.commissionValue, 'BAD_COMMISSION', false)!;
        if ((set.commissionKind ?? deal.commissionKind) === 'percent' && Number(set.commissionValue ?? deal.commissionValue) > 2000) bad('BAD_COMMISSION'); // over 20%: a typo
        if (b.agentShare !== undefined) set.agentShare = intIn(b.agentShare, 0, 10000, 'BAD_SHARE') ?? 0;
        await activity(tx, a.organizationId, 'deal.commission', { dealId: deal.id }, { kind: set.commissionKind ?? deal.commissionKind, value: set.commissionValue ?? deal.commissionValue, share: set.agentShare ?? deal.agentShare }, a.userId);
      }
      if (set.stage === 'closed' && deal.stage !== 'closed') { set.closedAt = new Date(); if (set.agreed === undefined && deal.agreed == null) set.agreed = deal.asking; }
      const [row] = await tx.update(reDeal).set(set).where(eq(reDeal.id, deal.id)).returning();
      const refs = { dealId: deal.id, propertyId: deal.propertyId, leadId: deal.leadId, ownerId: deal.ownerId };
      if (set.stage && set.stage !== deal.stage) {
        await activity(tx, a.organizationId, 'deal.stage', refs, { from: deal.stage, to: set.stage, reason: row.lostReason }, a.userId);
        const p = await prop(tx, deal.propertyId);
        const move = async (status: string) => { if (p.status !== status) { await tx.update(reProperty).set({ status, statusAt: new Date(), updatedAt: new Date() }).where(eq(reProperty.id, p.id)); await activity(tx, a.organizationId, 'property.status', { propertyId: p.id }, { from: p.status, to: status, byDeal: deal.id }, a.userId); } };
        if (set.stage === 'closed') {
          await move(deal.purpose === 'rent' ? 'rented' : 'sold');
          if (deal.leadId) await tx.update(reLead).set({ status: 'won', updatedAt: new Date() }).where(eq(reLead.id, deal.leadId));
          const others = await tx.update(reDeal).set({ stage: 'lost', lostReason: 'closed_with_another', updatedAt: new Date() }).where(and(eq(reDeal.propertyId, deal.propertyId), ne(reDeal.id, deal.id), inArray(reDeal.stage, OPEN_DEAL))).returning({ id: reDeal.id });
          await tx.update(reViewing).set({ status: 'cancelled', updatedAt: new Date() }).where(and(eq(reViewing.propertyId, deal.propertyId), inArray(reViewing.status, ['requested', 'scheduled', 'confirmed']), gte(reViewing.startsAt, new Date())));
          await notice(tx, a.organizationId, 'deal_closed', { dealId: deal.id, propertyId: deal.propertyId }, { ref: p.ref, title: p.title, others: others.length });
        } else if (set.stage === 'reserved') await move('reserved');
        else if ((set.stage === 'offer' || set.stage === 'negotiation') && p.status === 'available') await move('negotiating');
        else if (set.stage === 'lost' && ['reserved', 'negotiating'].includes(p.status)) {
          const [still] = await tx.select({ id: reDeal.id }).from(reDeal).where(and(eq(reDeal.propertyId, p.id), ne(reDeal.id, deal.id), inArray(reDeal.stage, ['offer', 'negotiation', 'reserved'])));
          if (!still) await move('available'); // nobody else is negotiating: back on the market
        }
        if (deal.leadId && ['offer', 'negotiation', 'reserved'].includes(set.stage)) await tx.update(reLead).set({ status: 'negotiating' }).where(and(eq(reLead.id, deal.leadId), inArray(reLead.status, ['new', 'active', 'viewing'])));
      }
      return { deal: dealOut(a, row) };
    });
    return c.json(out);
  });

  /** One step of the negotiation: the buyer's offer, the owner's counter, agreed, rejected. */
  r.post('/deals/:id/offers', async (c) => {
    const a = actor(c, 'deals', 'manage');
    const b = await c.req.json<any>();
    const kind = oneOf(b.kind, ['offer', 'counter', 'agreed', 'rejected', 'withdrawn'] as const, 'BAD_KIND');
    const amt = kind === 'rejected' || kind === 'withdrawn' ? amount(b.amount) : amount(b.amount, 'BAD_PRICE', false);
    const out = await inRe(d, a, async (tx) => {
      const [deal] = await tx.select().from(reDeal).where(and(eq(reDeal.id, c.req.param('id')), dealScope(a)));
      if (!deal) throw new HttpError(404, 'DEAL_NOT_FOUND');
      if (!OPEN_DEAL.includes(deal.stage)) throw new HttpError(409, 'DEAL_CLOSED');
      const [o] = await tx.insert(reOffer).values({ id: newId(), organizationId: a.organizationId, dealId: deal.id, kind, amount: amt, note: str(b.note, 500, 'BAD_TEXT'), userId: a.userId }).returning();
      const set: Partial<typeof reDeal.$inferInsert> = { updatedAt: new Date() };
      if (kind === 'agreed') set.agreed = amt;
      if (['offer', 'counter'].includes(kind) && ['interested', 'viewing'].includes(deal.stage)) set.stage = kind === 'offer' ? 'offer' : 'negotiation';
      if (kind === 'counter' && deal.stage === 'offer') set.stage = 'negotiation';
      await tx.update(reDeal).set(set).where(eq(reDeal.id, deal.id));
      if (set.stage) {
        const [p] = await tx.select().from(reProperty).where(eq(reProperty.id, deal.propertyId));
        if (p?.status === 'available') await tx.update(reProperty).set({ status: 'negotiating', statusAt: new Date() }).where(eq(reProperty.id, p.id));
        if (deal.leadId) await tx.update(reLead).set({ status: 'negotiating' }).where(and(eq(reLead.id, deal.leadId), inArray(reLead.status, ['new', 'active', 'viewing'])));
      }
      await activity(tx, a.organizationId, `offer.${kind}`, { dealId: deal.id, propertyId: deal.propertyId, leadId: deal.leadId, ownerId: deal.ownerId }, { amount: amt, currency: deal.currency }, a.userId);
      if (kind === 'offer') await notice(tx, a.organizationId, 'offer', { dealId: deal.id, propertyId: deal.propertyId, agentId: deal.agentId }, { amount: amt, currency: deal.currency });
      return o;
    });
    return c.json({ offer: out }, 201);
  });

  /** Commission money received. */
  r.post('/deals/:id/payments', async (c) => {
    const a = actor(c, 'commission', 'manage');
    const b = await c.req.json<any>();
    const out = await inRe(d, a, async (tx) => {
      const [deal] = await tx.select().from(reDeal).where(eq(reDeal.id, c.req.param('id')));
      if (!deal) throw new HttpError(404, 'DEAL_NOT_FOUND');
      const [row] = await tx.insert(rePayment).values({ id: newId(), organizationId: a.organizationId, dealId: deal.id, amount: amount(b.amount, 'BAD_AMOUNT', false)!, from: oneOf(b.from, ['owner', 'buyer', 'other'] as const, 'BAD_FROM', 'owner'),
        paidOn: dateOnly(b.paidOn) ?? today(), note: str(b.note, 300, 'BAD_TEXT'), userId: a.userId }).returning();
      await activity(tx, a.organizationId, 'commission.paid', { dealId: deal.id, propertyId: deal.propertyId }, { amount: row.amount, from: row.from, currency: deal.currency }, a.userId);
      return row;
    });
    return c.json({ payment: out }, 201);
  });
  r.delete('/payments/:id', async (c) => {
    const a = actor(c, 'commission', 'manage');
    await inRe(d, a, async (tx) => {
      const [x] = await tx.delete(rePayment).where(eq(rePayment.id, c.req.param('id'))).returning();
      if (!x) throw new HttpError(404, 'NOT_FOUND');
      await activity(tx, a.organizationId, 'commission.removed', { dealId: x.dealId }, { amount: x.amount }, a.userId);
    });
    return c.json({ ok: true });
  });

  /** Expected, collected, pending — by currency (dollars and dinars are never added together). Agents see their own. */
  r.get('/commission', async (c) => {
    const a = actor(c, 'deals', 'read');
    const all = may(a.principal, 'commission', 'read');
    const out = await inRe(d, a, async (tx) => {
      const deals = await tx.select({ deal: reDeal, p: { ref: reProperty.ref, title: reProperty.title } }).from(reDeal).innerJoin(reProperty, eq(reProperty.id, reDeal.propertyId))
        .where(and(all ? undefined : eq(reDeal.agentId, memberOf(a) ?? '-'), ne(reDeal.stage, 'lost'))).orderBy(desc(reDeal.updatedAt)).limit(1000);
      const ids = deals.map((x) => x.deal.id);
      const paid = ids.length ? rowsOf(await tx.execute(sql`select deal_id, sum(amount)::bigint as paid from re_payment where deal_id in (select json_array_elements_text(${JSON.stringify(ids)}::json)) group by deal_id`)) : [];
      const paidOf = new Map(paid.map((x) => [x.deal_id, Number(x.paid)]));
      const sum: Record<string, { expected: number; collected: number; pending: number; pipeline: number; agent: number }> = {};
      const rows = deals.map((x) => {
        const cm = commissionOf(x.deal), got = paidOf.get(x.deal.id) ?? 0, s = (sum[x.deal.currency] ??= { expected: 0, collected: 0, pending: 0, pipeline: 0, agent: 0 });
        if (x.deal.stage === 'closed') { s.expected += cm.total; s.collected += got; s.pending += Math.max(0, cm.total - got); s.agent += cm.agent; }
        else s.pipeline += cm.total;
        return { id: x.deal.id, stage: x.deal.stage, currency: x.deal.currency, closedAt: x.deal.closedAt, agentId: x.deal.agentId, property: x.p, commission: cm, paid: got };
      });
      return { totals: sum, deals: rows };
    });
    return c.json(out);
  });

  return r;
}
