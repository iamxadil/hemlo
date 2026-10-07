// The Hemlo team dashboard (admin.hemlohq.com). Every route: a Hemlo team member (founder, or an active hemlo_staff row),
// signed in with a passkey, session under 12 hours old — then the one permission that route needs.
import { Hono, type Context } from 'hono';
import { and, desc, eq, gt, inArray, isNull, like, or, sql } from 'drizzle-orm';
import { hmac, randomToken, newId, isPlaceholderEmail, normalizePermissions, withinPermissions, roleFor, maskEmail, maskIraqiPhone, STAFF_PERMISSIONS, type StaffPermission } from '@hemlo/core';
import { earlyAccess, hemloStaff, hemloStaffInvite, authEvent, user, hemloSubscription } from '@hemlo/db/schema';
import { stateOf, forgetSubscription, TRIAL_DAYS } from '../subscription';
import { withSystem } from '@hemlo/db';
import { audit } from '@hemlo/auth/audit';
import { accessShareText, type Locale } from '@hemlo/notify';
import { HttpError, requireUser } from '../principal';
import { loadStaff, fromRow, type Staff } from '../staff';
import { collectUsage } from './admin-usage';
import { adminPricingRoutes } from './pricing';
import { plansOf } from '../subscription';
import type { AppEnv, Deps } from '../types';

const STAFF_SESSION_HOURS = 12;
const ACCESS_LINK_DAYS = 14;
const TEAM_INVITE_DAYS = 7;
const STATUSES = ['new', 'contacted', 'approved', 'activated', 'declined'] as const;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const accessTokenHash = (secret: string, token: string) => hmac(secret, `access:${token}`);
export const teamTokenHash = (secret: string, token: string) => hmac(secret, `team:${token}`);
const rowsOf = (r: any): any[] => (Array.isArray(r) ? r : r?.rows ?? []);
export const adminUrl = (env: Deps['env']) => env.ADMIN_URL ?? env.ACCOUNT_URL.replace('://account.', '://admin.');

/** Signed in, on the team, not suspended or expired, passkey, fresh enough. Returns who, with what permissions. */
export async function requireStaff(c: Context<AppEnv>, d: Deps): Promise<Staff> {
  const cached = c.get('staff');
  if (cached) return cached;
  const p = requireUser(c);
  const staff = await loadStaff(d, p.user);
  if (!staff) throw new HttpError(403, 'NOT_STAFF');
  if (staff.state === 'suspended') throw new HttpError(403, 'STAFF_SUSPENDED');
  if (staff.state === 'expired') throw new HttpError(403, 'STAFF_EXPIRED');
  if (d.env.STAFF_PASSKEY !== '0' && p.session.loginMethod !== 'passkey') throw new HttpError(403, 'PASSKEY_REQUIRED');
  if (Date.now() - new Date(p.session.createdAt).getTime() > STAFF_SESSION_HOURS * 3600_000) throw new HttpError(401, 'SESSION_TOO_OLD');
  c.set('staff', staff);
  return staff;
}
const need = (c: Context<AppEnv>, perm: StaffPermission) => {
  const s = c.get('staff')!;
  if (!s.permissions.includes(perm)) throw new HttpError(403, 'NO_PERMISSION', perm);
  return s;
};

