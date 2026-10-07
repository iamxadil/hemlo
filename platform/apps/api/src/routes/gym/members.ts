// Members: search and the lists the desk works from (active, ending soon, lapsed, paused, owing), the member's file,
// their photo and card, and body measurements.
import { Hono } from 'hono';
import { and, desc, eq, sql } from 'drizzle-orm';
import { newId, normalizeIraqiPhone } from '@hemlo/core';
import { sysCustomer, sysFile, gymMember, gymMembership, gymCheckin, gymMeasure, gymTrainer } from '@hemlo/db/schema';
import { HttpError } from '../../principal';
import { actor, may, bad, text } from '../sys-common';
import { nextNumber } from '../systems-ops';
import { claimFiles, dropFiles } from '../files';
import { fileUrl } from '../../files';
import { inGym, rowsOf, ymd, today, addDays, dateOnly, memberOf, cardOf, newCardCode, cardCodeFrom, cleanHealth, alertsFrom, currentMs, stateOf, gymSettingsOf, GOALS, type MsRow } from './common';
import type { AppEnv, Deps } from '../../types';

const STATUSES = ['all', 'active', 'ending', 'expired', 'frozen', 'owing', 'none'] as const;
const ENDING_DAYS = 5;

function profileInput(b: any) {
  const m: Partial<typeof gymMember.$inferInsert> = {}, c: Partial<typeof sysCustomer.$inferInsert> = {};
  if (b.name !== undefined) c.name = text(b.name, 100, 'BAD_NAME', true)!;
  if (b.phone !== undefined) c.phone = b.phone ? normalizeIraqiPhone(String(b.phone)) ?? bad('BAD_PHONE') : null;
  if (b.gender !== undefined) m.gender = b.gender == null || b.gender === '' ? null : ['f', 'm'].includes(b.gender) ? b.gender : bad('BAD_GENDER');
  if (b.birthDate !== undefined) m.birthDate = dateOnly(b.birthDate, 'BAD_BIRTH_DATE');
  if (b.goal !== undefined) m.goal = b.goal == null || b.goal === '' ? null : GOALS.includes(b.goal) ? b.goal : bad('BAD_GOAL');
  if (b.emergencyName !== undefined) m.emergencyName = text(b.emergencyName, 80, 'BAD_TEXT');
  if (b.emergencyPhone !== undefined) m.emergencyPhone = b.emergencyPhone ? normalizeIraqiPhone(String(b.emergencyPhone)) ?? bad('BAD_PHONE') : null;
  if (b.referral !== undefined) m.referral = text(b.referral, 80, 'BAD_TEXT');
  if (b.notes !== undefined) m.notes = text(b.notes, 2000, 'BAD_TEXT');
  if (b.trainerId !== undefined) m.trainerId = b.trainerId || null;
  if (b.health !== undefined) { m.health = cleanHealth(b.health); m.alerts = alertsFrom(m.health as any); }
  return { m, c };
}

/** The state of a member's current membership, in SQL (for lists and counts). */
const stateSql = (day: string) => sql`case when cur.id is null then 'none' when cur.status = 'frozen' then 'frozen' when cur.starts_on > ${day} then 'future'
  when cur.ends_on < ${day} or (cur.visits is not null and cur.visits_used >= cur.visits) then 'expired'
  when cur.ends_on <= ${addDays(day, ENDING_DAYS - 1)} or (cur.visits is not null and cur.visits - cur.visits_used <= 2) then 'ending' else 'active' end`;

