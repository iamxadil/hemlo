// /v1/shop: the online shop's orders in the System, and its checkout rules. An order moves new → confirmed → (ready to
// collect | out for delivery) → delivered, or is canceled; the customer hears each step on WhatsApp (Connect), and a
// delivered order becomes a sale: the goods leave stock, the profit is counted, the customer's history has it.
import { Hono } from 'hono';
import { and, desc, eq, inArray, lt, sql } from 'drizzle-orm';
import { newId } from '@hemlo/core';
import { withOrg } from '@hemlo/db';
import { shopOrder, shopOrderLine, sysProduct, sysSale, sysSaleLine, sysSequence, sysStockMove, webSite, type WebShop } from '@hemlo/db/schema';
import { HttpError } from '../../principal';
import { actor, bad, openShiftId, round3 } from '../sys-common';
import { fileUrl } from '../../files';
import { onOrder } from '../../connect/core';
import { shopOrigin } from '../../connect/store';
import type { AppEnv, Deps } from '../../types';

const NEXT: Record<string, string[]> = {
  new: ['confirmed', 'canceled'],
  confirmed: ['ready', 'out', 'delivered', 'canceled'],
  ready: ['delivered', 'canceled'],
  out: ['delivered', 'canceled'],
};
export const OPEN = ['new', 'confirmed', 'ready', 'out'];

/** The checkout's rules from what the shop typed: fees in whole dinars, a few cities, nothing unbounded. */
export function shopIn(v: any): WebShop {
  const n = (x: unknown, max = 10_000_000) => (x == null || x === '' ? null : Number.isInteger(Number(x)) && Number(x) >= 0 && Number(x) <= max ? Number(x) : bad('BAD_AMOUNT'));
  const city = (x: unknown) => (typeof x === 'string' ? x.trim().slice(0, 60) : '');
  const s: WebShop = { delivery: v?.delivery !== false, pickup: !!v?.pickup, fee: n(v?.fee) ?? 0, freeOver: n(v?.freeOver), minOrder: n(v?.minOrder) };
  if (Array.isArray(v?.fees)) s.fees = v.fees.slice(0, 30).map((f: any) => ({ city: city(f?.city), fee: n(f?.fee) ?? 0 })).filter((f: any) => f.city);
  if (Array.isArray(v?.cities)) s.cities = [...new Set(v.cities.slice(0, 40).map(city).filter(Boolean))] as string[];
  if (v?.note && typeof v.note === 'object') s.note = { ar: typeof v.note.ar === 'string' ? v.note.ar.slice(0, 200) : undefined, en: typeof v.note.en === 'string' ? v.note.en.slice(0, 200) : undefined };
  return s;
}

