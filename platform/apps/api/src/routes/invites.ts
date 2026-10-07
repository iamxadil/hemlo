// Staff invitations by phone or email. The owner can share a phone invite through their own WhatsApp (a free wa.me link);
// accepting it requires signing in with that same phone number or email.
import { Hono } from 'hono';
import { and, eq, isNull, gt } from 'drizzle-orm';
import { hmac, randomToken, newId, normalizeIraqiPhone, maskPhone, isPlaceholderEmail } from '@hemlo/core';
import { withOrg, withSystem } from '@hemlo/db';
import { staffInvite } from '@hemlo/db/schema';
import { roleCan, canAssignRole, ROLES } from '@hemlo/auth/permissions';
import { audit } from '@hemlo/auth/audit';
import { inviteShareText, type Locale } from '@hemlo/notify';
import { HttpError, requireOrgUser, requireUser, findMember, forgetPrincipal } from '../principal';
import { isDemoOrg } from './demo';
import { withinLimit } from '../subscription';
import { sql } from 'drizzle-orm';
import type { AppEnv, Deps } from '../types';

const INVITE_DAYS = 7;
const tokenHash = (secret: string, t: string) => hmac(secret, `invite:${t}`);
const maskEmail = (e: string) => e.replace(/^(.)[^@]*(@.*)$/, '$1•••$2');

