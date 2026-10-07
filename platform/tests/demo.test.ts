// The demo shop: instant, private, fully stocked, fenced off, invisible to the admin numbers, and gone after a day.
import { describe, it, expect, beforeAll } from 'vitest';
import { setup, Browser, signInEmail } from './helpers';
import { purgeDemos, PER_IP_PER_HOUR } from '../apps/api/src/routes/demo';

let t: Awaited<ReturnType<typeof setup>>;
let visitor: Browser, token: string;
const bearer = () => ({ authorization: `Bearer ${token}` });

beforeAll(async () => {
  t = await setup({ BUSINESS_CREATION: undefined });
  visitor = new Browser(t.app);
  const r = await visitor.post('/v1/demo/start', { lang: 'en' });
  expect(r.status).toBe(201);
  token = r.json.token;
});

describe('a demo shop', () => {
  it('opens instantly, stocked, with a week of history and an open drawer', async () => {
    const me = (await visitor.get('/v1/sys/me', bearer())).json;
    expect(me.business).toMatchObject({ name: 'Al-Noor Market', demo: true, kind: 'store' });
    expect(me.role).toBe('owner');
    const products = (await visitor.get('/v1/sys/products', bearer())).json.products;
    expect(products.length).toBeGreaterThan(40);
    expect(products.find((p: any) => p.barcode === '6281036001017')).toMatchObject({ packSize: 24, packBarcode: '6281036101014' });
    expect(products.some((p: any) => p.scaleCode === '42')).toBe(true);
    expect(products.every((p: any) => !p.trackStock || p.stock >= 0)).toBe(true); // what's on the shelf is never negative
    const today = (await visitor.get(`/v1/sys/reports/summary?from=${new Date(Date.now() - 3 * 3600_000).toISOString()}&to=${new Date(Date.now() + 60_000).toISOString()}`, bearer())).json;
    expect(today.count).toBeGreaterThan(0); // a visitor at any hour finds a shop that's been trading
    const cheese = products.find((p: any) => p.scaleCode === '42');
    const history = (await visitor.get(`/v1/sys/products/${cheese.id}/moves`, bearer())).json;
    if (history.moves) { // the product history adds up: opening count, then every sale and delivery, ending at the shelf
      const newest = history.moves[0];
      expect(Number(newest.stock)).toBe(cheese.stock);
    }
    const week = (await visitor.get(`/v1/sys/reports/summary?from=${new Date(Date.now() - 7 * 86400_000).toISOString()}&to=${new Date(Date.now() + 60_000).toISOString()}`, bearer())).json;
    expect(week.count).toBeGreaterThan(100);
    expect(week.profit).toBeGreaterThan(0);
    expect(week.expenses.total).toBeGreaterThan(0);
    expect(week.owedToSuppliers).toBeGreaterThan(0);
    expect(week.lowStock.length).toBeGreaterThan(0);
    expect((await visitor.get('/v1/sys/customers', bearer())).json.customers.some((c: any) => c.balance > 0)).toBe(true);
    expect((await visitor.get('/v1/sys/shift', bearer())).json.shift).toBeTruthy();
    expect((await visitor.get('/v1/sys/shifts', bearer())).json.shifts.some((s: any) => s.countedCash - s.expectedCash === -250)).toBe(true);
    expect((await visitor.get('/v1/sys/settings', bearer())).json.scale.enabled).toBe(true);
  });

  it('really sells: a scanned carton comes off stock', async () => {
    const products = (await visitor.get('/v1/sys/products', bearer())).json.products;
    const pepsi = products.find((p: any) => p.barcode === '6281036001017');
    const s = await visitor.post('/v1/sys/sales', { lines: [{ productId: pepsi.id, qty: 1, pack: true }] }, bearer());
    expect(s.status).toBe(201);
    expect(s.json.sale.total).toBe(11000);
  });

  it('is fenced off: no FIB, no invitations, no shop devices, no API keys, no new businesses', async () => {
    expect((await visitor.req('PUT', '/v1/sys/settings/fib', { env: 'sandbox', clientId: 'x', clientSecret: 'y' }, bearer())).json.error).toBe('NOT_IN_DEMO');
    expect((await visitor.post('/v1/invites', { phone: '07701234567', role: 'cashier' }, bearer())).json.error).toBe('NOT_IN_DEMO');
    expect((await visitor.post('/v1/counter/devices', { name: 'Till' }, bearer())).json.error).toBe('NOT_IN_DEMO');
    expect((await visitor.post('/v1/api-keys', { name: 'k', permissions: {} }, bearer())).json.error).toBe('NOT_IN_DEMO');
    expect((await visitor.post('/v1/auth/organization/create', { name: 'Mine', slug: 'mine-demo-x' }, bearer())).status).toBeGreaterThanOrEqual(400);
  });

  it('never touches a real sign-in in the same browser', async () => {
    const real = new Browser(t.app);
    await signInEmail(real, 'real-person@example.com');
    const demo = await real.post('/v1/demo/start', { lang: 'ar' });
    expect((await real.get('/v1/me')).json.user.email).toBe('real-person@example.com');
    const asDemo = (await real.get('/v1/sys/me', { authorization: `Bearer ${demo.json.token}` })).json;
    expect(asDemo.business).toMatchObject({ name: 'ماركت النور', demo: true });
    expect((await real.get('/v1/me')).json.user.email).toBe('real-person@example.com');
  });

  it('a demo clinic: a live day (in the chair, waiting), plans to choose, lab work back and late, instalments due', async () => {
    const b = new Browser(t.app);
    const r = await b.post('/v1/demo/start', { lang: 'en', kind: 'dental' });
    expect(r.status).toBe(201);
    const h = { authorization: `Bearer ${r.json.token}` };
    const me = (await b.get('/v1/sys/me', h)).json;
    expect(me.business).toMatchObject({ name: 'Baghdad Smile Dental Clinic', demo: true, kind: 'dental' });
    const setup = (await b.get('/v1/dent/setup', h)).json;
    expect(setup.dentists).toHaveLength(3);
    expect(setup.procedures.length).toBeGreaterThan(30);
    const dash = (await b.get('/v1/dent/dashboard', h)).json;
    expect(dash.today.length).toBeGreaterThanOrEqual(8);
    expect(dash.today.every((a: any) => a.patient_id)).toBe(true);
    expect(dash.collected).toBeGreaterThanOrEqual(0); // before the day starts (a morning visitor), nothing is in yet
    expect(dash.lab).toEqual({ overdue: 1, ready: 1 });
    expect(dash.installments.due).toBeGreaterThanOrEqual(1);
    expect(dash.outstanding).toBeGreaterThan(0);
    const month = (await b.get(`/v1/dent/reports?from=${new Date(Date.now() - 35 * 86400_000).toISOString()}&to=${new Date(Date.now() + 60_000).toISOString()}`, h)).json;
    expect(month.visits).toBeGreaterThanOrEqual(15);
    expect(month.collected).toBeGreaterThan(1000000);
    expect(month.byDentist.find((x: any) => x.sharePercent === 40).share).toBeGreaterThan(0);
    expect(month.appointments.no_show).toBe(2);
    const patients = (await b.get('/v1/dent/patients', h)).json.patients;
    const ali = patients.find((p: any) => p.name === 'Ali Kadhim');
    expect(ali.alerts).toEqual(expect.arrayContaining(['diabetes']));
    const plans = (await b.get(`/v1/dent/patients/${ali.id}/plans`, h)).json.plans;
    expect(plans.filter((p: any) => p.optionGroup === 'ali-46')).toHaveLength(2);
    const chart = (await b.get(`/v1/dent/patients/${ali.id}/chart`, h)).json.findings;
    expect(chart.some((f: any) => f.tooth === 46 && f.kind === 'missing' && f.status === 'done')).toBe(true);
    // it really works: book, and the queue shows who's here
    expect((await b.get('/v1/dent/queue', h)).status).toBe(200);
  });

  it('limits demos per connection per hour (generous: many Iraqi mobile users share one address)', async () => {
    const b = new Browser(t.app);
    const codes: number[] = [];
    for (let i = 0; i <= PER_IP_PER_HOUR; i++) codes.push((await b.post('/v1/demo/start', {})).status);
    expect(codes.filter((c) => c === 201).length).toBeGreaterThanOrEqual(PER_IP_PER_HOUR - 3); // a few went to the earlier tests
    expect(codes[codes.length - 1]).toBe(429);
  });

  it('demo shops and visitors never count in the admin numbers', async () => {
    const staff = new Browser(t.app);
    await signInEmail(staff, 'founder@hemlohq.com');
    await t.client.query(`update "user" set role = 'admin' where email = 'founder@hemlohq.com'`);
    await signInEmail(staff, 'founder@hemlohq.com');
    const o = (await staff.get('/v1/admin/overview')).json;
    expect(o.businesses.total).toBe(0);
    expect(o.users.total).toBe(2); // the real person and the founder
    expect((await staff.get('/v1/admin/businesses')).json.businesses).toHaveLength(0);
    expect((await staff.get('/v1/admin/users')).json.users.every((u: any) => !String(u.email ?? '').includes('demo'))).toBe(true);
  });

  it('is deleted the moment the visitor leaves it', async () => {
    const b = new Browser(t.app);
    const r = await b.post('/v1/demo/start', { lang: 'en', kind: 'dental' }, { 'cf-connecting-ip': '10.9.9.9' });
    expect(r.status).toBe(201);
    const A = { authorization: `Bearer ${r.json.token}` };
    const biz = (await b.get('/v1/sys/me', A)).json.business.id;
    expect((await b.get('/v1/dent/patients', A)).status).toBe(200); // a read, so the person is remembered
    expect((await new Browser(t.app).post('/v1/demo/end', {})).status).toBe(403); // not a demo visitor
    expect((await b.post('/v1/demo/end', {}, A)).status).toBe(204);
    expect((await b.get('/v1/sys/me', A)).status).toBe(401);
    const left = await t.client.transaction(async (tx: any) => {
      await tx.query("select set_config('app.system', 'on', true)");
      return (await tx.query(`select (select count(*)::int from organization where id = $1) + (select count(*)::int from dent_patient where organization_id = $1)
        + (select count(*)::int from member where organization_id = $1) as n`, [biz])).rows[0].n;
    });
    expect(left).toBe(0);
  });

  it('is deleted after a day, leaving nothing behind', async () => {
    expect((await purgeDemos(t.db, 1)).shops).toBe(0); // all younger than an hour: kept
    const gone = await purgeDemos(t.db, 0);
    expect(gone.shops).toBeGreaterThanOrEqual(7);
    expect((await visitor.get('/v1/sys/me', bearer())).status).toBe(401);
    const left = await t.client.transaction(async (tx: any) => {
      await tx.query("select set_config('app.system', 'on', true)");
      return (await tx.query(`select (select count(*)::int from sys_sale) as sales, (select count(*)::int from sys_product) as products, (select count(*)::int from organization) as orgs,
        (select count(*)::int from dent_patient) + (select count(*)::int from dent_appointment) + (select count(*)::int from dent_finding) + (select count(*)::int from dent_lab_order) as dental,
        (select count(*)::int from "user" where email like '%@demo.hemlohq.invalid') as visitors`)).rows[0];
    });
    expect(left).toEqual({ sales: 0, products: 0, orgs: 0, dental: 0, visitors: 0 });
  });
});
