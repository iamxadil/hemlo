// Starting a clinic (self-serve, 30-day free trial) and setting it up: hours, the dollar rate, chairs, dentists and their
// shares, and the price list.
import { Hono } from 'hono';
import { and, asc, eq, sql } from 'drizzle-orm';
import { newId } from '@hemlo/core';
import { withOrg, withSystem } from '@hemlo/db';
import { organization, member, hemloSubscription, dentSettings, dentChair, dentDentist, dentProcedure } from '@hemlo/db/schema';
import { audit } from '@hemlo/auth/audit';
import { HttpError, requireUser, forgetPrincipal } from '../../principal';
import { actor, bad, text } from '../sys-common';
import { isDemoEmail } from '../demo';
import { TRIAL_DAYS, subscriptionOf, withinLimit } from '../../subscription';
import { CATALOG, DEFAULT_HOURS } from './catalog';
import { inClinic, settingsOf, CURRENCIES } from './common';
import type { AppEnv, Deps } from '../../types';

const rowsOf = (r: any): any[] => (Array.isArray(r) ? r : r?.rows ?? []);
const SPECIALTIES = ['general', 'endo', 'ortho', 'perio', 'prostho', 'surgery', 'pedo', 'implant', 'cosmetic'];
const CATEGORIES = ['diagnostic', 'preventive', 'restorative', 'endo', 'surgery', 'prostho', 'implant', 'ortho', 'perio', 'cosmetic', 'pedo', 'other'];
const SCOPES = ['tooth', 'surface', 'arch', 'mouth'];
const int = (v: unknown, min: number, max: number, code: string) => { const n = Number(v); return Number.isInteger(n) && n >= min && n <= max ? n : bad(code); };
const hhmm = /^([01]\d|2[0-3]):[0-5]\d$/;

function procedureInput(b: any, partial = false) {
  const out: Partial<typeof dentProcedure.$inferInsert> = {};
  if (!partial || b.name !== undefined) out.name = text(b.name, 120, 'BAD_NAME', true)!;
  if (!partial || b.category !== undefined) out.category = CATEGORIES.includes(b.category) ? b.category : bad('BAD_CATEGORY');
  if (b.currency !== undefined) out.currency = CURRENCIES.includes(b.currency) ? b.currency : bad('BAD_CURRENCY');
  if (!partial || b.price !== undefined) out.price = int(b.price, 0, 1_000_000_000, 'BAD_PRICE');
  if (b.minutes !== undefined) out.minutes = int(b.minutes, 5, 480, 'BAD_MINUTES');
  if (b.scope !== undefined) out.scope = SCOPES.includes(b.scope) ? b.scope : bad('BAD_SCOPE');
  if (b.mark !== undefined) out.mark = b.mark ? String(b.mark).slice(0, 20) : null;
  if (b.code !== undefined) out.code = text(b.code, 20, 'BAD_CODE');
  if (b.labWork !== undefined) out.labWork = !!b.labWork;
  if (b.active !== undefined) out.active = !!b.active;
  return out;
}
function dentistInput(b: any, partial = false) {
  const out: Partial<typeof dentDentist.$inferInsert> = {};
  if (!partial || b.name !== undefined) out.name = text(b.name, 80, 'BAD_NAME', true)!;
  if (b.specialty !== undefined) out.specialty = b.specialty == null ? null : SPECIALTIES.includes(b.specialty) ? b.specialty : bad('BAD_SPECIALTY');
  if (b.color !== undefined) out.color = /^#[0-9a-fA-F]{6}$/.test(b.color) ? b.color : bad('BAD_COLOR');
  if (b.sharePercent !== undefined) out.sharePercent = int(b.sharePercent, 0, 100, 'BAD_SHARE');
  if (b.shareBasis !== undefined) out.shareBasis = ['collected', 'billed'].includes(b.shareBasis) ? b.shareBasis : bad('BAD_SHARE');
  if (b.labDeduct !== undefined) out.labDeduct = !!b.labDeduct;
  if (b.active !== undefined) out.active = !!b.active;
  if (b.memberId !== undefined) out.memberId = b.memberId || null;
  return out;
}

