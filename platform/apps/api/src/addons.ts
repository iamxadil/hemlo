import { eq, inArray } from 'drizzle-orm';
import { withOrg, withSystem, type Database } from '@hemlo/db';
import { hemloAddon, hemloAddonEntitlement } from '@hemlo/db/schema';
import { HttpError } from './principal';
import { subscriptionOf } from './subscription';

export async function addonOffer(db: Database, code: string) {
  return withSystem(db, async (tx) => (await tx.select().from(hemloAddon).where(eq(hemloAddon.code, code)))[0] ?? null);
}

/** Add-ons sold together: a bundle switches on everything it includes (and is priced below the parts). */
export const BUNDLES: Record<string, string[]> = { 'web-connect': ['website', 'connect-pro'] };
const bundlesWith = (code: string) => Object.keys(BUNDLES).filter((b) => BUNDLES[b].includes(code));
type Offer = typeof hemloAddon.$inferSelect;
type Ent = typeof hemloAddonEntitlement.$inferSelect;
type Sub = Awaited<ReturnType<typeof subscriptionOf>>;
const isActive = (offer: Offer | null, ent: Ent | null, sub: Sub) => !!offer && offer.active && !!ent && ent.addonId === offer.id && ent.status === 'active'
  && (!ent.paidUntil || ent.paidUntil > new Date())
  && (sub.status === 'trial' || sub.status === 'active' || sub.status === 'grace')
  && ent.edition === sub.edition && offer.compatibleEditions.includes(sub.edition);

/** Whether this business has this add-on: on its own, or through a bundle that includes it. Three queries, whatever the codes. */
export async function addonEntitlement(db: Database, organizationId: string, code: string) {
  const all = await addonsActive(db, organizationId, [code]);
  return { ...all[code], subscription: all[code].subscription };
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


/** Several add-ons at once (Connect's plans, the plan page): the catalog, the subscription and the entitlements in three
 *  queries. An add-on included in an active bundle counts as active (its entitlement is the bundle's). */
export async function addonsActive(db: Database, organizationId: string, codes: readonly string[]) {
  const wanted = [...new Set([...codes, ...codes.flatMap(bundlesWith)])];
  const [offers, sub, rows] = await Promise.all([
    withSystem(db, (tx) => tx.select().from(hemloAddon).where(inArray(hemloAddon.code, wanted))), subscriptionOf(db, organizationId),
    withOrg(db, organizationId, (tx) => tx.select().from(hemloAddonEntitlement).where(eq(hemloAddonEntitlement.organizationId, organizationId))),
  ]);
  const own = (code: string) => {
    const offer = offers.find((x) => x.code === code) ?? null, ent = offer ? rows.find((x) => x.addonId === offer.id) ?? null : null;
    return { offer, entitlement: ent, active: isActive(offer, ent, sub) };
  };
  return Object.fromEntries(codes.map((code) => {
    const mine = own(code);
    if (!mine.active) for (const b of bundlesWith(code)) {
      const via = own(b);
      if (via.active && mine.offer?.active) return [code, { offer: mine.offer, entitlement: via.entitlement, active: true, via: b, subscription: sub }];
    }
    return [code, { ...mine, via: null as string | null, subscription: sub }];
  })) as Record<string, { offer: Offer | null; entitlement: Ent | null; active: boolean; via: string | null; subscription: Sub }>;
}
