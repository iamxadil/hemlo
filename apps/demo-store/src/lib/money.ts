// Money in the shop's one currency, kept as whole minor units (IQD: dinars, JOD: fils, USD: cents).
import type { Currency, Lang } from './types';

export const DECIMALS: Record<Currency, number> = { IQD: 0, JOD: 3, USD: 2 };
/** How much one US dollar is, for switching the demo between markets. */
const PER_USD: Record<Currency, number> = { IQD: 1310, JOD: 0.709, USD: 1 };
/** Prices look human after a switch: IQD to the nearest 250, JOD to the nearest 0.250, USD to whole dollars. */
const STEP: Record<Currency, number> = { IQD: 250, JOD: 250, USD: 100 };

const formats = new Map<string, Intl.NumberFormat>();
const nf = (lang: Lang, cur: Currency) => {
  const k = lang + cur;
  let f = formats.get(k);
  if (!f) {
    // whole amounts show no decimals (32 JOD, not 32.000); fils and cents show only when there are some
    f = new Intl.NumberFormat(lang === 'ar' ? 'ar-IQ-u-nu-latn' : 'en-US', { minimumFractionDigits: 0, maximumFractionDigits: DECIMALS[cur] });
    formats.set(k, f);
  }
  return f;
};
const SIGN: Record<Lang, Record<Currency, string>> = {
  ar: { IQD: 'د.ع', JOD: 'د.أ', USD: '$' },
  en: { IQD: 'IQD', JOD: 'JOD', USD: '$' },
};

export const toMajor = (minor: number, cur: Currency) => minor / 10 ** DECIMALS[cur];
export const toMinor = (major: number, cur: Currency) => Math.round(major * 10 ** DECIMALS[cur]);

/** "45,000 د.ع", "32.5 JOD", "$34". */
export function money(minor: number, cur: Currency, lang: Lang) {
  const n = nf(lang, cur).format(toMajor(minor, cur)), s = SIGN[lang][cur];
  return cur === 'USD' ? (lang === 'ar' ? `${n} $` : `$${n}`) : `${n} ${s}`;
}
export const sign = (cur: Currency, lang: Lang) => SIGN[lang][cur];

/** An amount moved from one currency to another, rounded to a price a shop would actually use. */
export function convert(minor: number, from: Currency, to: Currency) {
  if (from === to) return minor;
  const major = (toMajor(minor, from) / PER_USD[from]) * PER_USD[to];
  const m = toMinor(major, to), step = STEP[to];
  return Math.max(step, Math.round(m / step) * step);
}