export function shopRoutes(d: Deps) {
  const r = new Hono<AppEnv>();

  /** The orders: the open ones (oldest waiting first), or the finished ones (newest first), 40 at a time. */
  r.get('/orders', async (c) => {
    const a = actor(c, 'orders', 'read');
    const view = c.req.query('view') === 'done' ? 'done' : 'open', before = c.req.query('before');
    const rows = await withOrg(d.db, a.organizationId, async (tx) => {
      const list = await tx.select().from(shopOrder).where(and(eq(shopOrder.organizationId, a.organizationId),
        view === 'open' ? inArray(shopOrder.status, OPEN) : inArray(shopOrder.status, ['delivered', 'canceled']),
        ...(before && !Number.isNaN(Date.parse(before)) ? [lt(shopOrder.createdAt, new Date(before))] : [])))
        .orderBy(view === 'open' ? shopOrder.createdAt : desc(shopOrder.createdAt)).limit(40);
      const lines = list.length ? await tx.select({ orderId: shopOrderLine.orderId, name: shopOrderLine.name, qty: shopOrderLine.qty }).from(shopOrderLine).where(inArray(shopOrderLine.orderId, list.map((o) => o.id))) : [];
      return list.map((o) => ({ ...o, items: lines.filter((l) => l.orderId === o.id).map((l) => ({ name: l.name, qty: l.qty })) }));
    });
    return c.json({ orders: rows, more: rows.length === 40 });
  });

  /** How many orders wait on the shop (the badge in the menu). */
  r.get('/orders/count', async (c) => {
    const a = actor(c, 'orders', 'read');
    const [x] = await withOrg(d.db, a.organizationId, (tx) => tx.select({ n: sql<number>`count(*)::int`, fresh: sql<number>`count(*) filter (where ${shopOrder.status} = 'new')::int` })
      .from(shopOrder).where(and(eq(shopOrder.organizationId, a.organizationId), inArray(shopOrder.status, OPEN))));
    return c.json({ open: Number(x?.n ?? 0), new: Number(x?.fresh ?? 0) });
  });

  r.get('/orders/:id', async (c) => {
    const a = actor(c, 'orders', 'read');
    const out = await withOrg(d.db, a.organizationId, async (tx) => {
      const [o] = await tx.select().from(shopOrder).where(and(eq(shopOrder.organizationId, a.organizationId), eq(shopOrder.id, c.req.param('id'))));
      if (!o) throw new HttpError(404, 'ORDER_NOT_FOUND');
      const lines = await tx.select({ id: shopOrderLine.id, productId: shopOrderLine.productId, name: shopOrderLine.name, qty: shopOrderLine.qty, price: shopOrderLine.price, total: shopOrderLine.total,
        imageId: sysProduct.imageId, stock: sysProduct.stock, trackStock: sysProduct.trackStock, unit: sysProduct.unit })
        .from(shopOrderLine).leftJoin(sysProduct, eq(sysProduct.id, shopOrderLine.productId)).where(eq(shopOrderLine.orderId, o.id));
      return { o, lines, origin: await shopOrigin(tx, a.organizationId) };
    });
    const lines = await Promise.all(out.lines.map(async (l) => ({ ...l, image: l.imageId ? await fileUrl(d.env, a.organizationId, l.imageId) : null })));
    return c.json({ order: out.o, lines, link: out.origin ? `${out.origin}/order/${out.o.code}` : null });
  });

  /** Move an order along. Delivered: it becomes a sale (paid in cash on delivery). The customer hears every step. */
  r.patch('/orders/:id', async (c) => {
    const a = actor(c, 'orders', 'manage');
    const b = await c.req.json<{ status?: string; reason?: string }>().catch(() => ({} as any));
    const status = String(b.status ?? '');
    const order = await withOrg(d.db, a.organizationId, async (tx) => {
      const [o] = await tx.select().from(shopOrder).where(and(eq(shopOrder.organizationId, a.organizationId), eq(shopOrder.id, c.req.param('id')))).for('update');
      if (!o) throw new HttpError(404, 'ORDER_NOT_FOUND');
      if (!(NEXT[o.status] ?? []).includes(status)) throw new HttpError(409, 'BAD_STEP');
      if (status === 'ready' && o.delivery !== 'pickup') throw new HttpError(409, 'BAD_STEP');
      if (status === 'out' && o.delivery !== 'delivery') throw new HttpError(409, 'BAD_STEP');
      const now = new Date();
      const set: Partial<typeof shopOrder.$inferInsert> = { status, updatedAt: now };
      if (status === 'confirmed') set.confirmedAt = now;
      if (status === 'canceled') set.cancelReason = typeof b.reason === 'string' ? b.reason.trim().slice(0, 200) || null : null;
      if (status === 'delivered') {
        set.deliveredAt = now;
        set.saleId = await saleOf(tx, a, o, now);
      }
      const [row] = await tx.update(shopOrder).set(set).where(eq(shopOrder.id, o.id)).returning();
      return row;
    });
    const tell = () => onOrder(d, a.organizationId, order.id).catch((e) => console.error('[shop order]', e instanceof Error ? e.message : e));
    if (d.later) d.later(tell); else await tell();
    return c.json({ order });
  });

  /** The checkout's rules (delivery, fees, pickup, the smallest order): applied on the site at once. */
  r.get('/settings', async (c) => {
    const a = actor(c, 'orders', 'read');
    const [s] = await withOrg(d.db, a.organizationId, (tx) => tx.select({ settings: webSite.settings }).from(webSite).where(eq(webSite.organizationId, a.organizationId)));
    return c.json({ shop: s?.settings?.shop ?? { delivery: true, pickup: false, fee: 0 } });
  });
  r.put('/settings', async (c) => {
    const a = actor(c, 'website', 'manage');
    const shop = shopIn(await c.req.json().catch(() => ({})));
    const [row] = await withOrg(d.db, a.organizationId, async (tx) => {
      const [cur] = await tx.select({ settings: webSite.settings }).from(webSite).where(eq(webSite.organizationId, a.organizationId));
      if (!cur) throw new HttpError(404, 'SITE_NOT_FOUND');
      return tx.update(webSite).set({ settings: { ...cur.settings, shop }, updatedAt: new Date() }).where(eq(webSite.organizationId, a.organizationId)).returning({ settings: webSite.settings });
    });
    return c.json({ shop: row.settings.shop });
  });

  return r;
}

