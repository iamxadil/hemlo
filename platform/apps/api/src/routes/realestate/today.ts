// "What matters today": the morning brief and the command center (plain queries, no AI, so it costs nothing and is never
// wrong), notices, one search box that understands "villas under 200k in Dream City", and the reports an agency asks for.
import { Hono } from 'hono';
import { and, desc, eq, gte, inArray, isNull, lt, lte, or, sql, type SQL } from 'drizzle-orm';
import type { Database } from '@hemlo/db';
import { reProperty, reLead, reOwner, reViewing, reFollowup, reDeal, reNotice, reActivity, reDocument } from '@hemlo/db/schema';
import { actor, may, type Actor } from '../sys-common';
import { inRe, rowsOf, leadScope, memberOf, dayStart, like, today, RE_TYPES } from './common';
import { cardCols, withCovers } from './properties';
import { OPEN_LEAD } from './leads';
import { OPEN_DEAL, commissionOf } from './work';
import type { AppEnv, Deps } from '../../types';

// ---------- the search box ----------
const TYPE_WORDS: Record<string, string[]> = {
  apartment: ['apartment', 'apartments', 'flat', 'flats', 'شقة', 'شقق', 'شقه'], house: ['house', 'houses', 'home', 'homes', 'بيت', 'بيوت', 'منزل', 'دار'],
  villa: ['villa', 'villas', 'فيلا', 'فلل', 'فيلات', 'فله'], land: ['land', 'plot', 'plots', 'أرض', 'ارض', 'اراضي', 'قطعة'], office: ['office', 'offices', 'مكتب', 'مكاتب'],
  shop: ['shop', 'shops', 'store', 'محل', 'محلات', 'دكان'], commercial: ['commercial', 'تجاري'], building: ['building', 'buildings', 'بناية', 'عمارة'],
  warehouse: ['warehouse', 'مخزن', 'مخازن', 'مستودع'], farm: ['farm', 'مزرعة', 'بستان'],
};
/** "villas under 200k in Dream City" → { type: villa, max: 200000, area: 'dream city' }. Plain parsing: fast and free. */
export function parseQuery(raw: string) {
  let s = ` ${raw.toLowerCase().replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/,/g, '')} `;
  const out: { type?: string; max?: number; min?: number; area?: string; beds?: number; purpose?: 'sale' | 'rent'; viewingsToday?: boolean; followups?: boolean; rest: string } = { rest: '' };
  const n = (v: string, unit?: string) => { const x = Number(v); const u = (unit ?? '').trim(); return Math.round(x * (/^(k|ألف|الف)$/.test(u) ? 1000 : /^(m|مليون)$/.test(u) ? 1_000_000 : 1)); };
  for (const [t, ws] of Object.entries(TYPE_WORDS)) for (const w of ws) if (s.includes(` ${w} `)) { out.type = t; s = s.replace(` ${w} `, ' '); }
  let m = /(?:under|below|less than|max|تحت|اقل من|أقل من|بحدود|لحد)\s*\$?\s*(\d+(?:\.\d+)?)\s*(k|m|ألف|الف|مليون)?/.exec(s);
  if (m) { out.max = n(m[1], m[2]); s = s.replace(m[0], ' '); }
  m = /(?:over|above|more than|min|فوق|اكثر من|أكثر من)\s*\$?\s*(\d+(?:\.\d+)?)\s*(k|m|ألف|الف|مليون)?/.exec(s);
  if (m) { out.min = n(m[1], m[2]); s = s.replace(m[0], ' '); }
  m = /(\d+)\s*(?:\+\s*)?(?:bed(?:room)?s?|br|غرف|غرفة)/.exec(s);
  if (m) { out.beds = Number(m[1]); s = s.replace(m[0], ' '); }
  // (JavaScript's \b only knows Latin letters, so Arabic words are found between spaces)
  if (/ (for rent|rent|للإيجار|للايجار|إيجار|ايجار) /.test(s)) { out.purpose = 'rent'; s = s.replace(/ (for rent|rent|للإيجار|للايجار|إيجار|ايجار) /, ' '); }
  else if (/ (for sale|للبيع) /.test(s)) { out.purpose = 'sale'; s = s.replace(/ (for sale|للبيع) /, ' '); }
  if (/(viewings? today|today'?s viewings|معاينات اليوم|معاينة اليوم)/.test(s)) out.viewingsToday = true;
  if (/(follow ?ups?|متابعات|متابعة)/.test(s)) out.followups = true;
  m = /(?:^|\s)(?:in|at|في|ب)\s+(.+)$/.exec(s.trim());
  if (m) { out.area = m[1].trim(); s = s.replace(m[0], ' '); }
  out.rest = ` ${s} `.replace(/ (properties|property|listings|عقارات|عقار)(?= )/g, ' ').replace(/\s+/g, ' ').trim();
  return out;
}

export function reTodayRoutes(d: Deps) {
  const r = new Hono<AppEnv>();
  const mineOnly = (a: Actor, wantAll: boolean) => !(wantAll && may(a.principal, 'leads', 'read-all'));

  /** The command center: the brief, what needs attention, opportunities, recent, and the business. */
  r.get('/today', async (c) => {
    const a = actor(c, 'listings', 'read');
    const me = memberOf(a), mine = mineOnly(a, c.req.query('scope') === 'all');
    const seesMoney = may(a.principal, 'commission', 'read');
    const start = dayStart(0), end = dayStart(1), monthStart = new Date(Date.UTC(new Date(Date.now() + 3 * 3600_000).getUTCFullYear(), new Date(Date.now() + 3 * 3600_000).getUTCMonth(), 1) - 3 * 3600_000);
    const out = await inRe(d, a, async (tx) => {
      const agentIs = (col: any) => (mine ? or(eq(col, me ?? '-'), isNull(col)) : undefined);
      const [follow, viewings, requests, negotiations, docs, notices, newLeads, quiet, hot, stale, recent, counts, deals] = await Promise.all([
        tx.select({ f: reFollowup, lead: { id: reLead.id, name: reLead.name, phone: reLead.phone, whatsapp: reLead.whatsapp } }).from(reFollowup).leftJoin(reLead, eq(reLead.id, reFollowup.leadId))
          .where(and(isNull(reFollowup.doneAt), lt(reFollowup.dueAt, end), mine ? eq(reFollowup.agentId, me ?? '-') : undefined)).orderBy(reFollowup.dueAt).limit(30),
        tx.select({ v: reViewing, p: { id: reProperty.id, ref: reProperty.ref, title: reProperty.title, area: reProperty.area, coverId: reProperty.coverId, lat: reProperty.lat, lng: reProperty.lng, address: reProperty.address }, lead: { id: reLead.id, name: reLead.name, phone: reLead.phone, whatsapp: reLead.whatsapp } })
          .from(reViewing).innerJoin(reProperty, eq(reProperty.id, reViewing.propertyId)).leftJoin(reLead, eq(reLead.id, reViewing.leadId))
          .where(and(gte(reViewing.startsAt, start), lt(reViewing.startsAt, dayStart(2)), inArray(reViewing.status, ['scheduled', 'confirmed', 'completed']), mine ? agentIs(reViewing.agentId) : undefined)).orderBy(reViewing.startsAt),
        tx.select({ v: reViewing, p: { id: reProperty.id, ref: reProperty.ref, title: reProperty.title }, lead: { id: reLead.id, name: reLead.name, phone: reLead.phone } }).from(reViewing).innerJoin(reProperty, eq(reProperty.id, reViewing.propertyId)).leftJoin(reLead, eq(reLead.id, reViewing.leadId))
          .where(and(eq(reViewing.status, 'requested'), mine ? agentIs(reViewing.agentId) : undefined)).orderBy(desc(reViewing.createdAt)).limit(20),
        tx.select({ deal: reDeal, p: { id: reProperty.id, ref: reProperty.ref, title: reProperty.title }, lead: { id: reLead.id, name: reLead.name },
          last: sql<{ kind: string; amount: number; at: string } | null>`(select json_build_object('kind', kind, 'amount', amount, 'at', at) from re_offer o where o.deal_id = ${reDeal.id} order by at desc limit 1)` })
          .from(reDeal).innerJoin(reProperty, eq(reProperty.id, reDeal.propertyId)).leftJoin(reLead, eq(reLead.id, reDeal.leadId))
          .where(and(inArray(reDeal.stage, ['offer', 'negotiation', 'reserved']), mine ? agentIs(reDeal.agentId) : undefined)).orderBy(reDeal.updatedAt).limit(20),
        tx.select().from(reDocument).where(and(sql`${reDocument.expiresOn} is not null`, lte(reDocument.expiresOn, new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10)))).orderBy(reDocument.expiresOn).limit(10),
        tx.select().from(reNotice).where(and(isNull(reNotice.readAt), mine ? or(eq(reNotice.agentId, me ?? '-'), isNull(reNotice.agentId)) : undefined)).orderBy(desc(reNotice.createdAt)).limit(20),
        tx.select().from(reLead).where(and(gte(reLead.createdAt, new Date(Date.now() - 2 * 86400_000)), isNull(reLead.archivedAt), leadScope(a))).orderBy(desc(reLead.createdAt)).limit(8),
        // open leads nobody has spoken to in 10 days, with nothing planned: the ones that slip away
        tx.select({ id: reLead.id, name: reLead.name, phone: reLead.phone, whatsapp: reLead.whatsapp, lastContactAt: reLead.lastContactAt, status: reLead.status }).from(reLead)
          .where(and(inArray(reLead.status, OPEN_LEAD), isNull(reLead.archivedAt), isNull(reLead.nextFollowAt), or(isNull(reLead.lastContactAt), lt(reLead.lastContactAt, new Date(Date.now() - 10 * 86400_000))), leadScope(a), mine ? eq(reLead.agentId, me ?? '-') : undefined))
          .orderBy(reLead.lastContactAt).limit(8),
        // most interest in the last 7 days (views + taps + requests)
        tx.execute(sql`select p.id, sum(s.views)::int as views, sum(s.wa + s.calls + s.requests)::int as inquiries from re_stat s join re_property p on p.id = s.property_id
          where s.day >= ${new Date(Date.now() + 3 * 3600_000 - 7 * 86400_000).toISOString().slice(0, 10)} and p.status in ('available','negotiating') group by p.id order by sum(s.views) + 5 * sum(s.wa + s.calls + s.requests) desc limit 5`),
        // live for 45+ days with no viewing in 30: worth a price talk with the owner
        tx.select(cardCols).from(reProperty).where(and(eq(reProperty.status, 'available'), lt(reProperty.statusAt, new Date(Date.now() - 45 * 86400_000)),
          sql`not exists (select 1 from re_viewing v where v.property_id = ${reProperty.id} and v.created_at > now() - interval '30 days')`, mine ? agentIs(reProperty.agentId) : undefined)).orderBy(reProperty.statusAt).limit(5),
        tx.select().from(reActivity).where(gte(reActivity.at, new Date(Date.now() - 3 * 86400_000))).orderBy(desc(reActivity.at)).limit(15),
        tx.execute(sql`select
            (select count(*)::int from re_property where status in ('available','negotiating','reserved')) as live,
            (select count(*)::int from re_property where published_at is not null and status in ('available','negotiating','reserved')) as published,
            (select count(*)::int from re_property where created_at >= ${new Date(Date.now() - 7 * 86400_000).toISOString()}) as new_listings,
            (select count(*)::int from re_lead where status in ('new','active','viewing','negotiating') and archived_at is null) as open_leads,
            (select count(*)::int from re_viewing where status = 'completed' and starts_at >= ${monthStart.toISOString()}) as viewings_month,
            (select count(*)::int from re_deal where stage in ('offer','negotiation','reserved')) as negotiating,
            (select count(*)::int from re_deal where stage = 'closed' and closed_at >= ${monthStart.toISOString()}) as closed_month`),
        seesMoney ? tx.select().from(reDeal).where(or(and(eq(reDeal.stage, 'closed'), gte(reDeal.closedAt, monthStart)), inArray(reDeal.stage, OPEN_DEAL))) : Promise.resolve([] as any[]),
      ]);
      const hotRows = rowsOf(hot);
      const hotCards = hotRows.length ? await withCovers(d, tx, a.organizationId, await tx.select(cardCols).from(reProperty).where(inArray(reProperty.id, hotRows.map((x) => x.id)))) : [];
      const vCovers = await withCovers(d, tx, a.organizationId, viewings.map((x) => ({ id: x.p.id, coverId: x.p.coverId })));
      const now = Date.now();
      const due = follow.map((x) => ({ ...x.f, lead: x.lead, when: +x.f.dueAt < now ? 'overdue' : 'today' }));
      const todayViewings = viewings.map((x, i) => ({ ...x.v, property: { ...x.p, cover: vCovers[i].cover }, lead: x.lead }));
      // a negotiation "waits" when the last word was the buyer's (an answer is owed) or nothing moved for 3 days
      const waiting = negotiations.filter((x) => x.last?.kind === 'offer' || +new Date(x.deal.updatedAt) < now - 3 * 86400_000).map((x) => ({ ...x.deal, property: x.p, lead: x.lead, last: x.last }));
      const money: Record<string, { month: number; pipeline: number }> = {};
      for (const x of deals as any[]) { const cm = commissionOf(x).total, m = (money[x.currency] ??= { month: 0, pipeline: 0 }); if (x.stage === 'closed') m.month += cm; else m.pipeline += cm; }
      const [n] = rowsOf(counts);
      return {
        brief: {
          overdue: due.filter((x) => x.when === 'overdue').length, followups: due.length, viewings: todayViewings.filter((x) => +new Date(x.startsAt!) < +end).length,
          tomorrow: todayViewings.filter((x) => +new Date(x.startsAt!) >= +end).length, requests: requests.length, newLeads: newLeads.length, negotiations: waiting.length,
          matches: notices.filter((x) => x.kind === 'match').reduce((s, x) => s + Number((x.detail as any).leads ?? 0), 0), documents: docs.length,
        },
        followups: due.slice(0, 12), viewings: todayViewings, requests: requests.map((x) => ({ ...x.v, property: x.p, lead: x.lead })), negotiations: waiting, documents: docs, notices,
        opportunities: { hot: hotCards.map((p) => ({ ...p, ...hotRows.find((h) => h.id === p.id) })), quiet, stale: await withCovers(d, tx, a.organizationId, stale), newLeads },
        recent: recent, business: { live: n.live, published: n.published, newListings: n.new_listings, openLeads: n.open_leads, viewingsMonth: n.viewings_month, negotiating: n.negotiating, closedMonth: n.closed_month, commission: seesMoney ? money : null },
        scope: mine ? 'me' : 'all',
      };
    });
    return c.json(out);
  });

  r.get('/notices', async (c) => {
    const a = actor(c, 'listings', 'read');
    const me = memberOf(a);
    const rows = await inRe(d, a, (tx) => tx.select().from(reNotice).where(may(a.principal, 'leads', 'read-all') ? undefined : or(eq(reNotice.agentId, me ?? '-'), isNull(reNotice.agentId))).orderBy(desc(reNotice.createdAt)).limit(50));
    return c.json({ notices: rows, unread: rows.filter((x) => !x.readAt).length });
  });
  r.post('/notices/read', async (c) => {
    const a = actor(c, 'listings', 'read');
    const b = await c.req.json<{ ids?: string[] }>().catch(() => ({} as { ids?: string[] }));
    await inRe(d, a, (tx) => tx.update(reNotice).set({ readAt: new Date() }).where(and(isNull(reNotice.readAt), Array.isArray(b.ids) && b.ids.length ? inArray(reNotice.id, b.ids.slice(0, 200)) : undefined)));
    return c.json({ ok: true });
  });

  /** One box for everything: listings (with plain-language filters), leads, owners, deals, today's viewings. */
  r.get('/search', async (c) => {
    const a = actor(c, 'listings', 'read');
    const raw = (c.req.query('q') ?? '').trim().slice(0, 120);
    if (raw.length < 1) return c.json({ properties: [], leads: [], owners: [], deals: [], viewings: [], parsed: null });
    const p = parseQuery(raw);
    const out = await inRe(d, a, async (tx) => {
      const w: (SQL | undefined)[] = [inArray(reProperty.status, ['draft', 'available', 'negotiating', 'reserved'])];
      if (p.type) w.push(eq(reProperty.type, p.type));
      if (p.purpose) w.push(eq(reProperty.purpose, p.purpose));
      if (p.max) w.push(lte(reProperty.price, p.max));
      if (p.min) w.push(gte(reProperty.price, p.min));
      if (p.beds) w.push(gte(reProperty.bedrooms, p.beds));
      if (p.area) w.push(or(like(reProperty.area, p.area), like(reProperty.city, p.area)));
      const text = p.rest.replace(/^#/, '');
      if (text) w.push(/^\d{1,9}$/.test(text) ? eq(reProperty.ref, Number(text)) : or(like(reProperty.title, text), like(reProperty.titleEn, text), like(reProperty.area, text), like(reProperty.address, text)));
      const filtered = !!(p.type || p.max || p.min || p.beds || p.area || p.purpose);
      const props = p.viewingsToday || p.followups ? [] : await withCovers(d, tx, a.organizationId, await tx.select(cardCols).from(reProperty).where(and(...w)).orderBy(desc(reProperty.updatedAt)).limit(filtered ? 30 : 8));
      const digits = raw.replace(/\D/g, '');
      const leads = filtered || p.viewingsToday ? [] : may(a.principal, 'leads', 'read') ? await tx.select({ id: reLead.id, name: reLead.name, phone: reLead.phone, status: reLead.status, budgetMax: reLead.budgetMax, currency: reLead.currency })
        .from(reLead).where(and(leadScope(a), isNull(reLead.archivedAt), or(like(reLead.name, raw), digits.length >= 4 ? like(reLead.phone, digits.slice(-9)) : undefined))).limit(8) : [];
      const owners = filtered || p.viewingsToday ? [] : await tx.select({ id: reOwner.id, name: reOwner.name, phone: reOwner.phone }).from(reOwner)
        .where(and(isNull(reOwner.archivedAt), or(like(reOwner.name, raw), digits.length >= 4 ? like(reOwner.phone, digits.slice(-9)) : undefined))).limit(6);
      const deals = filtered || p.viewingsToday || !may(a.principal, 'deals', 'read') ? [] : await tx.select({ id: reDeal.id, stage: reDeal.stage, title: reProperty.title, ref: reProperty.ref, lead: reLead.name }).from(reDeal)
        .innerJoin(reProperty, eq(reProperty.id, reDeal.propertyId)).leftJoin(reLead, eq(reLead.id, reDeal.leadId)).where(or(like(reProperty.title, raw), like(reLead.name, raw))).limit(6);
      const viewings = p.viewingsToday ? (await tx.select({ v: reViewing, title: reProperty.title, lead: reLead.name }).from(reViewing).innerJoin(reProperty, eq(reProperty.id, reViewing.propertyId)).leftJoin(reLead, eq(reLead.id, reViewing.leadId))
        .where(and(gte(reViewing.startsAt, dayStart(0)), lt(reViewing.startsAt, dayStart(1)), inArray(reViewing.status, ['scheduled', 'confirmed'])))).map((x) => ({ ...x.v, title: x.title, lead: x.lead })) : [];
      return { properties: props, leads, owners, deals, viewings, parsed: filtered || p.viewingsToday || p.followups ? p : null };
    });
    return c.json(out);
  });

  /** The questions an agency owner asks, answered with numbers (and nothing that pretends to be a chart). */
  r.get('/reports', async (c) => {
    const a = actor(c, 'reports', 'read');
    const days = Math.min(365, Math.max(7, Number(c.req.query('days')) || 90));
    const since = new Date(Date.now() - days * 86400_000).toISOString();
    const all = may(a.principal, 'leads', 'read-all'), seesMoney = may(a.principal, 'commission', 'read');
    const out = await inRe(d, a, async (tx) => {
      const q = async (s: any) => rowsOf(await tx.execute(s));
      const [inventory, sources, agents, areas, funnel, stale, money] = await Promise.all([
        q(sql`select type, status, count(*)::int as n from re_property where status <> 'archived' group by type, status order by type`),
        q(sql`select source, count(*)::int as leads, count(*) filter (where status = 'won')::int as won, count(*) filter (where exists (select 1 from re_viewing v where v.lead_id = l.id and v.status = 'completed'))::int as viewed
          from re_lead l where created_at >= ${since} ${all ? sql`` : sql`and agent_id = ${memberOf(a) ?? '-'}`} group by source order by count(*) desc`),
        q(sql`select m.id, u.name,
            (select count(*)::int from re_property p where p.agent_id = m.id and p.status in ('available','negotiating','reserved')) as listings,
            (select count(*)::int from re_lead l where l.agent_id = m.id and l.status in ('new','active','viewing','negotiating') and l.archived_at is null) as leads,
            (select count(*)::int from re_viewing v where v.agent_id = m.id and v.status = 'completed' and v.starts_at >= ${since}) as viewings,
            (select count(*)::int from re_viewing v where v.agent_id = m.id and v.status = 'no_show' and v.starts_at >= ${since}) as no_shows,
            (select count(*)::int from re_deal x where x.agent_id = m.id and x.stage = 'closed' and x.closed_at >= ${since}) as closed
          from member m join "user" u on u.id = m.user_id where m.organization_id = ${a.organizationId} ${all ? sql`` : sql`and m.id = ${memberOf(a) ?? '-'}`} order by closed desc, viewings desc`),
        // which areas sell fastest: days on the market for homes closed in the period
        q(sql`select coalesce(p.area, '—') as area, count(*)::int as closed, round(avg(extract(epoch from (x.closed_at - p.created_at)) / 86400))::int as days
          from re_deal x join re_property p on p.id = x.property_id where x.stage = 'closed' and x.closed_at >= ${since} group by p.area order by count(*) desc limit 10`),
        q(sql`select (select coalesce(sum(views), 0)::int from re_stat where day >= ${since.slice(0, 10)}) as views,
            (select coalesce(sum(wa + calls + requests), 0)::int from re_stat where day >= ${since.slice(0, 10)}) as inquiries,
            (select count(*)::int from re_viewing where status = 'completed' and starts_at >= ${since}) as viewings,
            (select count(*)::int from re_offer where kind = 'offer' and at >= ${since}) as offers,
            (select count(*)::int from re_deal where stage = 'closed' and closed_at >= ${since}) as deals`),
        // interest without offers: viewed a lot, no offer yet
        q(sql`select p.id, p.ref, p.title, p.area, (p.stats->>'views')::int as views,
            (select count(*)::int from re_viewing v where v.property_id = p.id and v.status = 'completed') as viewings,
            extract(day from now() - p.status_at)::int as days
          from re_property p where p.status = 'available' and not exists (select 1 from re_offer o join re_deal x on x.id = o.deal_id where x.property_id = p.id and o.kind = 'offer')
          order by coalesce((p.stats->>'views')::int, 0) desc limit 8`),
        seesMoney ? tx.select().from(reDeal).where(and(eq(reDeal.stage, 'closed'), gte(reDeal.closedAt, new Date(since)))) : Promise.resolve([] as any[]),
      ]);
      const commission: Record<string, number> = {};
      for (const x of money as any[]) commission[x.currency] = (commission[x.currency] ?? 0) + commissionOf(x).total;
      return { days, inventory, sources, agents, areas, funnel: funnel[0], interestNoOffers: stale, commission: seesMoney ? commission : null };
    });
    return c.json(out);
  });

  return r;
}
