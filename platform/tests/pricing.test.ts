// Pricing: the public price list, 30-day trials on the biggest plan, plans that differ by size (staff accounts, dentists),
// a business asking for a plan from the app, Hemlo recording the payment in the admin dashboard, the money overview,
// a week of grace after a payment is due, and then read-only until the next payment.
import { describe, it, expect, beforeAll } from 'vitest';
import { setup, Browser, signInEmail } from './helpers';
import { forgetSubscription, forgetPlans } from '../apps/api/src/subscription';

let t: Awaited<ReturnType<typeof setup>>;
let founder: Browser, shop: Browser, clinic: Browser;
let shopId: string, clinicId: string;
const sys = async (q: string, params: unknown[] = []) => t.client.transaction(async (tx: any) => { await tx.query("select set_config('app.system', 'on', true)"); return (await tx.query(q, params)).rows; });

beforeAll(async () => {
  t = await setup();
  founder = new Browser(t.app);
  await signInEmail(founder, 'founder@hemlohq.com');
  await t.client.query(`update "user" set role = 'admin' where email = 'founder@hemlohq.com'`);
  await signInEmail(founder, 'founder@hemlohq.com');
  shop = new Browser(t.app);
  await signInEmail(shop, 'owner@shop.iq');
  shopId = (await shop.post('/v1/store/start', { name: 'Al-Amal Market' })).json.organizationId;
  await shop.post('/v1/auth/organization/set-active', { organizationId: shopId });
  clinic = new Browser(t.app);
  await signInEmail(clinic, 'dr@clinic.iq');
  clinicId = (await clinic.post('/v1/dent/start', { name: 'Smile' })).json.organizationId;
  await clinic.post('/v1/auth/organization/set-active', { organizationId: clinicId });
});

describe('the price list', () => {
  it('three plans per system, in dinars, a year for ten months', async () => {
    const all = (await new Browser(t.app).get('/v1/plans')).json;
    expect(all.trialDays).toBe(30);
    expect(all.plans).toHaveLength(12); // store, dental, gym, real estate: three each
    const re = (await new Browser(t.app).get('/v1/plans?edition=realestate')).json.plans;
    expect(re.map((p: any) => [p.code, p.priceMonth])).toEqual([['office', 35000], ['agency', 69000], ['group', 129000]]);
    const gym = (await new Browser(t.app).get('/v1/plans?edition=gym')).json.plans;
    expect(gym.map((p: any) => [p.code, p.priceMonth, p.priceYear])).toEqual([['starter', 25000, 250000], ['standard', 45000, 450000], ['pro', 75000, 750000]]);
    expect(gym[1]).toMatchObject({ popular: true, limits: { members: 500 } });
  });
});

describe('a trial', () => {
  it('lasts 30 days, on the biggest plan, so the business sees everything', async () => {
    const me = (await shop.get('/v1/sys/me')).json.subscription;
    expect(me).toMatchObject({ status: 'trial', daysLeft: 30, plan: { code: 'business' }, limits: { users: 20, devices: 10 } });
    const page = (await shop.get('/v1/billing')).json;
    expect(page.plans.map((p: any) => p.code)).toEqual(['starter', 'growth', 'business']);
    expect(page.usage).toMatchObject({ users: 1, devices: 0 });
  });
});

