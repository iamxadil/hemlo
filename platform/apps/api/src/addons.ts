import { eq, inArray } from 'drizzle-orm';
import { withOrg, withSystem, type Database } from '@hemlo/db';
import { hemloAddon, hemloAddonEntitlement } from '@hemlo/db/schema';
import { HttpError } from './principal';
import { subscriptionOf } from './subscription';

export async function addonOffer(db: Database, code: string) {
  return withSystem(db, async (tx) => (await tx.select().from(hemloAddon).where(eq(hemloAddon.code, code)))[0] ?? null);
}

export async function addonEntitlement(db: Database, organizationId: string, code: string) {
  const [offer, sub, rows] = await Promise.all([
    addonOffer(db, code), subscriptionOf(db, organizationId),
    withOrg(db, organizationId, (tx) => tx.select().from(hemloAddonEntitlement).where(eq(hemloAddonEntitlement.organizationId, organizationId))),
  ]);
  const ent = rows.find((x) => x.addonId === offer?.id) ?? null;
  const active = !!offer && offer.active && !!ent && ent.addonId === offer.id && ent.status === 'active'
    && (!ent.paidUntil || ent.paidUntil > new Date())
    && (sub.status === 'trial' || sub.status === 'active' || sub.status === 'grace')
    && ent.edition === sub.edition && offer.compatibleEditions.includes(sub.edition);
  return { offer, subscription: sub, entitlement: ent, active };
}

export async function requireAddon(db: Database, organizationId: string, code: string) {
  const result = await addonEntitlement(db, organizationId, code);
  if (!result.offer || !result.active) throw new HttpError(402, 'ADDON_NOT_ACTIVE');
  return result;
}

export async function requireAddonOffer(db: Database, organizationId: string, code: string) {
  const [offer, sub] = await Promise.all([addonOffer(db, code), subscriptionOf(db, organizationId)]);
  if (!offer || !offer.active || !offer.compatibleEditions.includes(sub.edition)) throw new HttpError(403, 'ADDON_UNAVAILABLE');
  if (!['trial', 'active', 'grace'].includes(sub.status)) throw new HttpError(402, 'CORE_SUBSCRIPTION_REQUIRED');
  return { offer, subscription: sub };
}


/** Several add-ons at once (Connect's two plans): the catalog, the subscription and the entitlements in three queries. */
export async function addonsActive(db: Database, organizationId: string, codes: readonly string[]) {
  const [offers, sub, rows] = await Promise.all([
    withSystem(db, (tx) => tx.select().from(hemloAddon).where(inArray(hemloAddon.code, [...codes]))), subscriptionOf(db, organizationId),
    withOrg(db, organizationId, (tx) => tx.select().from(hemloAddonEntitlement).where(eq(hemloAddonEntitlement.organizationId, organizationId))),
  ]);
  const now = new Date(), core = sub.status === 'trial' || sub.status === 'active' || sub.status === 'grace';
  return Object.fromEntries(codes.map((code) => {
    const offer = offers.find((x) => x.code === code) ?? null, ent = offer ? rows.find((x) => x.addonId === offer.id) ?? null : null;
    const active = !!offer && offer.active && !!ent && ent.status === 'active' && (!ent.paidUntil || ent.paidUntil > now) && core
      && ent.edition === sub.edition && offer.compatibleEditions.includes(sub.edition);
    return [code, { offer, entitlement: ent, active }];
  })) as Record<string, { offer: typeof hemloAddon.$inferSelect | null; entitlement: typeof hemloAddonEntitlement.$inferSelect | null; active: boolean }>;
}
