// The door: a card scanned (or a name picked) → in, or turned back with the reason, in one request. Which membership
// opens the door, visits counted once per stay (coming back within the re-entry time is the same visit), ladies' hours,
// and the desk's "let them in anyway". Plus the front desk's day: who came, who is in now, and the numbers.
import { Hono } from 'hono';
import { sql } from 'drizzle-orm';
import { newId } from '@hemlo/core';
import type { Database } from '@hemlo/db';
import { HttpError } from '../../principal';
import { actor, bad } from '../sys-common';
import { fileUrl } from '../../files';
import { inGym, rowsOf, ymd, today, addDays, cardCodeFrom, stateOf, hoursProblem, DOOR_ORDER, dateOnly, type MsRow } from './common';
import type { AppEnv, Deps } from '../../types';

export type CheckinResult = Awaited<ReturnType<typeof checkIn>>;
/** "in the gym now": came through the door within this many minutes */
export const IN_NOW_MINUTES = 90;

/**
 * Check a member in. Used by the desk (signed in) and by the door screen (self check-in, card only).
 * override: the desk lets someone in despite a problem (recorded as such).
 */
export async function checkIn(d: Deps, tx: Database, org: string, who: { memberId?: string | null; code?: string | null }, opts: { via: 'desk' | 'door'; override?: boolean; userId?: string | null }) {
  // A scanner at the door must feel instant: one read (the member, the gym's rules, their last visit, their memberships),
  // then one write (the visit, the membership's count, the member's last visit). Each round trip to the database costs.
  const code = who.memberId ? null : cardCodeFrom(who.code);
  if (!who.memberId && !code) throw new HttpError(404, 'CARD_UNKNOWN');
  const day = today(), now = Date.now();
  const [row] = rowsOf(await tx.execute(sql`select m.customer_id, m.member_no, m.gender, m.birth_date, m.photo_id, m.alerts, m.goal, m.trainer_id, m.last_visit_at, m.created_at,
      cu.name, cu.phone, cu.balance, cu.archived_at, s.hours, coalesce(s.reentry_minutes, 180) as reentry, coalesce(s.grace_days, 0) as grace,
      (select row_to_json(ci) from (select id, at from gym_checkin where member_id = m.customer_id and result <> 'denied' and via <> 'pt'
        and at >= now() - make_interval(mins => coalesce(s.reentry_minutes, 180)) order by at desc limit 1) ci) as last,
      coalesce((select json_agg(json_build_object('id', ms.id, 'name', ms.name, 'category', ms.category, 'startsOn', ms.starts_on, 'endsOn', ms.ends_on, 'visits', ms.visits,
        'visitsUsed', ms.visits_used, 'status', ms.status, 'frozenFrom', ms.frozen_from, 'freezeDays', ms.freeze_days, 'frozenDays', ms.frozen_days, 'trainerId', ms.trainer_id, 'price', ms.price))
        from gym_membership ms where ms.member_id = m.customer_id and ms.status <> 'canceled' and ms.category in ('gym', 'class', 'pt') and ms.ends_on >= ${addDays(day, -60)}), '[]') as ms
    from gym_member m join sys_customer cu on cu.id = m.customer_id left join gym_settings s on s.organization_id = m.organization_id
    where ${who.memberId ? sql`m.customer_id = ${who.memberId}` : sql`m.card_code = ${code}`}`));
  if (!row) throw new HttpError(404, who.memberId ? 'MEMBER_NOT_FOUND' : 'CARD_UNKNOWN');
  if (row.archived_at) throw new HttpError(404, 'MEMBER_NOT_FOUND');
  const memberId: string = row.customer_id, grace = Number(row.grace);
  const json = (v: any) => (typeof v === 'string' ? JSON.parse(v) : v);
  const all = (json(row.ms) as MsRow[]).map((m) => ({ ...m, startsOn: ymd(m.startsOn)!, endsOn: ymd(m.endsOn)!, frozenFrom: ymd(m.frozenFrom) })).sort((a, b) => a.endsOn.localeCompare(b.endsOn));
  const doorMs = all.map((m) => ({ m, ...stateOf(m, day, grace) }));
  // what opens the door: running (or in its grace days), the gym itself first, the one ending soonest first
  const usable = doorMs.filter((x) => x.state === 'active' || x.state === 'grace')
    .sort((a, b) => (a.state === 'active' ? 0 : 1) - (b.state === 'active' ? 0 : 1) || DOOR_ORDER.indexOf(a.m.category) - DOOR_ORDER.indexOf(b.m.category) || a.m.endsOn.localeCompare(b.m.endsOn))[0];
  let reason: string | null = null;
  if (!usable) reason = doorMs.some((x) => x.state === 'frozen') ? 'frozen' : doorMs.some((x) => x.state === 'future') ? 'not_started' : doorMs.some((x) => x.state === 'used') ? 'no_visits' : doorMs.length ? 'expired' : 'none';
  else reason = hoursProblem(json(row.hours), row.gender, now);
  const shown = usable ?? [...doorMs].sort((a, b) => b.m.endsOn.localeCompare(a.m.endsOn))[0] ?? null; // what to show when turned back: the latest

  const birthDate = ymd(row.birth_date);
  const card = { id: memberId, memberNo: row.member_no, name: row.name, phone: row.phone, balance: row.balance, gender: row.gender, birthDate,
    photoUrl: await fileUrl(d.env, org, row.photo_id), alerts: json(row.alerts) ?? [], goal: row.goal, trainerId: row.trainer_id, lastVisitAt: row.last_visit_at, createdAt: row.created_at };
  const msOut = (m: typeof shown) => (m ? { id: m.m.id, name: m.m.name, category: m.m.category, startsOn: m.m.startsOn, endsOn: m.m.endsOn, visits: m.m.visits, visitsUsed: m.m.visitsUsed,
    state: m.state, daysLeft: m.daysLeft, visitsLeft: m.visitsLeft, frozenFrom: m.m.frozenFrom } : null);
  const last = json(row.last);
  // here already (or popped out to the car): the same visit, nothing counted twice
  if (last && !reason) return { result: 'again' as const, reason: null, warn: [] as string[], member: card, membership: msOut(shown), checkin: { id: last.id as string, at: last.at as string } };

  const allowed = !reason || !!opts.override;
  const counts = !!(allowed && usable && usable.m.visits != null && !reason);
  const result = !reason ? 'ok' as const : opts.override ? 'override' as const : 'denied' as const;
  const id = newId();
  const [w] = rowsOf(await tx.execute(sql`with ins as (insert into gym_checkin (id, organization_id, member_id, membership_id, via, result, reason, counted, user_id)
      values (${id}, ${org}, ${memberId}, ${usable?.m.id ?? shown?.m.id ?? null}, ${opts.via}, ${result}, ${reason}, ${counts}, ${opts.userId ?? null}) returning id, at),
    up as (update gym_membership set visits_used = visits_used + 1 where id = ${counts ? usable!.m.id : null} returning visits_used),
    seen as (update gym_member set last_visit_at = now() where customer_id = ${allowed ? memberId : null} returning 1)
    select (select at from ins) as at, (select visits_used from up) as used, (select count(*) from seen) as seen`));
  let ms = shown;
  if (counts) { const m = { ...usable!.m, visitsUsed: Number(w.used) }; ms = { m, ...stateOf(m, day, grace) }; }

  const warn: string[] = [];
  if (allowed && ms) {
    if (ms.state === 'grace') warn.push('grace');
    else if (ms.m.visits != null ? (ms.visitsLeft ?? 0) <= 2 : ms.daysLeft <= 3) warn.push('ending');
  }
  if (row.balance > 0) warn.push('owes');
  if (birthDate && birthDate.slice(5) === day.slice(5)) warn.push('birthday');
  if (!row.photo_id) warn.push('no_photo');
  return { result, reason, warn, member: card, membership: msOut(ms), checkin: { id, at: w.at as string } };
}

