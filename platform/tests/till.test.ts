// The till: FIB payments (against a fake FIB that follows the documented API), one drawer per till, scale codes.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, type Server } from 'node:http';
import { setup, Browser, signInEmail, signInPhone, createOrg } from './helpers';

// ---- a fake FIB: token, create, status, cancel, refund ----
type Pay = { id: string; amount: number; status: 'UNPAID' | 'PAID' | 'DECLINED'; paidAmount?: number; refunded?: boolean; callback: string };
const fib = { pays: new Map<string, Pay>(), n: 0, server: null as Server | null, url: '' };
const read = (req: any) => new Promise<string>((ok) => { let b = ''; req.on('data', (c: any) => (b += c)); req.on('end', () => ok(b)); });
beforeAll(async () => {
  fib.server = createServer(async (req, res) => {
    const url = new URL(req.url!, 'http://x');
    const json = (status: number, body?: unknown) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(body ? JSON.stringify(body) : ''); };
    if (url.pathname === '/auth/realms/fib-online-shop/protocol/openid-connect/token') {
      const f = new URLSearchParams(await read(req));
      return f.get('client_id') === 'hemlo-shop' && f.get('client_secret') === 's3cret' ? json(200, { access_token: 'tok', expires_in: 60 }) : json(401, { error: 'invalid_client' });
    }
    if (req.headers.authorization !== 'Bearer tok') return json(401);
    const m = url.pathname.match(/^\/protected\/v1\/payments(?:\/([^/]+)\/(status|cancel|refund))?$/);
    if (!m) return json(404);
    if (!m[1] && req.method === 'POST') {
      const b = JSON.parse(await read(req));
      const id = `fib-${++fib.n}`;
      fib.pays.set(id, { id, amount: Number(b.monetaryValue.amount), status: 'UNPAID', callback: b.statusCallbackUrl });
      return json(202, { paymentId: id, readableCode: 'S3LE-NZ2S-ZNGF', qrCode: 'data:image/png;base64,iVBOR', personalAppLink: `https://personal.fib.iq/pay/${id}`, validUntil: new Date(Date.now() + 300_000).toISOString() });
    }
    const p = fib.pays.get(m[1]!);
    if (!p) return json(404);
    if (m[2] === 'status') return json(200, { paymentId: p.id, status: p.status, paidAt: p.status === 'PAID' ? new Date().toISOString() : null, amount: { amount: p.paidAmount ?? p.amount, currency: 'IQD' }, paidBy: p.status === 'PAID' ? { name: 'Ali Kareem', iban: 'IQ00' } : null, decliningReason: p.status === 'DECLINED' ? 'PAYMENT_CANCELLATION' : null });
    if (m[2] === 'cancel') { if (p.status === 'UNPAID') p.status = 'DECLINED'; return json(204); }
    if (m[2] === 'refund') { if (p.status !== 'PAID') return json(400); p.refunded = true; return json(202); }
  }).listen(0);
  await new Promise((ok) => fib.server!.once('listening', ok));
  fib.url = `http://localhost:${(fib.server!.address() as any).port}`;
});
afterAll(() => fib.server?.close());
/** Read past row-level security, inside one transaction only (the app shares this connection). */
const sysRow = (sql: string, params: unknown[]) => t.client.transaction(async (tx: any) => { await tx.query("select set_config('app.system', 'on', true)"); return (await tx.query(sql, params)).rows[0] as any; });
const customerPays = (id: string, amount?: number) => { const p = [...fib.pays.values()].find((x) => x.id === id)!; p.status = 'PAID'; if (amount != null) p.paidAmount = amount; return p; };

let t: Awaited<ReturnType<typeof setup>>;
let owner: Browser, cashier: Browser, orgId: string;
const id: Record<string, string> = {};

beforeAll(async () => {
  t = await setup({ FIB_BASE_URL: fib.url } as any);
  owner = new Browser(t.app);
  await signInEmail(owner, 'till-owner@example.com');
  orgId = (await createOrg(owner, 'Till Market')).id;
  const inv = await owner.post('/v1/invites', { phone: '07706660001', role: 'cashier', name: 'Hassan' });
  cashier = new Browser(t.app);
  await signInPhone(cashier, '+9647706660001');
  await cashier.post(`/v1/invites/by-token/${encodeURIComponent(new URL(inv.json.url).searchParams.get('t')!)}/accept`);
  id.p = (await owner.post('/v1/sys/products', { name: 'Nido', barcode: '222', price: 5000, cost: 4000, stock: 50 })).json.product.id;
});

