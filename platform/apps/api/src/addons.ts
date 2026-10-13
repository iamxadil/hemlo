import { eq } from 'drizzle-orm';
import { withOrg, withSystem, type Database } from '@hemlo/db';
import { hemloAddon, hemloAddonEntitlement, type AddonLimits } from '@hemlo/db/schema';
import { HttpError } from './principal';
import { subscriptionOf } from './subscription';

type Offer = typeof hemloAddon.$inferSelect;
type Ent = typeof hemloAddonEntitlement.$inferSelect;
type Sub = Awaited<ReturnType<typeof subscriptionOf>>;

// ---- the catalog (a handful of rows that change rarely: kept for a minute per isolate) ----
let catalog: { at: number; offers: Offer[] } | null = null;
export const forgetAddons = () => { catalog = null; };
export async function addonCatalog(db: Database): Promise<Offer[]> {
  if (catalog && Date.now() - catalog.at < 60_000) return catalog.offers;
  const offers = await withSystem(db, (tx) => tx.select().from(hemloAddon));
  catalog = { at: Date.now(), offers };
  return offers;
}
export async function addonOffer(db: Database, code: string, edition?: string) {
  const o = (await addonCatalog(db)).find((x) => x.code === code || x.id === code) ?? null;
  return edition ? forEdition(o, edition) : o;
}
/** The add-on as one system sees it: its price, allowances and words for that system where they differ (a shop pays less
 *  than an agency), the row's own everywhere else. Everything that prices, limits or shows an add-on goes through this. */
export function forEdition<T extends Offer | null | undefined>(o: T, edition: string): T {
  const e = o?.editions?.[edition];
  if (!o || !e) return o;
  return { ...o, ...(e.priceMonth !== undefined ? { priceMonth: e.priceMonth } : {}), ...(e.priceYear !== undefined ? { priceYear: e.priceYear } : {}),
    ...(e.limits ? { limits: e.limits } : {}), ...(e.name ? { name: e.name } : {}), ...(e.description ? { description: e.description } : {}) };
}

/** Add-ons that switch on others: a tier includes the ones below it (AI Studio → Connect Pro → Connect), a bundle its
 *  parts. Read from the catalog ("includes"); the retired Website + Connect Pro bundle is known here for old demos. */
const LEGACY: Record<string, string[]> = { 'web-connect': ['website', 'connect-pro', 'connect'] };
const includesOf = (o: Offer) => (o.includes?.length ? o.includes : LEGACY[o.code] ?? []);
export const isFree = (o: Offer | null | undefined) => !!o && o.priceMonth === 0;
// a shop on the founders' free arrangement (from before plans; no subscription row) is a live customer too
const live = (sub: Sub) => sub.status === 'trial' || sub.status === 'active' || sub.status === 'grace' || sub.status === 'free';
const fits = (o: Offer | null, sub: Sub) => !!o && o.active && live(sub) && o.compatibleEditions.includes(sub.edition);
/** Bought (an active, paid-up entitlement), or free with the System (no entitlement needed). */
const isActive = (offer: Offer | null, ent: Ent | null, sub: Sub) => fits(offer, sub) && (isFree(offer)
  || (!!ent && ent.addonId === offer!.id && ent.status === 'active' && (!ent.paidUntil || ent.paidUntil > new Date()) && ent.edition === sub.edition));

/** A tier's limits (missing numbers are 0: nothing is unlimited by accident). */
export const limitsOf = (o: Offer | null | undefined): Required<AddonLimits> => {
  const l = o?.limits ?? {};
  const n = (v: unknown) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.floor(Number(v)) : 0);
  return { aiDay: n(l.aiDay), aiWeek: n(l.aiWeek), aiMonth: n(l.aiMonth), waIqd: n(l.waIqd), waMarketingPct: Math.min(100, n(l.waMarketingPct)), sendsDay: n(l.sendsDay),
    studioMonth: n(l.studioMonth), imagesMonth: n(l.imagesMonth), videosMonth: n(l.videosMonth), mediaIqd: n(l.mediaIqd) };
};

/** Whether this business has this add-on: on its own, free with the System, or through one that includes it. */
export async function addonEntitlement(db: Database, organizationId: string, code: string) {
  return (await addonsActive(db, organizationId, [code]))[code];
}

export async function requireAddon(db: Database, organizationId: string, code: string) {
  const result = await addonEntitlement(db, organizationId, code);
  if (!result.offer || !result.active) throw new HttpError(402, 'ADDON_NOT_ACTIVE');
  return result;
}

export async function requireAddonOffer(db: Database, organizationId: string, code: string) {
  const [raw, sub] = await Promise.all([addonOffer(db, code), subscriptionOf(db, organizationId)]);
  const offer = forEdition(raw, sub.edition);
  if (!offer || !offer.active || !offer.compatibleEditions.includes(sub.edition)) throw new HttpError(403, 'ADDON_UNAVAILABLE');
  if (!live(sub)) throw new HttpError(402, 'CORE_SUBSCRIPTION_REQUIRED');
  return { offer, subscription: sub };
}

/** Several add-ons at once (Connect's tiers, the plan page): the catalog (cached), the subscription and the entitlements.
 *  An add-on included in an active one counts as active, with the including one's entitlement ("via"). */
export async function addonsActive(db: Database, organizationId: string, codes: readonly string[]) {
  const [catalogRows, sub, rows] = await Promise.all([addonCatalog(db), subscriptionOf(db, organizationId),
    withOrg(db, organizationId, (tx) => tx.select().from(hemloAddonEntitlement).where(eq(hemloAddonEntitlement.organizationId, organizationId)))]);
  const offers = catalogRows.map((o) => forEdition(o, sub.edition));
  const own = (code: string) => {
    const offer = offers.find((x) => x.code === code) ?? null, ent = offer ? rows.find((x) => x.addonId === offer.id) ?? null : null;
    return { offer, entitlement: ent, active: isActive(offer, ent, sub) };
  };
  return Object.fromEntries(codes.map((code) => {
    const mine = own(code);
    if (mine.offer?.active) for (const o of offers.filter((x) => includesOf(x).includes(code))) {
      const via = own(o.code);
      // a paid tier that includes this one wins over its free form (Basic shows as reached through Pro)
      if (via.active && (!mine.active || isFree(mine.offer))) return [code, { offer: mine.offer, entitlement: via.entitlement, active: true, via: o.code, subscription: sub }];
    }
    return [code, { ...mine, via: null as string | null, subscription: sub }];
  })) as Record<string, { offer: Offer | null; entitlement: Ent | null; active: boolean; via: string | null; subscription: Sub }>;
}
