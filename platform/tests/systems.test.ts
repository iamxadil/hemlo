// Hemlo Systems core (Stores & Markets): products, the checkout, the debt book, voids, reports, and the walls between shops.
import { describe, it, expect, beforeAll } from 'vitest';
import { setup, Browser, signInEmail, signInPhone, createOrg } from './helpers';

let t: Awaited<ReturnType<typeof setup>>;
let owner: Browser, cashier: Browser;
const ids: Record<string, string> = {};

beforeAll(async () => {
  t = await setup();
  owner = new Browser(t.app);
  await signInEmail(owner, 'market-owner@example.com');
  await createOrg(owner, 'Al-Khair Market');
  const inv = await owner.post('/v1/invites', { phone: '07704440001', role: 'cashier', name: 'Hassan' });
  cashier = new Browser(t.app);
  await signInPhone(cashier, '+9647704440001');
  await cashier.post(`/v1/invites/by-token/${encodeURIComponent(new URL(inv.json.url).searchParams.get('t')!)}/accept`);
});

describe('products', () => {
  it('the owner adds products; opening stock is recorded as a move', async () => {
    const pepsi = await owner.post('/v1/sys/products', { name: 'Pepsi 330ml', barcode: '6281036001017', price: 500, cost: 375, stock: 48, lowStock: 12, category: 'Drinks' });
    expect(pepsi.status).toBe(201);
    ids.pepsi = pepsi.json.product.id;
    const rice = await owner.post('/v1/sys/products', { name: 'Rice (loose)', unit: 'kg', price: 1750, cost: 1400, stock: 50 });
    ids.rice = rice.json.product.id;
    const bread = await owner.post('/v1/sys/products', { name: 'Samoon', price: 250, trackStock: false });
    ids.bread = bread.json.product.id;
    expect((await owner.get(`/v1/sys/products/${ids.pepsi}/moves`)).json.moves[0]).toMatchObject({ kind: 'count', qty: 48, stock: 48 });
  });

  it('a barcode belongs to one product per shop', async () => {
    expect((await owner.post('/v1/sys/products', { name: 'Fake Pepsi', barcode: '6281036001017', price: 1 })).json.error).toBe('BARCODE_TAKEN');
  });

  it('bad input is refused', async () => {
    expect((await owner.post('/v1/sys/products', { name: '', price: 500 })).json.error).toBe('BAD_NAME');
    expect((await owner.post('/v1/sys/products', { name: 'X', price: 12.5 })).json.error).toBe('BAD_PRICE');
    expect((await owner.post('/v1/sys/products', { name: 'X', price: 1, unit: 'ton' })).json.error).toBe('BAD_UNIT');
  });

  it('a cashier can see products (without costs) but not change them', async () => {
    const list = (await cashier.get('/v1/sys/products')).json.products;
    expect(list).toHaveLength(3);
    expect(list.every((p: any) => p.cost === null)).toBe(true);
    expect((await cashier.post('/v1/sys/products', { name: 'Mine', price: 1 })).status).toBe(403);
    expect((await cashier.req('PATCH', `/v1/sys/products/${ids.pepsi}`, { price: 1 })).status).toBe(403);
    const me = (await cashier.get('/v1/sys/me')).json;
    expect(me).toMatchObject({ role: 'cashier', business: { name: 'Al-Khair Market', currency: 'IQD' } });
    expect(me.can).toMatchObject({ 'sales.create': true, 'products.manage': false, 'sales.refund': false, 'reports.read': false });
  });

  it('deliveries, counts and damage move stock and keep a history', async () => {
    const recv = await owner.post(`/v1/sys/products/${ids.pepsi}/stock`, { kind: 'receive', qty: 24, cost: 400 });
    expect(recv.json.product).toMatchObject({ stock: 72, cost: 400 });
    expect((await owner.post(`/v1/sys/products/${ids.pepsi}/stock`, { kind: 'count', qty: 70 })).json.product.stock).toBe(70);
    expect((await owner.post(`/v1/sys/products/${ids.pepsi}/stock`, { kind: 'damage', qty: 2, note: 'dented' })).json.product.stock).toBe(68);
    expect((await owner.post(`/v1/sys/products/${ids.pepsi}/stock`, { kind: 'receive', qty: 1.5 })).json.error).toBe('BAD_QTY'); // cans are whole
    const kinds = (await owner.get(`/v1/sys/products/${ids.pepsi}/moves`)).json.moves.map((m: any) => m.kind);
    expect(kinds).toEqual(['damage', 'count', 'receive', 'count']);
    expect((await cashier.post(`/v1/sys/products/${ids.pepsi}/stock`, { kind: 'receive', qty: 1 })).status).toBe(403);
  });
});

