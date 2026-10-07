// The visitor's basket: product ids and quantities, kept in localStorage (small, and readable before the page draws)
// and shared live between tabs. Prices always come from the current document, so a price changed in the control panel
// changes the basket too.
import { computed, effect, signal } from '@preact/signals';
import { doc, productById } from './store';
import { totals, type Line } from './pricing';

type Item = { id: string; qty: number };
const KEY = 'hemlo-demo-cart';

const read = (): { items: Item[]; code: string | null } => {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? ''); return { items: Array.isArray(v.items) ? v.items : [], code: v.code ?? null }; } catch { return { items: [], code: null }; }
};
const start = read();
export const items = signal<Item[]>(start.items);
export const code = signal<string | null>(start.code);
export const cartOpen = signal(false);

let writing = false;
effect(() => {
  const v = JSON.stringify({ items: items.value, code: code.value });
  writing = true;
  try { localStorage.setItem(KEY, v); } catch { /* storage full or blocked: the basket still works for this visit */ }
  writing = false;
});
addEventListener('storage', (e) => { if (e.key === KEY && !writing) { const v = read(); items.value = v.items; code.value = v.code; } });

/** The basket as lines with live products; anything deleted or switched off in the control panel drops out. */
export const lines = computed<Line[]>(() => {
  const by = productById.value;
  return items.value.flatMap((i) => { const p = by.get(i.id); return p && p.active ? [{ product: p, qty: Math.min(i.qty, Math.max(p.stock, 0)) }] : []; }).filter((l) => l.qty > 0);
});
export const cartTotals = computed(() => totals(doc.value, lines.value, code.value));

export function add(id: string, qty = 1) {
  const p = productById.value.get(id); if (!p) return;
  const have = items.value.find((i) => i.id === id)?.qty ?? 0, next = Math.min(p.stock, have + qty);
  items.value = have ? items.value.map((i) => (i.id === id ? { ...i, qty: next } : i)) : [...items.value, { id, qty: next }];
}
export function setQty(id: string, qty: number) {
  items.value = qty <= 0 ? items.value.filter((i) => i.id !== id) : items.value.map((i) => (i.id === id ? { ...i, qty } : i));
}
export function emptyCart() { items.value = []; code.value = null; }