/** A delivered order as a sale: its lines at the order's prices, out of stock, the profit counted; paid in cash. The
 *  delivery fee is noted on it (the courier usually keeps it); the sale is the goods. */
async function saleOf(tx: any, a: ReturnType<typeof actor>, o: typeof shopOrder.$inferSelect, now: Date) {
  const lines = await tx.select().from(shopOrderLine).where(eq(shopOrderLine.orderId, o.id));
  const ids = lines.map((l: any) => l.productId).filter(Boolean);
  const products = ids.length ? await tx.select().from(sysProduct).where(inArray(sysProduct.id, ids)) : [];
  const [seq] = await tx.insert(sysSequence).values({ organizationId: a.organizationId, name: 'sale', value: 1 })
    .onConflictDoUpdate({ target: [sysSequence.organizationId, sysSequence.name], set: { value: sql`${sysSequence.value} + 1` } }).returning();
  const saleId = newId();
  const rows = lines.map((l: any) => { const p = products.find((x: any) => x.id === l.productId); return { l, p, cost: Math.round(Number(l.qty) * (p?.cost ?? 0)) }; });
  const subtotal = lines.reduce((n: number, l: any) => n + l.total, 0);
  const note = `${o.lang === 'en' ? 'Online order' : 'طلب أونلاين'} #${o.number}${o.deliveryFee ? ` · ${o.lang === 'en' ? 'delivery' : 'توصيل'} ${o.deliveryFee}` : ''}`;
  await tx.insert(sysSale).values({ id: saleId, organizationId: a.organizationId, number: seq.value, clientId: `order:${o.id}`, userId: a.userId, deviceId: a.deviceId, customerId: o.customerId,
    subtotal, discount: 0, total: subtotal, paid: subtotal, due: 0, method: 'cash', cost: rows.reduce((n: number, x: any) => n + x.cost, 0), note, shiftId: await openShiftId(tx, a.deviceId), createdAt: now });
  await tx.insert(sysSaleLine).values(rows.map(({ l, p, cost }: any) => ({ id: newId(), organizationId: a.organizationId, saleId, productId: p?.id ?? null, name: l.name, qty: l.qty, packSize: null, baseQty: l.qty, price: l.price, cost, total: l.total })));
  for (const { l, p } of rows.filter((x: any) => x.p?.trackStock)) {
    const [row] = await tx.update(sysProduct).set({ stock: sql`${sysProduct.stock} - ${round3(Number(l.qty))}`, updatedAt: now }).where(eq(sysProduct.id, p.id)).returning({ stock: sysProduct.stock });
    await tx.insert(sysStockMove).values({ id: newId(), organizationId: a.organizationId, productId: p.id, kind: 'sale', qty: -round3(Number(l.qty)), stock: row.stock, saleId, userId: a.userId, note });
  }
  return saleId;
}
