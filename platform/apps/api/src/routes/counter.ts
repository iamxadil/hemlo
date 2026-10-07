// Counter mode: a shared shop device, trusted once by an owner or manager; staff switch on it with a PIN.
import { Hono } from 'hono';
import { setCookie, deleteCookie } from 'hono/cookie';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { hmac, safeEqual, pinProblem, randomToken, newId } from '@hemlo/core';
import { withOrg, withSystem } from '@hemlo/db';
import { counterDevice, counterPin, counterLock } from '@hemlo/db/schema';
import { roleCan, PRIVILEGED } from '@hemlo/auth/permissions';
import { audit } from '@hemlo/auth/audit';
import { COUNTER_COOKIE, COUNTER_IDLE_MS, HttpError, counterTokenHash, requireOrgUser, type Principal, forgetPrincipal } from '../principal';
import { isDemoOrg } from './demo';
import { withinLimit } from '../subscription';
import type { AppEnv, Deps } from '../types';

const DEVICE_DAYS = 90;
const MAX_FAILURES = 5;
const pinHash = (secret: string, memberId: string, pin: string) => hmac(secret, `pin:${memberId}:${pin}`);

export function counterRoutes(d: Deps) {
  const r = new Hono<AppEnv>();
  const ctx = () => d.auth.$context;

  const requireManager = (c: any, fresh = false) => {
    const p = requireOrgUser(c, { fresh });
    if (!roleCan(p.role, 'counter', 'manage')) throw new HttpError(403, 'NOT_ALLOWED');
    return p;
  };
  const requireDevice = (c: any) => {
    const p = c.get('principal') as Principal | null;
    if (!p || p.kind !== 'counter') throw new HttpError(401, 'NOT_A_COUNTER_DEVICE');
    return p;
  };

  // ---- owner / manager, from their own signed-in session ----
  r.post('/devices', async (c) => {
    const p = requireManager(c, true);
    if (await isDemoOrg(d, p.organizationId)) throw new HttpError(403, 'NOT_IN_DEMO');
    const body = await c.req.json<{ name?: string; teamId?: string }>().catch(() => ({} as any));
    const name = String(body.name ?? '').trim().slice(0, 60) || 'Counter';
    const live = await withOrg(d.db, p.organizationId, (tx) => tx.select({ id: counterDevice.id }).from(counterDevice).where(and(eq(counterDevice.organizationId, p.organizationId), isNull(counterDevice.revokedAt), gt(counterDevice.expiresAt, new Date()))));
    await withinLimit(d.db, p.organizationId, 'devices', live.length);
    if (body.teamId) {
      const team = await (await ctx()).adapter.findOne<any>({ model: 'team', where: [{ field: 'id', value: body.teamId }, { field: 'organizationId', value: p.organizationId }] });
      if (!team) throw new HttpError(400, 'UNKNOWN_LOCATION');
    }
    const token = randomToken(32);
    const device = { id: newId(), organizationId: p.organizationId, teamId: body.teamId ?? null, name, tokenHash: await counterTokenHash(d.env.AUTH_SECRET, token),
      createdBy: p.userId, expiresAt: new Date(Date.now() + DEVICE_DAYS * 86400_000) };
    await withOrg(d.db, p.organizationId, (tx) => tx.insert(counterDevice).values(device));
    setCookie(c, COUNTER_COOKIE, token, { httpOnly: true, secure: d.env.API_URL.startsWith('https://'), sameSite: 'Lax', path: '/', maxAge: DEVICE_DAYS * 86400, domain: d.env.COOKIE_DOMAIN || undefined });
    await audit(d.db, { kind: 'counter.trusted', userId: p.userId, organizationId: p.organizationId, detail: { deviceId: device.id, name } });
    // Hand the device over: the owner's own session on it ends, so staff can't act as the owner.
    await (await ctx()).internalAdapter.deleteSession(p.session.token);
    forgetPrincipal(c);
    // The token is returned once, for native apps that keep it in secure storage (browsers use the cookie).
    return c.json({ device: { id: device.id, name, teamId: device.teamId, expiresAt: device.expiresAt }, token }, 201);
  });

  r.get('/devices', async (c) => {
    const p = requireManager(c);
    const rows = await withOrg(d.db, p.organizationId, (tx) => tx.select().from(counterDevice).where(isNull(counterDevice.revokedAt)));
    return c.json({ devices: rows.map(({ tokenHash, ...x }) => x) });
  });

  r.delete('/devices/:id', async (c) => {
    const p = requireManager(c);
    const n = await withOrg(d.db, p.organizationId, (tx) => tx.update(counterDevice).set({ revokedAt: new Date(), activeMemberId: null, activeUntil: null })
      .where(and(eq(counterDevice.id, c.req.param('id')), isNull(counterDevice.revokedAt))).returning({ id: counterDevice.id }));
    if (!n.length) throw new HttpError(404, 'NOT_FOUND');
    await audit(d.db, { kind: 'counter.revoked', userId: p.userId, organizationId: p.organizationId, detail: { deviceId: c.req.param('id') } });
    return c.json({ ok: true });
  });

  r.post('/devices/:id/unlock-member', async (c) => {
    const p = requireManager(c);
    const { memberId } = await c.req.json<{ memberId: string }>();
    await withOrg(d.db, p.organizationId, (tx) => tx.delete(counterLock).where(and(eq(counterLock.deviceId, c.req.param('id')), eq(counterLock.memberId, memberId))));
    await audit(d.db, { kind: 'counter.member_unlocked', userId: p.userId, organizationId: p.organizationId, detail: { deviceId: c.req.param('id'), memberId } });
    return c.json({ ok: true });
  });

  // ---- each member sets their own PIN, from their own phone ----
  r.put('/pin', async (c) => {
    const p = requireOrgUser(c, { fresh: true });
    const { pin } = await c.req.json<{ pin: string }>();
    const problem = pinProblem(String(pin ?? ''));
    if (problem) throw new HttpError(400, problem === 'weak' ? 'PIN_TOO_EASY' : 'PIN_FORMAT');
    const hash = await pinHash(d.env.AUTH_SECRET, p.memberId, pin);
    await withOrg(d.db, p.organizationId, async (tx) => {
      await tx.insert(counterPin).values({ memberId: p.memberId, organizationId: p.organizationId, userId: p.userId, pinHash: hash })
        .onConflictDoUpdate({ target: counterPin.memberId, set: { pinHash: hash, updatedAt: new Date() } });
      await tx.delete(counterLock).where(eq(counterLock.memberId, p.memberId));
    });
    await audit(d.db, { kind: 'counter.pin_set', userId: p.userId, organizationId: p.organizationId });
    return c.json({ ok: true });
  });

  r.delete('/pin', async (c) => {
    const p = requireOrgUser(c);
    await withOrg(d.db, p.organizationId, (tx) => tx.delete(counterPin).where(eq(counterPin.memberId, p.memberId)));
    return c.json({ ok: true });
  });

  r.get('/pin', async (c) => {
    const p = requireOrgUser(c);
    const row = await withOrg(d.db, p.organizationId, async (tx) => (await tx.select({ updatedAt: counterPin.updatedAt }).from(counterPin).where(eq(counterPin.memberId, p.memberId)))[0]);
    return c.json({ hasPin: !!row, updatedAt: row?.updatedAt ?? null });
  });

  // ---- on the counter device itself ----
  r.get('/state', async (c) => c.json(await state(requireDevice(c))));

  r.post('/unlock', async (c) => {
    const dev = requireDevice(c);
    const { memberId, pin } = await c.req.json<{ memberId: string; pin: string }>();
    const org = dev.organizationId;
    const [pinRow, lock] = await withOrg(d.db, org, async (tx) => [
      (await tx.select().from(counterPin).where(eq(counterPin.memberId, memberId)))[0],
      (await tx.select().from(counterLock).where(and(eq(counterLock.deviceId, dev.deviceId), eq(counterLock.memberId, memberId))))[0],
    ] as const);
    if (!pinRow) throw new HttpError(404, 'NO_PIN');
    if (lock?.locked) throw new HttpError(423, 'PIN_LOCKED');
    const ok = safeEqual(pinRow.pinHash, await pinHash(d.env.AUTH_SECRET, memberId, String(pin ?? '')));
    if (!ok) {
      const failures = (lock?.failures ?? 0) + 1, locked = failures >= MAX_FAILURES;
      await withOrg(d.db, org, (tx) => tx.insert(counterLock).values({ deviceId: dev.deviceId, memberId, organizationId: org, failures, locked })
        .onConflictDoUpdate({ target: [counterLock.deviceId, counterLock.memberId], set: { failures, locked, updatedAt: new Date() } }));
      if (locked) await onLockout(dev, memberId);
      throw new HttpError(locked ? 423 : 400, locked ? 'PIN_LOCKED' : 'WRONG_PIN', `${MAX_FAILURES - failures} tries left`);
    }
    const activeUntil = new Date(Date.now() + COUNTER_IDLE_MS);
    await withOrg(d.db, org, async (tx) => {
      await tx.delete(counterLock).where(and(eq(counterLock.deviceId, dev.deviceId), eq(counterLock.memberId, memberId)));
      await tx.update(counterDevice).set({ activeMemberId: memberId, activeUntil, lastSeenAt: new Date() }).where(eq(counterDevice.id, dev.deviceId));
    });
    await audit(d.db, { kind: 'counter.unlocked', userId: pinRow.userId, organizationId: org, detail: { deviceId: dev.deviceId } });
    return c.json(await state({ ...dev, memberId, userId: pinRow.userId }));
  });

  r.post('/lock', async (c) => {
    const dev = requireDevice(c);
    await withOrg(d.db, dev.organizationId, (tx) => tx.update(counterDevice).set({ activeMemberId: null, activeUntil: null }).where(eq(counterDevice.id, dev.deviceId)));
    return c.json({ ok: true });
  });

  r.post('/forget', async (c) => {
    const dev = requireDevice(c);
    await withOrg(d.db, dev.organizationId, (tx) => tx.update(counterDevice).set({ revokedAt: new Date(), activeMemberId: null, activeUntil: null }).where(eq(counterDevice.id, dev.deviceId)));
    deleteCookie(c, COUNTER_COOKIE, { path: '/', domain: d.env.COOKIE_DOMAIN || undefined });
    await audit(d.db, { kind: 'counter.forgotten', organizationId: dev.organizationId, detail: { deviceId: dev.deviceId } });
    return c.json({ ok: true });
  });

  async function state(dev: Extract<Principal, { kind: 'counter' }>) {
    const a = (await ctx()).adapter;
    const org = await a.findOne<any>({ model: 'organization', where: [{ field: 'id', value: dev.organizationId }] });
    const members = await a.findMany<any>({ model: 'member', where: [{ field: 'organizationId', value: dev.organizationId }] });
    const users = members.length ? await a.findMany<any>({ model: 'user', where: [{ field: 'id', operator: 'in', value: members.map((m) => m.userId) }] }) : [];
    let inTeam: Set<string> | null = null;
    if (dev.teamId) inTeam = new Set((await a.findMany<any>({ model: 'teamMember', where: [{ field: 'teamId', value: dev.teamId }] })).map((t) => t.userId));
    const [pins, locks] = await withOrg(d.db, dev.organizationId, async (tx) => [
      await tx.select({ memberId: counterPin.memberId }).from(counterPin),
      await tx.select().from(counterLock).where(eq(counterLock.deviceId, dev.deviceId)),
    ] as const);
    const withPin = new Set(pins.map((x) => x.memberId)), locked = new Set(locks.filter((l) => l.locked).map((l) => l.memberId));
    const staff = members
      .filter((m) => withPin.has(m.id) && (!inTeam || inTeam.has(m.userId) || String(m.role).split(',').some((r: string) => PRIVILEGED.includes(r as any))))
      .map((m) => { const u = users.find((x) => x.id === m.userId); return { memberId: m.id, name: u?.name || '—', image: u?.image ?? null, role: m.role, locked: locked.has(m.id) }; })
      .sort((x, y) => x.name.localeCompare(y.name));
    const active = dev.memberId ? staff.find((s) => s.memberId === dev.memberId) ?? null : null;
    return { device: { id: dev.deviceId, name: dev.device?.name, organization: { id: org?.id, name: org?.name, logo: org?.logo ?? null } }, staff, active, idleMinutes: COUNTER_IDLE_MS / 60000 };
  }

  async function onLockout(dev: Extract<Principal, { kind: 'counter' }>, memberId: string) {
    const a = (await ctx()).adapter;
    const members = await a.findMany<any>({ model: 'member', where: [{ field: 'organizationId', value: dev.organizationId }] });
    const who = members.find((m) => m.id === memberId);
    const whoUser = who && await a.findOne<any>({ model: 'user', where: [{ field: 'id', value: who.userId }] });
    await audit(d.db, { kind: 'counter.pin_locked', userId: who?.userId, organizationId: dev.organizationId, detail: { deviceId: dev.deviceId } });
    for (const m of members.filter((m) => String(m.role).split(',').includes('owner'))) {
      const u = await a.findOne<any>({ model: 'user', where: [{ field: 'id', value: m.userId }] });
      if (u?.emailVerified && !String(u.email).endsWith('.invalid'))
        await d.notifier.counterLockout({ email: u.email }, u.locale ?? 'ar', { name: whoUser?.name ?? '—', device: dev.device?.name ?? '', url: `${d.env.ACCOUNT_URL}${u.locale === 'en' ? '/en' : ''}/business/` }).catch(() => {});
    }
  }

  return r;
}

/** Slide the 10-minute idle lock forward while the unlocked person keeps working. */
export async function touchCounter(d: Deps, p: Principal | null) {
  if (!p || p.kind !== 'counter' || !p.memberId) return;
  const until = p.device?.activeUntil ? new Date(p.device.activeUntil).getTime() : 0;
  if (until - Date.now() > COUNTER_IDLE_MS - 60_000) return; // refreshed less than a minute ago
  await withSystem(d.db, (tx) => tx.update(counterDevice).set({ activeUntil: new Date(Date.now() + COUNTER_IDLE_MS), lastSeenAt: new Date() }).where(eq(counterDevice.id, p.deviceId)));
}
