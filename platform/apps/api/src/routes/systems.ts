// Hemlo Systems (system.hemlohq.com): products, the checkout, the debt book, stock and reports.
// Every request acts for one business (the person's active business, or a trusted counter device) and every query
// runs inside withOrg(), so row-level security keeps each business's data to itself. Money is whole IQD.
import { Hono, type Context } from 'hono';
import { and, desc, eq, gte, ilike, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import { newId, normalizeIraqiPhone } from '@hemlo/core';
import { withOrg, type Database } from '@hemlo/db';
import { sysProduct, sysCustomer, sysSale, sysSaleLine, sysLedger, sysStockMove, sysSequence, sysSupplier, sysReturn, sysExpense, sysFibPayment } from '@hemlo/db/schema';
import { fibFor, refreshFib } from './systems-till';
import { audit } from '@hemlo/auth/audit';
import { HttpError, findMember } from '../principal';
import { actor, may, bad, text, iqd, quantity, round3, dateParam, openShiftId, UNITS, type Actor } from './sys-common';
import type { AppEnv, Deps } from '../types';
import { claimFiles, dropFiles, logoUrl } from './files';
import { subscriptionOf } from '../subscription';
import { fileUrl } from '../files';
import { sysFile } from '@hemlo/db/schema';

function productInput(b: any, partial = false) {
  const out: Partial<typeof sysProduct.$inferInsert> = {};
  if (!partial || b.name !== undefined) out.name = text(b.name, 120, 'BAD_NAME', true)!;
  if (!partial || b.price !== undefined) out.price = iqd(b.price, 'BAD_PRICE')!;
  if (b.cost !== undefined) out.cost = iqd(b.cost, 'BAD_COST', { allowNull: true });
  if (b.barcode !== undefined) out.barcode = text(b.barcode, 64, 'BAD_BARCODE');
  if (b.category !== undefined) out.category = text(b.category, 60, 'BAD_CATEGORY');
  if (b.unit !== undefined) out.unit = UNITS.includes(b.unit) ? b.unit : bad('BAD_UNIT');
  if (b.lowStock !== undefined) out.lowStock = b.lowStock === null || b.lowStock === '' ? null : quantity(b.lowStock, 'kg', 'BAD_LOW_STOCK');
  if (b.trackStock !== undefined) out.trackStock = !!b.trackStock;
  if (b.packSize !== undefined) out.packSize = b.packSize == null || b.packSize === '' ? null : (Number.isInteger(Number(b.packSize)) && Number(b.packSize) >= 2 && Number(b.packSize) <= 10_000 ? Number(b.packSize) : bad('BAD_PACK'));
  if (b.packBarcode !== undefined) out.packBarcode = text(b.packBarcode, 64, 'BAD_BARCODE');
  if (b.packPrice !== undefined) out.packPrice = iqd(b.packPrice, 'BAD_PRICE', { allowNull: true });
  if (b.scaleCode !== undefined) out.scaleCode = b.scaleCode == null || b.scaleCode === '' ? null : /^\d{1,6}$/.test(String(b.scaleCode)) ? String(Number(b.scaleCode)) : bad('BAD_SCALE_CODE');
  if (out.packSize === null) { out.packBarcode = null; out.packPrice = null; }
  return out;
}

/** A code scanned at the till must point at one thing: no product's barcode may equal another's carton barcode. */
async function checkBarcodes(tx: Database, id: string | null, codes: (string | null | undefined)[]) {
  const list = codes.filter((x): x is string => !!x);
  if (new Set(list).size !== list.length) throw new HttpError(409, 'BARCODE_TAKEN');
  if (!list.length) return;
  const clash = await tx.select({ id: sysProduct.id }).from(sysProduct)
    .where(and(isNull(sysProduct.archivedAt), or(inArray(sysProduct.barcode, list), inArray(sysProduct.packBarcode, list))));
  if (clash.some((x) => x.id !== id)) throw new HttpError(409, 'BARCODE_TAKEN');
}
const barcodeTaken = (e: any) => /sys_product_(pack_)?barcode/.test(String(e?.message ?? '') + String(e?.cause?.message ?? '') + String(e?.constraint_name ?? e?.cause?.constraint_name ?? ''));

export function systemsRoutes(d: Deps) {
  const r = new Hono<AppEnv>();
  const inOrg = <T>(a: Actor, fn: (tx: Database) => Promise<T>) => withOrg(d.db, a.organizationId, fn);

  /** The business this screen works for, and what this person may do in it. */
  r.get('/me', async (c) => {
    // any member of the business: a shop's staff read stock, an estate agent reads listings, a teacher reads students
    let a: Actor; try { a = actor(c, 'stock', 'read'); } catch (e) { try { a = actor(c, 'listings', 'read'); } catch { try { a = actor(c, 'students', 'read'); } catch { throw e; } } }
    const ctx = await d.auth.$context;
    const org = await ctx.adapter.findOne<any>({ model: 'organization', where: [{ field: 'id', value: a.organizationId }] });
    let meta: any = {}; try { meta = typeof org?.metadata === 'string' ? JSON.parse(org.metadata) : org?.metadata ?? {}; } catch {}
    const p = a.principal;
    const role = p.kind === 'apikey' ? null : p.role;
    const can = Object.fromEntries(([
      ['products.manage', 'products', 'manage'], ['stock.adjust', 'stock', 'adjust'], ['sales.create', 'sales', 'create'], ['sales.read', 'sales', 'read'],
      ['sales.refund', 'sales', 'refund'], ['customers.read', 'customers', 'read'], ['customers.create', 'customers', 'create'], ['stock.read', 'stock', 'read'], ['customers.update', 'customers', 'update'], ['reports.read', 'reports', 'read'],
      ['purchases.create', 'purchases', 'create'], ['purchases.read', 'purchases', 'read'], ['expenses.create', 'expenses', 'create'], ['expenses.read', 'expenses', 'read'],
      ['patients.read', 'patients', 'read'], ['patients.create', 'patients', 'create'], ['patients.update', 'patients', 'update'], ['clinical.read', 'clinical', 'read'], ['clinical.write', 'clinical', 'write'],
      ['appointments.read', 'appointments', 'read'], ['appointments.manage', 'appointments', 'manage'], ['clinic.configure', 'clinic', 'configure'], ['lab.read', 'lab', 'read'], ['lab.manage', 'lab', 'manage'], ['settings.update', 'settings', 'update'],
      ['members.read', 'members', 'read'], ['members.create', 'members', 'create'], ['members.update', 'members', 'update'], ['checkin.create', 'checkin', 'create'],
      ['memberships.sell', 'memberships', 'sell'], ['memberships.manage', 'memberships', 'manage'], ['training.read', 'training', 'read'], ['training.write', 'training', 'write'], ['gym.configure', 'gym', 'configure'],
      ['listings.create', 'listings', 'create'], ['listings.read', 'listings', 'read'], ['listings.update', 'listings', 'update'], ['listings.publish', 'listings', 'publish'], ['listings.archive', 'listings', 'archive'],
      ['leads.create', 'leads', 'create'], ['leads.read', 'leads', 'read'], ['leads.read-all', 'leads', 'read-all'], ['leads.update', 'leads', 'update'], ['leads.assign', 'leads', 'assign'],
      ['viewings.read', 'viewings', 'read'], ['viewings.manage', 'viewings', 'manage'], ['deals.read', 'deals', 'read'], ['deals.manage', 'deals', 'manage'],
      ['commission.read', 'commission', 'read'], ['commission.manage', 'commission', 'manage'], ['agency.configure', 'agency', 'configure'],
      ['students.read', 'students', 'read'], ['students.create', 'students', 'create'], ['students.update', 'students', 'update'], ['attendance.take', 'attendance', 'take'], ['attendance.read', 'attendance', 'read'],
      ['fees.read', 'fees', 'read'], ['fees.collect', 'fees', 'collect'], ['fees.manage', 'fees', 'manage'], ['school.configure', 'school', 'configure'],
      ['website.manage', 'website', 'manage'],
      ['connect.read', 'connect', 'read'], ['connect.reply', 'connect', 'reply'], ['connect.configure', 'connect', 'configure'], ['orders.read', 'orders', 'read'], ['orders.manage', 'orders', 'manage'],
    ] as const).map(([k, res, act]) => [k, may(p, res, act)]));
    const member = a.userId ? await findMember(d, a.organizationId, { userId: a.userId }) : null;
    const logo = await inOrg(a, (tx) => logoUrl(d, tx, a.organizationId));
    return c.json({ business: { id: a.organizationId, name: org?.name, slug: org?.slug, kind: meta?.kind ?? null, city: meta?.city ?? null, currency: 'IQD', demo: !!meta?.demo, logoUrl: logo },
      role, counter: p.kind === 'counter', memberId: member?.id ?? null, can, subscription: await subscriptionOf(d.db, a.organizationId) });
  });

  // ---------------- products ----------------
  r.get('/products', async (c) => {
    const a = actor(c, 'stock', 'read');
    const archived = c.req.query('archived') === '1';
    const rows = await inOrg(a, (tx) => tx.select().from(sysProduct).where(archived ? undefined : isNull(sysProduct.archivedAt)).orderBy(sysProduct.name));
    const canCost = may(a.principal, 'products', 'manage') || may(a.principal, 'reports', 'read');
    const withImage = await Promise.all(rows.map(async (x) => ({ ...(canCost ? x : { ...x, cost: null }), imageUrl: await fileUrl(d.env, a.organizationId, x.imageId) })));
    return c.json({ products: withImage });
  });

  r.post('/products', async (c) => {
    const a = actor(c, 'products', 'manage');
    const b = await c.req.json();
    const input = productInput(b);
    const stock = b.stock == null || b.stock === '' ? 0 : Number(b.stock);
    if (!Number.isFinite(stock) || stock < 0 || stock > 1_000_000) bad('BAD_QTY');
    try {
      const product = await inOrg(a, async (tx) => {
        await checkBarcodes(tx, null, [input.barcode, input.packBarcode]);
        const id = newId();
        const imageId = b.imageId ? (await claimFiles(tx, [b.imageId], 'product', id))[0].id : null;
        const [row] = await tx.insert(sysProduct).values({ id, organizationId: a.organizationId, ...input, imageId, stock } as any).returning();
        if (stock) await tx.insert(sysStockMove).values({ id: newId(), organizationId: a.organizationId, productId: row.id, kind: 'count', qty: stock, stock, cost: row.cost, userId: a.userId, note: 'opening stock' });
        return row;
      });
      return c.json({ product: { ...product, imageUrl: await fileUrl(d.env, a.organizationId, product.imageId) } }, 201);
    } catch (e) { if (barcodeTaken(e)) throw new HttpError(409, 'BARCODE_TAKEN'); throw e; }
  });

  r.patch('/products/:id', async (c) => {
    const a = actor(c, 'products', 'manage');
    const b = await c.req.json();
    const input = productInput(b, true);
    try {
      const [row] = await inOrg(a, async (tx) => {
        const [cur] = await tx.select().from(sysProduct).where(eq(sysProduct.id, c.req.param('id')));
        if (!cur) throw new HttpError(404, 'NOT_FOUND');
        await checkBarcodes(tx, cur.id, [input.barcode !== undefined ? input.barcode : cur.barcode, input.packBarcode !== undefined ? input.packBarcode : cur.packBarcode]);
        if (b.imageId !== undefined) { // a new photo, or none; the old one is deleted
          const next = b.imageId ? (await claimFiles(tx, [b.imageId], 'product', cur.id))[0].id : null;
          if (cur.imageId && cur.imageId !== next) await dropFiles(d, tx, and(eq(sysFile.id, cur.imageId)));
          (input as any).imageId = next;
        }
        return tx.update(sysProduct).set({ ...input, updatedAt: new Date() }).where(eq(sysProduct.id, cur.id)).returning();
      });
      return c.json({ product: { ...row, imageUrl: await fileUrl(d.env, a.organizationId, row.imageId) } });
    } catch (e) { if (barcodeTaken(e)) throw new HttpError(409, 'BARCODE_TAKEN'); throw e; }
  });

  r.delete('/products/:id', async (c) => {
    const a = actor(c, 'products', 'manage');
    const [row] = await inOrg(a, (tx) => tx.update(sysProduct).set({ archivedAt: new Date(), barcode: null, updatedAt: new Date() }).where(eq(sysProduct.id, c.req.param('id'))).returning());
    if (!row) throw new HttpError(404, 'NOT_FOUND');
    return c.json({ ok: true });
  });

  /** A delivery arrived (receive), a shelf count (count), or damaged/expired goods (damage). */
  r.post('/products/:id/stock', async (c) => {
    const a = actor(c, 'stock', 'adjust');
    const b = await c.req.json<{ kind?: string; qty?: number; cost?: number; note?: string }>();
    if (!['receive', 'count', 'damage'].includes(b.kind ?? '')) bad('BAD_KIND');
    const note = text(b.note, 200, 'BAD_NOTE');
    const cost = iqd(b.cost, 'BAD_COST', { allowNull: true });
    const product = await inOrg(a, async (tx) => {
      const [p] = await tx.select().from(sysProduct).where(eq(sysProduct.id, c.req.param('id')));
      if (!p) throw new HttpError(404, 'NOT_FOUND');
      const n = b.kind === 'count' ? (Number(b.qty) >= 0 && Number.isFinite(Number(b.qty)) ? Math.round(Number(b.qty) * 1000) / 1000 : bad('BAD_QTY')) : quantity(b.qty, p.unit);
      const change = b.kind === 'receive' ? n : b.kind === 'damage' ? -n : Math.round((n - p.stock) * 1000) / 1000;
      const [row] = await tx.update(sysProduct).set({ stock: sql`${sysProduct.stock} + ${change}`, ...(b.kind === 'receive' && cost != null ? { cost } : {}), updatedAt: new Date() })
        .where(eq(sysProduct.id, p.id)).returning();
      await tx.insert(sysStockMove).values({ id: newId(), organizationId: a.organizationId, productId: p.id, kind: b.kind!, qty: change, stock: row.stock, cost: b.kind === 'receive' ? cost : null, note, userId: a.userId });
      return row;
    });
    return c.json({ product });
  });

  r.get('/products/:id/moves', async (c) => {
    const a = actor(c, 'stock', 'read');
    const moves = await inOrg(a, (tx) => tx.select().from(sysStockMove).where(eq(sysStockMove.productId, c.req.param('id'))).orderBy(desc(sysStockMove.at)).limit(100));
    return c.json({ moves });
  });

  // ---------------- customers & the debt book ----------------
  r.get('/customers', async (c) => {
    const a = actor(c, 'customers', 'read');
    const q = (c.req.query('q') ?? '').trim();
    const rows = await inOrg(a, (tx) => tx.select().from(sysCustomer)
      .where(and(isNull(sysCustomer.archivedAt), q ? or(ilike(sysCustomer.name, `%${q}%`), ilike(sysCustomer.phone, `%${q.replace(/\D/g, '').slice(-9) || q}%`)) : undefined))
      .orderBy(desc(sysCustomer.balance), sysCustomer.name).limit(1000));
    return c.json({ customers: rows });
  });

  const customerInput = (b: any, partial = false) => {
    const out: Partial<typeof sysCustomer.$inferInsert> = {};
    if (!partial || b.name !== undefined) out.name = text(b.name, 100, 'BAD_NAME', true)!;
    if (b.phone !== undefined) out.phone = b.phone ? normalizeIraqiPhone(String(b.phone)) ?? bad('BAD_PHONE') : null;
    if (b.note !== undefined) out.note = text(b.note, 300, 'BAD_NOTE');
    return out;
  };

  r.post('/customers', async (c) => {
    const a = actor(c, 'customers', 'create');
    const input = customerInput(await c.req.json());
    const [row] = await inOrg(a, (tx) => tx.insert(sysCustomer).values({ id: newId(), organizationId: a.organizationId, ...input } as any).returning());
    return c.json({ customer: row }, 201);
  });

  r.patch('/customers/:id', async (c) => {
    const a = actor(c, 'customers', 'update');
    const input = customerInput(await c.req.json(), true);
    const [row] = await inOrg(a, (tx) => tx.update(sysCustomer).set({ ...input, updatedAt: new Date() }).where(eq(sysCustomer.id, c.req.param('id'))).returning());
    if (!row) throw new HttpError(404, 'NOT_FOUND');
    return c.json({ customer: row });
  });

  r.get('/customers/:id', async (c) => {
    const a = actor(c, 'customers', 'read');
    const out = await inOrg(a, async (tx) => {
      const [customer] = await tx.select().from(sysCustomer).where(eq(sysCustomer.id, c.req.param('id')));
      if (!customer) throw new HttpError(404, 'NOT_FOUND');
      const ledger = await tx.select({ l: sysLedger, number: sysSale.number }).from(sysLedger).leftJoin(sysSale, eq(sysSale.id, sysLedger.saleId))
        .where(eq(sysLedger.customerId, customer.id)).orderBy(desc(sysLedger.at)).limit(200);
      return { customer, ledger: ledger.map((x) => ({ ...x.l, saleNumber: x.number })) };
    });
    return c.json(out);
  });

  /** Money received against a customer's debt. Taken at the counter, so it needs sales:create. */
  r.post('/customers/:id/payments', async (c) => {
    const a = actor(c, 'sales', 'create');
    const b = await c.req.json<{ amount?: number; note?: string; method?: string }>();
    const method = b.method === 'card' ? 'card' : 'cash';
    const amount = iqd(b.amount, 'BAD_AMOUNT')!;
    if (amount <= 0) bad('BAD_AMOUNT');
    const note = text(b.note, 200, 'BAD_NOTE');
    const customer = await inOrg(a, async (tx) => {
      const [row] = await tx.update(sysCustomer).set({ balance: sql`${sysCustomer.balance} - ${amount}`, updatedAt: new Date() }).where(eq(sysCustomer.id, c.req.param('id'))).returning();
      if (!row) throw new HttpError(404, 'NOT_FOUND');
      await tx.insert(sysLedger).values({ id: newId(), organizationId: a.organizationId, customerId: row.id, kind: 'payment', amount: -amount, balance: row.balance, method, shiftId: await openShiftId(tx, a.deviceId), note, userId: a.userId });
      return row;
    });
    return c.json({ customer }, 201);
  });

  // ---------------- sales ----------------
  /**
   * One sale, all or nothing: stock goes down, the receipt number goes up, and whatever wasn't paid goes on the
   * customer's account. Sending the same clientId again returns the first sale (safe for retries and offline sync).
   */
  r.post('/sales', async (c) => {
    const a = actor(c, 'sales', 'create');
    const b = await c.req.json<{ clientId?: string; lines?: { productId: string; qty: number; price?: number; pack?: boolean }[]; discount?: number; paid?: number; method?: string; customerId?: string | null; note?: string; fibPaymentId?: string }>();
    const clientId = text(b.clientId, 64, 'BAD_CLIENT_ID');
    if (!Array.isArray(b.lines) || !b.lines.length || b.lines.length > 300) bad('EMPTY_SALE');
    const method = ['cash', 'card', 'credit', 'fib'].includes(b.method ?? 'cash') ? (b.method ?? 'cash') : bad('BAD_METHOD');
    if (method === 'fib' && !b.fibPaymentId) bad('FIB_PAYMENT_REQUIRED');
    const note = text(b.note, 200, 'BAD_NOTE');
    const customPrices = may(a.principal, 'products', 'manage');

    const result = await inOrg(a, async (tx) => {
      if (clientId) {
        const [dup] = await tx.select().from(sysSale).where(eq(sysSale.clientId, clientId));
        if (dup) return { sale: dup, repeated: true };
      }
      const ids = [...new Set(b.lines!.map((l) => String(l.productId)))];
      const products = await tx.select().from(sysProduct).where(and(inArray(sysProduct.id, ids), isNull(sysProduct.archivedAt)));
      const lines = b.lines!.map((l) => {
        const p = products.find((x) => x.id === String(l.productId)) ?? (() => { throw new HttpError(409, 'PRODUCT_GONE'); })();
        // a carton: counted in cartons, priced per carton, and takes packSize pieces out of stock
        const pack = !!l.pack && !!p.packSize;
        if (l.pack && !p.packSize) bad('NO_PACK');
        const qty = quantity(l.qty, pack ? 'pack' : p.unit);
        const unitPrice = pack ? p.packPrice ?? p.price * p.packSize! : p.price;
        const price = customPrices && l.price != null ? iqd(l.price, 'BAD_PRICE')! : unitPrice;
        const baseQty = round3(qty * (pack ? p.packSize! : 1));
        return { p, qty, pack: pack ? p.packSize! : null, baseQty, price, total: Math.round(qty * price), cost: Math.round(baseQty * (p.cost ?? 0)) };
      });
      const subtotal = lines.reduce((s, l) => s + l.total, 0);
      const discount = iqd(b.discount ?? 0, 'BAD_DISCOUNT')!;
      if (discount > subtotal) bad('BAD_DISCOUNT');
      const total = subtotal - discount;

      let customer: typeof sysCustomer.$inferSelect | null = null;
      if (b.customerId) {
        [customer] = await tx.select().from(sysCustomer).where(and(eq(sysCustomer.id, b.customerId), isNull(sysCustomer.archivedAt)));
        if (!customer) throw new HttpError(404, 'CUSTOMER_NOT_FOUND');
      }
      // FIB: only a payment FIB itself confirms as PAID, for exactly this total, used once
      let fib: typeof sysFibPayment.$inferSelect | null = null;
      if (method === 'fib') {
        [fib] = await tx.select().from(sysFibPayment).where(eq(sysFibPayment.id, b.fibPaymentId!));
        if (!fib) throw new HttpError(404, 'FIB_PAYMENT_NOT_FOUND');
        if (fib.status === 'UNPAID') fib = await refreshFib(d, tx, fib);
        if (fib.status !== 'PAID') throw new HttpError(409, 'FIB_NOT_PAID');
        if (fib.saleId) throw new HttpError(409, 'FIB_ALREADY_USED');
        if (fib.amount !== total) throw new HttpError(409, 'FIB_AMOUNT_MISMATCH');
      }
      const paid = method === 'credit' ? Math.min(total, iqd(b.paid ?? 0, 'BAD_PAID')!) : total;
      const due = total - paid;
      if (due > 0 && !customer) throw new HttpError(400, 'CUSTOMER_REQUIRED');
      const finalMethod = due === 0 ? (method === 'credit' ? 'cash' : method) : paid > 0 ? 'mixed' : 'credit';

      const [seq] = await tx.insert(sysSequence).values({ organizationId: a.organizationId, name: 'sale', value: 1 })
        .onConflictDoUpdate({ target: [sysSequence.organizationId, sysSequence.name], set: { value: sql`${sysSequence.value} + 1` } }).returning();
      const saleId = newId();
      const [sale] = await tx.insert(sysSale).values({
        id: saleId, organizationId: a.organizationId, number: seq.value, clientId, userId: a.userId, deviceId: a.deviceId, customerId: customer?.id ?? null,
        subtotal, discount, total, paid, due, method: finalMethod, cost: lines.reduce((s, l) => s + l.cost, 0), note, shiftId: await openShiftId(tx, a.deviceId), fibPaymentId: fib?.id ?? null,
      }).returning();
      if (fib) await tx.update(sysFibPayment).set({ saleId }).where(eq(sysFibPayment.id, fib.id));
      await tx.insert(sysSaleLine).values(lines.map((l) => ({ id: newId(), organizationId: a.organizationId, saleId, productId: l.p.id, name: l.p.name, qty: l.qty, packSize: l.pack, baseQty: l.baseQty, price: l.price, cost: l.cost, total: l.total })));
      for (const l of lines.filter((x) => x.p.trackStock)) {
        const [row] = await tx.update(sysProduct).set({ stock: sql`${sysProduct.stock} - ${l.baseQty}`, updatedAt: new Date() }).where(eq(sysProduct.id, l.p.id)).returning({ stock: sysProduct.stock });
        await tx.insert(sysStockMove).values({ id: newId(), organizationId: a.organizationId, productId: l.p.id, kind: 'sale', qty: -l.baseQty, stock: row.stock, saleId, userId: a.userId });
      }
      if (customer && due > 0) {
        const [cu] = await tx.update(sysCustomer).set({ balance: sql`${sysCustomer.balance} + ${due}`, updatedAt: new Date() }).where(eq(sysCustomer.id, customer.id)).returning();
        await tx.insert(sysLedger).values({ id: newId(), organizationId: a.organizationId, customerId: customer.id, kind: 'sale', amount: due, balance: cu.balance, saleId, userId: a.userId });
        customer = cu;
      }
      return { sale, repeated: false };
    });
    const full = await saleWithLines(a, result.sale.id);
    return c.json({ ...full, repeated: result.repeated }, result.repeated ? 200 : 201);
  });

  const saleWithLines = (a: Actor, id: string) => inOrg(a, async (tx) => {
    const [sale] = await tx.select().from(sysSale).where(eq(sysSale.id, id));
    if (!sale) throw new HttpError(404, 'NOT_FOUND');
    const lines = await tx.select().from(sysSaleLine).where(eq(sysSaleLine.saleId, id));
    const [customer] = sale.customerId ? await tx.select().from(sysCustomer).where(eq(sysCustomer.id, sale.customerId)) : [null];
    return { sale, lines, customer: customer ?? null };
  });

  r.get('/sales', async (c) => {
    const a = actor(c, 'sales', 'read');
    const to = dateParam(c.req.query('to'), new Date());
    const from = dateParam(c.req.query('from'), new Date(to.getTime() - 86400_000));
    const rows = await inOrg(a, (tx) => tx.select({ s: sysSale, customer: sysCustomer.name }).from(sysSale).leftJoin(sysCustomer, eq(sysCustomer.id, sysSale.customerId))
      .where(and(gte(sysSale.createdAt, from), lt(sysSale.createdAt, to))).orderBy(desc(sysSale.createdAt)).limit(1000));
    const canProfit = may(a.principal, 'reports', 'read');
    return c.json({ sales: rows.map((x) => ({ ...x.s, cost: canProfit ? x.s.cost : null, customerName: x.customer })) });
  });

  r.get('/sales/:id', async (c) => {
    const a = actor(c, 'sales', 'read');
    return c.json(await saleWithLines(a, c.req.param('id')));
  });

  /** Cancel a sale: stock comes back and any debt it created is removed. The sale stays, marked void. */
  r.post('/sales/:id/void', async (c) => {
    const a = actor(c, 'sales', 'refund');
    const reason = text((await c.req.json().catch(() => ({})))?.reason, 200, 'BAD_NOTE');
    const sale = await inOrg(a, async (tx) => {
      const [s] = await tx.update(sysSale).set({ voidedAt: new Date(), voidedBy: a.userId, note: reason ?? undefined }).where(and(eq(sysSale.id, c.req.param('id')), isNull(sysSale.voidedAt), eq(sysSale.returned, 0))).returning();
      if (!s) {
        const [exists] = await tx.select({ voidedAt: sysSale.voidedAt }).from(sysSale).where(eq(sysSale.id, c.req.param('id')));
        if (!exists) throw new HttpError(404, 'NOT_FOUND');
        throw new HttpError(409, exists.voidedAt ? 'ALREADY_VOID' : 'HAS_RETURNS'); // after a return, return the rest instead
      }
      const lines = await tx.select({ l: sysSaleLine, track: sysProduct.trackStock }).from(sysSaleLine).leftJoin(sysProduct, eq(sysProduct.id, sysSaleLine.productId)).where(eq(sysSaleLine.saleId, s.id));
      for (const { l } of lines.filter((x) => x.track && x.l.productId)) {
        const [row] = await tx.update(sysProduct).set({ stock: sql`${sysProduct.stock} + ${l.baseQty ?? l.qty}`, updatedAt: new Date() }).where(eq(sysProduct.id, l.productId!)).returning({ stock: sysProduct.stock });
        await tx.insert(sysStockMove).values({ id: newId(), organizationId: a.organizationId, productId: l.productId!, kind: 'void', qty: l.baseQty ?? l.qty, stock: row.stock, saleId: s.id, userId: a.userId });
      }
      if (s.customerId && s.due > 0) {
        const [cu] = await tx.update(sysCustomer).set({ balance: sql`${sysCustomer.balance} - ${s.due}`, updatedAt: new Date() }).where(eq(sysCustomer.id, s.customerId)).returning();
        await tx.insert(sysLedger).values({ id: newId(), organizationId: a.organizationId, customerId: s.customerId, kind: 'void', amount: -s.due, balance: cu.balance, saleId: s.id, note: reason, userId: a.userId });
      }
      return s;
    });
    let fibRefund: 'refunded' | 'failed' | 'too_late' | null = null;
    if (sale.fibPaymentId) {
      fibRefund = await inOrg(a, async (tx) => {
        const [p] = await tx.select().from(sysFibPayment).where(eq(sysFibPayment.id, sale.fibPaymentId!));
        if (!p?.paidAt || Date.now() - p.paidAt.getTime() > 24 * 3600_000) { if (p) await tx.update(sysFibPayment).set({ refundStatus: 'too_late' }).where(eq(sysFibPayment.id, p.id)); return 'too_late' as const; }
        try {
          const { client } = await fibFor(d, tx, a.organizationId);
          await client.refund(p.fibPaymentId);
          await tx.update(sysFibPayment).set({ refundedAt: new Date(), refundStatus: 'refunded' }).where(eq(sysFibPayment.id, p.id));
          return 'refunded' as const;
        } catch { await tx.update(sysFibPayment).set({ refundStatus: 'failed' }).where(eq(sysFibPayment.id, p.id)); return 'failed' as const; }
      });
    }
    await audit(d.db, { kind: 'sys.sale_voided', organizationId: a.organizationId, userId: a.userId, detail: { number: sale.number, total: sale.total, reason, fibRefund } });
    return c.json({ sale, fibRefund });
  });

  // ---------------- reports ----------------
  /** Totals for a period (the screen sends local midnight boundaries). Iraq is UTC+3 all year. */
  r.get('/reports/summary', async (c) => {
    const a = actor(c, 'reports', 'read');
    const to = dateParam(c.req.query('to'), new Date());
    const from = dateParam(c.req.query('from'), new Date(to.getTime() - 86400_000));
    const out = await inOrg(a, async (tx) => {
      const inPeriod = (col: any) => and(gte(col, from), lt(col, to));
      const sales = await tx.select({ id: sysSale.id, createdAt: sysSale.createdAt, total: sysSale.total, cost: sysSale.cost, paid: sysSale.paid, due: sysSale.due, discount: sysSale.discount, method: sysSale.method, userId: sysSale.userId })
        .from(sysSale).where(and(inPeriod(sysSale.createdAt), isNull(sysSale.voidedAt)));
      const top = await tx.select({ productId: sysSaleLine.productId, name: sysSaleLine.name, qty: sql<number>`sum(coalesce(${sysSaleLine.baseQty}, ${sysSaleLine.qty}))::float`, total: sql<number>`sum(${sysSaleLine.total})::int` })
        .from(sysSaleLine).innerJoin(sysSale, eq(sysSale.id, sysSaleLine.saleId))
        .where(and(inPeriod(sysSale.createdAt), isNull(sysSale.voidedAt)))
        .groupBy(sysSaleLine.productId, sysSaleLine.name).orderBy(sql`sum(${sysSaleLine.total}) desc`).limit(8);
      const [payments] = await tx.select({ n: sql<number>`coalesce(-sum(${sysLedger.amount}), 0)::int` }).from(sysLedger).where(and(eq(sysLedger.kind, 'payment'), inPeriod(sysLedger.at)));
      const [debt] = await tx.select({ total: sql<number>`coalesce(sum(${sysCustomer.balance}) filter (where ${sysCustomer.balance} > 0), 0)::int`, people: sql<number>`count(*) filter (where ${sysCustomer.balance} > 0)::int` }).from(sysCustomer).where(isNull(sysCustomer.archivedAt));
      const [owed] = await tx.select({ total: sql<number>`coalesce(sum(${sysSupplier.balance}) filter (where ${sysSupplier.balance} > 0), 0)::int` }).from(sysSupplier).where(isNull(sysSupplier.archivedAt));
      const [returns] = await tx.select({ total: sql<number>`coalesce(sum(${sysReturn.total}), 0)::int`, cost: sql<number>`coalesce(sum(${sysReturn.cost}), 0)::int`, n: sql<number>`count(*)::int` }).from(sysReturn).where(inPeriod(sysReturn.createdAt));
      const expenses = await tx.select({ category: sysExpense.category, total: sql<number>`sum(${sysExpense.amount})::int` }).from(sysExpense).where(inPeriod(sysExpense.at)).groupBy(sysExpense.category);
      const low = await tx.select().from(sysProduct).where(and(isNull(sysProduct.archivedAt), eq(sysProduct.trackStock, true), sql`${sysProduct.stock} <= coalesce(${sysProduct.lowStock}, 0)`)).orderBy(sysProduct.stock).limit(20);
      return { sales, top, collected: payments?.n ?? 0, debt, owed: owed?.total ?? 0, returns, expenses, low };
    });
    const sum = (k: 'total' | 'cost' | 'paid' | 'due' | 'discount') => out.sales.reduce((s, x) => s + x[k], 0);
    const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86400_000));
    const buckets = days <= 1 ? 24 : days;
    const series = Array.from({ length: buckets }, () => 0);
    for (const s of out.sales) {
      const i = days <= 1 ? new Date(new Date(s.createdAt).getTime() + 3 * 3600_000).getUTCHours() : Math.floor((new Date(s.createdAt).getTime() - from.getTime()) / 86400_000);
      if (i >= 0 && i < buckets) series[i] += s.total;
    }
    const byMethod = { cash: 0, card: 0, fib: 0, credit: 0 };
    for (const s of out.sales) { if (s.method === 'card') byMethod.card += s.paid; else if (s.method === 'fib') byMethod.fib += s.paid; else byMethod.cash += s.paid; byMethod.credit += s.due; }
    // per cashier
    const byUserMap = new Map<string, { count: number; total: number }>();
    for (const s of out.sales) { const k = s.userId ?? ''; const v = byUserMap.get(k) ?? { count: 0, total: 0 }; v.count++; v.total += s.total; byUserMap.set(k, v); }
    const ids = [...byUserMap.keys()].filter(Boolean);
    const users = ids.length ? await (await d.auth.$context).adapter.findMany<any>({ model: 'user', where: [{ field: 'id', operator: 'in', value: ids }] }) : [];
    const byUser = [...byUserMap].map(([id, v]) => ({ userId: id || null, name: users.find((u) => u.id === id)?.name ?? null, ...v })).sort((x, y) => y.total - x.total);
    const expenseTotal = out.expenses.reduce((s, x) => s + x.total, 0);
    const gross = sum('total') - sum('cost') - (out.returns.total - out.returns.cost);
    return c.json({
      from, to, count: out.sales.length, total: sum('total'), cost: sum('cost'), profit: gross, discount: sum('discount'),
      returns: out.returns, net: sum('total') - out.returns.total, expenses: { total: expenseTotal, byCategory: out.expenses }, netProfit: gross - expenseTotal,
      byMethod, collected: out.collected, series: { unit: days <= 1 ? 'hour' : 'day', values: series }, byUser,
      top: out.top, debt: out.debt, owedToSuppliers: out.owed, lowStock: out.low.map((p) => ({ id: p.id, name: p.name, stock: p.stock, unit: p.unit, lowStock: p.lowStock })),
    });
  });

  return r;
}