describe('asking for a plan, paying, and the admin side', () => {
  it('the owner asks for Starter; Hemlo records the payment; the plan is live for a month', async () => {
    const plans = (await shop.get('/v1/billing')).json.plans;
    const starter = plans.find((p: any) => p.code === 'starter');
    const req = await shop.post('/v1/billing/request', { planId: starter.id, billing: 'month', message: 'call me after 5' });
    expect(req.status).toBe(201);
    let bill = (await founder.get('/v1/admin/billing')).json;
    expect(bill.requests).toHaveLength(1);
    expect(bill.requests[0]).toMatchObject({ business: 'Al-Amal Market', planId: starter.id, message: 'call me after 5' });
    const pay = await founder.post(`/v1/admin/subscriptions/${shopId}/payments`, { amount: 15000, months: 1, method: 'fib', reference: 'FIB-123', planId: starter.id });
    expect(pay.status).toBe(201);
    expect(pay.json.subscription).toMatchObject({ status: 'active', plan: { code: 'starter' }, limits: { users: 2, devices: 1 } });
    forgetSubscription(shopId);
    expect((await shop.get('/v1/billing')).json).toMatchObject({ subscription: { status: 'active' }, request: null, payments: [{ amount: 15000, method: 'fib' }] });
    bill = (await founder.get('/v1/admin/billing')).json;
    expect(bill).toMatchObject({ mrr: 15000, collected30: 15000, counts: { active: 1, trial: 1 }, requests: [] });
    // a second month paid early runs on from the first
    const again = await founder.post(`/v1/admin/subscriptions/${shopId}/payments`, { amount: 15000, months: 1, method: 'cash' });
    const until = new Date(again.json.subscription.paidUntil);
    expect(Math.round((+until - Date.now()) / 86400_000)).toBeGreaterThanOrEqual(58);
  });

  it('plans differ by size: Starter has two staff accounts', async () => {
    expect((await shop.post('/v1/invites', { phone: '07701110001', role: 'cashier' })).status).toBe(201); // the owner + 1
    const over = await shop.post('/v1/invites', { phone: '07701110002', role: 'cashier' });
    expect(over.status).toBe(402);
    expect(over.json.error).toBe('PLAN_LIMIT_USERS');
  });

  it('a clinic on Solo has one dentist; a second asks for a bigger plan', async () => {
    const solo = (await clinic.get('/v1/billing')).json.plans.find((p: any) => p.code === 'solo');
    await founder.post(`/v1/admin/subscriptions/${clinicId}/payments`, { amount: 350000, months: 12, method: 'transfer', planId: solo.id, billing: 'year' });
    forgetSubscription(clinicId);
    expect((await clinic.post('/v1/dent/dentists', { name: 'Dr Rana' })).json.error).toBe('PLAN_LIMIT_DENTISTS');
    const clinicPlan = (await founder.get(`/v1/admin/subscriptions/${clinicId}`)).json;
    expect(clinicPlan.subscription).toMatchObject({ billing: 'year', plan: { code: 'solo' } });
    expect(clinicPlan.usage.dentists).toBe(1);
    expect((await founder.get('/v1/admin/billing')).json.mrr).toBe(15000 + Math.round(350000 / 12));
  });

  it('Hemlo edits a price from the dashboard, and the website sees it', async () => {
    const plans = (await founder.get('/v1/admin/plans')).json.plans;
    const growth = plans.find((p: any) => p.code === 'growth');
    const r = await founder.req('PATCH', `/v1/admin/plans/${growth.id}`, { priceMonth: 27000, priceYear: 270000, limits: { users: 6, devices: 3, ai: 200 } });
    expect(r.status).toBe(200);
    forgetPlans();
    expect((await new Browser(t.app).get('/v1/plans?edition=store')).json.plans.find((p: any) => p.code === 'growth')).toMatchObject({ priceMonth: 27000, limits: { ai: 200 } });
    // a new plan, hidden from the public list
    const vip = await founder.post('/v1/admin/plans', { edition: 'gym', code: 'chain', name: { ar: 'سلسلة', en: 'Chain' }, priceMonth: 150000, public: false });
    expect(vip.status).toBe(201);
    forgetPlans();
    expect((await new Browser(t.app).get('/v1/plans?edition=gym')).json.plans).toHaveLength(3);
    expect((await shop.req('PATCH', `/v1/admin/plans/${growth.id}`, { priceMonth: 1 })).status).toBe(403); // not Hemlo's team
  });
});

describe('when a payment is due', () => {
  it('a week of grace (everything works, with a reminder), then read-only until paid', async () => {
    await sys(`update hemlo_subscription set paid_until = now() - interval '2 days' where organization_id = $1`, [shopId]);
    forgetSubscription(shopId);
    expect((await shop.get('/v1/sys/me')).json.subscription).toMatchObject({ status: 'grace', daysLeft: 5 });
    expect((await shop.post('/v1/sys/products', { name: 'Tea', price: 1000 })).status).toBe(201);
    await sys(`update hemlo_subscription set paid_until = now() - interval '8 days' where organization_id = $1`, [shopId]);
    forgetSubscription(shopId);
    expect((await shop.post('/v1/sys/products', { name: 'Sugar', price: 1000 })).json.error).toBe('SUBSCRIPTION_ENDED');
    expect((await shop.get('/v1/sys/products')).status).toBe(200);
    // asking for a plan still works when the subscription has ended
    expect((await shop.post('/v1/billing/request', { planId: null, message: 'Enterprise: 3 branches' })).status).toBe(201);
    // the payment brings it back from today
    const pay = await founder.post(`/v1/admin/subscriptions/${shopId}/payments`, { amount: 15000, months: 1, method: 'zaincash' });
    expect(Math.round((+new Date(pay.json.subscription.paidUntil) - Date.now()) / 86400_000)).toBeGreaterThanOrEqual(28);
    forgetSubscription(shopId);
    expect((await shop.post('/v1/sys/products', { name: 'Sugar', price: 1000 })).status).toBe(201);
  });
});