export function gymCheckinRoutes(d: Deps) {
  const r = new Hono<AppEnv>();

  /** { memberId } or { code } (a scanned card), and { override } to let someone in despite a problem. */
  r.post('/checkin', async (c) => {
    const a = actor(c, 'checkin', 'create');
    const b = await c.req.json<{ memberId?: string; code?: string; override?: boolean }>().catch(() => ({} as any));
    if (!b.memberId && !b.code) bad('NO_MEMBER');
    const out = await inGym(d, a, (tx) => checkIn(d, tx, a.organizationId, b, { via: 'desk', override: !!b.override, userId: a.userId }));
    if (out.result !== 'again') d.screens?.changed(`gym:${a.organizationId}`);
    return c.json(out, out.result === 'again' ? 200 : 201);
  });

  /** One day's door: everyone who came (or was turned back), newest first. */
  r.get('/checkins', async (c) => {
    const a = actor(c, 'members', 'read');
    const day = dateOnly(c.req.query('day')) ?? today();
    const from = new Date(`${day}T00:00:00+03:00`), to = new Date(+from + 86400_000);
    const rows = await inGym(d, a, async (tx) => rowsOf(await tx.execute(sql`select ci.id, ci.member_id, ci.at, ci.via, ci.result, ci.reason, ci.counted, ci.trainer_id,
        cu.name, m.member_no, m.photo_id, m.gender, ms.name as ms_name
      from gym_checkin ci join sys_customer cu on cu.id = ci.member_id join gym_member m on m.customer_id = ci.member_id left join gym_membership ms on ms.id = ci.membership_id
      where ci.at >= ${from} and ci.at < ${to} order by ci.at desc limit 400`)));
    const checkins = await Promise.all(rows.map(async (x) => ({ id: x.id, memberId: x.member_id, at: x.at, via: x.via, result: x.result, reason: x.reason, counted: x.counted, trainerId: x.trainer_id,
      name: x.name, memberNo: x.member_no, gender: x.gender, membership: x.ms_name, photoUrl: await fileUrl(d.env, a.organizationId, x.photo_id) })));
    return c.json({ checkins });
  });

  /** The desk's glance: who is in now, today against last week, members, renewals due, money today, the hours of the day. */
  r.get('/today', async (c) => {
    const a = actor(c, 'members', 'read');
    const day = today();
    const from = new Date(`${day}T00:00:00+03:00`), weekAgo = new Date(+from - 7 * 86400_000), nowWeekAgo = new Date(Date.now() - 7 * 86400_000);
    const out = await inGym(d, a, async (tx) => {
      const [n] = rowsOf(await tx.execute(sql`select
        (select count(distinct member_id)::int from gym_checkin where at >= now() - make_interval(mins => ${IN_NOW_MINUTES}) and result <> 'denied' and via <> 'pt') as in_now,
        (select count(*)::int from gym_checkin where at >= ${from} and result <> 'denied' and via <> 'pt') as visits,
        (select count(*)::int from gym_checkin where at >= ${weekAgo} and at < ${nowWeekAgo} and result <> 'denied' and via <> 'pt') as visits_last_week,
        (select count(*)::int from gym_checkin where at >= ${from} and result = 'denied') as turned_back,
        (select count(*)::int from gym_checkin where at >= ${from} and via = 'pt') as pt_sessions,
        (select count(distinct ms.member_id)::int from gym_membership ms join sys_customer cu on cu.id = ms.member_id
          where cu.archived_at is null and ms.status = 'active' and ms.category <> 'other' and ms.starts_on <= ${day} and ms.ends_on >= ${day}
            and (ms.visits is null or ms.visits_used < ms.visits)) as active,
        (select count(*)::int from gym_membership ms where ms.status = 'active' and ms.category in ('gym', 'class', 'pt') and ms.ends_on between ${day} and ${addDays(day, 6)}
          and not exists (select 1 from gym_membership n where n.member_id = ms.member_id and n.category = ms.category and n.status <> 'canceled' and n.ends_on > ms.ends_on)) as ending,
        (select count(*)::int from gym_membership ms where ms.status = 'active' and ms.category in ('gym', 'class', 'pt') and ms.ends_on between ${addDays(day, -14)} and ${addDays(day, -1)}
          and not exists (select 1 from gym_membership n where n.member_id = ms.member_id and n.category = ms.category and n.status <> 'canceled' and n.ends_on > ms.ends_on)) as lapsed,
        (select count(*)::int from gym_member m where m.created_at >= ${from}) as new_today,
        (select count(*)::int from gym_membership where created_at >= ${from} and status <> 'canceled') as sold_today,
        (select coalesce(sum(total - returned), 0)::int from sys_sale where created_at >= ${from} and voided_at is null and note = 'gym') as memberships_today,
        (select coalesce(sum(total - returned), 0)::int from sys_sale where created_at >= ${from} and voided_at is null and coalesce(note, '') <> 'gym') as shop_today,
        (select coalesce(sum(paid), 0)::int from sys_sale where created_at >= ${from} and voided_at is null)
          + (select coalesce(-sum(amount), 0)::int from sys_ledger where at >= ${from} and kind = 'payment') as collected_today,
        (select coalesce(sum(balance), 0)::int from sys_customer where balance > 0 and archived_at is null) as owed,
        (select count(*)::int from sys_customer where balance > 0 and archived_at is null) as owing`));
      // visits per hour, today and the same day last week (the shape of the day)
      const hours = rowsOf(await tx.execute(sql`select extract(hour from (at at time zone 'Asia/Baghdad'))::int as h, (at >= ${from})::bool as today, count(*)::int as n
        from gym_checkin where ((at >= ${from}) or (at >= ${weekAgo} and at < ${new Date(+weekAgo + 86400_000)})) and result <> 'denied' and via <> 'pt' group by 1, 2`));
      return { n, hours };
    });
    const hours = Array.from({ length: 24 }, (_, h) => ({ h, today: out.hours.find((x) => x.h === h && x.today)?.n ?? 0, lastWeek: out.hours.find((x) => x.h === h && !x.today)?.n ?? 0 }));
    const n = out.n;
    return c.json({
      inNow: n.in_now, visits: n.visits, visitsLastWeek: n.visits_last_week, turnedBack: n.turned_back, ptSessions: n.pt_sessions, active: n.active, ending: n.ending, lapsed: n.lapsed,
      newToday: n.new_today, soldToday: n.sold_today, membershipsToday: n.memberships_today, shopToday: n.shop_today, collectedToday: n.collected_today, owed: n.owed, owing: n.owing, hours,
    });
  });

  return r;
}

