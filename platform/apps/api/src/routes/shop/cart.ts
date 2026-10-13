// The online shop's money: a cart priced from the shop's live catalogue (never from what the browser says), its
// delivery fee from the shop's own rules, and an order filed from it. Shared by the site's bag, its checkout, and the
// order itself, so the customer sees exactly what they will be asked to pay.
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { newId, normalizeIraqiPhone } from '@hemlo/core';
import type { Database } from '@hemlo/db';
import { shopOrder, shopOrderLine, sysProduct, sysSequence, type WebShop } from '@hemlo/db/schema';
import { HttpError } from '../../principal';
import { round3 } from '../sys-common';
import { customerByPhone } from '../../connect/store';

export type CartIn = { id: string; qty: number }[];
export type Priced = {
  lines: { id: string; slug: string | null; name: string; price: number; qty: number; total: number; imageId: string | null; unit: string; left: number | null; short: boolean }[];
  subtotal: number; fee: number; total: number; minOrder: number | null; freeOver: number | null;
  delivery: 'delivery' | 'pickup'; canDeliver: boolean; canPickup: boolean; ok: boolean; problem: string | null;
};

/** A cart from the browser: at most 40 lines, a positive amount each (to the gram for what's sold by weight). */
export function cartIn(v: unknown): CartIn {
  if (!Array.isArray(v) || !v.length || v.length > 40) throw new HttpError(400, 'BAD_CART');
  const seen = new Map<string, number>();
  for (const x of v as any[]) {
    const id = typeof x?.id === 'string' && /^[\w-]{4,64}$/.test(x.id) ? x.id : null, qty = round3(Number(x?.qty));
    if (!id || !Number.isFinite(qty) || qty <= 0 || qty > 999) throw new HttpError(400, 'BAD_CART');
    seen.set(id, round3((seen.get(id) ?? 0) + qty));
  }
  return [...seen].map(([id, qty]) => ({ id, qty }));
}

const feeFor = (s: WebShop, city: string | null) => {
  const own = city ? (s.fees ?? []).find((f) => f.city.trim().toLowerCase() === city.trim().toLowerCase()) : null;
  return Math.max(0, Math.round(own?.fee ?? s.fee ?? 0));
};

/** The cart as the shop sells it now: online products only, today's prices, what's left in stock. */
export async function priceCart(tx: Database, org: string, shop: WebShop | undefined, cart: CartIn, opts: { city?: string | null; delivery?: string | null } = {}): Promise<Priced> {
  const s = shop ?? {};
  const canDeliver = s.delivery !== false, canPickup = !!s.pickup;
  const delivery = opts.delivery === 'pickup' && canPickup ? 'pickup' as const : canDeliver ? 'delivery' as const : 'pickup' as const;
  const rows = await tx.select().from(sysProduct).where(and(eq(sysProduct.organizationId, org), inArray(sysProduct.id, cart.map((x) => x.id)), isNull(sysProduct.archivedAt), eq(sysProduct.online, true)));
  const lines = cart.map((x) => rows.find((p) => p.id === x.id)).map((p, i) => {
    if (!p) return null;
    const qty = p.unit === 'piece' || p.unit === 'box' || p.unit === 'pack' ? Math.max(1, Math.round(cart[i].qty)) : cart[i].qty;
    const left = p.trackStock ? Math.max(0, Number(p.stock)) : null;
    return { id: p.id, slug: p.slug, name: p.name, price: p.price, qty, total: Math.round(qty * p.price), imageId: p.imageId, unit: p.unit, left, short: left != null && qty > left };
  }).filter(Boolean) as Priced['lines'];
  const subtotal = lines.reduce((n, l) => n + l.total, 0);
  const free = s.freeOver != null && s.freeOver > 0 && subtotal >= s.freeOver;
  const fee = delivery === 'delivery' && !free ? feeFor(s, opts.city ?? null) : 0;
  const minOrder = s.minOrder && s.minOrder > 0 ? s.minOrder : null;
  const problem = !lines.length ? 'EMPTY_CART' : lines.some((l) => l.short) ? 'OUT_OF_STOCK' : minOrder && subtotal < minOrder ? 'BELOW_MINIMUM'
    : !canDeliver && !canPickup ? 'SHOP_CLOSED' : delivery === 'delivery' && s.cities?.length && opts.city && !s.cities.some((c) => c.trim().toLowerCase() === opts.city!.trim().toLowerCase()) ? 'NO_DELIVERY_THERE' : null;
  return { lines, subtotal, fee, total: subtotal + fee, minOrder, freeOver: s.freeOver ?? null, delivery, canDeliver, canPickup, ok: !problem, problem };
}

const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
const orderCode = () => { const b = crypto.getRandomValues(new Uint8Array(12)); return [...b].map((x) => ALPHABET[x % ALPHABET.length]).join(''); };
const words = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) || null : null);

/** An order, from a priced cart and who it's for. Nothing leaves stock yet: it does when the order is delivered (a sale). */
export async function placeOrder(tx: Database, org: string, shop: WebShop | undefined, b: any) {
  const cart = cartIn(b?.lines);
  const name = words(b?.name, 80), phone = normalizeIraqiPhone(String(b?.phone ?? ''));
  if (!name || name.length < 2) throw new HttpError(400, 'BAD_NAME');
  if (!phone) throw new HttpError(400, 'BAD_PHONE');
  const city = words(b?.city, 60), area = words(b?.area, 80), address = words(b?.address, 240), note = words(b?.note, 400);
  const priced = await priceCart(tx, org, shop, cart, { city, delivery: b?.delivery });
  if (!priced.ok) throw new HttpError(409, priced.problem!);
  if (priced.delivery === 'delivery' && (!city || !address)) throw new HttpError(400, 'BAD_ADDRESS');
  const [seq] = await tx.insert(sysSequence).values({ organizationId: org, name: 'order', value: 1 })
    .onConflictDoUpdate({ target: [sysSequence.organizationId, sysSequence.name], set: { value: sql`${sysSequence.value} + 1` } }).returning();
  const customer = await customerByPhone(tx, org, phone);
  const id = newId();
  const [order] = await tx.insert(shopOrder).values({ id, organizationId: org, number: seq.value, code: orderCode(), name, phone, delivery: priced.delivery, city, area, address, note,
    subtotal: priced.subtotal, deliveryFee: priced.fee, total: priced.total, lang: b?.lang === 'en' ? 'en' : 'ar', customerId: customer?.id ?? null }).returning();
  await tx.insert(shopOrderLine).values(priced.lines.map((l) => ({ id: newId(), organizationId: org, orderId: id, productId: l.id, name: l.name, qty: l.qty, price: l.price, total: l.total })));
  return order;
}
