// Turning a basket into an order, and finding an order by its number. Kept apart from the control panel's actions so
// the shop only downloads what checkout needs.
import { change, doc } from './store';
import { totals, type Line } from './pricing';
import type { Order } from './types';

export type PlaceProblem = 'empty' | 'stock' | 'code';
/**
 * Turns the basket into an order: checks stock against the shop as it is right now, applies the code, takes the items
 * out of stock, counts the code's use. Returns the order, or what stopped it.
 */
export function placeOrder(lines: Line[], code: string | null, customer: Order['customer'], pay: Order['pay']): Order | PlaceProblem {
  if (!lines.length) return 'empty';
  // checked against the shop as it is now (another tab may have changed stock or the code), before anything changes
  const check = (d: typeof doc.value) => lines.map((l) => ({ product: d.products.find((p) => p.id === l.product.id), qty: l.qty }));
  const now0 = check(doc.value);
  if (now0.some((l) => !l.product || !l.product.active || l.product.stock < l.qty)) return 'stock';
  if (code && totals(doc.value, now0 as Line[], code).problem) return 'code';
  return change((d): Order => {
    const fresh = check(d), t = totals(d, fresh as Line[], code);
    const now = Date.now(), no = d.nextOrderNo++;
    const order: Order = {
      id: `o-${no}`, no, createdAt: now, status: 'new', customer,
      lines: fresh.map((l) => ({ productId: l.product!.id, name: l.product!.name, price: l.product!.price, qty: l.qty, pic: l.product!.pics[0] ?? '' })),
      subtotal: t.subtotal, discount: t.discount, code: t.code?.code ?? null, delivery: t.delivery, total: t.total, pay,
      history: [{ status: 'new', at: now }],
    };
    for (const l of fresh) l.product!.stock -= l.qty;
    if (t.code) d.discounts.find((x) => x.id === t.code!.id)!.uses++;
    d.orders.unshift(order);
    return order;
  }, { now: true });
}
export const orderByNo = (no: number) => doc.value.orders.find((o) => o.no === no) ?? null;