describe('connecting the shop’s FIB account', () => {
  it('only the owner; wrong credentials are refused; the secret is sealed and never shown', async () => {
    expect((await cashier.req('PUT', '/v1/sys/settings/fib', { env: 'sandbox', clientId: 'hemlo-shop', clientSecret: 's3cret' })).status).toBe(403);
    expect((await owner.req('PUT', '/v1/sys/settings/fib', { env: 'sandbox', clientId: 'hemlo-shop', clientSecret: 'wrong' })).json.error).toBe('FIB_AUTH_FAILED');
    const ok = await owner.req('PUT', '/v1/sys/settings/fib', { env: 'sandbox', clientId: 'hemlo-shop', clientSecret: 's3cret' });
    expect(ok.json.fib).toMatchObject({ connected: true, env: 'sandbox', clientId: 'heml…' });
    const settings = (await cashier.get('/v1/sys/settings')).json;
    expect(settings.fib).toMatchObject({ connected: true });
    expect(JSON.stringify(settings)).not.toContain('s3cret');
    const stored = await sysRow(`select fib from sys_settings where organization_id = $1`, [orgId]);
    expect(stored.fib.secret).toMatch(/^v1\./);
    expect(JSON.stringify(stored.fib)).not.toContain('s3cret');
  });
});

describe('paying with FIB at the till', () => {
  it('QR code first; the sale only goes through once FIB itself says PAID, for this exact amount, once', async () => {
    const pay = await cashier.post('/v1/sys/fib/payments', { amount: 10000, description: 'Till Market' });
    expect(pay.status).toBe(201);
    expect(pay.json.payment).toMatchObject({ status: 'UNPAID', amount: 10000, readableCode: 'S3LE-NZ2S-ZNGF' });
    expect(pay.json.payment.qrCode).toMatch(/^data:image\/png/);
    id.pay = pay.json.payment.id;
    const sale = { method: 'fib', fibPaymentId: id.pay, lines: [{ productId: id.p, qty: 2 }] };
    expect((await cashier.post('/v1/sys/sales', sale)).json.error).toBe('FIB_NOT_PAID');

    customerPays(`fib-${fib.n}`);
    await new Promise((r) => setTimeout(r, 2100)); // the till polls every two seconds
    expect((await cashier.get(`/v1/sys/fib/payments/${id.pay}`)).json.payment).toMatchObject({ status: 'PAID', paidBy: 'Ali Kareem' });

    const s = await cashier.post('/v1/sys/sales', sale);
    expect(s.status).toBe(201);
    expect(s.json.sale).toMatchObject({ method: 'fib', total: 10000, paid: 10000, due: 0 });
    id.fibSale = s.json.sale.id;
    expect((await cashier.post('/v1/sys/sales', sale)).json.error).toBe('FIB_ALREADY_USED');
  });

  it('a payment for a different amount cannot pay this cart', async () => {
    const pay = (await cashier.post('/v1/sys/fib/payments', { amount: 5000 })).json.payment;
    customerPays(`fib-${fib.n}`);
    expect((await cashier.post('/v1/sys/sales', { method: 'fib', fibPaymentId: pay.id, lines: [{ productId: id.p, qty: 2 }] })).json.error).toBe('FIB_AMOUNT_MISMATCH');
  });

  it('FIB says PAID but for less than asked: treated as declined', async () => {
    const pay = (await cashier.post('/v1/sys/fib/payments', { amount: 5000 })).json.payment;
    customerPays(`fib-${fib.n}`, 500);
    await new Promise((r) => setTimeout(r, 2100));
    expect((await cashier.get(`/v1/sys/fib/payments/${pay.id}`)).json.payment).toMatchObject({ status: 'DECLINED', declineReason: 'AMOUNT_MISMATCH' });
  });

  it('the callback is signed per payment, and only makes us ask FIB (a forged PAID changes nothing)', async () => {
    const pay = (await cashier.post('/v1/sys/fib/payments', { amount: 5000 })).json.payment;
    const cb = fib.pays.get(`fib-${fib.n}`)!.callback;
    const path = new URL(cb).pathname + new URL(cb).search;
    expect((await new Browser(t.app).post(path.replace(/sig=[^&]+/, 'sig=forged'), { id: 'x', status: 'PAID' })).status).toBe(404);
    await new Browser(t.app).post(path, { id: `fib-${fib.n}`, status: 'PAID' }); // FIB still says UNPAID
    expect((await sysRow(`select status from sys_fib_payment where id = $1`, [pay.id])).status).toBe('UNPAID');
    customerPays(`fib-${fib.n}`);
    await new Browser(t.app).post(path, { id: `fib-${fib.n}`, status: 'PAID' });
    expect((await sysRow(`select status from sys_fib_payment where id = $1`, [pay.id])).status).toBe('PAID');
  });

  it('cancel an unpaid QR code', async () => {
    const pay = (await cashier.post('/v1/sys/fib/payments', { amount: 5000 })).json.payment;
    expect((await cashier.post(`/v1/sys/fib/payments/${pay.id}/cancel`)).json.payment.status).toBe('CANCELLED');
  });

  it('voiding an FIB sale refunds it through FIB', async () => {
    const v = await owner.post(`/v1/sys/sales/${id.fibSale}/void`, { reason: 'wrong item' });
    expect(v.json.fibRefund).toBe('refunded');
    expect(fib.pays.get('fib-1')!.refunded).toBe(true);
  });
});

