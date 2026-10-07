// The waiting-room screen. A TV opens a display-only link (#/waiting?k=<clinic>.<key>): no one is signed in on it, it can
// read nothing but the chairs and the queue, and resetting the key cuts every screen off. Patients see it, so names
// leave the server already shortened ("Ali H."). One small query per refresh, and no session lookup: it's cheap to poll.
import { Hono } from 'hono';
import { sql } from 'drizzle-orm';
import { randomToken, safeEqual } from '@hemlo/core';
import { withOrg } from '@hemlo/db';
import { HttpError } from '../../principal';
import { actor } from '../sys-common';
import { inClinic } from './common';
import { fileUrl } from '../../files';
import type { AppEnv, Deps } from '../../types';

const rowsOf = (r: any): any[] => (Array.isArray(r) ? r : r?.rows ?? []);
/** "Ali Hussein Kadhim" → "Ali H." (what a waiting room may see) */
export const shortName = (n: string) => { const w = String(n ?? '').trim().split(/\s+/).filter(Boolean); return w.length > 1 ? `${w[0]} ${[...w[1]][0]}.` : w[0] ?? ''; };

/** The clinic a screen link belongs to, if the link is still valid. */
export async function screenOrg(db: Deps['db'], k: string | null | undefined) {
  const [org, key] = String(k ?? '').split('.');
  if (!org || !key || key.length < 20) return null;
  const [row] = await withOrg(db, org, async (tx) => rowsOf(await tx.execute(sql`select screen_key as key from dent_settings where organization_id = ${org}`)));
  return row?.key && safeEqual(String(row.key), key) ? org : null;
}

export function dentalScreenRoutes(d: Deps) {
  const r = new Hono<AppEnv>();

  /** The screen's link for this clinic (made the first time anyone asks). */
  r.get('/screen-link', async (c) => {
    const a = actor(c, 'appointments', 'read');
    const [row] = await inClinic(d, a, async (tx) => rowsOf(await tx.execute(sql`insert into dent_settings (organization_id, screen_key) values (${a.organizationId}, ${randomToken(24)})
      on conflict (organization_id) do update set screen_key = coalesce(dent_settings.screen_key, excluded.screen_key) returning screen_key`)));
    return c.json({ key: `${a.organizationId}.${row.screen_key}` });
  });

  /** A new link: every screen showing the old one goes blank. */
  r.post('/screen-link/reset', async (c) => {
    const a = actor(c, 'clinic', 'configure');
    const key = randomToken(24);
    await inClinic(d, a, (tx) => tx.execute(sql`insert into dent_settings (organization_id, screen_key) values (${a.organizationId}, ${key})
      on conflict (organization_id) do update set screen_key = excluded.screen_key`));
    return c.json({ key: `${a.organizationId}.${key}` });
  });

  /** What the screen shows: the clinic, its chairs, who is in them, and who is waiting (in order of arrival). */
  r.get('/screen', async (c) => {
    const [org, key] = String(c.req.query('k') ?? '').split('.');
    if (!org || !key || key.length < 20) throw new HttpError(404, 'NO_SCREEN');
    const row = await withOrg(d.db, org, async (tx) => rowsOf(await tx.execute(sql`select s.screen_key as key, o.name, ss.logo_id as logo,
      coalesce((select json_agg(json_build_object('id', ch.id, 'name', ch.name) order by ch.sort, ch.name) from dent_chair ch where ch.archived_at is null), '[]') as chairs,
      coalesce((select json_agg(json_build_object('id', a.id, 'status', a.status, 'chair', a.chair_id, 'name', cu.name, 'dentist', de.name, 'color', de.color,
          'arrivedAt', a.arrived_at, 'seatedAt', a.seated_at) order by a.arrived_at nulls last, a.starts_at)
        from dent_appointment a join sys_customer cu on cu.id = a.patient_id left join dent_dentist de on de.id = a.dentist_id
        where a.status in ('arrived', 'seated') and a.starts_at > now() - interval '18 hours'), '[]') as queue
      from dent_settings s join organization o on o.id = s.organization_id left join sys_settings ss on ss.organization_id = s.organization_id
      where s.organization_id = ${org}`))[0]);
    if (!row?.key || !safeEqual(String(row.key), key)) throw new HttpError(404, 'NO_SCREEN');
    const json = (v: any) => (typeof v === 'string' ? JSON.parse(v) : v) ?? [];
    c.header('cache-control', 'no-store');
    return c.json({
      clinic: { name: row.name, logoUrl: await fileUrl(d.env, org, row.logo) },
      chairs: json(row.chairs),
      queue: json(row.queue).map((x: any) => ({ ...x, name: shortName(x.name) })),
      at: new Date().toISOString(),
    });
  });

  return r;
}
