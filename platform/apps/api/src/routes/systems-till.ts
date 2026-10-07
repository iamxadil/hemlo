// The till: shop settings (the shop's own FIB account, the label-scale barcode format) and FIB payments at the counter.
// Rule: FIB's callback is only a nudge. A payment counts as PAID only after we ask FIB ourselves, with the shop's credentials.
import { Hono } from 'hono';
import { and, eq } from 'drizzle-orm';
import { hmac, newId, safeEqual, seal, unseal } from '@hemlo/core';
import { withOrg, withSystem, type Database } from '@hemlo/db';
import { sysSettings, sysFibPayment } from '@hemlo/db/schema';
import { audit } from '@hemlo/auth/audit';
import { HttpError } from '../principal';
import { fibClient, FibError, type FibEnv } from '../fib';
import { actor, bad, text, iqd, type Actor } from './sys-common';
import { isDemoOrg } from './demo';
import type { AppEnv, Deps } from '../types';
import { fileUrl } from '../files';

const SEAL = 'fib-credentials';
const CHECK_EVERY_MS = 2000;

export const callbackSig = (secret: string, rowId: string) => hmac(secret, `fib-callback:${rowId}`);

async function settingsOf(tx: Database, orgId: string) {
  const [row] = await tx.select().from(sysSettings).where(eq(sysSettings.organizationId, orgId));
  return row ?? null;
}
const publicPayment = (p: typeof sysFibPayment.$inferSelect) => ({
  id: p.id, status: p.status, amount: p.amount, readableCode: p.readableCode, qrCode: p.qrCode, personalAppLink: p.personalAppLink,
  validUntil: p.validUntil, paidAt: p.paidAt, paidBy: p.paidBy, declineReason: p.declineReason, saleId: p.saleId, env: p.env,
});

/** Open a client for this business's FIB account. */
export async function fibFor(d: Deps, tx: Database, orgId: string) {
  const s = await settingsOf(tx, orgId);
  if (!s?.fib) throw new HttpError(409, 'FIB_NOT_CONNECTED');
  const secret = await unseal(d.env.AUTH_SECRET, SEAL, s.fib.secret);
  return { env: s.fib.env, client: fibClient(s.fib.env, s.fib.clientId, secret, d.env.FIB_BASE_URL) };
}

/** Ask FIB for the truth about one payment, and record it. */
export async function refreshFib(d: Deps, tx: Database, p: typeof sysFibPayment.$inferSelect) {
  if (p.status !== 'UNPAID') return p;
  const { client } = await fibFor(d, tx, p.organizationId);
  const st = await client.status(p.fibPaymentId);
  const next: Partial<typeof sysFibPayment.$inferInsert> = { checkedAt: new Date() };
  if (st.status === 'PAID') {
    // the amount must match what we asked for, to the dinar
    const paidAmount = st.amount ? Math.round(Number(st.amount.amount)) : p.amount;
    if (paidAmount !== p.amount) { next.status = 'DECLINED'; next.declineReason = 'AMOUNT_MISMATCH'; }
    else { next.status = 'PAID'; next.paidAt = st.paidAt ? new Date(st.paidAt) : new Date(); next.paidBy = st.paidBy?.name ?? null; }
  } else if (st.status === 'DECLINED') { next.status = 'DECLINED'; next.declineReason = st.decliningReason ?? null; }
  const [row] = await tx.update(sysFibPayment).set(next).where(eq(sysFibPayment.id, p.id)).returning();
  return row;
}