describe('the checkout', () => {
  it('a cash sale: numbered, stock goes down, totals from the shop’s own prices', async () => {
    const r = await cashier.post('/v1/sys/sales', { clientId: 'c-1', lines: [{ productId: ids.pepsi, qty: 2, price: 1 }, { productId: ids.rice, qty: 1.5 }, { productId: ids.bread, qty: 10 }] });
    expect(r.status).toBe(201);
    expect(r.json.sale).toMatchObject({ number: 1, subtotal: 1000 + 2625 + 2500, total: 6125, paid: 6125, due: 0, method: 'cash' });
    expect(r.json.lines.find((l: any) => l.name === 'Pepsi 330ml').price).toBe(500); // a cashier can't set prices
    const products = (await owner.get('/v1/sys/products')).json.products;
    expect(products.find((p: any) => p.id === ids.pepsi).stock).toBe(66);
    expect(products.find((p: any) => p.id === ids.rice).stock).toBe(48.5);
    expect(r.json.sale.cost).toBe(2 * 400 + Math.round(1.5 * 1400)); // profit uses the latest cost
  });

  it('the same sale sent twice (a retry after the internet dropped) is counted once', async () => {
    const again = await cashier.post('/v1/sys/sales', { clientId: 'c-1', lines: [{ productId: ids.pepsi, qty: 2 }] });
    expect(again.status).toBe(200);
    expect(again.json).toMatchObject({ repeated: true, sale: { number: 1 } });
    expect((await owner.get('/v1/sys/products')).json.products.find((p: any) => p.id === ids.pepsi).stock).toBe(66);
  });

  it('owners may change a price at the till, and give a discount', async () => {
    const r = await owner.post('/v1/sys/sales', { lines: [{ productId: ids.pepsi, qty: 1, price: 450 }], discount: 50, method: 'card' });
    expect(r.json.sale).toMatchObject({ number: 2, subtotal: 450, discount: 50, total: 400, method: 'card' });
    expect((await owner.post('/v1/sys/sales', { lines: [{ productId: ids.pepsi, qty: 1 }], discount: 9999 })).json.error).toBe('BAD_DISCOUNT');
  });

  it('refuses empty sales, bad quantities and unknown products', async () => {
    expect((await cashier.post('/v1/sys/sales', { lines: [] })).json.error).toBe('EMPTY_SALE');
    expect((await cashier.post('/v1/sys/sales', { lines: [{ productId: ids.pepsi, qty: 0 }] })).json.error).toBe('BAD_QTY');
    expect((await cashier.post('/v1/sys/sales', { lines: [{ productId: 'nope', qty: 1 }] })).json.error).toBe('PRODUCT_GONE');
  });
});

describe('the debt book', () => {
  it('a sale on credit needs a customer, and goes on their account', async () => {
    expect((await cashier.post('/v1/sys/sales', { method: 'credit', lines: [{ productId: ids.rice, qty: 2 }] })).json.error).toBe('CUSTOMER_REQUIRED');
    const cu = await cashier.post('/v1/sys/customers', { name: 'Abu Ali', phone: '0770 555 1234' });
    expect(cu.json.customer.phone).toBe('+9647705551234');
    ids.abuAli = cu.json.customer.id;
    expect((await cashier.post('/v1/sys/customers', { name: 'X', phone: '12' })).json.error).toBe('BAD_PHONE');

    const s = await cashier.post('/v1/sys/sales', { method: 'credit', paid: 1500, customerId: ids.abuAli, lines: [{ productId: ids.rice, qty: 2 }] });
    expect(s.json.sale).toMatchObject({ total: 3500, paid: 1500, due: 2000, method: 'mixed' });
    ids.creditSale = s.json.sale.id;
    const s2 = await cashier.post('/v1/sys/sales', { method: 'credit', customerId: ids.abuAli, lines: [{ productId: ids.bread, qty: 4 }] });
    expect(s2.json.sale).toMatchObject({ total: 1000, paid: 0, due: 1000, method: 'credit' });
    expect(s2.json.customer.balance).toBe(3000);
  });

  it('payments reduce the balance; the history shows every step', async () => {
    const p = await cashier.post(`/v1/sys/customers/${ids.abuAli}/payments`, { amount: 2500, note: 'cash' });
    expect(p.json.customer.balance).toBe(500);
    const book = (await cashier.get(`/v1/sys/customers/${ids.abuAli}`)).json;
    expect(book.ledger.map((l: any) => [l.kind, l.amount, l.balance])).toEqual([['payment', -2500, 500], ['sale', 1000, 3000], ['sale', 2000, 2000]]);
    expect(book.ledger[2].saleNumber).toBeGreaterThan(0);
    expect((await cashier.get('/v1/sys/customers?q=abu')).json.customers[0].balance).toBe(500);
    expect((await cashier.get('/v1/sys/customers?q=5551234')).json.customers).toHaveLength(1);
  });
});