describe('one drawer per till', () => {
  it('the main till and a shop device each have their own drawer; FIB never counts as cash', async () => {
    expect((await owner.post('/v1/sys/shift/open', { openingCash: 20000 })).status).toBe(201);
    // a shop device, unlocked by the cashier
    await cashier.req('PUT', '/v1/counter/pin', { pin: '4827' });
    const dev = new Browser(t.app);
    await signInEmail(dev, 'till-owner@example.com');
    await dev.post('/v1/auth/organization/set-active', { organizationId: orgId });
    expect((await dev.post('/v1/counter/devices', { name: 'Till 2' })).status).toBe(201);
    const staff = (await dev.get('/v1/counter/state')).json.staff;
    await dev.post('/v1/counter/unlock', { memberId: staff.find((s: any) => s.name === 'Hassan').memberId, pin: '4827' });
    expect((await dev.post('/v1/sys/shift/open', { openingCash: 5000 }, { 'x-hemlo-as': 'counter' })).status).toBe(201); // a second drawer, open at the same time

    await dev.post('/v1/sys/sales', { lines: [{ productId: id.p, qty: 1 }] }, { 'x-hemlo-as': 'counter' });   // 5,000 cash on till 2
    await owner.post('/v1/sys/sales', { lines: [{ productId: id.p, qty: 2 }] });                            // 10,000 cash on the main till
    const fp = (await owner.post('/v1/sys/fib/payments', { amount: 5000 })).json.payment;
    customerPays(`fib-${fib.n}`);
    await owner.post('/v1/sys/sales', { method: 'fib', fibPaymentId: fp.id, lines: [{ productId: id.p, qty: 1 }] });

    const main = (await owner.get('/v1/sys/shift')).json.drawer;
    const two = (await dev.get('/v1/sys/shift', { 'x-hemlo-as': 'counter' })).json.drawer;
    expect(main).toMatchObject({ opening: 20000, cashSales: 10000, fibSales: 5000, expected: 30000 });
    expect(two).toMatchObject({ opening: 5000, cashSales: 5000, expected: 10000 });
    const hist = (await owner.get('/v1/sys/shifts')).json.shifts.map((s: any) => s.deviceName);
    expect(hist).toContain('Till 2');
    const report = (await owner.get(`/v1/sys/reports/summary?from=${new Date(Date.now() - 86400_000).toISOString()}&to=${new Date(Date.now() + 60_000).toISOString()}`)).json;
    expect(report.byMethod.fib).toBe(5000);
  });
});

describe('label scales', () => {
  it('a product carries the scale’s item code; the shop picks the barcode format', async () => {
    expect((await owner.post('/v1/sys/products', { name: 'Cheese', unit: 'kg', price: 12000, scaleCode: '00042' })).json.product.scaleCode).toBe('42');
    expect((await owner.post('/v1/sys/products', { name: 'X', price: 1, scaleCode: 'abc' })).json.error).toBe('BAD_SCALE_CODE');
    expect((await owner.req('PUT', '/v1/sys/settings/scale', { enabled: true, prefixes: ['21', '22'], mode: 'weight' })).json.scale).toEqual({ enabled: true, prefixes: ['21', '22'], mode: 'weight' });
    expect((await cashier.get('/v1/sys/settings')).json.scale.enabled).toBe(true);
    expect((await cashier.req('PUT', '/v1/sys/settings/scale', { enabled: false })).status).toBe(403);
  });
});
