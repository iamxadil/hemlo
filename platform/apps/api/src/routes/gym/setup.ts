// Starting a gym (self-serve, 30-day free trial) and setting it up: plans and prices, coaches, the weekly timetable,
// opening hours (with ladies' hours), and how the door behaves.
import { Hono } from 'hono';
import { and, asc, eq, sql } from 'drizzle-orm';
import { newId, normalizeIraqiPhone } from '@hemlo/core';
import { withOrg, withSystem } from '@hemlo/db';
import { organization, member, hemloSubscription, sysSettings, gymSettings, gymPlan, gymTrainer, gymClass, type GymHours } from '@hemlo/db/schema';
import { audit } from '@hemlo/auth/audit';
import { HttpError, requireUser, forgetPrincipal } from '../../principal';
import { actor, bad, text, iqd } from '../sys-common';
import { isDemoEmail } from '../demo';
import { TRIAL_DAYS, subscriptionOf } from '../../subscription';
import { inGym, gymSettingsOf, int, hhmmRe, rowsOf, CATEGORIES } from './common';
import type { AppEnv, Deps } from '../../types';

/** A new gym's price list (Baghdad prices, autumn 2026): the owner changes them in a minute. */
export const PLANS: [ar: string, en: string, category: string, duration: number, unit: string, visits: number | null, price: number, freezeDays: number, gender?: string][] = [
  ['شهر واحد', 'One month', 'gym', 1, 'month', null, 40000, 0],
  ['ثلاثة أشهر', 'Three months', 'gym', 3, 'month', null, 110000, 7],
  ['ستة أشهر', 'Six months', 'gym', 6, 'month', null, 200000, 14],
  ['سنة كاملة', 'A full year', 'gym', 12, 'month', null, 360000, 30],
  ['12 زيارة خلال شهر', '12 visits in a month', 'gym', 1, 'month', 12, 30000, 0],
  ['يوم واحد', 'Day pass', 'gym', 1, 'day', 1, 5000, 0],
  ['تدريب شخصي · 12 جلسة', 'Personal training · 12 sessions', 'pt', 2, 'month', 12, 180000, 7],
  ['الكلاسات · شهر', 'Classes · one month', 'class', 1, 'month', null, 35000, 0],
];
export const DEFAULT_HOURS: GymHours = Object.fromEntries(['0', '1', '2', '3', '4', '5', '6'].map((k) => [k, k === '5' ? [{ from: '14:00', to: '23:00', who: 'all' }] : [{ from: '06:00', to: '23:59', who: 'all' }]]));
const GENDERS = ['all', 'm', 'f'];
const color = (v: unknown) => (v == null || v === '' ? null : /^#[0-9a-fA-F]{6}$/.test(String(v)) ? String(v) : bad('BAD_COLOR'));

function planInput(b: any, partial = false) {
  const out: Partial<typeof gymPlan.$inferInsert> = {};
  if (!partial || b.name !== undefined) out.name = text(b.name, 80, 'BAD_NAME', true)!;
  if (!partial || b.category !== undefined) out.category = CATEGORIES.includes(b.category) ? b.category : bad('BAD_CATEGORY');
  if (!partial || b.duration !== undefined) out.duration = int(b.duration, 1, 400, 'BAD_DURATION');
  if (!partial || b.unit !== undefined) out.unit = ['day', 'month'].includes(b.unit) ? b.unit : bad('BAD_DURATION');
  if (b.visits !== undefined) out.visits = b.visits == null || b.visits === '' ? null : int(b.visits, 1, 1000, 'BAD_VISITS');
  if (!partial || b.price !== undefined) out.price = iqd(b.price, 'BAD_PRICE')!;
  if (b.gender !== undefined) out.gender = GENDERS.includes(b.gender) ? b.gender : bad('BAD_GENDER');
  if (b.freezeDays !== undefined) out.freezeDays = int(b.freezeDays, 0, 365, 'BAD_FREEZE');
  if (b.color !== undefined) out.color = color(b.color);
  if (b.active !== undefined) out.active = !!b.active;
  if (b.sort !== undefined) out.sort = int(b.sort, 0, 10000, 'BAD_SORT');
  return out;
}
function trainerInput(b: any, partial = false) {
  const out: Partial<typeof gymTrainer.$inferInsert> = {};
  if (!partial || b.name !== undefined) out.name = text(b.name, 80, 'BAD_NAME', true)!;
  if (b.phone !== undefined) out.phone = b.phone ? normalizeIraqiPhone(String(b.phone)) ?? bad('BAD_PHONE') : null;
  if (b.gender !== undefined) out.gender = b.gender == null || b.gender === '' ? null : ['f', 'm'].includes(b.gender) ? b.gender : bad('BAD_GENDER');
  if (b.specialty !== undefined) out.specialty = text(b.specialty, 80, 'BAD_TEXT');
  if (b.color !== undefined) out.color = color(b.color) ?? '#E4572E';
  if (b.ptShare !== undefined) out.ptShare = int(b.ptShare, 0, 100, 'BAD_SHARE');
  if (b.active !== undefined) out.active = !!b.active;
  if (b.memberId !== undefined) out.memberId = b.memberId || null;
  return out;
}
function classInput(b: any, partial = false) {
  const out: Partial<typeof gymClass.$inferInsert> = {};
  if (!partial || b.name !== undefined) out.name = text(b.name, 60, 'BAD_NAME', true)!;
  if (b.trainerId !== undefined) out.trainerId = b.trainerId || null;
  if (!partial || b.day !== undefined) out.day = int(b.day, 0, 6, 'BAD_DAY');
  if (!partial || b.startsAt !== undefined) out.startsAt = hhmmRe.test(String(b.startsAt)) ? String(b.startsAt) : bad('BAD_TIME');
  if (b.minutes !== undefined) out.minutes = int(b.minutes, 10, 300, 'BAD_MINUTES');
  if (b.capacity !== undefined) out.capacity = b.capacity == null || b.capacity === '' ? null : int(b.capacity, 1, 500, 'BAD_CAPACITY');
  if (b.gender !== undefined) out.gender = GENDERS.includes(b.gender) ? b.gender : bad('BAD_GENDER');
  if (b.color !== undefined) out.color = color(b.color);
  if (b.active !== undefined) out.active = !!b.active;
  return out;
}
export function hoursInput(v: any): GymHours {
  const h: GymHours = {};
  for (const k of ['0', '1', '2', '3', '4', '5', '6']) {
    const list = v?.[k] ?? [];
    if (!Array.isArray(list) || list.length > 6) bad('BAD_HOURS');
    h[k] = list.map((x: any) => (x && hhmmRe.test(x.from) && (hhmmRe.test(x.to) || x.to === '24:00') && x.from < x.to && GENDERS.includes(x.who ?? 'all') ? { from: x.from, to: x.to, who: x.who ?? 'all' } : bad('BAD_HOURS')));
  }
  return h;
}

export function gymSetupRoutes(d: Deps) {
  const r = new Hono<AppEnv>();

  /** Start a gym: the business, a 30-day free trial, the owner, a price list and opening hours. */
  r.post('/start', async (c) => {
    const p = requireUser(c);
    if (isDemoEmail(p.user.email)) throw new HttpError(403, 'NOT_IN_DEMO');
    const b = await c.req.json<{ name?: string; city?: string; lang?: string; who?: string }>().catch(() => ({} as Record<string, string>));
    const name = text(b.name, 80, 'BAD_NAME', true)!;
    if (name.length < 2) bad('BAD_NAME');
    const city = text(b.city, 60, 'BAD_CITY');
    const lang = b.lang === 'en' ? 'en' : 'ar';
    const who = GENDERS.includes(b.who ?? '') ? b.who! : 'all'; // a men's gym, a ladies' gym, or both
    // one free trial per person (Hemlo can always extend or grant another from the admin dashboard)
    const [used] = await withSystem(d.db, async (tx) => rowsOf(await tx.execute(sql`select 1 from hemlo_subscription s join member m on m.organization_id = s.organization_id
      where s.edition = 'gym' and m.user_id = ${p.userId} and m.role like '%owner%' limit 1`)));
    if (used) throw new HttpError(409, 'TRIAL_USED');

    const orgId = newId(), now = new Date(), trialEndsAt = new Date(now.getTime() + TRIAL_DAYS * 86400_000);
    const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'gym'}-${orgId.slice(0, 6).toLowerCase()}`;
    await withOrg(d.db, orgId, async (tx) => {
      await tx.insert(organization).values({ id: orgId, name, slug, createdAt: now, metadata: JSON.stringify({ kind: 'gym', city, who }) });
      await tx.insert(member).values({ id: newId(), organizationId: orgId, userId: p.userId, role: 'owner', createdAt: now } as any);
      await tx.insert(hemloSubscription).values({ organizationId: orgId, edition: 'gym', status: 'trial', seats: 1, trialEndsAt });
      await tx.insert(sysSettings).values({ organizationId: orgId });
      await tx.insert(gymSettings).values({ organizationId: orgId, hours: DEFAULT_HOURS });
      await tx.insert(gymPlan).values(PLANS.map(([ar, en, category, duration, unit, visits, price, freezeDays], i) => ({
        id: newId(), organizationId: orgId, name: lang === 'ar' ? ar : en, category, duration, unit, visits, price, freezeDays, gender: who, sort: i })));
    });
    forgetPrincipal(c); // now a member of the new gym
    await audit(d.db, { kind: 'gym.trial_started', userId: p.userId, organizationId: orgId, detail: { name, city, who } });
    return c.json({ organizationId: orgId, trialEndsAt }, 201);
  });

  /** Everything the gym's screens need to start: settings, plans, coaches, the timetable, the team, the plan. */
  r.get('/setup', async (c) => {
    const a = actor(c, 'members', 'read');
    const out = await inGym(d, a, async (tx) => ({
      settings: (({ doorKey: _, ...x }) => x)(await gymSettingsOf(tx, a.organizationId)), // the door link has its own route
      plans: await tx.select().from(gymPlan).orderBy(asc(gymPlan.sort), asc(gymPlan.name)),
      trainers: await tx.select().from(gymTrainer).orderBy(asc(gymTrainer.name)),
      classes: await tx.select().from(gymClass).orderBy(asc(gymClass.day), asc(gymClass.startsAt)),
      members: rowsOf(await tx.execute(sql`select m.id, m.role, u.name from member m join "user" u on u.id = m.user_id where m.organization_id = ${a.organizationId} order by u.name`)),
    }));
    return c.json({ ...out, subscription: await subscriptionOf(d.db, a.organizationId) });
  });

  r.put('/settings', async (c) => {
    const a = actor(c, 'gym', 'configure');
    const b = await c.req.json<any>();
    const set: Partial<typeof gymSettings.$inferInsert> = { updatedAt: new Date() };
    if (b.hours !== undefined) set.hours = hoursInput(b.hours);
    if (b.reentryMinutes !== undefined) set.reentryMinutes = int(b.reentryMinutes, 0, 24 * 60, 'BAD_MINUTES');
    if (b.graceDays !== undefined) set.graceDays = int(b.graceDays, 0, 30, 'BAD_DAYS');
    if (b.reminderText !== undefined) set.reminderText = text(b.reminderText, 600, 'BAD_TEXT');
    if (b.selfCheckin !== undefined) set.selfCheckin = !!b.selfCheckin;
    const [row] = await inGym(d, a, (tx) => tx.insert(gymSettings).values({ organizationId: a.organizationId, ...set } as any)
      .onConflictDoUpdate({ target: gymSettings.organizationId, set }).returning());
    const { doorKey: _, ...settings } = row;
    return c.json({ settings });
  });

  // ---- plans and prices ----
  r.post('/plans', async (c) => {
    const a = actor(c, 'gym', 'configure');
    const input = planInput(await c.req.json<any>());
    const [row] = await inGym(d, a, async (tx) => {
      const [n] = rowsOf(await tx.execute(sql`select coalesce(max(sort), 0)::int + 1 as n from gym_plan`));
      return tx.insert(gymPlan).values({ id: newId(), organizationId: a.organizationId, sort: n.n, ...input } as any).returning();
    });
    return c.json({ plan: row }, 201);
  });
  r.patch('/plans/:id', async (c) => {
    const a = actor(c, 'gym', 'configure');
    const input = planInput(await c.req.json<any>(), true);
    const [row] = await inGym(d, a, (tx) => tx.update(gymPlan).set(input).where(eq(gymPlan.id, c.req.param('id'))).returning());
    if (!row) throw new HttpError(404, 'NOT_FOUND');
    return c.json({ plan: row });
  });

  // ---- coaches ----
  r.post('/trainers', async (c) => {
    const a = actor(c, 'gym', 'configure');
    const input = trainerInput(await c.req.json<any>());
    const [row] = await inGym(d, a, async (tx) => {
      if (input.memberId) { const [m] = await tx.select({ id: member.id }).from(member).where(and(eq(member.id, input.memberId), eq(member.organizationId, a.organizationId))); if (!m) bad('BAD_MEMBER'); }
      return tx.insert(gymTrainer).values({ id: newId(), organizationId: a.organizationId, ...input } as any).returning();
    }).catch((e) => { if (/gym_trainer_member/.test(String(e?.message) + String(e?.cause?.message))) throw new HttpError(409, 'ALREADY_A_TRAINER'); throw e; });
    return c.json({ trainer: row }, 201);
  });
  r.patch('/trainers/:id', async (c) => {
    const a = actor(c, 'gym', 'configure');
    const input = trainerInput(await c.req.json<any>(), true);
    const [row] = await inGym(d, a, (tx) => tx.update(gymTrainer).set(input).where(eq(gymTrainer.id, c.req.param('id'))).returning());
    if (!row) throw new HttpError(404, 'NOT_FOUND');
    return c.json({ trainer: row });
  });

  // ---- the weekly timetable ----
  r.post('/classes', async (c) => {
    const a = actor(c, 'gym', 'configure');
    const input = classInput(await c.req.json<any>());
    const [row] = await inGym(d, a, (tx) => tx.insert(gymClass).values({ id: newId(), organizationId: a.organizationId, ...input } as any).returning());
    return c.json({ class: row }, 201);
  });
  r.patch('/classes/:id', async (c) => {
    const a = actor(c, 'gym', 'configure');
    const input = classInput(await c.req.json<any>(), true);
    const [row] = await inGym(d, a, (tx) => tx.update(gymClass).set(input).where(eq(gymClass.id, c.req.param('id'))).returning());
    if (!row) throw new HttpError(404, 'NOT_FOUND');
    return c.json({ class: row });
  });

  return r;
}