export function inviteRoutes(d: Deps) {
  const r = new Hono<AppEnv>();
  const adapter = async () => (await d.auth.$context).adapter;

  r.post('/', async (c) => {
    const p = requireOrgUser(c);
    if (!roleCan(p.role, 'member', 'create')) throw new HttpError(403, 'NOT_ALLOWED');
    if (await isDemoOrg(d, p.organizationId)) throw new HttpError(403, 'NOT_IN_DEMO');
    const b = await c.req.json<{ phone?: string; email?: string; name?: string; role: string; teamIds?: string[] }>();
    if (!ROLES.includes(b.role as any) || !canAssignRole(p.role, b.role)) throw new HttpError(403, 'ROLE_TOO_HIGH');
    const phone = b.phone ? normalizeIraqiPhone(b.phone) : null;
    const email = b.email ? String(b.email).trim().toLowerCase() : null;
    if (b.phone && !phone) throw new HttpError(400, 'INVALID_PHONE');
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new HttpError(400, 'INVALID_EMAIL');
    if (!phone && !email) throw new HttpError(400, 'PHONE_OR_EMAIL_REQUIRED');
    // the plan's staff accounts: everyone in the business, and invitations not yet answered
    const [{ n }] = (await withOrg(d.db, p.organizationId, async (tx) => { const r: any = await tx.execute(sql`select (select count(*) from member where organization_id = ${p.organizationId}) + (select count(*) from staff_invite where organization_id = ${p.organizationId} and accepted_at is null and canceled_at is null and expires_at > now()) as n`); return Array.isArray(r) ? r : r.rows; }));
    await withinLimit(d.db, p.organizationId, 'users', Number(n));
    const a = await adapter();
    const teamIds = [...new Set(b.teamIds ?? [])];
    for (const t of teamIds) if (!await a.findOne({ model: 'team', where: [{ field: 'id', value: t }, { field: 'organizationId', value: p.organizationId }] })) throw new HttpError(400, 'UNKNOWN_LOCATION');

    const token = randomToken(32);
    const row = { id: newId(), organizationId: p.organizationId, tokenHash: await tokenHash(d.env.AUTH_SECRET, token), phoneNumber: phone, email, name: b.name?.trim().slice(0, 80) || null,
      role: b.role, teamIds, inviterId: p.userId, expiresAt: new Date(Date.now() + INVITE_DAYS * 86400_000) };
    await withOrg(d.db, p.organizationId, (tx) => tx.insert(staffInvite).values(row));
    const org = await a.findOne<any>({ model: 'organization', where: [{ field: 'id', value: p.organizationId }] });
    const locale: Locale = (p.user.locale as Locale) ?? 'ar';
    const url = `${d.env.ACCOUNT_URL}/invite/?t=${encodeURIComponent(token)}`;
    const vars = { inviter: p.user.name || 'Hemlo', org: org?.name ?? '', url };
    if (email) await d.notifier.invitation({ email }, locale, { ...vars, role: b.role }).catch((e) => console.error('[invite email]', e));
    await audit(d.db, { kind: 'invite.created', userId: p.userId, organizationId: p.organizationId, detail: { role: b.role, via: phone ? 'phone' : 'email' } });
    const text = inviteShareText(locale, vars);
    return c.json({
      invite: { id: row.id, role: row.role, expiresAt: row.expiresAt, phone, email },
      url, shareText: text,
      whatsappUrl: phone ? `https://wa.me/${phone.slice(1)}?text=${encodeURIComponent(text)}` : null,
    }, 201);
  });

  r.get('/', async (c) => {
    const p = requireOrgUser(c);
    if (!roleCan(p.role, 'member', 'create')) throw new HttpError(403, 'NOT_ALLOWED');
    const rows = await withOrg(d.db, p.organizationId, (tx) => tx.select().from(staffInvite)
      .where(and(isNull(staffInvite.acceptedAt), isNull(staffInvite.canceledAt), gt(staffInvite.expiresAt, new Date()))));
    return c.json({ invites: rows.map(({ tokenHash: _, ...x }) => x) });
  });

  r.delete('/:id', async (c) => {
    const p = requireOrgUser(c);
    if (!roleCan(p.role, 'member', 'create')) throw new HttpError(403, 'NOT_ALLOWED');
    await withOrg(d.db, p.organizationId, (tx) => tx.update(staffInvite).set({ canceledAt: new Date() }).where(eq(staffInvite.id, c.req.param('id'))));
    return c.json({ ok: true });
  });

  // Public preview: what am I being invited to?
  r.get('/by-token/:token', async (c) => {
    const inv = await byToken(c.req.param('token'));
    const a = await adapter();
    const org = await a.findOne<any>({ model: 'organization', where: [{ field: 'id', value: inv.organizationId }] });
    const inviter = await a.findOne<any>({ model: 'user', where: [{ field: 'id', value: inv.inviterId }] });
    return c.json({ organization: { name: org?.name, logo: org?.logo ?? null }, inviter: inviter?.name ?? '', role: inv.role, name: inv.name,
      contact: inv.phoneNumber ? { phone: maskPhone(inv.phoneNumber) } : { email: maskEmail(inv.email!) }, expiresAt: inv.expiresAt, status: status(inv) });
  });

  r.post('/by-token/:token/accept', async (c) => {
    const p = requireUser(c);
    const inv = await byToken(c.req.param('token'));
    if (status(inv) !== 'open') throw new HttpError(410, `INVITE_${status(inv).toUpperCase()}`);
    const u = p.user;
    const matches = (inv.phoneNumber && u.phoneNumberVerified && u.phoneNumber === inv.phoneNumber)
      || (inv.email && u.emailVerified && !isPlaceholderEmail(u.email) && String(u.email).toLowerCase() === inv.email);
    if (!matches) throw new HttpError(403, 'CONTACT_MISMATCH', inv.phoneNumber ? 'Sign in with the phone number this invitation was sent to' : 'Sign in with the email this invitation was sent to');

    const a = await adapter();
    // People who sign up with a phone have no name yet: take the one the owner typed in the invitation.
    if (!u.name && inv.name) await a.update({ model: 'user', where: [{ field: 'id', value: p.userId }], update: { name: inv.name } });
    const existing = await findMember(d, inv.organizationId, { userId: p.userId });
    if (!existing) await d.auth.api.addMember({ body: { userId: p.userId, organizationId: inv.organizationId, role: inv.role as any } });
    for (const teamId of inv.teamIds) {
      const already = await a.findOne({ model: 'teamMember', where: [{ field: 'teamId', value: teamId }, { field: 'userId', value: p.userId }] });
      if (!already) await a.create({ model: 'teamMember', data: { teamId, userId: p.userId, createdAt: new Date() } });
    }
    await withSystem(d.db, (tx) => tx.update(staffInvite).set({ acceptedAt: new Date(), acceptedBy: p.userId }).where(eq(staffInvite.id, inv.id)));
    await d.auth.api.setActiveOrganization({ headers: c.req.raw.headers, body: { organizationId: inv.organizationId } }).catch(() => {});
    forgetPrincipal(c);
    await audit(d.db, { kind: 'invite.accepted', userId: p.userId, organizationId: inv.organizationId, detail: { role: inv.role } });
    return c.json({ ok: true, organizationId: inv.organizationId });
  });

  async function byToken(token: string) {
    const h = await tokenHash(d.env.AUTH_SECRET, token);
    const inv = await withSystem(d.db, async (tx) => (await tx.select().from(staffInvite).where(eq(staffInvite.tokenHash, h)))[0]);
    if (!inv) throw new HttpError(404, 'INVITE_NOT_FOUND');
    return inv;
  }
  const status = (inv: typeof staffInvite.$inferSelect) =>
    inv.acceptedAt ? 'used' : inv.canceledAt ? 'canceled' : inv.expiresAt < new Date() ? 'expired' : 'open';

  return r;
}
