// Money and dates in the visitor's language and the shop's currency; the shop's colours from its settings.
import { effect } from '@preact/signals';
import { lang } from './i18n';
import { money } from './money';
import { doc } from './store';

export const price = (minor: number) => money(minor, doc.value.settings.currency, lang.value);

const dates = new Map<string, Intl.DateTimeFormat>();
const df = (key: string, o: Intl.DateTimeFormatOptions) => {
  const k = lang.value + key;
  let f = dates.get(k);
  if (!f) { f = new Intl.DateTimeFormat(lang.value === 'ar' ? 'ar-IQ-u-nu-latn' : 'en-GB', o); dates.set(k, f); }
  return f;
};
export const day = (t: number) => df('d', { day: 'numeric', month: 'short', year: 'numeric' }).format(t);
export const when = (t: number) => df('w', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(t);
/** "5 min ago", "3 h ago", or the date. */
export function ago(t: number) {
  const m = Math.round((Date.now() - t) / 60000), ar = lang.value === 'ar';
  if (m < 1) return ar ? 'الآن' : 'just now';
  if (m < 60) return ar ? `قبل ${m} د` : `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return ar ? `قبل ${h} س` : `${h} h ago`;
  return day(t);
}

/** Paints the shop's theme (accent, ink, paper, corner radius) as CSS variables; runs again whenever settings change. */
export function startTheme() {
  effect(() => {
    const { accent, ink, paper, radius } = doc.value.settings.theme, r = document.documentElement.style;
    r.setProperty('--accent', accent); r.setProperty('--ink', ink); r.setProperty('--paper', paper); r.setProperty('--radius', `${radius}px`);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', paper);
  });
}
