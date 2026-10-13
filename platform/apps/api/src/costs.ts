// What things cost Hemlo, as the team entered them in admin (hemlo_setting "costs"). Nothing here is a guess: a rate
// that isn't entered is unknown (null), and the margin report says so instead of pretending it's zero.
import { eq } from 'drizzle-orm';
import { withSystem, type Database } from '@hemlo/db';
import { hemloSetting, type CostSettings } from '@hemlo/db/schema';

export type WaCategory = 'marketing' | 'utility' | 'service';
let cache: { at: number; costs: CostSettings } | null = null;
export const forgetCosts = () => { cache = null; };

export async function costsOf(db: Database): Promise<CostSettings> {
  if (cache && Date.now() - cache.at < 60_000) return cache.costs;
  const [row] = await withSystem(db, (tx) => tx.select().from(hemloSetting).where(eq(hemloSetting.key, 'costs')));
  const costs = (row?.value ?? {}) as CostSettings;
  cache = { at: Date.now(), costs };
  return costs;
}

/** The country a WhatsApp number belongs to, as far as the rates care: Iraq, or everyone else. */
export const countryOf = (phone: string) => (/^\+?964/.test(phone.replace(/\s/g, '')) ? 'IQ' : 'other');

/** What one message out costs, in IQD: a template by its category, a reply inside the 24-hour window as "service". */
export function waCost(costs: CostSettings, phone: string, category: WaCategory) {
  const rates = costs.waRates ?? {};
  const r = rates[countryOf(phone)] ?? rates.other ?? {};
  const v = Number(r[category]);
  return Number.isFinite(v) && v > 0 ? Math.round(v) : 0;
}

/** US dollars (as millionths) in IQD, or null while the dollar rate isn't entered. */
export const usdToIqd = (costs: CostSettings, micros: number) => (costs.usdIqd && costs.usdIqd > 0 ? Math.round((micros / 1_000_000) * costs.usdIqd) : null);
