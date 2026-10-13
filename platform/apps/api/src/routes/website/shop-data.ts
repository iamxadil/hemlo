// What a shop's website reads: its products (only what a customer may see: never the cost, the barcode or the exact
// stock), one product's page, and an order by its code. Plus the shop's adapter for the shared Website renderer: a
// visitor's message lands in the shop's Hemlo Connect inbox, unread, for the team.
import { and, desc, eq, ilike, isNotNull, isNull, or, sql, type SQL } from 'drizzle-orm';
import { newId } from '@hemlo/core';
import type { Database } from '@hemlo/db';
import { connectConversation, connectMessage, shopOrder, shopOrderLine, sysProduct } from '@hemlo/db/schema';
import { fileUrl } from '../../files';
import { customerByPhone } from '../../connect/store';
import type { Deps } from '../../types';
import type { WebsiteAdapter, WebsiteListingFilter } from './adapters';

export type ShopItem = { id: string; slug: string; name: string; category: string | null; price: number; image: string | null; unit: string; stock: 'in' | 'low' | 'out'; fresh: boolean };
export type ShopProductPage = ShopItem & { description: string | null; photos: string[] };
export type ShopOrderView = {
  number: number; code: string; status: string; name: string; delivery: string; city: string | null; area: string | null; address: string | null;
  subtotal: number; deliveryFee: number; total: number; createdAt: Date; lines: { name: string; qty: number; price: number; total: number; image: string | null }[];
};

const cols = {
  id: sysProduct.id, slug: sysProduct.slug, name: sysProduct.name, category: sysProduct.category, price: sysProduct.price, imageId: sysProduct.imageId, unit: sysProduct.unit,
  stock: sysProduct.stock, lowStock: sysProduct.lowStock, trackStock: sysProduct.trackStock, createdAt: sysProduct.createdAt,
};
const stockOf = (p: { trackStock: boolean; stock: number; lowStock: number | null }) =>
  (!p.trackStock ? 'in' as const : p.stock <= 0 ? 'out' as const : p.lowStock != null && p.stock <= p.lowStock ? 'low' as const : 'in' as const);
async function asItems(deps: Deps, org: string, rows: any[]): Promise<ShopItem[]> {
  return Promise.all(rows.filter((p) => p.slug).map(async (p) => ({
    id: p.id, slug: p.slug, name: p.name, category: p.category, price: p.price, unit: p.unit, stock: stockOf(p),
    image: p.imageId ? await fileUrl(deps.env, org, p.imageId) : null, fresh: Date.now() - +p.createdAt < 14 * 86400_000,
  })));
}

/** The shop's products on its site, by a word, a category and an order (the newest first by default). */
export async function shopItems(tx: Database, deps: Deps, org: string, f: WebsiteListingFilter = {}) {
  const where: SQL[] = [eq(sysProduct.organizationId, org), eq(sysProduct.online, true), isNull(sysProduct.archivedAt)];
  if (f.category) where.push(eq(sysProduct.category, f.category));
  if (f.q) where.push(or(ilike(sysProduct.name, `%${f.q}%`), ilike(sysProduct.category, `%${f.q}%`))!);
  const order = f.sort === 'price-asc' ? [sql`${sysProduct.price} asc`] : f.sort === 'price-desc' ? [sql`${sysProduct.price} desc`] : [desc(sysProduct.createdAt)];
  const rows = await tx.select(cols).from(sysProduct).where(and(...where)).orderBy(...order).limit(f.limit ?? 240);
  return asItems(deps, org, rows);
}

export async function shopProductPage(tx: Database, deps: Deps, org: string, slug: string): Promise<ShopProductPage | null> {
  const [p] = await tx.select({ ...cols, description: sysProduct.description, photoIds: sysProduct.photoIds }).from(sysProduct)
    .where(and(eq(sysProduct.organizationId, org), eq(sysProduct.slug, slug), eq(sysProduct.online, true), isNull(sysProduct.archivedAt))).limit(1);
  if (!p) return null;
  const [item] = await asItems(deps, org, [p]);
  const extra = (await Promise.all((p.photoIds ?? []).slice(0, 8).map((id) => fileUrl(deps.env, org, id)))).filter(Boolean) as string[];
  return { ...item, description: p.description, photos: [...(item.image ? [item.image] : []), ...extra] };
}

/** An order as its customer may see it (by its unguessable code): what, how much, where it stands. */
export async function shopOrderByCode(tx: Database, deps: Deps, org: string, code: string): Promise<ShopOrderView | null> {
  const [o] = await tx.select().from(shopOrder).where(and(eq(shopOrder.organizationId, org), eq(shopOrder.code, code))).limit(1);
  if (!o) return null;
  const lines = await tx.select({ name: shopOrderLine.name, qty: shopOrderLine.qty, price: shopOrderLine.price, total: shopOrderLine.total, imageId: sysProduct.imageId })
    .from(shopOrderLine).leftJoin(sysProduct, eq(sysProduct.id, shopOrderLine.productId)).where(eq(shopOrderLine.orderId, o.id));
  return {
    number: o.number, code: o.code, status: o.status, name: o.name, delivery: o.delivery, city: o.city, area: o.area, address: o.address,
    subtotal: o.subtotal, deliveryFee: o.deliveryFee, total: o.total, createdAt: o.createdAt,
    lines: await Promise.all(lines.map(async (l) => ({ name: l.name, qty: Number(l.qty), price: l.price, total: l.total, image: l.imageId ? await fileUrl(deps.env, org, l.imageId) : null }))),
  };
}

export const storeWebsiteAdapter: WebsiteAdapter = {
  edition: 'store',
  sections: ['products'],
  publicProjection: ['sys_product.name', 'sys_product.category', 'sys_product.price', 'sys_product.image_id', 'sys_product.description', 'sys_product.unit'],
  refreshOn: ['sys_product'],
  async load(tx, deps, organizationId, _lang, _origin, filter = {}) {
    return { listings: [], products: await shopItems(tx, deps, organizationId, filter) };
  },
  async loadProperty() { return null; },
  async sitemapSlugs(tx) {
    const rows = await tx.select({ slug: sysProduct.slug }).from(sysProduct).where(and(eq(sysProduct.online, true), isNull(sysProduct.archivedAt), isNotNull(sysProduct.slug))).limit(50_000);
    return rows.map((x) => x.slug!);
  },
  async createInquiry(tx, input) {
    const org = input.organizationId, now = new Date();
    let [conv] = await tx.select().from(connectConversation).where(and(eq(connectConversation.organizationId, org), eq(connectConversation.phone, input.phone)));
    if (!conv) {
      const customer = await customerByPhone(tx, org, input.phone);
      [conv] = await tx.insert(connectConversation).values({ id: newId(), organizationId: org, phone: input.phone, name: input.name, customerId: customer?.id ?? null }).onConflictDoNothing().returning();
      if (!conv) [conv] = await tx.select().from(connectConversation).where(and(eq(connectConversation.organizationId, org), eq(connectConversation.phone, input.phone)));
    }
    const body = [input.message, input.email].filter(Boolean).join('\n') || '—';
    await tx.insert(connectMessage).values({ id: newId(), organizationId: org, conversationId: conv.id, direction: 'in', author: 'customer', kind: 'text', body, status: 'received',
      meta: { source: 'website', page: input.page ?? 'home' }, createdAt: now });
    await tx.update(connectConversation).set({ unread: sql`${connectConversation.unread} + 1`, lastMessageAt: now, preview: body.slice(0, 160), status: 'open', handoff: true })
      .where(eq(connectConversation.id, conv.id));
    return { leadId: '', about: null };
  },
};