describe('cancelling a sale', () => {
  it('only managers and owners; stock comes back and the debt it made is removed', async () => {
    expect((await cashier.post(`/v1/sys/sales/${ids.creditSale}/void`, { reason: 'mistake' })).status).toBe(403);
    const v = await owner.post(`/v1/sys/sales/${ids.creditSale}/void`, { reason: 'wrong customer' });
    expect(v.status).toBe(200);
    expect(v.json.sale.voidedAt).toBeTruthy();
    expect((await owner.post(`/v1/sys/sales/${ids.creditSale}/void`, {})).json.error).toBe('ALREADY_VOID');
    expect((await owner.get('/v1/sys/products')).json.products.find((p: any) => p.id === ids.rice).stock).toBe(48.5);
    expect((await owner.get(`/v1/sys/customers/${ids.abuAli}`)).json.customer.balance).toBe(-1500); // they overpaid: the shop owes them
    const events = (await owner.get('/v1/events/org')).json.events.map((e: any) => e.kind);
    expect(events).toContain('sys.sale_voided');
  });
});

describe('reports', () => {
  it('today: count, sales, profit, methods, collected, best sellers, low stock, debts', async () => {
    const now = new Date();
    const r = await owner.get(`/v1/sys/reports/summary?from=${new Date(now.getTime() - 86400_000).toISOString()}&to=${new Date(now.getTime() + 60_000).toISOString()}`);
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({ count: 3, total: 6125 + 400 + 1000, collected: 2500 });
    expect(r.json.byMethod).toMatchObject({ card: 400, credit: 1000 });
    expect(r.json.profit).toBe(r.json.total - r.json.cost);
    expect(r.json.series.values).toHaveLength(24);
    expect(r.json.series.values.reduce((a: number, b: number) => a + b, 0)).toBe(r.json.total);
    expect(r.json.top[0]).toMatchObject({ name: 'Samoon', total: 3500 }); // 2,500 cash + 1,000 on credit; the rice on credit was voided
    expect(r.json.debt).toEqual({ total: 0, people: 0 }); // Abu Ali is in credit now
    expect((await cashier.get('/v1/sys/reports/summary')).status).toBe(403);
  });
});

describe('the walls between shops', () => {
  it('another shop sees none of this, even knowing the ids', async () => {
    const other = new Browser(t.app);
    await signInEmail(other, 'other-market@example.com');
    await createOrg(other, 'Rival Market');
    expect((await other.get('/v1/sys/products')).json.products).toHaveLength(0);
    expect((await other.get(`/v1/sys/customers/${ids.abuAli}`)).status).toBe(404);
    expect((await other.post('/v1/sys/sales', { lines: [{ productId: ids.pepsi, qty: 1 }] })).json.error).toBe('PRODUCT_GONE');
    expect((await other.post(`/v1/sys/sales/${ids.creditSale}/void`, {})).status).toBe(404);
    // and the same barcode is fine in a different shop
    expect((await other.post('/v1/sys/products', { name: 'Pepsi', barcode: '6281036001017', price: 500 })).status).toBe(201);
  });

  it('someone without a business is refused', async () => {
    const lone = new Browser(t.app);
    await signInEmail(lone, 'no-shop@example.com');
    expect((await lone.get('/v1/sys/products')).json.error).toBe('NO_ACTIVE_ORGANIZATION');
  });
});
