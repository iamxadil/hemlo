// Hemlo Systems V2: the cash drawer, returns, suppliers & purchases, expenses, and importing products from a sheet.
// Same rules as systems.ts: one business per request, everything inside withOrg(), whole IQD.
import { Hono } from 'hono';
import { and, desc, eq, gte, inArray, isNull, lt, sql } from 'drizzle-orm';
import { newId, normalizeIraqiPhone } from '@hemlo/core';
import { withOrg, type Database } from '@hemlo/db';
import {
  sysProduct, sysCustomer, sysSale, sysSaleLine, sysLedger, sysStockMove, sysSequence, sysShift, sysReturn, sysReturnLine,
  sysSupplier, sysPurchase, sysPurchaseLine, sysSupplierLedger, sysExpense, counterDevice,
} from '@hemlo/db/schema';
import { audit } from '@hemlo/auth/audit';
import { HttpError } from '../principal';
import { actor, may, bad, text, iqd, quantity, round3, dateParam, openShiftId, tillIs, UNITS, type Actor } from './sys-common';
import type { AppEnv, Deps } from '../types';
import { claimFiles, dropFiles, attachmentsOf } from './files';
import { sysFile } from '@hemlo/db/schema';

export const EXPENSE_CATEGORIES = ['rent', 'generator', 'electricity', 'salaries', 'transport', 'supplies', 'other'] as const;

export async function nextNumber(tx: Database, organizationId: string, name: string) {
  const [seq] = await tx.insert(sysSequence).values({ organizationId, name, value: 1 })
    .onConflictDoUpdate({ target: [sysSequence.organizationId, sysSequence.name], set: { value: sql`${sysSequence.value} + 1` } }).returning();
  return seq.value;
}

