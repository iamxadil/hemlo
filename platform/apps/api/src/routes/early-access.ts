// Early access: people ask to try Hemlo before accounts open to everyone. No sign-in needed.
// Protected by validation, a hidden "website" field bots fill in, and a per-IP limit.
import { Hono } from 'hono';
import { and, eq, gt, sql } from 'drizzle-orm';
import { newId, normalizeIraqiPhone } from '@hemlo/core';
import { earlyAccess } from '@hemlo/db/schema';
import { HttpError, requireUser, forgetPrincipal } from '../principal';
import { audit } from '@hemlo/auth/audit';
import { accessTokenHash } from './admin';
import type { AppEnv, Deps } from '../types';

export const EARLY_ACCESS_KINDS = ['phone-repair', 'car-repair', 'ac-appliances', 'cafe-restaurant', 'store', 'clinic-salon', 'school', 'realestate', 'other'] as const;
/** What a real-estate office asks for from the add-ons form (hemlohq.com/systems#addons): shown first in the note. */
const INTERESTS: Record<string, string> = { website: 'Hemlo Website', connect: 'Hemlo Connect', 'connect-pro': 'Hemlo Connect Pro', 'web-connect': 'Website + Connect Pro' };
const PER_IP_PER_HOUR = 5;
const clip = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export function earlyAccessRoutes(d: Deps) {
  const r = new Hono<AppEnv>();

  r.post('/', async (c) => {
    const b = await c.req.json<Record<string, unknown>>().catch(() => ({} as Record<string, unknown>));
    if (clip(b.website, 200)) return c.json({ ok: true }); // the hidden field: only bots fill it in
    const interest = INTERESTS[String(b.interest ?? '')] ?? null;
    const name = clip(b.name, 80), business = clip(b.business, 100), city = clip(b.city, 60) || null;
    const note = [interest && `[${interest}]`, clip(b.note, 500)].filter(Boolean).join(' ') || null;
    const email = clip(b.email, 120).toLowerCase() || null;
    const kind = EARLY_ACCESS_KINDS.includes(b.kind as any) ? (b.kind as string) : null;
    const phone = normalizeIraqiPhone(String(b.phone ?? ''));
    const locale = b.locale === 'en' ? 'en' : 'ar';
    if (!name || !business || !kind) throw new HttpError(400, 'MISSING_FIELDS');
    if (!phone) throw new HttpError(400, 'INVALID_PHONE');
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new HttpError(400, 'INVALID_EMAIL');

    const ip = c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
    const hourAgo = new Date(Date.now() - 3600_000);
    if (ip) {
      const [{ n }] = await d.db.select({ n: sql<number>`count(*)::int` }).from(earlyAccess).where(and(eq(earlyAccess.ip, ip), gt(earlyAccess.createdAt, hourAgo)));
      if (n >= PER_IP_PER_HOUR) throw new HttpError(429, 'TOO_MANY_REQUESTS');
    }
    // The same phone again within a day: already on the list, nothing new to store.
    const dup = await d.db.select({ id: earlyAccess.id }).from(earlyAccess)
      .where(and(eq(earlyAccess.phoneNumber, phone), gt(earlyAccess.createdAt, new Date(Date.now() - 86400_000)))).limit(1);
    if (dup.length) return c.json({ ok: true });

    await d.db.insert(earlyAccess).values({ id: newId(), name, phoneNumber: phone, email, business, kind, city, note, locale, ip });
    const to = d.env.EARLY_ACCESS_NOTIFY || 'hello@hemlohq.com';
    const p = d.notifier.earlyAccessAlert(to, { name, phone, business, kind, city, note, locale }).catch((e) => console.error('[early access alert]', e));
    try { c.executionCtx.waitUntil(p); } catch { await p; }
    return c.json({ ok: true }, 201);
  });

  // ---- the private access link (from an approval in admin.hemlohq.com) ----
  async function byToken(token: string) {
    const h = await accessTokenHash(d.env.AUTH_SECRET, token);
    const [row] = await d.db.select().from(earlyAccess).where(eq(earlyAccess.tokenHash, h));
    return row ?? null;
  }
  const linkStatus = (row: typeof earlyAccess.$inferSelect | null) =>
    !row ? 'invalid' : row.claimedAt ? 'used' : row.status !== 'approved' ? 'invalid' : !row.tokenExpiresAt || row.tokenExpiresAt < new Date() ? 'expired' : 'open';

  r.get('/claim/:token', async (c) => {
    const row = await byToken(c.req.param('token'));
    const status = linkStatus(row);
    if (!row || status === 'invalid') return c.json({ status: 'invalid' });
    return c.json({ status, name: row.name.split(/\s+/)[0], business: row.business, kind: row.kind, expiresAt: row.tokenExpiresAt });
  });

  /** Signed in with the link: the person gets early access, and their business is created with them as owner. */
  r.post('/claim/:token', async (c) => {
    const p = requireUser(c);
    const row = await byToken(c.req.param('token'));
    const status = linkStatus(row);
    if (status !== 'open') throw new HttpError(410, `LINK_${status.toUpperCase()}`);
    const ctx = await d.auth.$context;
    await ctx.adapter.update({ model: 'user', where: [{ field: 'id', value: p.userId }], update: { earlyAccess: true, ...(p.user.name ? {} : { name: row!.name }) } });
    const slug = `${row!.business.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 40) || 'business'}-${Math.random().toString(36).slice(2, 6)}`;
    const org: any = await d.auth.api.createOrganization({ body: { name: row!.business, slug, userId: p.userId, metadata: { kind: row!.kind, city: row!.city } } as any });
    await d.db.update(earlyAccess).set({ status: 'activated', claimedAt: new Date(), claimedBy: p.userId, organizationId: org.id }).where(eq(earlyAccess.id, row!.id));
    await d.auth.api.setActiveOrganization({ headers: c.req.raw.headers, body: { organizationId: org.id } }).catch(() => {});
    forgetPrincipal(c);
    await audit(d.db, { kind: 'early_access.activated', userId: p.userId, organizationId: org.id, detail: { business: row!.business } });
    return c.json({ ok: true, organizationId: org.id }, 201);
  });

  return r;
}