export function adminRoutes(d: Deps) {
  const r = new Hono<AppEnv>();
  r.use('*', async (c, next) => { await requireStaff(c, d); await next(); });
  /** The dashboard's door check: on the team, passkey, fresh enough. No particular permission needed. */
  r.get('/check', (c) => c.json({ ok: true }));

  r.get('/overview', async (c) => {
    const s = need(c, 'overview.view');
    const q = async (x: ReturnType<typeof sql>) => rowsOf(await d.db.execute(x));
    const [byStatus, users, businesses, active, reqDays, userDays, latest] = await Promise.all([
      q(sql`select status, count(*)::int as n from early_access group by status`),
      q(sql`select count(*)::int as total, count(*) filter (where created_at > now() - interval '7 days')::int as week from "user" where email not like '%@demo.hemlohq.invalid'`),
      q(sql`select count(*)::int as total, count(*) filter (where created_at > now() - interval '7 days')::int as week from organization where coalesce(metadata, '') not like '%"demo":true%'`),
      q(sql`select count(distinct s.user_id)::int as n from "session" s join "user" u on u.id = s.user_id where s.updated_at > now() - interval '7 days' and u.email not like '%@demo.hemlohq.invalid'`),
      q(sql`select to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as day, count(*)::int as n from early_access where created_at > now() - interval '30 days' group by 1`),
      q(sql`select to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as day, count(*)::int as n from "user" where created_at > now() - interval '30 days' and email not like '%@demo.hemlohq.invalid' group by 1`),
      s.permissions.includes('requests.view') ? d.db.select().from(earlyAccess).orderBy(desc(earlyAccess.createdAt)).limit(6) : Promise.resolve([]),
    ]);
    const days = Array.from({ length: 30 }, (_, i) => new Date(Date.now() - (29 - i) * 86400_000).toISOString().slice(0, 10));
    const series = (rows: any[]) => days.map((day) => ({ day, n: rows.find((x) => x.day === day)?.n ?? 0 }));
    const status = Object.fromEntries(STATUSES.map((st) => [st, byStatus.find((x) => x.status === st)?.n ?? 0]));
    return c.json({
      requests: { ...status, total: byStatus.reduce((a, x) => a + x.n, 0) },
      users: users[0], businesses: businesses[0], activeUsers7: active[0]?.n ?? 0,
      series: { requests: series(reqDays), users: series(userDays) },
      latest: latest.map((x) => publicRequest(x, s)),
    });
  });

  // ---- early access ----
  r.get('/early-access', async (c) => {
    const s = need(c, 'requests.view');
    const status = c.req.query('status');
    const rows = await d.db.select().from(earlyAccess)
      .where(status && STATUSES.includes(status as any) ? eq(earlyAccess.status, status) : undefined)
      .orderBy(desc(earlyAccess.createdAt)).limit(500);
    return c.json({ requests: rows.map((x) => publicRequest(x, s)) });
  });

  r.patch('/early-access/:id', async (c) => {
    const s = need(c, 'requests.update');
    const b = await c.req.json<{ status?: string; adminNote?: string }>();
    const set: Partial<typeof earlyAccess.$inferInsert> = {};
    if (b.status !== undefined) {
      if (!['new', 'contacted', 'declined'].includes(b.status)) throw new HttpError(400, 'BAD_STATUS'); // approve/activate have their own steps
      set.status = b.status;
      if (b.status === 'declined') { set.tokenHash = null; set.tokenExpiresAt = null; }
    }
    if (b.adminNote !== undefined) set.adminNote = String(b.adminNote).slice(0, 1000) || null;
    const [row] = await d.db.update(earlyAccess).set(set).where(eq(earlyAccess.id, c.req.param('id'))).returning();
    if (!row) throw new HttpError(404, 'NOT_FOUND');
    await audit(d.db, { kind: 'admin.early_access_updated', userId: s.userId, detail: { id: row.id, business: row.business, status: b.status, note: b.adminNote !== undefined } });
    return c.json({ request: publicRequest(row, s) });
  });

  /** Approve: a private access link (14 days), sent by WhatsApp from Hemlo's phone, and by email when there is one. */
  r.post('/early-access/:id/approve', async (c) => {
    const s = need(c, 'requests.approve');
    const [row] = await d.db.select().from(earlyAccess).where(eq(earlyAccess.id, c.req.param('id')));
    if (!row) throw new HttpError(404, 'NOT_FOUND');
    if (row.status === 'activated') throw new HttpError(409, 'ALREADY_ACTIVATED');
    const token = randomToken(32);
    const [updated] = await d.db.update(earlyAccess).set({
      status: 'approved', approvedAt: new Date(), approvedBy: s.userId,
      tokenHash: await accessTokenHash(d.env.AUTH_SECRET, token), tokenExpiresAt: new Date(Date.now() + ACCESS_LINK_DAYS * 86400_000),
    }).where(eq(earlyAccess.id, row.id)).returning();
    const locale = (row.locale === 'en' ? 'en' : 'ar') as Locale;
    const url = `${d.env.ACCOUNT_URL}/${locale === 'en' ? 'en/' : ''}welcome/?t=${encodeURIComponent(token)}`;
    const first = row.name.split(/\s+/)[0];
    const message = accessShareText(locale, { name: first, business: row.business, url });
    let emailed = false;
    if (row.email) emailed = await d.notifier.accessGranted({ email: row.email }, locale, { name: first, business: row.business, url }).then(() => true, () => false);
    await audit(d.db, { kind: 'admin.early_access_approved', userId: s.userId, detail: { id: row.id, business: row.business } });
    const contact = s.permissions.includes('people.contact');
    return c.json({ request: publicRequest(updated, s), url, message, emailed,
      whatsappUrl: contact ? `https://wa.me/${row.phoneNumber.replace(/\D/g, '')}?text=${encodeURIComponent(message)}` : null });
  });

  // ---- people and businesses ----
  r.get('/users', async (c) => {
    const s = need(c, 'users.view');
    const contact = s.permissions.includes('people.contact');
    const term = (c.req.query('q') ?? '').trim();
    const like = `%${term}%`;
    const rows = rowsOf(await d.db.execute(sql`
      select u.id, u.name, u.email, u.phone_number, u.role, u.early_access, u.created_at,
        (select count(*)::int from member m where m.user_id = u.id) as businesses,
        (select count(*)::int from passkey k where k.user_id = u.id) as passkeys,
        (select max(s.updated_at) from "session" s where s.user_id = u.id) as last_active,
        exists(select 1 from hemlo_staff h where h.user_id = u.id) as on_team
      from "user" u
      where u.email not like '%@demo.hemlohq.invalid' and ${!term ? sql`true` : contact ? sql`(u.name ilike ${like} or u.email ilike ${like} or u.phone_number ilike ${like})` : sql`u.name ilike ${like}`}
      order by u.created_at desc limit 300`));
    return c.json({ users: rows.map((u) => {
      const email = isPlaceholderEmail(u.email) ? null : u.email;
      return { id: u.id, name: u.name, email: contact ? email : maskEmail(email), phoneNumber: contact ? u.phone_number : maskIraqiPhone(u.phone_number), masked: !contact,
        staff: u.role === 'admin' || !!u.on_team, earlyAccess: !!u.early_access, createdAt: u.created_at, businesses: u.businesses, passkeys: u.passkeys, lastActive: u.last_active };
    }) });
  });

  r.get('/businesses', async (c) => {
    need(c, 'businesses.view');
    const rows = rowsOf(await d.db.execute(sql`
      select o.id, o.name, o.slug, o.metadata, o.created_at,
        (select count(*)::int from member m where m.organization_id = o.id) as members,
        (select count(*)::int from team t where t.organization_id = o.id) as locations,
        (select u.name from member m join "user" u on u.id = m.user_id where m.organization_id = o.id and m.role like '%owner%' order by m.created_at limit 1) as owner
      from organization o where coalesce(o.metadata, '') not like '%"demo":true%' order by o.created_at desc limit 300`));
    return c.json({ businesses: rows.map((o) => {
      let meta: any = {}; try { meta = typeof o.metadata === 'string' ? JSON.parse(o.metadata) : o.metadata ?? {}; } catch {}
      return { id: o.id, name: o.name, slug: o.slug, kind: meta?.kind ?? null, city: meta?.city ?? null, createdAt: o.created_at, members: o.members, locations: o.locations, owner: o.owner };
    }) });
  });

  // ---- usage: how every shop is using Hemlo, and the platform against its plan limits ----
  r.get('/usage', async (c) => {
    const s = need(c, 'usage.view');
    return c.json(await collectUsage(d, { contact: s.permissions.includes('people.contact') }));
  });

  // ---- subscriptions: trials, paid periods, dentist seats (billing is manual for now) ----
  /** Change a business's plan. action: extend (days) | activate (months, or until) | end | free. */
  r.patch('/subscriptions/:orgId', async (c) => {
    const s = need(c, 'billing.manage');
    const org = c.req.param('orgId');
    const b = await c.req.json<{ action?: string; days?: number; months?: number; until?: string; seats?: number; priceNote?: string | null; note?: string | null; edition?: string; planId?: string | null; billing?: string; price?: number | null }>();
    const plans = await plansOf(d.db);
    const [exists] = rowsOf(await d.db.execute(sql`select id, metadata from organization where id = ${org}`));
    if (!exists) throw new HttpError(404, 'NOT_FOUND');
    let meta: any = {}; try { meta = JSON.parse(exists.metadata ?? '{}'); } catch {}
    const row = await withSystem(d.db, async (tx) => {
      const [cur] = await tx.select().from(hemloSubscription).where(eq(hemloSubscription.organizationId, org));
      const now = Date.now();
      const set: Partial<typeof hemloSubscription.$inferInsert> = { updatedAt: new Date(), updatedBy: s.userId };
      if (b.action === 'extend') {
        const days = Math.max(1, Math.min(90, Math.round(Number(b.days ?? TRIAL_DAYS))));
        const base = Math.max(now, cur?.trialEndsAt ? +cur.trialEndsAt : now);
        Object.assign(set, { status: 'trial', trialEndsAt: new Date(base + days * 86400_000) });
      } else if (b.action === 'activate') {
        let until: Date;
        if (b.until) { until = new Date(b.until); if (Number.isNaN(+until) || +until < now) throw new HttpError(400, 'BAD_DATE'); }
        else { const months = Math.max(1, Math.min(36, Math.round(Number(b.months ?? 1)))); const base = new Date(Math.max(now, cur?.paidUntil ? +cur.paidUntil : now)); base.setMonth(base.getMonth() + months); until = base; }
        Object.assign(set, { status: 'active', paidUntil: until });
      } else if (b.action === 'end') set.status = 'canceled';
      else if (b.action === 'free') set.status = 'free';
      else if (b.action !== undefined) throw new HttpError(400, 'BAD_ACTION');
      if (b.seats !== undefined) { const n = Number(b.seats); if (!Number.isInteger(n) || n < 1 || n > 200) throw new HttpError(400, 'BAD_SEATS'); set.seats = n; }
      if (b.priceNote !== undefined) set.priceNote = b.priceNote ? String(b.priceNote).slice(0, 200) : null;
      if (b.note !== undefined) set.note = b.note ? String(b.note).slice(0, 1000) : null;
      if (b.planId !== undefined) { if (b.planId && !plans.some((p) => p.id === b.planId && p.edition === (cur?.edition ?? b.edition ?? meta?.kind ?? 'store'))) throw new HttpError(400, 'BAD_PLAN'); set.planId = b.planId || null; }
      if (b.billing !== undefined) set.billing = b.billing === 'year' ? 'year' : 'month';
      if (b.price !== undefined) { const n = b.price == null ? null : Number(b.price); if (n != null && (!Number.isInteger(n) || n < 0 || n > 1_000_000_000)) throw new HttpError(400, 'BAD_PRICE'); set.price = n; }
      const [out] = cur
        ? await tx.update(hemloSubscription).set(set).where(eq(hemloSubscription.organizationId, org)).returning()
        : await tx.insert(hemloSubscription).values({ organizationId: org, edition: b.edition ?? meta?.kind ?? 'store', status: set.status ?? 'free', seats: set.seats ?? 1, ...set }).returning();
      return out;
    });
    forgetSubscription(org);
    await audit(d.db, { kind: 'admin.subscription_updated', userId: s.userId, organizationId: org, detail: { action: b.action ?? 'edit', seats: row.seats, status: row.status } });
    return c.json({ subscription: { ...row, state: stateOf(row, plans) } });
  });

  // ---- pricing: plans, payments, plan requests, the money ----
  r.route('/', adminPricingRoutes(d));

  // ---- activity: what the team did ----
  r.get('/activity', async (c) => {
    need(c, 'activity.view');
    const rows = await withSystem(d.db, (tx) => tx.select().from(authEvent)
      .where(or(like(authEvent.kind, 'admin.%'), like(authEvent.kind, 'staff.%'), eq(authEvent.kind, 'early_access.activated')))
      .orderBy(desc(authEvent.at)).limit(200));
    const ids = [...new Set(rows.map((e) => e.userId).filter(Boolean))] as string[];
    const people = ids.length ? await d.db.select({ id: user.id, name: user.name }).from(user).where(inArray(user.id, ids)) : [];
    const nameOf = (id: string | null) => people.find((u) => u.id === id)?.name || null;
    return c.json({ events: rows.map((e) => ({ id: e.id, at: e.at, kind: e.kind, actor: nameOf(e.userId), actorId: e.userId, detail: e.detail ?? {} })) });
  });

  // ---- the team ----
  r.get('/team', async (c) => {
    const me = need(c, 'team.view');
    const people = await d.db.select({ id: user.id, name: user.name, email: user.email, role: user.role, createdAt: user.createdAt }).from(user)
      .where(or(eq(user.role, 'admin'), inArray(user.id, d.db.select({ id: hemloStaff.userId }).from(hemloStaff))));
    const rows = await d.db.select().from(hemloStaff);
    const ids = people.map((u) => u.id);
    const stats = ids.length ? rowsOf(await d.db.execute(sql`select u.id,
      (select max(s.updated_at) from "session" s where s.user_id = u.id) as last_active,
      (select count(*)::int from passkey k where k.user_id = u.id) as passkeys
      from "user" u where u.role = 'admin' or u.id in (select user_id from hemlo_staff)`)) : [];
    const invites = me.permissions.includes('team.manage')
      ? await d.db.select().from(hemloStaffInvite).where(and(isNull(hemloStaffInvite.acceptedAt), isNull(hemloStaffInvite.canceledAt), gt(hemloStaffInvite.expiresAt, new Date()))).orderBy(desc(hemloStaffInvite.createdAt))
      : [];
    const nameOf = (id: string | null) => people.find((u) => u.id === id)?.name || null;
    const members = people.map((u) => {
      const row = rows.find((x) => x.userId === u.id);
      const s: Staff = u.role === 'admin' || !row
        ? { userId: u.id, founder: true, role: 'founder', permissions: [...STAFF_PERMISSIONS], title: null, accessUntil: null, state: 'active' }
        : fromRow(row);
      const st = stats.find((x) => x.id === u.id);
      return { userId: u.id, name: u.name, email: isPlaceholderEmail(u.email) ? null : u.email, founder: s.founder, role: s.role, permissions: s.permissions,
        title: s.title, accessUntil: s.accessUntil, state: s.state, lastActive: st?.last_active ?? null, passkeys: st?.passkeys ?? 0,
        since: row?.createdAt ?? u.createdAt, invitedBy: row ? nameOf(row.invitedBy) : null, you: u.id === me.userId, canManage: canManage(me, s) };
    }).sort((a, b) => Number(b.founder) - Number(a.founder) || new Date(a.since).getTime() - new Date(b.since).getTime());
    return c.json({
      members,
      invites: invites.map((i) => ({ id: i.id, email: i.email, name: i.name, title: i.title, permissions: normalizePermissions(i.permissions), role: roleFor(normalizePermissions(i.permissions)), expiresAt: i.expiresAt, accessUntil: i.accessUntil, createdAt: i.createdAt })),
    });
  });

  r.post('/team/invites', async (c) => {
    const me = need(c, 'team.manage');
    const b = await c.req.json<{ email?: string; name?: string; title?: string; permissions?: string[]; accessDays?: number | null; locale?: string }>();
    const email = String(b.email ?? '').trim().toLowerCase();
    if (!EMAIL.test(email) || email.length > 200) throw new HttpError(400, 'BAD_EMAIL');
    const permissions = normalizePermissions(b.permissions ?? []);
    if (!permissions.length) throw new HttpError(400, 'NO_PERMISSIONS');
    if (!withinPermissions(me.permissions, permissions)) throw new HttpError(403, 'PERMISSION_ABOVE_YOUR_OWN');
    const onTeam = rowsOf(await d.db.execute(sql`select 1 from "user" u left join hemlo_staff h on h.user_id = u.id where lower(u.email) = ${email} and (u.role = 'admin' or h.user_id is not null)`));
    if (onTeam.length) throw new HttpError(409, 'ALREADY_ON_TEAM');
    const days = b.accessDays == null ? null : Math.max(1, Math.min(365, Math.round(Number(b.accessDays))));
    const token = randomToken(32);
    await d.db.update(hemloStaffInvite).set({ canceledAt: new Date() }).where(and(eq(hemloStaffInvite.email, email), isNull(hemloStaffInvite.acceptedAt), isNull(hemloStaffInvite.canceledAt)));
    const [invite] = await d.db.insert(hemloStaffInvite).values({
      id: newId(), email, name: b.name?.trim().slice(0, 100) || null, title: b.title?.trim().slice(0, 80) || null, permissions,
      accessUntil: days ? new Date(Date.now() + days * 86400_000) : null, tokenHash: await teamTokenHash(d.env.AUTH_SECRET, token),
      invitedBy: me.userId, expiresAt: new Date(Date.now() + TEAM_INVITE_DAYS * 86400_000),
    }).returning();
    const locale = (b.locale === 'en' ? 'en' : 'ar') as Locale;
    const url = `${adminUrl(d.env)}/${locale === 'en' ? 'en/' : ''}#/join?t=${encodeURIComponent(token)}`;
    const inviter = requireUser(c).user.name || 'Hemlo';
    const role = roleFor(permissions);
    const emailed = await d.notifier.teamInvitation({ email }, locale, { inviter, role: ROLE_LABEL[role]?.[locale] ?? ROLE_LABEL.custom[locale]!, url }).then(() => true, () => false);
    await audit(d.db, { kind: 'staff.invited', userId: me.userId, detail: { email, role } });
    return c.json({ invite: { id: invite.id, email, role, permissions, expiresAt: invite.expiresAt, accessUntil: invite.accessUntil }, url, emailed }, 201);
  });

  r.delete('/team/invites/:id', async (c) => {
    const me = need(c, 'team.manage');
    const [row] = await d.db.update(hemloStaffInvite).set({ canceledAt: new Date() }).where(and(eq(hemloStaffInvite.id, c.req.param('id')), isNull(hemloStaffInvite.acceptedAt))).returning();
    if (!row) throw new HttpError(404, 'NOT_FOUND');
    await audit(d.db, { kind: 'staff.invite_canceled', userId: me.userId, detail: { email: row.email } });
    return c.json({ ok: true });
  });

  const target = async (c: Context<AppEnv>) => {
    const me = need(c, 'team.manage');
    const id = c.req.param('userId')!;
    if (id === me.userId) throw new HttpError(403, 'NOT_YOURSELF');
    const [row] = await d.db.select().from(hemloStaff).where(eq(hemloStaff.userId, id));
    if (!row) throw new HttpError(404, 'NOT_FOUND'); // founders have no row: they cannot be changed here
    const them = fromRow(row);
    if (!canManage(me, them)) throw new HttpError(403, 'PERMISSION_ABOVE_YOUR_OWN');
    const [u] = rowsOf(await d.db.execute(sql`select name from "user" where id = ${id}`));
    return { me, row, them, name: u?.name ?? null };
  };

  r.patch('/team/:userId', async (c) => {
    const { me, row, name } = await target(c);
    const b = await c.req.json<{ permissions?: string[]; title?: string | null; accessUntil?: string | null; suspended?: boolean }>();
    const set: Partial<typeof hemloStaff.$inferInsert> = { updatedAt: new Date() };
    if (b.permissions !== undefined) {
      const permissions = normalizePermissions(b.permissions);
      if (!permissions.length) throw new HttpError(400, 'NO_PERMISSIONS');
      if (!withinPermissions(me.permissions, permissions)) throw new HttpError(403, 'PERMISSION_ABOVE_YOUR_OWN');
      set.permissions = permissions;
    }
    if (b.title !== undefined) set.title = b.title?.trim().slice(0, 80) || null;
    if (b.accessUntil !== undefined) set.accessUntil = b.accessUntil ? new Date(b.accessUntil) : null;
    if (b.suspended !== undefined) set.suspendedAt = b.suspended ? row.suspendedAt ?? new Date() : null;
    const [updated] = await d.db.update(hemloStaff).set(set).where(eq(hemloStaff.userId, row.userId)).returning();
    const s = fromRow(updated);
    const change = b.suspended === true ? 'suspended' : b.suspended === false ? 'resumed' : b.permissions !== undefined ? 'permissions' : b.accessUntil !== undefined ? 'access' : 'title';
    await audit(d.db, { kind: 'staff.updated', userId: me.userId, detail: { target: row.userId, name, change, role: s.role } });
    return c.json({ member: { userId: s.userId, role: s.role, permissions: s.permissions, title: s.title, accessUntil: s.accessUntil, state: s.state } });
  });

  r.delete('/team/:userId', async (c) => {
    const { me, row, name } = await target(c);
    await d.db.delete(hemloStaff).where(eq(hemloStaff.userId, row.userId));
    await audit(d.db, { kind: 'staff.removed', userId: me.userId, detail: { target: row.userId, name } });
    return c.json({ ok: true });
  });

  return r;
}

