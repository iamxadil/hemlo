// Hemlo Systems V2: cartons, the cash drawer, returns, suppliers & purchases, expenses, import, and the fuller report.
import { describe, it, expect, beforeAll } from 'vitest';
import { setup, Browser, signInEmail, signInPhone, createOrg } from './helpers';

let t: Awaited<ReturnType<typeof setup>>;
let owner: Browser, cashier: Browser;
const id: Record<string, string> = {};
const today = () => `from=${new Date(Date.now() - 86400_000).toISOString()}&to=${new Date(Date.now() + 60_000).toISOString()}`;
const stock = async (pid: string) => (await owner.get('/v1/sys/products')).json.products.find((p: any) => p.id === pid).stock;

beforeAll(async () => {
  t = await setup();
  owner = new Browser(t.app);
  await signInEmail(owner, 'v2-owner@example.com');
  await owner.post('/v1/auth/update-user', { name: 'Abu Hussein' });
  await createOrg(owner, 'Al-Noor Market');
  const inv = await owner.post('/v1/invites', { phone: '07705550001', role: 'cashier', name: 'Hassan' });
  cashier = new Browser(t.app);
  await signInPhone(cashier, '+9647705550001');
  await cashier.post(`/v1/invites/by-token/${encodeURIComponent(new URL(inv.json.url).searchParams.get('t')!)}/accept`);
  const add = async (k: string, body: any) => { id[k] = (await owner.post('/v1/sys/products', body)).json.product.id; };
  await add('pepsi', { name: 'Pepsi', barcode: '111', price: 500, cost: 400, stock: 100, packSize: 24, packBarcode: '111-24', packPrice: 11000 });
  await add('nido', { name: 'Nido', barcode: '222', price: 9500, cost: 8000, stock: 10 });
});

describe('cartons', () => {
  it('a carton sells at the carton price and takes 24 pieces out of stock', async () => {
    const s = await cashier.post('/v1/sys/sales', { lines: [{ productId: id.pepsi, qty: 2, pack: true }, { productId: id.pepsi, qty: 3 }] });
    expect(s.status).toBe(201);
    expect(s.json.sale.total).toBe(22000 + 1500);
    expect(s.json.lines.find((l: any) => l.packSize === 24)).toMatchObject({ qty: 2, baseQty: 48, price: 11000 });
    expect(await stock(id.pepsi)).toBe(100 - 48 - 3);
  });

  it('cartons are whole; a product without a carton cannot be sold as one; carton barcodes never clash', async () => {
    expect((await cashier.post('/v1/sys/sales', { lines: [{ productId: id.pepsi, qty: 0.5, pack: true }] })).json.error).toBe('BAD_QTY');
    expect((await cashier.post('/v1/sys/sales', { lines: [{ productId: id.nido, qty: 1, pack: true }] })).json.error).toBe('NO_PACK');
    expect((await owner.post('/v1/sys/products', { name: 'X', price: 1, barcode: '111-24' })).json.error).toBe('BARCODE_TAKEN');
    expect((await owner.req('PATCH', `/v1/sys/products/${id.nido}`, { packSize: 12, packBarcode: '111' })).json.error).toBe('BARCODE_TAKEN');
    expect((await owner.req('PATCH', `/v1/sys/products/${id.nido}`, { packSize: 12, packBarcode: '222-12' })).json.product).toMatchObject({ packSize: 12, packBarcode: '222-12' });
  });
});

