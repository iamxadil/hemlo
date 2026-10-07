// Search that forgives the way people type: Arabic letters that are often swapped (أ إ آ ا, ة ه, ى ي), diacritics,
// and upper/lower case. Matches every word typed, in either language.
import type { Product } from './types';

export const norm = (s: string) =>
  s.toLowerCase().normalize('NFKD').replace(/[ً-ٰٟـ̀-ͯ]/g, '')
    .replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي');

const index = new WeakMap<Product, string>();
const hay = (p: Product) => {
  let h = index.get(p);
  if (!h) { h = norm([p.name.ar, p.name.en, p.short.ar, p.short.en, p.sku, ...p.notes.flatMap((n) => [n.ar, n.en])].join(' ')); index.set(p, h); }
  return h;
};

export function search(list: Product[], q: string) {
  const words = norm(q).split(/\s+/).filter(Boolean);
  if (!words.length) return list;
  return list.filter((p) => { const h = hay(p); return words.every((w) => h.includes(w)); });
}
