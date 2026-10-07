// Start a shop (hemlohq.com → system.hemlohq.com/?start=store): the business, a 30-day free trial with everything, the
// person as its owner. The same deal as a dental clinic: one free trial per person; after it, Hemlo's team activates
// the shop, and until then its records stay open to read (never held hostage).
import { Hono } from 'hono';
import { sql } from 'drizzle-orm';
import { newId } from '@hemlo/core';
import { withOrg, withSystem } from '@hemlo/db';
import { organization, member, hemloSubscription, sysSettings } from '@hemlo/db/schema';
import { audit } from '@hemlo/auth/audit';
import { HttpError, requireUser, forgetPrincipal } from '../principal';
import { bad, text } from './sys-common';
import { isDemoEmail } from './demo';
import { TRIAL_DAYS } from '../subscription';
import type { AppEnv, Deps } from '../types';

const rowsOf = (r: any): any[] => (Array.isArray(r) ? r : r?.rows ?? []);
export const SHOP_KINDS = ['market', 'grocery', 'pharmacy', 'clothes', 'electronics', 'other'] as const;

export function storeStartRoutes(d: Deps) {
  const r = new Hono<AppEnv>();
  r.post('/start', async (c) => {
    const p = requireUser(c);
    if (isDemoEmail(p.user.email)) throw new HttpError(403, 'NOT_IN_DEMO');
    const b = await c.req.json<{ name?: string; city?: string; shopKind?: string }>().catch(() => ({} as Record<string, string>));
    const name = text(b.name, 80, 'BAD_NAME', true)!;
    if (name.length < 2) bad('BAD_NAME');
    const city = text(b.city, 60, 'BAD_CITY');
    const shopKind = SHOP_KINDS.includes(b.shopKind as any) ? b.shopKind : 'market';
    // one free trial per person (Hemlo can always extend or grant another from the admin dashboard)
    const [used] = await withSystem(d.db, async (tx) => rowsOf(await tx.execute(sql`select 1 from hemlo_subscription s join member m on m.organization_id = s.organization_id
      where s.edition = 'store' and m.user_id = ${p.userId} and m.role like '%owner%' limit 1`)));
    if (used) throw new HttpError(409, 'TRIAL_USED');

    const orgId = newId(), now = new Date(), trialEndsAt = new Date(now.getTime() + TRIAL_DAYS * 86400_000);
    const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'shop'}-${orgId.slice(0, 6).toLowerCase()}`;
    await withOrg(d.db, orgId, async (tx) => {
      await tx.insert(organization).values({ id: orgId, name, slug, createdAt: now, metadata: JSON.stringify({ kind: 'store', shopKind, city }) });
      await tx.insert(member).values({ id: newId(), organizationId: orgId, userId: p.userId, role: 'owner', createdAt: now } as any);
      await tx.insert(hemloSubscription).values({ organizationId: orgId, edition: 'store', status: 'trial', seats: 1, trialEndsAt });
      await tx.insert(sysSettings).values({ organizationId: orgId });
    });
    forgetPrincipal(c); // now a member of the new shop
    await audit(d.db, { kind: 'store.trial_started', userId: p.userId, organizationId: orgId, detail: { name, city, shopKind } });
    return c.json({ organizationId: orgId, trialEndsAt }, 201);
  });
  return r;
}