describe('the cash drawer', () => {
  it('opens once; counts only cash in and out; closing records the difference', async () => {
    expect((await cashier.post('/v1/sys/shift/open', { openingCash: 50000 })).status).toBe(201);
    expect((await owner.post('/v1/sys/shift/open', { openingCash: 1 })).json.error).toBe('SHIFT_OPEN');

    const cu = (await cashier.post('/v1/sys/customers', { name: 'Umm Ali' })).json.customer;
    id.cu = cu.id;
    const cash = await cashier.post('/v1/sys/sales', { lines: [{ productId: id.pepsi, qty: 10 }] });          // +5,000 cash
    id.cashSale = cash.json.sale.id;
    await cashier.post('/v1/sys/sales', { method: 'card', lines: [{ productId: id.pepsi, qty: 4 }] });        // card: not in the drawer
    await cashier.post('/v1/sys/sales', { method: 'credit', paid: 1000, customerId: cu.id, lines: [{ productId: id.nido, qty: 1 }] }); // +1,000 cash, 8,500 on account
    await cashier.post(`/v1/sys/customers/${cu.id}/payments`, { amount: 3000 });                             // +3,000 cash
    await cashier.post(`/v1/sys/customers/${cu.id}/payments`, { amount: 1000, method: 'card' });              // card
    await owner.post('/v1/sys/expenses', { category: 'generator', amount: 2000, fromDrawer: true });         // −2,000
    await owner.post('/v1/sys/expenses', { category: 'rent', amount: 100000 });                              // paid elsewhere
    await owner.post(`/v1/sys/sales/${id.cashSale}/returns`, { lines: [{ lineId: cash.json.lines[0].id, qty: 1 }], refund: 'cash' }); // −500
    const sup = (await owner.post('/v1/sys/suppliers', { name: 'Baghdad Wholesale', phone: '0780 111 2222' })).json.supplier;
    id.sup = sup.id;
    await owner.post(`/v1/sys/suppliers/${sup.id}/payments`, { amount: 4000, fromDrawer: true });            // −4,000

    const now = (await cashier.get('/v1/sys/shift')).json;
    expect(now.drawer).toMatchObject({ opening: 50000, cashSales: 6000, cardSales: 2000, onAccount: 8500, debtPayments: 3000, refunds: 500, expenses: 2000, supplierPayments: 4000 });
    expect(now.drawer.expected).toBe(50000 + 6000 + 3000 - 500 - 2000 - 4000);

    const close = await cashier.post('/v1/sys/shift/close', { countedCash: 52000, note: 'short 500' });
    expect(close.json).toMatchObject({ difference: -500, shift: { expectedCash: 52500, countedCash: 52000 } });
    expect((await cashier.post('/v1/sys/shift/close', { countedCash: 1 })).json.error).toBe('NO_SHIFT');
    expect((await cashier.get('/v1/sys/shifts')).status).toBe(403);
    const hist = (await owner.get('/v1/sys/shifts')).json.shifts;
    expect(hist[0]).toMatchObject({ difference: -500, openedByName: 'Hassan', closedByName: 'Hassan' });
  });
});

describe('returns', () => {
  it('part of a receipt comes back: stock returns, the discount is shared, and never more than was sold', async () => {
    const s = await owner.post('/v1/sys/sales', { lines: [{ productId: id.pepsi, qty: 4 }, { productId: id.nido, qty: 1 }], discount: 1150 }); // 11,500 − 1,150 = 10,350 (90%)
    const pepsiLine = s.json.lines.find((l: any) => l.productId === id.pepsi);
    const before = await stock(id.pepsi);
    expect((await cashier.post(`/v1/sys/sales/${s.json.sale.id}/returns`, { lines: [{ lineId: pepsiLine.id, qty: 1 }] })).status).toBe(403);
    const r = await owner.post(`/v1/sys/sales/${s.json.sale.id}/returns`, { lines: [{ lineId: pepsiLine.id, qty: 2 }], reason: 'expired' });
    expect(r.status).toBe(201);
    expect(r.json.return).toMatchObject({ total: 900, refund: 'cash' });                 // 2 × 500 × 0.9
    expect(await stock(id.pepsi)).toBe(before + 2);
    expect((await owner.post(`/v1/sys/sales/${s.json.sale.id}/returns`, { lines: [{ lineId: pepsiLine.id, qty: 3 }] })).json.error).toBe('RETURN_TOO_MUCH');
    expect((await owner.post(`/v1/sys/sales/${s.json.sale.id}/returns`, { lines: [{ lineId: pepsiLine.id, qty: 1 }], refund: 'account' })).json.error).toBe('CUSTOMER_REQUIRED');
    expect((await owner.post(`/v1/sys/sales/${s.json.sale.id}/void`, {})).json.error).toBe('HAS_RETURNS');
    const list = (await owner.get(`/v1/sys/sales/${s.json.sale.id}/returns`)).json.returns;
    expect(list[0].lines[0]).toMatchObject({ qty: 2, total: 900 });
  });

  it('a return can go back onto the customer’s account', async () => {
    const s = await cashier.post('/v1/sys/sales', { method: 'credit', customerId: id.cu, lines: [{ productId: id.nido, qty: 1 }] });
    const before = (await owner.get(`/v1/sys/customers/${id.cu}`)).json.customer.balance;
    await owner.post(`/v1/sys/sales/${s.json.sale.id}/returns`, { lines: [{ lineId: s.json.lines[0].id, qty: 1 }], refund: 'account' });
    const book = (await owner.get(`/v1/sys/customers/${id.cu}`)).json;
    expect(book.customer.balance).toBe(before - 9500);
    expect(book.ledger[0]).toMatchObject({ kind: 'return', amount: -9500 });
  });
});