export function systemsOpsRoutes(d: Deps) {
  const r = new Hono<AppEnv>();
  const inOrg = <T>(a: Actor, fn: (tx: Database) => Promise<T>) => withOrg(d.db, a.organizationId, fn);

  // ---------------- the cash drawer (تسليم الصندوق) ----------------
  /** What should be in the drawer now: the float, plus cash taken, minus cash paid out. */
  async function drawer(tx: Database, s: typeof sysShift.$inferSelect) {
    const [sales] = await tx.select({
      cash: sql<number>`coalesce(sum(${sysSale.paid}) filter (where ${sysSale.method} not in ('card', 'fib')), 0)::int`,
      card: sql<number>`coalesce(sum(${sysSale.paid}) filter (where ${sysSale.method} = 'card'), 0)::int`,
      fib: sql<number>`coalesce(sum(${sysSale.paid}) filter (where ${sysSale.method} = 'fib'), 0)::int`,
      credit: sql<number>`coalesce(sum(${sysSale.due}), 0)::int`, count: sql<number>`count(*)::int`,
    }).from(sysSale).where(and(eq(sysSale.shiftId, s.id), isNull(sysSale.voidedAt)));
    const [debts] = await tx.select({ cash: sql<number>`coalesce(-sum(${sysLedger.amount}) filter (where coalesce(${sysLedger.method}, 'cash') = 'cash'), 0)::int` })
      .from(sysLedger).where(and(eq(sysLedger.shiftId, s.id), eq(sysLedger.kind, 'payment')));
    const [refunds] = await tx.select({ cash: sql<number>`coalesce(sum(${sysReturn.total}) filter (where ${sysReturn.refund} = 'cash'), 0)::int` }).from(sysReturn).where(eq(sysReturn.shiftId, s.id));
    const [expenses] = await tx.select({ cash: sql<number>`coalesce(sum(${sysExpense.amount}), 0)::int` }).from(sysExpense).where(and(eq(sysExpense.shiftId, s.id), eq(sysExpense.fromDrawer, true)));
    const [suppliers] = await tx.select({ cash: sql<number>`coalesce(-sum(${sysSupplierLedger.amount}), 0)::int` }).from(sysSupplierLedger)
      .where(and(eq(sysSupplierLedger.shiftId, s.id), eq(sysSupplierLedger.fromDrawer, true), eq(sysSupplierLedger.kind, 'payment')));
    const [purchases] = await tx.select({ cash: sql<number>`coalesce(sum(${sysPurchase.paid}), 0)::int` }).from(sysPurchase).where(and(eq(sysPurchase.shiftId, s.id), eq(sysPurchase.fromDrawer, true)));
    const expected = s.openingCash + sales.cash + debts.cash - refunds.cash - expenses.cash - suppliers.cash - purchases.cash;
    return { opening: s.openingCash, cashSales: sales.cash, cardSales: sales.card, fibSales: sales.fib, onAccount: sales.credit, sales: sales.count, debtPayments: debts.cash,
      refunds: refunds.cash, expenses: expenses.cash, supplierPayments: suppliers.cash + purchases.cash, expected };
  }

  r.get('/shift', async (c) => {
    const a = actor(c, 'sales', 'create');
    const out = await inOrg(a, async (tx) => {
      const [s] = await tx.select().from(sysShift).where(and(isNull(sysShift.closedAt), tillIs(a.deviceId))).limit(1);
      return s ? { shift: s, drawer: await drawer(tx, s) } : { shift: null, drawer: null };
    });
    return c.json(out);
  });

  r.post('/shift/open', async (c) => {
    const a = actor(c, 'sales', 'create');
    const b = await c.req.json<{ openingCash?: number }>().catch(() => ({} as any));
    const openingCash = iqd(b.openingCash ?? 0, 'BAD_AMOUNT')!;
    const shift = await inOrg(a, async (tx) => {
      if (await openShiftId(tx, a.deviceId)) throw new HttpError(409, 'SHIFT_OPEN');
      const [s] = await tx.insert(sysShift).values({ id: newId(), organizationId: a.organizationId, deviceId: a.deviceId, openedBy: a.userId, openingCash }).returning();
      return s;
    });
    return c.json({ shift }, 201);
  });

  /** Close with a count. The difference (short or over) is kept, with who closed it. */
  r.post('/shift/close', async (c) => {
    const a = actor(c, 'sales', 'create');
    const b = await c.req.json<{ countedCash?: number; note?: string }>();
    const counted = iqd(b.countedCash, 'BAD_AMOUNT')!;
    const note = text(b.note, 300, 'BAD_NOTE');
    const out = await inOrg(a, async (tx) => {
      const [s] = await tx.select().from(sysShift).where(and(isNull(sysShift.closedAt), tillIs(a.deviceId))).limit(1);
      if (!s) throw new HttpError(409, 'NO_SHIFT');
      const dr = await drawer(tx, s);
      const [closed] = await tx.update(sysShift).set({ closedAt: new Date(), closedBy: a.userId, expectedCash: dr.expected, countedCash: counted, note }).where(eq(sysShift.id, s.id)).returning();
      return { shift: closed, drawer: dr, difference: counted - dr.expected };
    });
    await audit(d.db, { kind: 'sys.shift_closed', organizationId: a.organizationId, userId: a.userId, detail: { expected: out.drawer.expected, counted, difference: out.difference } });
    return c.json(out);
  });

  r.get('/shifts', async (c) => {
    const a = actor(c, 'reports', 'read');
    const rows = await inOrg(a, (tx) => tx.select({ s: sysShift, device: counterDevice.name }).from(sysShift).leftJoin(counterDevice, eq(counterDevice.id, sysShift.deviceId)).orderBy(desc(sysShift.openedAt)).limit(60))
      .then((r) => r.map((x) => ({ ...x.s, deviceName: x.device })));
    const ids = [...new Set(rows.flatMap((s) => [s.openedBy, s.closedBy]).filter(Boolean))] as string[];
    const users = ids.length ? await (await d.auth.$context).adapter.findMany<any>({ model: 'user', where: [{ field: 'id', operator: 'in', value: ids }] }) : [];
    const name = (id: string | null) => users.find((u) => u.id === id)?.name ?? null;
    return c.json({ shifts: rows.map((s) => ({ ...s, openedByName: name(s.openedBy), closedByName: name(s.closedBy), difference: s.countedCash != null && s.expectedCash != null ? s.countedCash - s.expectedCash : null })) });
  });

  // ---------------- returns ----------------
  /** Some items back from a receipt. Refund in cash (from the drawer) or onto the customer's account. Stock comes back. */
  r.post('/sales/:id/returns', async (c) => {
    const a = actor(c, 'sales', 'refund');
    const b = await c.req.json<{ lines?: { lineId: string; qty: number }[]; refund?: string; reason?: string }>();
    if (!Array.isArray(b.lines) || !b.lines.length) bad('EMPTY_RETURN');
    const refund = b.refund === 'account' ? 'account' : 'cash';
    const reason = text(b.reason, 200, 'BAD_NOTE');
    const out = await inOrg(a, async (tx) => {
      const [sale] = await tx.select().from(sysSale).where(eq(sysSale.id, c.req.param('id')));
      if (!sale) throw new HttpError(404, 'NOT_FOUND');
      if (sale.voidedAt) throw new HttpError(409, 'ALREADY_VOID');
      if (refund === 'account' && !sale.customerId) throw new HttpError(400, 'CUSTOMER_REQUIRED');
      const saleLines = await tx.select({ l: sysSaleLine, track: sysProduct.trackStock }).from(sysSaleLine).leftJoin(sysProduct, eq(sysProduct.id, sysSaleLine.productId)).where(eq(sysSaleLine.saleId, sale.id));
      const factor = sale.subtotal ? sale.total / sale.subtotal : 1; // the sale's discount applies to what comes back too
      const picked = b.lines!.map((x) => {
        const row = saleLines.find((s) => s.l.id === x.lineId) ?? bad('BAD_LINE');
        const { l } = row;
        const qty = quantity(x.qty, l.packSize ? 'pack' : 'kg');
        if (qty > round3(l.qty - l.returnedQty)) bad('RETURN_TOO_MUCH');
        const base = round3(qty * (l.packSize ?? 1)), lineBase = l.baseQty ?? l.qty;
        return { l, track: row.track, qty, base, total: Math.round(qty * l.price * factor), cost: Math.round((l.cost / (lineBase || 1)) * base) };
      });
      const total = picked.reduce((s, x) => s + x.total, 0), cost = picked.reduce((s, x) => s + x.cost, 0);
      if (sale.returned + total > sale.total) bad('RETURN_TOO_MUCH');
      const shiftId = await openShiftId(tx, a.deviceId);
      const [ret] = await tx.insert(sysReturn).values({ id: newId(), organizationId: a.organizationId, saleId: sale.id, userId: a.userId, total, cost, refund, shiftId, reason }).returning();
      await tx.insert(sysReturnLine).values(picked.map((x) => ({ id: newId(), organizationId: a.organizationId, returnId: ret.id, saleLineId: x.l.id, productId: x.l.productId, name: x.l.name, qty: x.qty, baseQty: x.base, price: x.l.price, total: x.total })));
      for (const x of picked) {
        await tx.update(sysSaleLine).set({ returnedQty: sql`${sysSaleLine.returnedQty} + ${x.qty}` }).where(eq(sysSaleLine.id, x.l.id));
        if (x.track && x.l.productId) {
          const [p] = await tx.update(sysProduct).set({ stock: sql`${sysProduct.stock} + ${x.base}`, updatedAt: new Date() }).where(eq(sysProduct.id, x.l.productId)).returning({ stock: sysProduct.stock });
          await tx.insert(sysStockMove).values({ id: newId(), organizationId: a.organizationId, productId: x.l.productId, kind: 'return', qty: x.base, stock: p.stock, saleId: sale.id, note: reason, userId: a.userId });
        }
      }
      await tx.update(sysSale).set({ returned: sql`${sysSale.returned} + ${total}` }).where(eq(sysSale.id, sale.id));
      if (refund === 'account') {
        const [cu] = await tx.update(sysCustomer).set({ balance: sql`${sysCustomer.balance} - ${total}`, updatedAt: new Date() }).where(eq(sysCustomer.id, sale.customerId!)).returning();
        await tx.insert(sysLedger).values({ id: newId(), organizationId: a.organizationId, customerId: cu.id, kind: 'return', amount: -total, balance: cu.balance, saleId: sale.id, note: reason, userId: a.userId });
      }
      return { return: ret, lines: picked.map((x) => ({ name: x.l.name, qty: x.qty, total: x.total })) };
    });
    await audit(d.db, { kind: 'sys.sale_returned', organizationId: a.organizationId, userId: a.userId, detail: { saleId: c.req.param('id'), total: out.return.total, refund } });
    return c.json(out, 201);
  });

  r.get('/sales/:id/returns', async (c) => {
    const a = actor(c, 'sales', 'read');
    const out = await inOrg(a, async (tx) => {
      const returns = await tx.select().from(sysReturn).where(eq(sysReturn.saleId, c.req.param('id'))).orderBy(desc(sysReturn.createdAt));
      const lines = returns.length ? await tx.select().from(sysReturnLine).where(inArray(sysReturnLine.returnId, returns.map((x) => x.id))) : [];
      return returns.map((x) => ({ ...x, lines: lines.filter((l) => l.returnId === x.id) }));
    });
    return c.json({ returns: out });
  });

  // ---------------- suppliers ----------------
  const supplierInput = (b: any, partial = false) => {
    const out: Partial<typeof sysSupplier.$inferInsert> = {};
    if (!partial || b.name !== undefined) out.name = text(b.name, 100, 'BAD_NAME', true)!;
    if (b.phone !== undefined) out.phone = b.phone ? normalizeIraqiPhone(String(b.phone)) ?? bad('BAD_PHONE') : null;
    if (b.note !== undefined) out.note = text(b.note, 300, 'BAD_NOTE');
    return out;
  };

  r.get('/suppliers', async (c) => {
    const a = actor(c, 'purchases', 'read');
    const rows = await inOrg(a, (tx) => tx.select().from(sysSupplier).where(isNull(sysSupplier.archivedAt)).orderBy(desc(sysSupplier.balance), sysSupplier.name));
    return c.json({ suppliers: rows });
  });

  r.post('/suppliers', async (c) => {
    const a = actor(c, 'purchases', 'create');
    const input = supplierInput(await c.req.json());
    const [row] = await inOrg(a, (tx) => tx.insert(sysSupplier).values({ id: newId(), organizationId: a.organizationId, ...input } as any).returning());
    return c.json({ supplier: row }, 201);
  });

  r.patch('/suppliers/:id', async (c) => {
    const a = actor(c, 'purchases', 'create');
    const input = supplierInput(await c.req.json(), true);
    const [row] = await inOrg(a, (tx) => tx.update(sysSupplier).set({ ...input, updatedAt: new Date() }).where(eq(sysSupplier.id, c.req.param('id'))).returning());
    if (!row) throw new HttpError(404, 'NOT_FOUND');
    return c.json({ supplier: row });
  });

  r.get('/suppliers/:id', async (c) => {
    const a = actor(c, 'purchases', 'read');
    const out = await inOrg(a, async (tx) => {
      const [supplier] = await tx.select().from(sysSupplier).where(eq(sysSupplier.id, c.req.param('id')));
      if (!supplier) throw new HttpError(404, 'NOT_FOUND');
      const ledger = await tx.select({ l: sysSupplierLedger, number: sysPurchase.number, reference: sysPurchase.reference }).from(sysSupplierLedger)
        .leftJoin(sysPurchase, eq(sysPurchase.id, sysSupplierLedger.purchaseId)).where(eq(sysSupplierLedger.supplierId, supplier.id)).orderBy(desc(sysSupplierLedger.at)).limit(200);
      return { supplier, ledger: ledger.map((x) => ({ ...x.l, purchaseNumber: x.number, reference: x.reference })) };
    });
    return c.json(out);
  });

  /** Paying a supplier, from the drawer or from elsewhere (bank, the owner's pocket). */
  r.post('/suppliers/:id/payments', async (c) => {
    const a = actor(c, 'purchases', 'create');
    const b = await c.req.json<{ amount?: number; note?: string; fromDrawer?: boolean }>();
    const amount = iqd(b.amount, 'BAD_AMOUNT')!;
    if (amount <= 0) bad('BAD_AMOUNT');
    const note = text(b.note, 200, 'BAD_NOTE');
    const supplier = await inOrg(a, async (tx) => {
      const [row] = await tx.update(sysSupplier).set({ balance: sql`${sysSupplier.balance} - ${amount}`, updatedAt: new Date() }).where(eq(sysSupplier.id, c.req.param('id'))).returning();
      if (!row) throw new HttpError(404, 'NOT_FOUND');
      await tx.insert(sysSupplierLedger).values({ id: newId(), organizationId: a.organizationId, supplierId: row.id, kind: 'payment', amount: -amount, balance: row.balance,
        fromDrawer: !!b.fromDrawer, shiftId: b.fromDrawer ? await openShiftId(tx, a.deviceId) : null, note, userId: a.userId });
      return row;
    });
    return c.json({ supplier }, 201);
  });

  // ---------------- purchases (delivery invoices) ----------------
  r.post('/purchases', async (c) => {
    const a = actor(c, 'purchases', 'create');
    const b = await c.req.json<{ supplierId?: string | null; reference?: string; lines?: { productId: string; qty: number; cost: number; pack?: boolean }[]; paid?: number; fromDrawer?: boolean; note?: string; attachmentIds?: string[] }>();
    if (!Array.isArray(b.lines) || !b.lines.length || b.lines.length > 500) bad('EMPTY_PURCHASE');
    const reference = text(b.reference, 60, 'BAD_REFERENCE');
    const note = text(b.note, 300, 'BAD_NOTE');
    const out = await inOrg(a, async (tx) => {
      let supplier: typeof sysSupplier.$inferSelect | null = null;
      if (b.supplierId) { [supplier] = await tx.select().from(sysSupplier).where(eq(sysSupplier.id, b.supplierId)); if (!supplier) throw new HttpError(404, 'SUPPLIER_NOT_FOUND'); }
      const products = await tx.select().from(sysProduct).where(inArray(sysProduct.id, [...new Set(b.lines!.map((l) => String(l.productId)))]));
      const lines = b.lines!.map((l) => {
        const p = products.find((x) => x.id === String(l.productId)) ?? (() => { throw new HttpError(409, 'PRODUCT_GONE'); })();
        const pack = l.pack && p.packSize ? p.packSize : null;
        const qty = quantity(l.qty, pack ? 'pack' : p.unit);
        const cost = iqd(l.cost, 'BAD_COST')!;
        return { p, qty, pack, base: round3(qty * (pack ?? 1)), cost, total: Math.round(qty * cost), unitCost: pack ? Math.round(cost / pack) : cost };
      });
      const total = lines.reduce((s, l) => s + l.total, 0);
      const paid = Math.min(total, iqd(b.paid ?? (supplier ? 0 : total), 'BAD_PAID')!);
      const due = total - paid;
      if (due > 0 && !supplier) throw new HttpError(400, 'SUPPLIER_REQUIRED');
      const shiftId = b.fromDrawer ? await openShiftId(tx, a.deviceId) : null;
      const purchaseId = newId();
      await claimFiles(tx, b.attachmentIds, 'purchase', purchaseId);
      const [purchase] = await tx.insert(sysPurchase).values({ id: purchaseId, organizationId: a.organizationId, number: await nextNumber(tx, a.organizationId, 'purchase'), supplierId: supplier?.id ?? null,
        userId: a.userId, reference, total, paid, due, fromDrawer: !!b.fromDrawer && paid > 0, shiftId, note }).returning();
      await tx.insert(sysPurchaseLine).values(lines.map((l) => ({ id: newId(), organizationId: a.organizationId, purchaseId: purchase.id, productId: l.p.id, name: l.p.name, qty: l.qty, packSize: l.pack, baseQty: l.base, cost: l.cost, total: l.total })));
      for (const l of lines) {
        const [p] = await tx.update(sysProduct).set({ stock: l.p.trackStock ? sql`${sysProduct.stock} + ${l.base}` : sysProduct.stock, cost: l.unitCost, updatedAt: new Date() }).where(eq(sysProduct.id, l.p.id)).returning({ stock: sysProduct.stock });
        if (l.p.trackStock) await tx.insert(sysStockMove).values({ id: newId(), organizationId: a.organizationId, productId: l.p.id, kind: 'receive', qty: l.base, stock: p.stock, cost: l.unitCost, note: reference ? `#${purchase.number} · ${reference}` : `#${purchase.number}`, userId: a.userId });
      }
      if (supplier && due > 0) {
        const [s] = await tx.update(sysSupplier).set({ balance: sql`${sysSupplier.balance} + ${due}`, updatedAt: new Date() }).where(eq(sysSupplier.id, supplier.id)).returning();
        await tx.insert(sysSupplierLedger).values({ id: newId(), organizationId: a.organizationId, supplierId: s.id, kind: 'purchase', amount: due, balance: s.balance, purchaseId: purchase.id, userId: a.userId });
        supplier = s;
      }
      return { purchase, supplier };
    });
    return c.json(out, 201);
  });

  r.get('/purchases', async (c) => {
    const a = actor(c, 'purchases', 'read');
    const to = dateParam(c.req.query('to'), new Date());
    const from = dateParam(c.req.query('from'), new Date(to.getTime() - 30 * 86400_000));
    const rows = await inOrg(a, (tx) => tx.select({ p: sysPurchase, supplier: sysSupplier.name }).from(sysPurchase).leftJoin(sysSupplier, eq(sysSupplier.id, sysPurchase.supplierId))
      .where(and(gte(sysPurchase.createdAt, from), lt(sysPurchase.createdAt, to))).orderBy(desc(sysPurchase.createdAt)).limit(500));
    return c.json({ purchases: rows.map((x) => ({ ...x.p, supplierName: x.supplier })) });
  });

  r.get('/purchases/:id', async (c) => {
    const a = actor(c, 'purchases', 'read');
    const out = await inOrg(a, async (tx) => {
      const [purchase] = await tx.select().from(sysPurchase).where(eq(sysPurchase.id, c.req.param('id')));
      if (!purchase) throw new HttpError(404, 'NOT_FOUND');
      const lines = await tx.select().from(sysPurchaseLine).where(eq(sysPurchaseLine.purchaseId, purchase.id));
      const [supplier] = purchase.supplierId ? await tx.select().from(sysSupplier).where(eq(sysSupplier.id, purchase.supplierId)) : [null];
      return { purchase, lines, supplier: supplier ?? null, attachments: (await attachmentsOf(d, tx, [purchase.id]))[purchase.id] ?? [] };
    });
    return c.json(out);
  });

  // ---------------- expenses ----------------
  r.get('/expenses', async (c) => {
    const a = actor(c, 'expenses', 'read');
    const to = dateParam(c.req.query('to'), new Date());
    const from = dateParam(c.req.query('from'), new Date(to.getTime() - 30 * 86400_000));
    const rows = await inOrg(a, async (tx) => {
      const list = await tx.select().from(sysExpense).where(and(gte(sysExpense.at, from), lt(sysExpense.at, to))).orderBy(desc(sysExpense.at)).limit(1000);
      const files = await attachmentsOf(d, tx, list.map((x) => x.id));
      return list.map((x) => ({ ...x, attachments: files[x.id] ?? [] }));
    });
    return c.json({ expenses: rows });
  });

  r.post('/expenses', async (c) => {
    const a = actor(c, 'expenses', 'create');
    const b = await c.req.json<{ category?: string; amount?: number; note?: string; fromDrawer?: boolean; attachmentIds?: string[] }>();
    const category = EXPENSE_CATEGORIES.includes(b.category as any) ? b.category! : bad('BAD_CATEGORY');
    const amount = iqd(b.amount, 'BAD_AMOUNT')!;
    if (amount <= 0) bad('BAD_AMOUNT');
    const note = text(b.note, 200, 'BAD_NOTE');
    const out = await inOrg(a, async (tx) => {
      const id = newId();
      await claimFiles(tx, b.attachmentIds, 'expense', id);
      const [row] = await tx.insert(sysExpense).values({ id, organizationId: a.organizationId, category, amount, note, fromDrawer: !!b.fromDrawer,
        shiftId: b.fromDrawer ? await openShiftId(tx, a.deviceId) : null, userId: a.userId }).returning();
      return { ...row, attachments: (await attachmentsOf(d, tx, [id]))[id] ?? [] };
    });
    return c.json({ expense: out }, 201);
  });

  r.delete('/expenses/:id', async (c) => {
    const a = actor(c, 'expenses', 'create');
    const [row] = await inOrg(a, async (tx) => {
      const gone = await tx.delete(sysExpense).where(eq(sysExpense.id, c.req.param('id'))).returning();
      if (gone.length) await dropFiles(d, tx, and(eq(sysFile.refId, gone[0].id)));
      return gone;
    });
    if (!row) throw new HttpError(404, 'NOT_FOUND');
    await audit(d.db, { kind: 'sys.expense_deleted', organizationId: a.organizationId, userId: a.userId, detail: { category: row.category, amount: row.amount } });
    return c.json({ ok: true });
  });

  // ---------------- import from a spreadsheet ----------------
  /**
   * Up to 2,000 rows per request. A row whose barcode already exists updates that product (name, prices, category, pack);
   * any other row creates a product. A stock value sets the shelf count. Bad rows are skipped and reported, never half-saved.
   */
  r.post('/products/import', async (c) => {
    const a = actor(c, 'products', 'manage');
    const b = await c.req.json<{ rows?: any[] }>();
    if (!Array.isArray(b.rows) || !b.rows.length || b.rows.length > 2000) bad('BAD_IMPORT');
    const errors: { row: number; code: string }[] = [];
    const clean: { i: number; v: any; stock: number | null }[] = [];
    b.rows!.forEach((raw, i) => {
      try {
        const v = {
          name: text(raw.name, 120, 'BAD_NAME', true)!, price: iqd(raw.price, 'BAD_PRICE')!, cost: iqd(raw.cost, 'BAD_COST', { allowNull: true }),
          barcode: text(raw.barcode == null ? null : String(raw.barcode), 64, 'BAD_BARCODE'), category: text(raw.category, 60, 'BAD_CATEGORY'),
          unit: raw.unit ? (UNITS.includes(raw.unit) ? raw.unit : bad('BAD_UNIT')) : 'piece',
          lowStock: raw.lowStock == null || raw.lowStock === '' ? null : quantity(raw.lowStock, 'kg', 'BAD_LOW_STOCK'),
          packSize: raw.packSize == null || raw.packSize === '' ? null : (Number.isInteger(Number(raw.packSize)) && Number(raw.packSize) >= 2 ? Number(raw.packSize) : bad('BAD_PACK')),
          packBarcode: text(raw.packBarcode == null ? null : String(raw.packBarcode), 64, 'BAD_BARCODE'), packPrice: iqd(raw.packPrice, 'BAD_PRICE', { allowNull: true }),
        };
        const stock = raw.stock == null || raw.stock === '' ? null : Number(raw.stock);
        if (stock != null && (!Number.isFinite(stock) || stock < 0 || stock > 1_000_000)) bad('BAD_QTY');
        clean.push({ i, v, stock });
      } catch (e) { errors.push({ row: i, code: e instanceof HttpError ? e.code : 'BAD_ROW' }); }
    });
    // the same barcode twice in one sheet: keep the first
    const seen = new Set<string>();
    const rows = clean.filter((x) => { const k = x.v.barcode; if (!k) return true; if (seen.has(k)) { errors.push({ row: x.i, code: 'DUPLICATE_BARCODE' }); return false; } seen.add(k); return true; });

    const result = await inOrg(a, async (tx) => {
      const codes = rows.map((x) => x.v.barcode).filter(Boolean) as string[];
      const existing = codes.length ? await tx.select().from(sysProduct).where(and(isNull(sysProduct.archivedAt), inArray(sysProduct.barcode, codes))) : [];
      const packCodes = new Set((await tx.select({ c: sysProduct.packBarcode }).from(sysProduct).where(isNull(sysProduct.archivedAt))).map((x) => x.c).filter(Boolean));
      let created = 0, updated = 0;
      const inserts: (typeof sysProduct.$inferInsert)[] = [], moves: (typeof sysStockMove.$inferInsert)[] = [];
      for (const { i, v, stock } of rows) {
        if (v.barcode && packCodes.has(v.barcode)) { errors.push({ row: i, code: 'BARCODE_TAKEN' }); continue; }
        const found = v.barcode ? existing.find((p) => p.barcode === v.barcode) : undefined;
        if (found) {
          const [p] = await tx.update(sysProduct).set({ ...v, barcode: found.barcode, ...(stock != null ? { stock } : {}), updatedAt: new Date() }).where(eq(sysProduct.id, found.id)).returning();
          if (stock != null && stock !== found.stock) moves.push({ id: newId(), organizationId: a.organizationId, productId: p.id, kind: 'count', qty: round3(stock - found.stock), stock, userId: a.userId, note: 'import' });
          updated++;
        } else {
          const id = newId();
          inserts.push({ id, organizationId: a.organizationId, ...v, stock: stock ?? 0 });
          if (stock) moves.push({ id: newId(), organizationId: a.organizationId, productId: id, kind: 'count', qty: stock, stock, userId: a.userId, note: 'import' });
          created++;
        }
      }
      for (let k = 0; k < inserts.length; k += 250) await tx.insert(sysProduct).values(inserts.slice(k, k + 250));
      for (let k = 0; k < moves.length; k += 250) await tx.insert(sysStockMove).values(moves.slice(k, k + 250));
      return { created, updated };
    });
    await audit(d.db, { kind: 'sys.products_imported', organizationId: a.organizationId, userId: a.userId, detail: { ...result, skipped: errors.length } });
    return c.json({ ...result, errors: errors.sort((x, y) => x.row - y.row) });
  });

  return r;
}

