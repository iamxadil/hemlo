// Everything that changes the shop, in one place: the control panel and the checkout call these, never `change()`
// directly, so the rules (stock, codes, order numbers, history) live once.
import { change } from './store';
import { uid, slugify } from './id';
import { convert } from './money';
import type { Banner, Category, Currency, Discount, OrderStatus, Product, Settings } from './types';

// ---- products ----
export function blankProduct(categoryId: string): Product {
  return {
    id: '', slug: '', categoryId, name: { ar: '', en: '' }, short: { ar: '', en: '' }, body: { ar: '', en: '' },
    notes: [], price: 0, compareAt: null, stock: 0, sku: '', pics: [], size: '', featured: false, active: true, createdAt: 0,
  };
}
/** Saves a new or edited product; gives it an id and a unique URL name. Returns its id. */
export function saveProduct(p: Product) {
  return change((d) => {
    const id = p.id || `p-${uid()}`;
    const taken = new Set(d.products.filter((x) => x.id !== id).map((x) => x.slug));
    let slug = slugify(p.slug || p.name.en || p.name.ar), n = 2;
    while (taken.has(slug)) slug = `${slugify(p.slug || p.name.en || p.name.ar)}-${n++}`;
    const next: Product = { ...p, id, slug, createdAt: p.createdAt || Date.now(), sku: p.sku || `LY-${d.products.length + 101}` };
    const i = d.products.findIndex((x) => x.id === id);
    if (i >= 0) d.products[i] = next; else d.products.unshift(next);
    return id;
  });
}
export const deleteProduct = (id: string) => change((d) => { d.products = d.products.filter((p) => p.id !== id); });
export const toggleProduct = (id: string, key: 'active' | 'featured') => change((d) => { const p = d.products.find((x) => x.id === id); if (p) p[key] = !p[key]; });

// ---- categories, banners, discounts ----
export function saveCategory(c: Category) {
  return change((d) => {
    const id = c.id || `c-${uid()}`, next = { ...c, id, slug: c.slug || slugify(c.name.en || c.name.ar), order: c.id ? c.order : d.categories.length };
    const i = d.categories.findIndex((x) => x.id === id);
    if (i >= 0) d.categories[i] = next; else d.categories.push(next);
    return id;
  });
}
export const moveCategory = (id: string, by: -1 | 1) => change((d) => {
  const list = [...d.categories].sort((a, b) => a.order - b.order), i = list.findIndex((c) => c.id === id), j = i + by;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  list.forEach((c, k) => { d.categories.find((x) => x.id === c.id)!.order = k; });
});
/** A category can go only when it's empty, so no product is left without a home. */
export const deleteCategory = (id: string) => change((d) => {
  if (d.products.some((p) => p.categoryId === id)) return false;
  d.categories = d.categories.filter((c) => c.id !== id);
  return true;
});

export function saveBanner(b: Banner) {
  return change((d) => {
    const id = b.id || `b-${uid()}`, i = d.banners.findIndex((x) => x.id === id);
    if (i >= 0) d.banners[i] = { ...b, id }; else d.banners.push({ ...b, id });
    return id;
  });
}
export const deleteBanner = (id: string) => change((d) => { d.banners = d.banners.filter((b) => b.id !== id); });
export const moveBanner = (id: string, by: -1 | 1) => change((d) => {
  const i = d.banners.findIndex((b) => b.id === id), j = i + by;
  if (i >= 0 && j >= 0 && j < d.banners.length) [d.banners[i], d.banners[j]] = [d.banners[j], d.banners[i]];
});

/** Saves a discount code; codes are unique and upper-case. Returns false when the code is already used by another. */
export function saveDiscount(x: Discount) {
  return change((d) => {
    const code = x.code.trim().toUpperCase().replace(/\s+/g, '');
    if (!code || d.discounts.some((o) => o.id !== x.id && o.code === code)) return false;
    const id = x.id || `d-${uid()}`, i = d.discounts.findIndex((o) => o.id === id);
    if (i >= 0) d.discounts[i] = { ...x, id, code }; else d.discounts.push({ ...x, id, code });
    return true;
  });
}
export const deleteDiscount = (id: string) => change((d) => { d.discounts = d.discounts.filter((x) => x.id !== id); });

// ---- settings ----
export const saveSettings = (s: Partial<Settings>) => change((d) => { d.settings = { ...d.settings, ...s }; });
/** Moves the whole shop to another currency: every price, fee, threshold and fixed discount, rounded like a shop would. */
export function setCurrency(to: Currency) {
  change((d) => {
    const from = d.settings.currency; if (from === to) return;
    const c = (v: number) => convert(v, from, to);
    for (const p of d.products) { p.price = c(p.price); p.compareAt = p.compareAt == null ? null : c(p.compareAt); }
    for (const x of d.discounts) { x.minTotal = c(x.minTotal); if (x.kind === 'fixed') x.value = c(x.value); }
    d.settings.delivery = { fee: c(d.settings.delivery.fee), freeOver: c(d.settings.delivery.freeOver) };
    d.settings.currency = to;
  });
}

// ---- orders ----
export const setOrderStatus = (id: string, status: OrderStatus) => change((d) => {
  const o = d.orders.find((x) => x.id === id);
  if (!o || o.status === status) return;
  if (status === 'canceled' && o.status !== 'canceled') for (const l of o.lines) { const p = d.products.find((x) => x.id === l.productId); if (p) p.stock += l.qty; }
  o.status = status; o.history.push({ status, at: Date.now() });
});