describe('suppliers & purchases', () => {
  it('a delivery invoice: cartons into stock, cost per piece updated, the unpaid part owed to the supplier', async () => {
    const before = await stock(id.pepsi);
    const p = await owner.post('/v1/sys/purchases', { supplierId: id.sup, reference: 'INV-7781', paid: 20000, lines: [{ productId: id.pepsi, qty: 5, pack: true, cost: 10000 }] });
    expect(p.status).toBe(201);
    expect(p.json.purchase).toMatchObject({ number: 1, total: 50000, paid: 20000, due: 30000 });
    expect(await stock(id.pepsi)).toBe(before + 120);
    expect((await owner.get('/v1/sys/products')).json.products.find((x: any) => x.id === id.pepsi).cost).toBe(417); // 10,000 / 24
    const sup = (await owner.get(`/v1/sys/suppliers/${id.sup}`)).json;
    expect(sup.supplier.balance).toBe(30000 - 4000);
    expect(sup.ledger[0]).toMatchObject({ kind: 'purchase', amount: 30000, purchaseNumber: 1, reference: 'INV-7781' });
    expect((await owner.post('/v1/sys/purchases', { paid: 0, lines: [{ productId: id.nido, qty: 1, cost: 8000 }] })).json.error).toBe('SUPPLIER_REQUIRED');
    expect((await cashier.post('/v1/sys/purchases', { lines: [{ productId: id.nido, qty: 1, cost: 8000 }] })).status).toBe(403);
    expect((await cashier.get('/v1/sys/suppliers')).status).toBe(403);
  });
});

describe('expenses', () => {
  it('categories are fixed; cashiers cannot add or see them', async () => {
    expect((await owner.post('/v1/sys/expenses', { category: 'party', amount: 1 })).json.error).toBe('BAD_CATEGORY');
    expect((await owner.get('/v1/sys/expenses')).json.expenses.map((e: any) => e.category).sort()).toEqual(['generator', 'rent']);
    expect((await cashier.post('/v1/sys/expenses', { category: 'rent', amount: 1 })).status).toBe(403);
  });
});

describe('import', () => {
  it('creates new products, updates by barcode, and reports the rows it skipped', async () => {
    const r = await owner.post('/v1/sys/products/import', { rows: [
      { name: 'Tea 500g', barcode: 333, price: 4250, cost: 3500, stock: 20, category: 'Grocery' },
      { name: 'Nido 900g', barcode: '222', price: 9750, cost: 8200, stock: 12 },
      { name: '', price: 100 },
      { name: 'Tea again', barcode: '333', price: 1 },
      { name: 'Clash', barcode: '111-24', price: 1 },
    ] });
    expect(r.json).toMatchObject({ created: 1, updated: 1 });
    expect(r.json.errors).toEqual([{ row: 2, code: 'BAD_NAME' }, { row: 3, code: 'DUPLICATE_BARCODE' }, { row: 4, code: 'BARCODE_TAKEN' }]);
    const list = (await owner.get('/v1/sys/products')).json.products;
    expect(list.find((p: any) => p.barcode === '222')).toMatchObject({ name: 'Nido 900g', price: 9750, stock: 12 });
    expect(list.find((p: any) => p.barcode === '333')).toMatchObject({ name: 'Tea 500g', stock: 20 });
    expect((await cashier.post('/v1/sys/products/import', { rows: [{ name: 'x', price: 1 }] })).status).toBe(403);
  });
});

describe('the report', () => {
  it('returns come off sales, expenses come off profit, per cashier, and what the shop owes suppliers', async () => {
    const r = (await owner.get(`/v1/sys/reports/summary?${today()}`)).json;
    expect(r.returns.n).toBe(3);
    expect(r.net).toBe(r.total - r.returns.total);
    expect(r.expenses.total).toBe(102000);
    expect(r.netProfit).toBe(r.profit - 102000);
    expect(r.owedToSuppliers).toBe(26000);
    expect(r.byUser.map((u: any) => u.name).sort()).toEqual(['Abu Hussein', 'Hassan']);
  });
});
