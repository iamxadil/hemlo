// The door screen: a TV or tablet at the entrance opens a display-only link (#/door?k=<gym>.<key>). It greets each
// member as the desk checks them in ("Welcome, Ali — 12 days left"), shows today's classes, the hours (ladies' time)
// and how many are training now. If the owner allows it, members check themselves in there by scanning their card.
// No one is signed in on it, names leave the server shortened, and resetting the key cuts every screen off.
import { Hono } from 'hono';
import { sql } from 'drizzle-orm';
import { randomToken, safeEqual } from '@hemlo/core';
import { withOrg } from '@hemlo/db';
import { HttpError } from '../../principal';
import { actor } from '../sys-common';
import { shortName } from '../dental/screen';
import { fileUrl } from '../../files';
import { inGym, rowsOf, ymd, today, clock, stateOf, gymSettingsOf, type MsRow } from './common';
import { checkIn, IN_NOW_MINUTES } from './checkin';
import { subscriptionOf } from '../../subscription';
import type { AppEnv, Deps } from '../../types';

/** The gym a door link belongs to, if the link is still valid. */
export async function doorOrg(db: Deps['db'], k: string | null | undefined) {
  const [org, key] = String(k ?? '').split('.');
  if (!org || !key || key.length < 20) return null;
  const [row] = await withOrg(db, org, async (tx) => rowsOf(await tx.execute(sql`select door_key as key from gym_settings where organization_id = ${org}`)));
  return row?.key && safeEqual(String(row.key), key) ? org : null;
}

export function gymDoorRoutes(d: Deps) {
  const r = new Hono<AppEnv>();

  r.get('/door-link', async (c) => {
    const a = actor(c, 'members', 'read');
    const [row] = await inGym(d, a, async (tx) => rowsOf(await tx.execute(sql`insert into gym_settings (organization_id, door_key) values (${a.organizationId}, ${randomToken(24)})
      on conflict (organization_id) do update set door_key = coalesce(gym_settings.door_key, excluded.door_key) returning door_key`)));
    return c.json({ key: `${a.organizationId}.${row.door_key}` });
  });

  r.post('/door-link/reset', async (c) => {
    const a = actor(c, 'gym', 'configure');
    const key = randomToken(24);
    await inGym(d, a, (tx) => tx.execute(sql`insert into gym_settings (organization_id, door_key) values (${a.organizationId}, ${key})
      on conflict (organization_id) do update set door_key = excluded.door_key`));
    return c.json({ key: `${a.organizationId}.${key}` });
  });

  /** What the door shows. One query; no session. */
  r.get('/door', async (c) => {
    const [org, key] = String(c.req.query('k') ?? '').split('.');
    if (!org || !key || key.length < 20) throw new HttpError(404, 'NO_SCREEN');
    const day = today(), { dow } = clock();
    const row = await withOrg(d.db, org, async (tx) => rowsOf(await tx.execute(sql`select s.door_key as key, s.self_checkin, s.hours, s.grace_days, o.name, ss.logo_id as logo,
      (select count(distinct member_id)::int from gym_checkin where at >= now() - make_interval(mins => ${IN_NOW_MINUTES}) and result <> 'denied' and via <> 'pt') as in_now,
      coalesce((select json_agg(json_build_object('id', ci.id, 'at', ci.at, 'result', ci.result, 'reason', ci.reason, 'name', cu.name, 'gender', m.gender,
          'startsOn', ms.starts_on, 'endsOn', ms.ends_on, 'visits', ms.visits, 'visitsUsed', ms.visits_used, 'status', ms.status, 'msName', ms.name) order by ci.at desc)
        from (select * from gym_checkin where at >= now() - interval '10 minutes' and via <> 'pt' order by at desc limit 8) ci
        join sys_customer cu on cu.id = ci.member_id join gym_member m on m.customer_id = ci.member_id left join gym_membership ms on ms.id = ci.membership_id), '[]') as recent,
      coalesce((select json_agg(json_build_object('id', k.id, 'name', k.name, 'startsAt', k.starts_at, 'minutes', k.minutes, 'capacity', k.capacity, 'gender', k.gender, 'color', k.color,
          'coach', t.name, 'booked', (select count(*) from gym_booking b where b.class_id = k.id and b.date = ${day} and b.status in ('booked', 'attended'))) order by k.starts_at)
        from gym_class k left join gym_trainer t on t.id = k.trainer_id where k.active and k.day = ${Number(dow)}), '[]') as classes
      from gym_settings s join organization o on o.id = s.organization_id left join sys_settings ss on ss.organization_id = s.organization_id
      where s.organization_id = ${org}`))[0]);
    if (!row?.key || !safeEqual(String(row.key), key)) throw new HttpError(404, 'NO_SCREEN');
    const json = (v: any) => (typeof v === 'string' ? JSON.parse(v) : v) ?? [];
    c.header('cache-control', 'no-store');
    return c.json({
      gym: { name: row.name, logoUrl: await fileUrl(d.env, org, row.logo), selfCheckin: !!row.self_checkin },
      inNow: row.in_now, hours: (typeof row.hours === 'string' ? JSON.parse(row.hours) : row.hours)?.[dow] ?? [],
      classes: json(row.classes),
      recent: json(row.recent).map((x: any) => {
        const st = x.endsOn ? stateOf({ ...x, startsOn: ymd(x.startsOn), endsOn: ymd(x.endsOn), visitsUsed: x.visitsUsed ?? 0 } as MsRow, day, row.grace_days) : null;
        return { id: x.id, at: x.at, result: x.result, reason: x.reason, name: shortName(x.name), gender: x.gender, membership: x.msName ?? null, state: st?.state ?? null, daysLeft: st?.daysLeft ?? null, visitsLeft: st?.visitsLeft ?? null };
      }),
      today: day, at: new Date().toISOString(),
    });
  });

  /** Self check-in at the door (when the owner allows it): the card's code only. */
  r.post('/door/checkin', async (c) => {
    const k = c.req.query('k');
    const org = await doorOrg(d.db, k);
    if (!org) throw new HttpError(404, 'NO_SCREEN');
    if ((await subscriptionOf(d.db, org)).status === 'ended') throw new HttpError(402, 'TRIAL_ENDED'); // as at the desk: nothing new until Hemlo activates the gym
    const code = (await c.req.json<{ code?: string }>().catch(() => ({} as any))).code;
    const out = await withOrg(d.db, org, async (tx) => {
      const s = await gymSettingsOf(tx, org);
      if (!s.selfCheckin) throw new HttpError(403, 'SELF_CHECKIN_OFF');
      return checkIn(d, tx, org, { code }, { via: 'door' });
    });
    if (out.result !== 'again') d.screens?.changed(`gym:${org}`);
    const m = out.membership;
    return c.json({ id: out.checkin.id, result: out.result, reason: out.reason, warn: out.warn.filter((w) => w !== 'no_photo' && w !== 'owes'), name: shortName(out.member.name),
      membership: m ? { name: m.name, state: m.state, daysLeft: m.daysLeft, visitsLeft: m.visitsLeft } : null });
  });

  return r;
}