/** Accepting a team invitation: before someone is on the team, so outside the staff guard. */
export function teamJoinRoutes(d: Deps) {
  const r = new Hono<AppEnv>();
  const find = async (token: string) => {
    const [row] = await d.db.select().from(hemloStaffInvite).where(eq(hemloStaffInvite.tokenHash, await teamTokenHash(d.env.AUTH_SECRET, token)));
    const status = !row ? 'invalid' : row.acceptedAt ? 'used' : row.canceledAt ? 'canceled' : row.expiresAt < new Date() ? 'expired' : 'open';
    return { row, status } as const;
  };

  r.get('/:token', async (c) => {
    const { row, status } = await find(c.req.param('token'));
    if (!row || status !== 'open') return c.json({ status });
    const [inviter] = rowsOf(await d.db.execute(sql`select name from "user" where id = ${row.invitedBy}`));
    const permissions = normalizePermissions(row.permissions);
    return c.json({ status, email: maskEmail(row.email), name: row.name, title: row.title, inviter: inviter?.name || null, role: roleFor(permissions), permissions, accessUntil: row.accessUntil });
  });

  r.post('/:token', async (c) => {
    const p = requireUser(c);
    const { row, status } = await find(c.req.param('token'));
    if (!row || status !== 'open') throw new HttpError(410, status === 'used' ? 'LINK_USED' : status === 'expired' ? 'LINK_EXPIRED' : 'LINK_INVALID');
    const email = p.user.email && !isPlaceholderEmail(p.user.email) && p.user.emailVerified ? p.user.email.toLowerCase() : null;
    if (email !== row.email) throw new HttpError(403, 'WRONG_ACCOUNT');
    if (p.user.role === 'admin') throw new HttpError(409, 'ALREADY_ON_TEAM');
    const values = { userId: p.userId, permissions: normalizePermissions(row.permissions), title: row.title, accessUntil: row.accessUntil, suspendedAt: null, invitedBy: row.invitedBy, updatedAt: new Date() };
    await d.db.insert(hemloStaff).values(values).onConflictDoUpdate({ target: hemloStaff.userId, set: values });
    await d.db.update(hemloStaffInvite).set({ acceptedAt: new Date(), acceptedBy: p.userId }).where(eq(hemloStaffInvite.id, row.id));
    if (row.name && !p.user.name) await d.db.execute(sql`update "user" set name = ${row.name} where id = ${p.userId}`);
    await audit(d.db, { kind: 'staff.joined', userId: p.userId, detail: { role: roleFor(values.permissions) } });
    return c.json({ ok: true, role: roleFor(values.permissions) }, 201);
  });
  return r;
}

/** You can manage someone only if everything they hold, you hold too. Nobody manages a founder. */
const canManage = (me: Staff, them: Staff) => !them.founder && them.userId !== me.userId && me.permissions.includes('team.manage') && withinPermissions(me.permissions, them.permissions);

const ROLE_LABEL: Record<string, Partial<Record<Locale, string>>> = {
  admin: { ar: 'مدير', en: 'Admin' }, onboarding: { ar: 'التهيئة والمبيعات', en: 'Onboarding' },
  support: { ar: 'الدعم', en: 'Support' }, analyst: { ar: 'محلّل', en: 'Analyst' }, custom: { ar: 'صلاحيات مخصّصة', en: 'Custom access' },
};

/** Contact details only for people allowed to contact. */
function publicRequest(x: typeof earlyAccess.$inferSelect, s: Staff) {
  const { tokenHash, ip, ...rest } = x;
  const contact = s.permissions.includes('people.contact');
  return { ...rest, phoneNumber: contact ? x.phoneNumber : maskIraqiPhone(x.phoneNumber), email: contact ? x.email : maskEmail(x.email), masked: !contact,
    linkActive: !!tokenHash && !!x.tokenExpiresAt && x.tokenExpiresAt > new Date() && x.status === 'approved' };
}