export function dentalSetupRoutes(d: Deps) {
  const r = new Hono<AppEnv>();

  /** Start a clinic: the business, a 30-day free trial, two chairs, the owner as its first dentist, and a price list. */
  r.post('/start', async (c) => {
    const p = requireUser(c);
    if (isDemoEmail(p.user.email)) throw new HttpError(403, 'NOT_IN_DEMO');
    const b = await c.req.json<{ name?: string; city?: string; lang?: string; specialty?: string; chairs?: number }>();
    const name = text(b.name, 80, 'BAD_NAME', true)!;
    if (name.length < 2) bad('BAD_NAME');
    const city = text(b.city, 60, 'BAD_CITY');
    const lang = b.lang === 'en' ? 'en' : 'ar';
    const chairs = b.chairs == null ? 2 : int(b.chairs, 1, 12, 'BAD_CHAIRS');
    // one free trial per person (Hemlo can always extend or grant another from the admin dashboard)
    const [used] = await withSystem(d.db, async (tx) => rowsOf(await tx.execute(sql`select 1 from hemlo_subscription s join member m on m.organization_id = s.organization_id
      where s.edition = 'dental' and m.user_id = ${p.userId} and m.role like '%owner%' limit 1`)));
    if (used) throw new HttpError(409, 'TRIAL_USED');

    const orgId = newId(), now = new Date(), trialEndsAt = new Date(now.getTime() + TRIAL_DAYS * 86400_000);
    const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'clinic'}-${orgId.slice(0, 6).toLowerCase()}`;
    await withOrg(d.db, orgId, async (tx) => {
      await tx.insert(organization).values({ id: orgId, name, slug, createdAt: now, metadata: JSON.stringify({ kind: 'dental', city }) });
      const memberId = newId();
      await tx.insert(member).values({ id: memberId, organizationId: orgId, userId: p.userId, role: 'owner', createdAt: now } as any);
      await tx.insert(hemloSubscription).values({ organizationId: orgId, edition: 'dental', status: 'trial', seats: 1, trialEndsAt });
      await tx.insert(dentSettings).values({ organizationId: orgId, hours: DEFAULT_HOURS });
      await tx.insert(dentChair).values(Array.from({ length: chairs }, (_, i) => ({ id: newId(), organizationId: orgId, name: `${lang === 'ar' ? 'كرسي' : 'Chair'} ${i + 1}`, sort: i })));
      await tx.insert(dentDentist).values({ id: newId(), organizationId: orgId, memberId, name: p.user.name || (lang === 'ar' ? 'الطبيب' : 'Dentist'),
        specialty: SPECIALTIES.includes(b.specialty ?? '') ? b.specialty! : 'general' });
      await tx.insert(dentProcedure).values(CATALOG.map(([ar, en, category, currency, price, minutes, scope, mark, lab], i) => ({
        id: newId(), organizationId: orgId, name: lang === 'ar' ? ar : en, category, currency, price, minutes, scope, mark, labWork: !!lab, sort: i })));
    });
    forgetPrincipal(c); // now a member of the new clinic
    await audit(d.db, { kind: 'dental.trial_started', userId: p.userId, organizationId: orgId, detail: { name, city } });
    return c.json({ organizationId: orgId, trialEndsAt }, 201);
  });

  /** Everything the clinic's screens need to start: settings, chairs, dentists, the price list, the team, the plan. */
  r.get('/setup', async (c) => {
    const a = actor(c, 'patients', 'read');
    const out = await inClinic(d, a, async (tx) => ({
      settings: (({ screenKey: _, ...x }) => x)(await settingsOf(tx, a.organizationId)), // the screen link has its own route
      chairs: await tx.select().from(dentChair).orderBy(asc(dentChair.sort), asc(dentChair.name)),
      dentists: await tx.select().from(dentDentist).orderBy(asc(dentDentist.name)),
      procedures: await tx.select().from(dentProcedure).orderBy(asc(dentProcedure.sort), asc(dentProcedure.name)),
      members: rowsOf(await tx.execute(sql`select m.id, m.role, u.name from member m join "user" u on u.id = m.user_id where m.organization_id = ${a.organizationId} order by u.name`)),
    }));
    return c.json({ ...out, subscription: await subscriptionOf(d.db, a.organizationId) });
  });

  r.put('/settings', async (c) => {
    const a = actor(c, 'clinic', 'configure');
    const b = await c.req.json<any>();
    const set: Partial<typeof dentSettings.$inferInsert> = { updatedAt: new Date() };
    if (b.usdRate !== undefined) set.usdRate = int(b.usdRate, 500, 5000, 'BAD_RATE');
    if (b.slotMinutes !== undefined) set.slotMinutes = [5, 10, 15, 20, 30].includes(Number(b.slotMinutes)) ? Number(b.slotMinutes) : bad('BAD_SLOT');
    if (b.recallMonths !== undefined) set.recallMonths = int(b.recallMonths, 0, 24, 'BAD_RECALL');
    if (b.rxHeader !== undefined) set.rxHeader = text(b.rxHeader, 400, 'BAD_TEXT');
    if (b.reminderText !== undefined) set.reminderText = text(b.reminderText, 600, 'BAD_TEXT');
    if (b.hours !== undefined) {
      const h: Record<string, [string, string] | null> = {};
      for (const k of ['0', '1', '2', '3', '4', '5', '6']) {
        const v = b.hours?.[k];
        h[k] = v == null ? null : Array.isArray(v) && hhmm.test(v[0]) && hhmm.test(v[1]) && v[0] < v[1] ? [v[0], v[1]] : bad('BAD_HOURS');
      }
      set.hours = h;
    }
    const [row] = await inClinic(d, a, (tx) => tx.insert(dentSettings).values({ organizationId: a.organizationId, ...set } as any)
      .onConflictDoUpdate({ target: dentSettings.organizationId, set }).returning());
    return c.json({ settings: row });
  });

  // ---- chairs ----
  r.post('/chairs', async (c) => {
    const a = actor(c, 'clinic', 'configure');
    const name = text((await c.req.json<any>()).name, 40, 'BAD_NAME', true)!;
    const [row] = await inClinic(d, a, async (tx) => {
      const [n] = rowsOf(await tx.execute(sql`select count(*)::int as n from dent_chair`));
      return tx.insert(dentChair).values({ id: newId(), organizationId: a.organizationId, name, sort: n.n }).returning();
    });
    return c.json({ chair: row }, 201);
  });
  r.patch('/chairs/:id', async (c) => {
    const a = actor(c, 'clinic', 'configure');
    const b = await c.req.json<any>();
    const set: Partial<typeof dentChair.$inferInsert> = {};
    if (b.name !== undefined) set.name = text(b.name, 40, 'BAD_NAME', true)!;
    if (b.archived !== undefined) set.archivedAt = b.archived ? new Date() : null;
    const [row] = await inClinic(d, a, (tx) => tx.update(dentChair).set(set).where(eq(dentChair.id, c.req.param('id'))).returning());
    if (!row) throw new HttpError(404, 'NOT_FOUND');
    return c.json({ chair: row });
  });

  // ---- dentists ----
  r.post('/dentists', async (c) => {
    const a = actor(c, 'clinic', 'configure');
    const input = dentistInput(await c.req.json<any>());
    const [{ n }] = await inClinic(d, a, async (tx) => rowsOf(await tx.execute(sql`select count(*)::int as n from dent_dentist where active`)));
    await withinLimit(d.db, a.organizationId, 'dentists', n);
    const [row] = await inClinic(d, a, async (tx) => {
      if (input.memberId) { const [m] = await tx.select({ id: member.id }).from(member).where(and(eq(member.id, input.memberId), eq(member.organizationId, a.organizationId))); if (!m) bad('BAD_MEMBER'); }
      return tx.insert(dentDentist).values({ id: newId(), organizationId: a.organizationId, ...input } as any).returning();
    }).catch((e) => { if (/dent_dentist_member/.test(String(e?.message) + String(e?.cause?.message))) throw new HttpError(409, 'ALREADY_A_DENTIST'); throw e; });
    return c.json({ dentist: row }, 201);
  });
  r.patch('/dentists/:id', async (c) => {
    const a = actor(c, 'clinic', 'configure');
    const input = dentistInput(await c.req.json<any>(), true);
    if (input.active === true) { const [{ n }] = await inClinic(d, a, async (tx) => rowsOf(await tx.execute(sql`select count(*)::int as n from dent_dentist where active and id <> ${c.req.param('id')}`))); await withinLimit(d.db, a.organizationId, 'dentists', n); }
    const [row] = await inClinic(d, a, (tx) => tx.update(dentDentist).set(input).where(eq(dentDentist.id, c.req.param('id'))).returning());
    if (!row) throw new HttpError(404, 'NOT_FOUND');
    return c.json({ dentist: row });
  });

  // ---- the price list ----
  r.post('/procedures', async (c) => {
    const a = actor(c, 'clinic', 'configure');
    const input = procedureInput(await c.req.json<any>());
    const [row] = await inClinic(d, a, async (tx) => {
      const [n] = rowsOf(await tx.execute(sql`select coalesce(max(sort), 0)::int + 1 as n from dent_procedure`));
      return tx.insert(dentProcedure).values({ id: newId(), organizationId: a.organizationId, ...input, sort: n.n } as any).returning();
    });
    return c.json({ procedure: row }, 201);
  });
  r.patch('/procedures/:id', async (c) => {
    const a = actor(c, 'clinic', 'configure');
    const input = procedureInput(await c.req.json<any>(), true);
    const [row] = await inClinic(d, a, (tx) => tx.update(dentProcedure).set(input).where(eq(dentProcedure.id, c.req.param('id'))).returning());
    if (!row) throw new HttpError(404, 'NOT_FOUND');
    return c.json({ procedure: row });
  });

  return r;
}
