// One place that works out what a basket costs: lines, discount code, delivery. The cart, the checkout and the order
// that gets saved all use it, so the numbers can never disagree.
import type { Discount, Doc, Product } from './types';

export type Line = { product: Product; qty: number };
export type CodeProblem = 'unknown' | 'inactive' | 'min';
export interface Totals { subtotal: number; discount: number; delivery: number; total: number; code: Discount | null; problem: CodeProblem | null; count: number }

export function findCode(doc: Doc, code: string | null) {
  if (!code) return null;
  const c = code.trim().toUpperCase();
  return doc.discounts.find((d) => d.code.toUpperCase() === c) ?? null;
}

export function totals(doc: Doc, lines: Line[], code: string | null): Totals {
  const subtotal = lines.reduce((s, l) => s + l.product.price * l.qty, 0);
  const count = lines.reduce((s, l) => s + l.qty, 0);
  const d = findCode(doc, code);
  let discount = 0, problem: CodeProblem | null = null;
  if (code && !d) problem = 'unknown';
  else if (d && !d.active) problem = 'inactive';
  else if (d && subtotal < d.minTotal) problem = 'min';
  else if (d) discount = Math.min(subtotal, d.kind === 'percent' ? Math.round((subtotal * d.value) / 100) : d.value);
  const after = subtotal - discount, { fee, freeOver } = doc.settings.delivery;
  const delivery = lines.length === 0 || after >= freeOver ? 0 : fee;
  return { subtotal, discount, delivery, total: after + delivery, code: problem ? null : d, problem, count };
}

/** How far a basket is from free delivery (0 when it's already free). */
export const toFree = (doc: Doc, t: Totals) => Math.max(0, doc.settings.delivery.freeOver - (t.subtotal - t.discount));
