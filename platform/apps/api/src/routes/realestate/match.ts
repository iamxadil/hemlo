// The matcher: does this property suit this buyer (or tenant), and why. Pure (no database), so it's the same everywhere
// and easy to test. Only what the lead actually asked for counts: a lead who gave a budget and an area is scored on those
// two, not punished for saying nothing about bathrooms. Hard rules first (buy vs rent, the kind of property, far over
// budget), then a weighted score where each criterion fits fully, nearly, or not at all — and says so.

export type LeadWants = {
  purpose: string; types: string[]; areas: string[]; city: string | null;
  budgetMin: number | null; budgetMax: number | null; currency: string;
  bedrooms: number | null; bathrooms: number | null; sizeMin: number | null; sizeMax: number | null; must: string[];
};
export type PropertyFacts = {
  purpose: string; type: string; status: string; area: string | null; city: string | null;
  price: number | null; currency: string; bedrooms: number | null; bathrooms: number | null; size: number | null; features: string[];
};
export type Criterion = 'type' | 'price' | 'location' | 'bedrooms' | 'bathrooms' | 'size' | 'features';
export type Reason = { key: Criterion; fit: 'yes' | 'near' | 'no' };
export type Match = { score: number; reasons: Reason[] };

/** How much each criterion matters (only the ones the lead gave are counted). */
export const WEIGHTS: Record<Criterion, number> = { price: 30, type: 25, location: 20, bedrooms: 10, size: 10, bathrooms: 5, features: 10 };
/** Over budget by more than this, it isn't a match at all. */
export const OVER_BUDGET = 0.15;
/** Below this score a property isn't offered as a match. */
export const MIN_SCORE = 60;
/** Statuses a buyer may still be offered (a reserved or sold home is never suggested). */
export const MATCHABLE = ['available', 'negotiating'];

/** Arabic and English place names written many ways: ignore case, spaces, "al-", hamzas and tā' marbūṭa. */
export const placeKey = (s: string | null | undefined) => (s ?? '').toLowerCase().normalize('NFKC')
  .replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/[ًٌٍَُِّْـ]/g, '')
  .replace(/^(al[\s-]+|ال)/, '').replace(/[\s\-_'’.]/g, '');

/** A price in the lead's currency (Iraqi listings are in dollars or dinars; one rate for the agency). */
export function inCurrency(amount: number, from: string, to: string, usdRate: number) {
  if (from === to) return amount;
  return from === 'USD' ? amount * usdRate : amount / usdRate;
}

function priceFit(price: number, min: number | null, max: number | null): Reason['fit'] | null {
  if (max != null && price > max) return price <= max * (1 + OVER_BUDGET / 2) ? 'near' : 'no';
  if (min != null && price < min * 0.7) return 'near'; // much cheaper than they meant: may be a different class of home
  return 'yes';
}
const atLeast = (have: number | null, want: number): Reason['fit'] => (have == null ? 'near' : have >= want ? 'yes' : have === want - 1 ? 'near' : 'no');
const FIT = { yes: 1, near: 0.5, no: 0 } as const;

/** null: not a match at all. Otherwise a score from 0 to 100 and the reasons, in order of weight. */
export function matchOf(lead: LeadWants, p: PropertyFacts, usdRate = 1450): Match | null {
  if (p.purpose !== lead.purpose) return null;
  if (!MATCHABLE.includes(p.status)) return null;
  if (lead.types.length && !lead.types.includes(p.type)) return null;
  const reasons: Reason[] = [];
  if (lead.types.length) reasons.push({ key: 'type', fit: 'yes' });

  if (lead.budgetMax != null || lead.budgetMin != null) {
    if (p.price == null) reasons.push({ key: 'price', fit: 'near' }); // "price on request"
    else {
      const price = inCurrency(p.price, p.currency, lead.currency, usdRate);
      if (lead.budgetMax != null && price > lead.budgetMax * (1 + OVER_BUDGET)) return null;
      reasons.push({ key: 'price', fit: priceFit(price, lead.budgetMin, lead.budgetMax)! });
    }
  }
  if (lead.areas.length || lead.city) {
    const area = placeKey(p.area), city = placeKey(p.city);
    const inArea = lead.areas.some((a) => { const k = placeKey(a); return !!k && (k === area || k === city || (!!area && (area.includes(k) || k.includes(area)))); });
    const inCity = !!lead.city && placeKey(lead.city) === city;
    // areas named: in one of them fits, elsewhere in their city nearly does; only a city named: in that city fits
    const fit: Reason['fit'] = lead.areas.length ? (inArea ? 'yes' : inCity ? 'near' : 'no') : inCity ? 'yes' : 'no';
    reasons.push({ key: 'location', fit });
  }
  if (lead.bedrooms != null) reasons.push({ key: 'bedrooms', fit: atLeast(p.bedrooms, lead.bedrooms) });
  if (lead.sizeMin != null || lead.sizeMax != null) {
    const s = p.size;
    reasons.push({ key: 'size', fit: s == null ? 'near' : lead.sizeMin != null && s < lead.sizeMin ? (s >= lead.sizeMin * 0.85 ? 'near' : 'no') : lead.sizeMax != null && s > lead.sizeMax * 1.25 ? 'near' : 'yes' });
  }
  if (lead.bathrooms != null) reasons.push({ key: 'bathrooms', fit: atLeast(p.bathrooms, lead.bathrooms) });
  if (lead.must.length) {
    const have = new Set(p.features.map((f) => f.toLowerCase()));
    const got = lead.must.filter((m) => have.has(m.toLowerCase())).length / lead.must.length;
    reasons.push({ key: 'features', fit: got === 1 ? 'yes' : got >= 0.5 ? 'near' : 'no' });
  }
  if (!reasons.length) return { score: 50, reasons }; // they told us nothing beyond buy/rent: possible, not a strong match
  const total = reasons.reduce((n, r) => n + WEIGHTS[r.key], 0);
  const got = reasons.reduce((n, r) => n + WEIGHTS[r.key] * FIT[r.fit], 0);
  reasons.sort((a, b) => WEIGHTS[b.key] - WEIGHTS[a.key]);
  return { score: Math.round((got / total) * 100), reasons };
}

/** The best matches first; only real ones (MIN_SCORE and above). */
export function rank<T extends PropertyFacts>(lead: LeadWants, list: T[], usdRate?: number, min = MIN_SCORE) {
  return list.map((p) => ({ p, m: matchOf(lead, p, usdRate) })).filter((x): x is { p: T; m: Match } => !!x.m && x.m.score >= min).sort((a, b) => b.m.score - a.m.score);
}