export function gymMemberRoutes(d: Deps) {
  const r = new Hono<AppEnv>();

  /**
   * The member list: ?q= (name, phone, member number, card) and ?status= (active · ending · expired · frozen · owing · all),
   * with the counts for every status in the same query.
   */
  r.get('/members', async (c) => {
    const a = actor(c, 'members', 'read');
    const q = (c.req.query('q') ?? '').trim();
    const status = (STATUSES as readonly string[]).includes(c.req.query('status') ?? '') ? c.req.query('status')! : 'all';
    const offset = Math.max(0, Math.min(10_000, Number(c.req.query('offset')) || 0));
    const day = today();
    const digits = q.replace(/\D/g, ''), code = cardCodeFrom(q);
    const search = !q ? sql`true`
      : code ? sql`m.card_code = ${code}`
      : /^\d{1,6}$/.test(q) ? sql`(m.member_no = ${Number(q)} or cu.phone like ${'%' + digits + '%'})`
      : digits.length >= 4 ? sql`cu.phone like ${'%' + digits.replace(/^0/, '') + '%'}`
      : sql`cu.name ilike ${'%' + q.replace(/[%_\\]/g, '') + '%'}`;
    const filter = status === 'all' ? sql`true`
      : status === 'owing' ? sql`cu.balance > 0`
      : status === 'active' ? sql`st.s in ('active', 'ending')`
      : status === 'expired' ? sql`st.s = 'expired' and cur.ends_on >= ${addDays(day, -90)}` // lapsed lately: worth a call
      : sql`st.s = ${status}`;
    const out = await inGym(d, a, async (tx) => {
      const base = sql`from gym_member m join sys_customer cu on cu.id = m.customer_id left join lateral ${currentMs(day)} cur on true
        cross join lateral (select ${stateSql(day)} as s) st where cu.archived_at is null and ${search}`;
      const rows = rowsOf(await tx.execute(sql`select m.customer_id as id, m.member_no, cu.name, cu.phone, cu.balance, m.gender, m.photo_id, m.alerts, m.last_visit_at, m.trainer_id,
          cur.id as ms_id, cur.name as ms_name, cur.category as ms_category, cur.starts_on, cur.ends_on, cur.visits, cur.visits_used, st.s as state
        ${base} and ${filter}
        order by ${status === 'ending' ? sql`cur.ends_on asc` : status === 'expired' ? sql`cur.ends_on desc` : q && /^\d{1,6}$/.test(q) ? sql`(m.member_no = ${Number(q) || 0}) desc, m.created_at desc` : sql`m.last_visit_at desc nulls last, m.created_at desc`}
        limit 61 offset ${offset}`));
      const [counts] = rowsOf(await tx.execute(sql`select count(*)::int as "all", count(*) filter (where st.s in ('active', 'ending'))::int as active,
          count(*) filter (where st.s = 'ending')::int as ending, count(*) filter (where st.s = 'expired' and cur.ends_on >= ${addDays(day, -90)})::int as expired,
          count(*) filter (where st.s = 'frozen')::int as frozen, count(*) filter (where cu.balance > 0)::int as owing ${base}`));
      return { rows, counts };
    });
    const members = await Promise.all(out.rows.slice(0, 60).map(async (x) => ({
      id: x.id, memberNo: x.member_no, name: x.name, phone: x.phone, balance: x.balance, gender: x.gender, alerts: x.alerts ?? [], lastVisitAt: x.last_visit_at, trainerId: x.trainer_id,
      photoUrl: await fileUrl(d.env, a.organizationId, x.photo_id), state: x.state,
      membership: x.ms_id ? { id: x.ms_id, name: x.ms_name, category: x.ms_category, startsOn: ymd(x.starts_on), endsOn: ymd(x.ends_on), visits: x.visits, visitsUsed: x.visits_used } : null,
    })));
    return c.json({ members, counts: out.counts, more: out.rows.length > 60 });
  });

  r.post('/members', async (c) => {
    const a = actor(c, 'members', 'create');
    const b = await c.req.json<any>();
    const { m, c: cu } = profileInput({ health: {}, ...b });
    if (!cu.name) bad('BAD_NAME');
    const out = await inGym(d, a, async (tx) => {
      const id = newId();
      const [customer] = await tx.insert(sysCustomer).values({ id, organizationId: a.organizationId, name: cu.name!, phone: cu.phone ?? null, note: null }).returning();
      if (b.photoId) { await claimFiles(tx, [b.photoId], 'member', id); m.photoId = b.photoId; }
      const [row] = await tx.insert(gymMember).values({ customerId: id, organizationId: a.organizationId, memberNo: await nextNumber(tx, a.organizationId, 'member'), cardCode: newCardCode(), ...m } as any).returning();
      return { m: row, c: customer };
    });
    return c.json({ member: await cardOf(d, a.organizationId, out) }, 201);
  });

  /** The member's file: profile, every membership and its state, visits, measurements, classes booked, their coach. */
  r.get('/members/:id', async (c) => {
    const a = actor(c, 'members', 'read');
    const id = c.req.param('id');
    const day = today();
    const out = await inGym(d, a, async (tx) => {
      const x = await memberOf(tx, id);
      const s = await gymSettingsOf(tx, a.organizationId);
      const memberships = await tx.select().from(gymMembership).where(eq(gymMembership.memberId, id)).orderBy(desc(gymMembership.endsOn)).limit(100);
      const visits = await tx.select().from(gymCheckin).where(eq(gymCheckin.memberId, id)).orderBy(desc(gymCheckin.at)).limit(120);
      const measures = may(a.principal, 'training', 'read') ? await tx.select().from(gymMeasure).where(eq(gymMeasure.memberId, id)).orderBy(desc(gymMeasure.at)).limit(60) : [];
      const bookings = rowsOf(await tx.execute(sql`select b.id, b.date, b.status, k.name, k.starts_at from gym_booking b join gym_class k on k.id = b.class_id
        where b.member_id = ${id} and b.date >= ${day} and b.status = 'booked' order by b.date, k.starts_at limit 20`));
      const [stats] = rowsOf(await tx.execute(sql`select count(*) filter (where at >= now() - interval '30 days' and result <> 'denied')::int as month,
        count(*) filter (where result <> 'denied')::int as total from gym_checkin where member_id = ${id}`));
      const trainer = x.m.trainerId ? (await tx.select().from(gymTrainer).where(eq(gymTrainer.id, x.m.trainerId)))[0] ?? null : null;
      return { x, s, memberships, visits, measures, bookings, stats, trainer };
    });
    const { x } = out;
    const health = may(a.principal, 'training', 'read') || may(a.principal, 'members', 'update');
    return c.json({
      member: { ...(await cardOf(d, a.organizationId, x)), cardCode: x.m.cardCode, emergencyName: x.m.emergencyName, emergencyPhone: x.m.emergencyPhone, referral: x.m.referral,
        notes: x.m.notes, ...(health ? { health: x.m.health } : {}) },
      memberships: out.memberships.map((m) => ({ ...m, ...stateOf(m as unknown as MsRow, day, out.s.graceDays) })),
      visits: out.visits, measures: out.measures, bookings: out.bookings, stats: out.stats, trainer: out.trainer,
    });
  });

  r.patch('/members/:id', async (c) => {
    const a = actor(c, 'members', 'update');
    const id = c.req.param('id');
    const b = await c.req.json<any>();
    const { m, c: cu } = profileInput(b);
    const out = await inGym(d, a, async (tx) => {
      const x = await memberOf(tx, id);
      if (b.photoId !== undefined) { // a new photo replaces the old one (null removes it)
        if (b.photoId) await claimFiles(tx, [b.photoId], 'member', id);
        if (x.m.photoId && x.m.photoId !== b.photoId) await dropFiles(d, tx, and(eq(sysFile.id, x.m.photoId)));
        m.photoId = b.photoId || null;
      }
      const [mm] = Object.keys(m).length ? await tx.update(gymMember).set({ ...m, updatedAt: new Date() }).where(eq(gymMember.customerId, id)).returning() : [x.m];
      const [cc] = Object.keys(cu).length ? await tx.update(sysCustomer).set({ ...cu, updatedAt: new Date() }).where(eq(sysCustomer.id, id)).returning() : [x.c];
      return { m: mm, c: cc };
    });
    return c.json({ member: await cardOf(d, a.organizationId, out) });
  });

  /** A lost card: a new code, and the old card stops opening the door. */
  r.post('/members/:id/new-card', async (c) => {
    const a = actor(c, 'members', 'update');
    const [row] = await inGym(d, a, (tx) => tx.update(gymMember).set({ cardCode: newCardCode(), updatedAt: new Date() }).where(eq(gymMember.customerId, c.req.param('id'))).returning({ cardCode: gymMember.cardCode }));
    if (!row) throw new HttpError(404, 'MEMBER_NOT_FOUND');
    return c.json(row);
  });

  /** Archive (or bring back) a member: they leave the lists, their history stays. */
  r.post('/members/:id/archive', async (c) => {
    const a = actor(c, 'members', 'update');
    const on = (await c.req.json<{ archived?: boolean }>().catch(() => ({} as any))).archived !== false;
    const [row] = await inGym(d, a, (tx) => tx.update(sysCustomer).set({ archivedAt: on ? new Date() : null, updatedAt: new Date() }).where(eq(sysCustomer.id, c.req.param('id'))).returning({ id: sysCustomer.id }));
    if (!row) throw new HttpError(404, 'MEMBER_NOT_FOUND');
    return c.json({ ok: true });
  });

  // ---- body measurements ----
  const num = (v: unknown, max: number) => (v == null || v === '' ? null : Number.isFinite(Number(v)) && Number(v) > 0 && Number(v) <= max ? Math.round(Number(v) * 10) / 10 : bad('BAD_MEASURE'));
  r.post('/members/:id/measures', async (c) => {
    const a = actor(c, 'training', 'write');
    const b = await c.req.json<any>();
    const v = { weight: num(b.weight, 400), height: num(b.height, 260), bodyFat: num(b.bodyFat, 80), muscle: num(b.muscle, 200), waist: num(b.waist, 300),
      chest: num(b.chest, 300), arm: num(b.arm, 120), thigh: num(b.thigh, 150), hip: num(b.hip, 300) };
    if (Object.values(v).every((x) => x == null)) bad('EMPTY_MEASURE');
    const [row] = await inGym(d, a, async (tx) => {
      await memberOf(tx, c.req.param('id'));
      return tx.insert(gymMeasure).values({ id: newId(), organizationId: a.organizationId, memberId: c.req.param('id'), ...v, note: text(b.note, 300, 'BAD_TEXT'), userId: a.userId,
        ...(b.at ? { at: new Date(`${dateOnly(b.at)}T12:00:00+03:00`) } : {}) }).returning();
    });
    return c.json({ measure: row }, 201);
  });
  r.delete('/measures/:id', async (c) => {
    const a = actor(c, 'training', 'write');
    const [row] = await inGym(d, a, (tx) => tx.delete(gymMeasure).where(eq(gymMeasure.id, c.req.param('id'))).returning({ id: gymMeasure.id }));
    if (!row) throw new HttpError(404, 'NOT_FOUND');
    return c.json({ ok: true });
  });

  /** Birthdays this week (a message on the day keeps people coming). */
  r.get('/birthdays', async (c) => {
    const a = actor(c, 'members', 'read');
    const day = today();
    const from = day.slice(5), to = addDays(day, 6).slice(5); // MM-DD; the week may cross the new year
    const rows = await inGym(d, a, async (tx) => rowsOf(await tx.execute(sql`select m.customer_id as id, cu.name, cu.phone, m.birth_date
      from gym_member m join sys_customer cu on cu.id = m.customer_id where cu.archived_at is null and m.birth_date is not null
        and ${from <= to ? sql`to_char(m.birth_date, 'MM-DD') between ${from} and ${to}` : sql`(to_char(m.birth_date, 'MM-DD') >= ${from} or to_char(m.birth_date, 'MM-DD') <= ${to})`}
      order by (to_char(m.birth_date, 'MM-DD') < ${from}), to_char(m.birth_date, 'MM-DD') limit 50`)));
    return c.json({ birthdays: rows.map((x) => ({ id: x.id, name: x.name, phone: x.phone, birthDate: ymd(x.birth_date) })) });
  });

  return r;
}