export function systemsTillRoutes(d: Deps) {
  const r = new Hono<AppEnv>();
  const inOrg = <T>(a: Actor, fn: (tx: Database) => Promise<T>) => withOrg(d.db, a.organizationId, fn);

  // ---------------- settings ----------------
  r.get('/settings', async (c) => {
    const a = actor(c, 'stock', 'read');
    const s = await inOrg(a, (tx) => settingsOf(tx, a.organizationId));
    return c.json({
      scale: s?.scale ?? { enabled: false, prefixes: ['20', '21', '22', '23', '24', '25', '26', '27', '28', '29'], mode: 'weight' },
      fib: s?.fib ? { connected: true, env: s.fib.env, clientId: `${s.fib.clientId.slice(0, 4)}…`, connectedAt: s.fib.connectedAt } : { connected: false },
      logoUrl: await fileUrl(d.env, a.organizationId, s?.logoId),
    });
  });

  r.put('/settings/scale', async (c) => {
    const a = actor(c, 'products', 'manage');
    const b = await c.req.json<{ enabled?: boolean; prefixes?: string[]; mode?: string }>();
    const prefixes = (Array.isArray(b.prefixes) ? b.prefixes : []).map(String).filter((x) => /^\d{1,2}$/.test(x)).slice(0, 20);
    const scale = { enabled: !!b.enabled, prefixes: prefixes.length ? prefixes : ['20', '21', '22', '23', '24', '25', '26', '27', '28', '29'], mode: b.mode === 'price' ? 'price' as const : 'weight' as const };
    await inOrg(a, (tx) => tx.insert(sysSettings).values({ organizationId: a.organizationId, scale }).onConflictDoUpdate({ target: sysSettings.organizationId, set: { scale, updatedAt: new Date() } }));
    return c.json({ scale });
  });

  /** Connect the shop's own FIB business account. The credentials are checked with FIB before they're saved. */
  r.put('/settings/fib', async (c) => {
    const a = actor(c, 'settings', 'update');
    if (await isDemoOrg(d, a.organizationId)) throw new HttpError(403, 'NOT_IN_DEMO');
    const b = await c.req.json<{ env?: string; clientId?: string; clientSecret?: string }>();
    const env: FibEnv = b.env === 'production' ? 'production' : 'sandbox';
    const clientId = text(b.clientId, 200, 'BAD_CLIENT_ID', true)!;
    const clientSecret = text(b.clientSecret, 500, 'BAD_CLIENT_SECRET', true)!;
    try { await fibClient(env, clientId, clientSecret, d.env.FIB_BASE_URL).verify(); }
    catch (e) { throw new HttpError(400, e instanceof FibError && e.status === 0 ? 'FIB_UNREACHABLE' : 'FIB_AUTH_FAILED'); }
    const fib = { env, clientId, secret: await seal(d.env.AUTH_SECRET, SEAL, clientSecret), connectedAt: new Date().toISOString() };
    await inOrg(a, (tx) => tx.insert(sysSettings).values({ organizationId: a.organizationId, fib }).onConflictDoUpdate({ target: sysSettings.organizationId, set: { fib, updatedAt: new Date() } }));
    await audit(d.db, { kind: 'sys.fib_connected', organizationId: a.organizationId, userId: a.userId, detail: { env } });
    return c.json({ fib: { connected: true, env, clientId: `${clientId.slice(0, 4)}…`, connectedAt: fib.connectedAt } });
  });

  r.delete('/settings/fib', async (c) => {
    const a = actor(c, 'settings', 'update');
    await inOrg(a, (tx) => tx.update(sysSettings).set({ fib: null, updatedAt: new Date() }).where(eq(sysSettings.organizationId, a.organizationId)));
    await audit(d.db, { kind: 'sys.fib_disconnected', organizationId: a.organizationId, userId: a.userId });
    return c.json({ ok: true });
  });

  // ---------------- FIB at the counter ----------------
  /** Ask FIB for a payment: returns the QR code and the readable code for the customer's FIB app. */
  r.post('/fib/payments', async (c) => {
    const a = actor(c, 'sales', 'create');
    const b = await c.req.json<{ amount?: number; description?: string }>();
    const amount = iqd(b.amount, 'BAD_AMOUNT')!;
    if (amount < 250) bad('BAD_AMOUNT');
    const out = await inOrg(a, async (tx) => {
      const { env, client } = await fibFor(d, tx, a.organizationId);
      const id = newId();
      const callbackUrl = `${d.env.API_URL}/v1/fib/callback/${id}?sig=${await callbackSig(d.env.AUTH_SECRET, id)}`;
      let p;
      try { p = await client.create({ amount, description: text(b.description, 50, 'BAD_NOTE') ?? 'Hemlo', callbackUrl }); }
      catch (e) { throw new HttpError(e instanceof FibError && e.status === 0 ? 400 : 409, 'FIB_FAILED', e instanceof Error ? e.message : undefined); }
      const [row] = await tx.insert(sysFibPayment).values({
        id, organizationId: a.organizationId, fibPaymentId: p.paymentId, env, amount, readableCode: p.readableCode, qrCode: p.qrCode,
        personalAppLink: p.personalAppLink ?? null, validUntil: p.validUntil ? new Date(p.validUntil) : null, userId: a.userId, deviceId: a.deviceId,
      }).returning();
      return row;
    });
    return c.json({ payment: publicPayment(out) }, 201);
  });

  /** The till polls this every couple of seconds while the QR code is on screen. */
  r.get('/fib/payments/:id', async (c) => {
    const a = actor(c, 'sales', 'create');
    const row = await inOrg(a, async (tx) => {
      const [p] = await tx.select().from(sysFibPayment).where(eq(sysFibPayment.id, c.req.param('id')));
      if (!p) throw new HttpError(404, 'NOT_FOUND');
      if (p.status === 'UNPAID' && (!p.checkedAt || Date.now() - p.checkedAt.getTime() > CHECK_EVERY_MS)) return refreshFib(d, tx, p).catch(() => p);
      return p;
    });
    return c.json({ payment: publicPayment(row) });
  });

  r.post('/fib/payments/:id/cancel', async (c) => {
    const a = actor(c, 'sales', 'create');
    const row = await inOrg(a, async (tx) => {
      const [p] = await tx.select().from(sysFibPayment).where(and(eq(sysFibPayment.id, c.req.param('id')), eq(sysFibPayment.status, 'UNPAID')));
      if (!p) throw new HttpError(409, 'NOT_CANCELABLE');
      const { client } = await fibFor(d, tx, a.organizationId);
      await client.cancel(p.fibPaymentId).catch(() => {});
      const fresh = await refreshFib(d, tx, p).catch(() => p); // it may have been paid a moment ago
      if (fresh.status === 'PAID') return fresh;
      const [x] = await tx.update(sysFibPayment).set({ status: 'CANCELLED', checkedAt: new Date() }).where(eq(sysFibPayment.id, p.id)).returning();
      return x;
    });
    return c.json({ payment: publicPayment(row) });
  });

  return r;
}

/** FIB calls this when a payment changes. Signed per payment; we then check the status with FIB ourselves. */
export function fibCallbackRoutes(d: Deps) {
  const r = new Hono<AppEnv>();
  r.post('/callback/:id', async (c) => {
    const id = c.req.param('id');
    if (!safeEqual(c.req.query('sig') ?? '', await callbackSig(d.env.AUTH_SECRET, id))) return c.json({ error: 'NOT_FOUND' }, 404);
    const [p] = await withSystem(d.db, (tx) => tx.select().from(sysFibPayment).where(eq(sysFibPayment.id, id)));
    if (p) await withOrg(d.db, p.organizationId, (tx) => refreshFib(d, tx, p)).catch((e) => console.error('[fib callback]', e));
    return c.json({ ok: true });
  });
  return r;
}
