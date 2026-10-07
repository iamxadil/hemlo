// The weekly timetable as dated sessions (this week, next week), places booked in each, and who came.
import { Hono } from 'hono';
import { and, eq, sql } from 'drizzle-orm';
import { newId } from '@hemlo/core';
import { gymClass, gymBooking } from '@hemlo/db/schema';
import { HttpError } from '../../principal';
import { actor, bad } from '../sys-common';
import { fileUrl } from '../../files';
import { inGym, rowsOf, ymd, today, addDays, dateOnly, memberOf } from './common';
import type { AppEnv, Deps } from '../../types';

const dowOf = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();

export function gymClassRoutes(d: Deps) {
  const r = new Hono<AppEnv>();

  /** Seven days of sessions from ?from= (default: today), each with its places taken. */
  r.get('/sessions', async (c) => {
    const a = actor(c, 'members', 'read');
    const from = dateOnly(c.req.query('from')) ?? today();
    const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));
    const out = await inGym(d, a, async (tx) => {
      const classes = await tx.select().from(gymClass).where(eq(gymClass.active, true));
      const counts = rowsOf(await tx.execute(sql`select class_id, date, count(*) filter (where status in ('booked', 'attended'))::int as booked, count(*) filter (where status = 'attended')::int as came
        from gym_booking where date between ${from} and ${days[6]} group by class_id, date`));
      return { classes, counts };
    });
    const sessions = days.flatMap((date) => out.classes.filter((k) => k.day === dowOf(date)).map((k) => {
      const n = out.counts.find((x) => x.class_id === k.id && ymd(x.date) === date);
      return { classId: k.id, date, name: k.name, trainerId: k.trainerId, startsAt: k.startsAt, minutes: k.minutes, capacity: k.capacity, gender: k.gender, color: k.color, booked: n?.booked ?? 0, came: n?.came ?? 0 };
    })).sort((x, y) => (x.date + x.startsAt).localeCompare(y.date + y.startsAt));
    return c.json({ from, sessions });
  });

  /** Who is booked into one session. */
  r.get('/sessions/:classId/:date', async (c) => {
    const a = actor(c, 'members', 'read');
    const date = dateOnly(c.req.param('date')) ?? bad('BAD_DATE');
    const rows = await inGym(d, a, async (tx) => rowsOf(await tx.execute(sql`select b.id, b.status, b.member_id, cu.name, cu.phone, m.member_no, m.photo_id, m.gender
      from gym_booking b join sys_customer cu on cu.id = b.member_id join gym_member m on m.customer_id = b.member_id
      where b.class_id = ${c.req.param('classId')} and b.date = ${date} and b.status <> 'canceled' order by b.created_at`)));
    return c.json({ bookings: await Promise.all(rows.map(async (x) => ({ id: x.id, status: x.status, memberId: x.member_id, name: x.name, phone: x.phone, memberNo: x.member_no, gender: x.gender,
      photoUrl: await fileUrl(d.env, a.organizationId, x.photo_id) }))) });
  });

  /** A place in a session: { classId, date, memberId }. Full is full; a ladies' class is for ladies. */
  r.post('/bookings', async (c) => {
    const a = actor(c, 'checkin', 'create');
    const b = await c.req.json<any>();
    const date = dateOnly(b.date) ?? bad('BAD_DATE');
    if (date < today() || date > addDays(today(), 30)) bad('BAD_DATE');
    const row = await inGym(d, a, async (tx) => {
      const [k] = await tx.select().from(gymClass).where(eq(gymClass.id, String(b.classId ?? '')));
      if (!k || !k.active || k.day !== dowOf(date)) bad('BAD_CLASS');
      const x = await memberOf(tx, String(b.memberId ?? ''));
      if (k!.gender !== 'all' && x.m.gender && x.m.gender !== k!.gender) throw new HttpError(409, 'CLASS_GENDER');
      // the count and the insert in one statement: two desks can't both take the last place
      const [ins] = rowsOf(await tx.execute(sql`insert into gym_booking (id, organization_id, class_id, date, member_id, status)
        select ${newId()}, ${a.organizationId}, ${k!.id}, ${date}, ${x.m.customerId}, 'booked'
        where ${k!.capacity == null} or (select count(*) from gym_booking where class_id = ${k!.id} and date = ${date} and status in ('booked', 'attended')) < ${k!.capacity ?? 0}
        on conflict (class_id, date, member_id) do update set status = 'booked' where gym_booking.status = 'canceled'
        returning id, status`));
      if (!ins) {
        const [mine] = await tx.select().from(gymBooking).where(and(eq(gymBooking.classId, k!.id), eq(gymBooking.date, date), eq(gymBooking.memberId, x.m.customerId)));
        throw new HttpError(409, mine && mine.status !== 'canceled' ? 'ALREADY_BOOKED' : 'CLASS_FULL');
      }
      return ins;
    });
    return c.json({ booking: row }, 201);
  });

  /** Came · didn't come · cancelled. */
  r.patch('/bookings/:id', async (c) => {
    const a = actor(c, 'checkin', 'create');
    const status = (await c.req.json<any>()).status;
    if (!['booked', 'attended', 'no_show', 'canceled'].includes(status)) bad('BAD_STATUS');
    const [row] = await inGym(d, a, (tx) => tx.update(gymBooking).set({ status }).where(eq(gymBooking.id, c.req.param('id'))).returning());
    if (!row) throw new HttpError(404, 'NOT_FOUND');
    return c.json({ booking: row });
  });

  return r;
}
