// The signed-in person: profile summary, security log, business log, API keys, and the Hemlo staff area.
import { Hono } from 'hono';
import { desc, eq } from 'drizzle-orm';
import { isPlaceholderEmail } from '@hemlo/core';
import { withOrg, withSystem } from '@hemlo/db';
import { authEvent } from '@hemlo/db/schema';
import { ROLE_PERMISSIONS, roleCan, statements, type Resource } from '@hemlo/auth/permissions';
import { FRESH_SECONDS } from '@hemlo/auth/server';
import { audit } from '@hemlo/auth/audit';
import { HttpError, requireOrgUser, requirePermission, requireUser } from '../principal';
import { loadStaff } from '../staff';
import { isDemoOrg } from './demo';
import type { AppEnv, Deps } from '../types';


export function accountRoutes(d: Deps) {
  const r = new Hono<AppEnv>();
  const adapter = async () => (await d.auth.$context).adapter;

  /** Everything the screens need about "me". Works while a second factor is pending, so the screen can ask for it. */
  r.get('/me', async (c) => {
    const p = c.get('principal');
    if (!p || p.kind !== 'user') throw new HttpError(401, 'SIGN_IN_REQUIRED');
    const a = await adapter();
    const u = p.user;
    const members = await a.findMany<any>({ model: 'member', where: [{ field: 'userId', value: p.userId }] });
    const orgs = members.length ? await a.findMany<any>({ model: 'organization', where: [{ field: 'id', operator: 'in', value: members.map((m) => m.organizationId) }] }) : [];
    const passkeys = await a.findMany<any>({ model: 'passkey', where: [{ field: 'userId', value: p.userId }] });
    const staff = await loadStaff(d, u);
    const realEmail = u.email && !isPlaceholderEmail(u.email) ? u.email : null;
    const privileged = members.some((m) => /owner|admin/.test(m.role));
    return c.json({
      user: { id: u.id, name: u.name, email: realEmail, emailVerified: !!(realEmail && u.emailVerified), phoneNumber: u.phoneNumber ?? null, phoneNumberVerified: !!u.phoneNumberVerified,
        locale: u.locale ?? 'ar', image: u.image ?? null, createdAt: u.createdAt, hemloStaff: !!staff && staff.state === 'active' },
      staff: staff && { role: staff.role, permissions: staff.permissions, title: staff.title, accessUntil: staff.accessUntil, state: staff.state, founder: staff.founder },
      session: { id: p.session.id, loginMethod: p.session.loginMethod ?? null, secondFactorPending: !!p.session.secondFactorPending, createdAt: p.session.createdAt,
        fresh: Date.now() - new Date(p.session.createdAt).getTime() < FRESH_SECONDS * 1000 },
      organizations: members.map((m) => { const o = orgs.find((x) => x.id === m.organizationId); let meta: any = {}; try { meta = typeof o?.metadata === 'string' ? JSON.parse(o.metadata) : o?.metadata ?? {}; } catch {}
        return { id: m.organizationId, name: o?.name, slug: o?.slug, logo: o?.logo ?? null, role: m.role, kind: meta?.kind ?? null }; }),
      activeOrganizationId: p.organizationId,
      permissions: p.role ? p.role.split(',').reduce((acc: any, r: string) => ({ ...acc, ...(ROLE_PERMISSIONS as any)[r] }), {}) : {},
      backup: { passkeys: passkeys.length, email: !!(realEmail && u.emailVerified) },
      needsBackup: privileged && passkeys.length === 0 && !(realEmail && u.emailVerified),
      // Hemlo is in early access: businesses are created by staff and by people with an approved access link
      canCreateBusiness: d.env.BUSINESS_CREATION === 'open' || u.role === 'admin' || !!u.earlyAccess,
    });
  });

  /** May the current principal do resource:action? For other Hemlo apps and for the screens. */
  r.get('/can', async (c) => {
    const resource = c.req.query('resource') as Resource, action = c.req.query('action') ?? '';
    if (!(resource in statements)) throw new HttpError(400, 'UNKNOWN_RESOURCE');
    try { const { organizationId, principal } = requirePermission(c, resource, action); return c.json({ allowed: true, organizationId, as: principal.kind }); }
    catch (e) { if (e instanceof HttpError && e.status === 403) return c.json({ allowed: false, reason: e.code }); throw e; }
  });

  r.get('/events/me', async (c) => {
    const p = requireUser(c);
    const rows = await withSystem(d.db, (tx) => tx.select().from(authEvent).where(eq(authEvent.userId, p.userId)).orderBy(desc(authEvent.at)).limit(50));
    return c.json({ events: rows.map(({ ip, ...e }) => ({ ...e, ip: ip ? ip.replace(/(\d+\.\d+)\.\d+\.\d+/, '$1.x.x') : null })) });
  });

  r.get('/events/org', async (c) => {
    const p = requireOrgUser(c);
    if (!roleCan(p.role, 'audit', 'read')) throw new HttpError(403, 'NOT_ALLOWED');
    const rows = await withOrg(d.db, p.organizationId, (tx) => tx.select().from(authEvent).orderBy(desc(authEvent.at)).limit(100));
    const a = await adapter();
    const ids = [...new Set(rows.map((x) => x.userId).filter(Boolean))] as string[];
    const users = ids.length ? await a.findMany<any>({ model: 'user', where: [{ field: 'id', operator: 'in', value: ids }] }) : [];
    return c.json({ events: rows.map(({ ip, userAgent, ...e }) => ({ ...e, userName: users.find((u) => u.id === e.userId)?.name ?? null })) });
  });

  // ---- API keys, owned by the business ----
  r.post('/api-keys', async (c) => {
    const p = requireOrgUser(c, { fresh: true });
    if (!roleCan(p.role, 'apikey', 'manage')) throw new HttpError(403, 'NOT_ALLOWED');
    if (await isDemoOrg(d, p.organizationId)) throw new HttpError(403, 'NOT_IN_DEMO');
    const b = await c.req.json<{ name: string; permissions: Record<string, string[]>; expiresInDays?: number }>();
    for (const [res, acts] of Object.entries(b.permissions ?? {}))
      for (const act of acts) if (!roleCan(p.role, res as Resource, act)) throw new HttpError(403, 'PERMISSION_ABOVE_YOUR_OWN');
    const key: any = await d.auth.api.createApiKey({ body: {
      name: String(b.name ?? '').slice(0, 60) || 'Integration', organizationId: p.organizationId, userId: p.userId,
      permissions: b.permissions ?? {}, metadata: { createdBy: p.userId },
      expiresIn: b.expiresInDays ? Math.min(b.expiresInDays, 365) * 86400 : undefined,
    } as any });
    await audit(d.db, { kind: 'apikey.created', userId: p.userId, organizationId: p.organizationId, detail: { id: key.id, name: key.name } });
    return c.json({ id: key.id, name: key.name, key: key.key, start: key.start, expiresAt: key.expiresAt }, 201); // the key is shown once
  });

  r.get('/api-keys', async (c) => {
    const p = requireOrgUser(c);
    if (!roleCan(p.role, 'apikey', 'manage')) throw new HttpError(403, 'NOT_ALLOWED');
    const rows = await (await adapter()).findMany<any>({ model: 'apikey', where: [{ field: 'referenceId', value: p.organizationId }] });
    return c.json({ keys: rows.map((k) => ({ id: k.id, name: k.name, start: k.start, createdAt: k.createdAt, lastRequest: k.lastRequest, expiresAt: k.expiresAt, enabled: k.enabled,
      permissions: typeof k.permissions === 'string' ? JSON.parse(k.permissions) : k.permissions })) });
  });

  r.delete('/api-keys/:id', async (c) => {
    const p = requireOrgUser(c, { fresh: true });
    if (!roleCan(p.role, 'apikey', 'manage')) throw new HttpError(403, 'NOT_ALLOWED');
    const a = await adapter();
    const k = await a.findOne<any>({ model: 'apikey', where: [{ field: 'id', value: c.req.param('id') }, { field: 'referenceId', value: p.organizationId }] });
    if (!k) throw new HttpError(404, 'NOT_FOUND');
    await a.delete({ model: 'apikey', where: [{ field: 'id', value: k.id }] });
    await audit(d.db, { kind: 'apikey.deleted', userId: p.userId, organizationId: p.organizationId, detail: { id: k.id, name: k.name } });
    return c.json({ ok: true });
  });

  return r;
}
