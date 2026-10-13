// Pricing: the public price list, 30-day trials on the biggest plan, plans that differ by size (staff accounts, dentists),
// a business asking for a plan from the app, Hemlo recording the payment in the admin dashboard, the money overview,
// a week of grace after a payment is due, and then read-only until the next payment.
import { describe, it, expect, beforeAll } from 'vitest';
import { setup, Browser, signInEmail, createOrg } from './helpers';
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

describe('optional add-ons', () => {
  it('launches at its list price, keeps an unconfigured price non-purchasable, and activates only after staff confirms the catalog amount', async () => {
    const offers = (await new Browser(t.app).get('/v1/plans/addons?edition=realestate')).json.addons;
    // in order: Website, then Connect's tiers (Basic free with the System, Pro, AI Studio); the old bundle is retired
    expect(offers.map((x: any) => [x.code, x.priceMonth, x.priceYear, x.free])).toEqual([['website', 10000, 100000, false], ['connect', 0, 0, true], ['connect-pro', 35000, 350000, false], ['ai-studio', 50000, 500000, false]]);
    await founder.req('PATCH', '/v1/admin/addons/website', { priceMonth: null, priceYear: null });
    expect((await new Browser(t.app).get('/v1/plans/addons?edition=realestate')).json.addons.find((x: any) => x.code === 'website')).toMatchObject({ configured: false, priceMonth: null });
    // a shop sees the same add-ons at its own prices (each system's override), with its own words
    const shopOffers = (await new Browser(t.app).get('/v1/plans/addons?edition=store')).json.addons;
    expect(shopOffers.map((x: any) => [x.code, x.priceMonth, x.priceYear, x.free])).toEqual([['website', 10000, 100000, false], ['connect', 0, 0, true], ['connect-pro', 25000, 250000, false], ['ai-studio', 35000, 350000, false]]);
    expect(shopOffers.find((x: any) => x.code === 'connect-pro').description.en).toMatch(/products, prices and stock/);
    // the shop's own price stands when the agencies' is cleared: a shop may ask for its Website
    expect((await shop.post('/v1/billing/addons/website/request')).status).toBe(201);

    const owner = new Browser(t.app);
    await signInEmail(owner, 'website-buyer@example.com');
    const org = await createOrg(owner, 'Al-Nakheel Realty');
    await owner.post('/v1/auth/organization/set-active', { organizationId: org.id });
    await sys(`insert into hemlo_subscription (organization_id, edition, status, seats, trial_ends_at) values ($1, 'realestate', 'trial', 1, now() + interval '20 days')`, [org.id]);

    expect((await owner.post('/v1/billing/addons/website/request')).status).toBe(409);
    await founder.req('PATCH', '/v1/admin/addons/website', { priceMonth: 12000, priceYear: 120000 });
    const requested = await owner.post('/v1/billing/addons/website/request', { billing: 'month' });
    expect(requested.status).toBe(201);
    expect(requested.json.status).toBe('pending');
    expect((await owner.post('/v1/web/site/enable')).status).toBe(402);
    // the request waits for a person at Hemlo: the admin overview says so until it is decided
    const waitingBefore = (await founder.req('GET', '/v1/admin/overview')).json.waiting.addons;
    expect(waitingBefore).toBeGreaterThan(0);

    const requestId = requested.json.request.id;
    const denied = await founder.req('PATCH', `/v1/admin/addon-requests/${requestId}`, { action: 'activate', amount: 1, method: 'cash' });
    expect(denied.status).toBe(400);
    const activated = await founder.req('PATCH', `/v1/admin/addon-requests/${requestId}`, { action: 'activate', amount: 12000, method: 'cash', reference: 'RECEIPT-1' });
    expect(activated.status).toBe(201);
    expect(activated.json.entitlement).toMatchObject({ status: 'active', price: 12000, billing: 'month', edition: 'realestate' });
    expect((await founder.req('GET', '/v1/admin/overview')).json.waiting.addons).toBe(waitingBefore - 1);
    const mine = async (code: string) => (await owner.get('/v1/billing/addons')).json.addons.find((x: any) => x.code === code);
    expect((await mine('website')).entitlement.active).toBe(true);
    expect((await mine('connect')).entitlement).toBeNull(); // one add-on's entitlement is never shown on another
    expect(await mine('connect')).toMatchObject({ free: true, included: true }); // Basic: free with the System, nothing to ask for
    expect((await owner.post('/v1/web/site/enable')).status).toBe(200);
    await owner.put('/v1/web/site', { settings: { contact: { whatsapp: '07701234567' } } });
    expect((await owner.post('/v1/web/site/publish')).status).toBe(200);
    const cancel = await owner.post('/v1/billing/addons/website/cancel-request');
    expect(cancel.status).toBe(201);
    expect((await mine('website')).entitlement.active).toBe(true);
    const canceled = await founder.req('PATCH', `/v1/admin/addon-requests/${cancel.json.request.id}`, { action: 'cancel' });
    expect(canceled.json.entitlement.status).toBe('canceled');
    expect((await owner.post('/v1/web/site/publish')).status).toBe(402);

    // Connect's tiers: Basic is free (nothing to ask for); Pro, then AI Studio, each ending the one below
    const approve = async (code: string, amount: number) => {
      const req = await owner.post(`/v1/billing/addons/${code}/request`, { billing: 'month' });
      expect(req.status).toBe(201);
      return founder.req('PATCH', `/v1/admin/addon-requests/${req.json.request.id}`, { action: 'activate', amount, method: 'cash' });
    };
    expect((await owner.get('/v1/connect')).json.plan).toBe('connect');
    expect((await owner.post('/v1/billing/addons/connect/request', { billing: 'month' })).json.error).toBe('ADDON_INCLUDED');
    expect((await approve('connect-pro', 35000)).status).toBe(201);
    expect((await mine('connect-pro')).entitlement.active).toBe(true);
    expect(await mine('connect')).toMatchObject({ included: true, via: 'connect-pro' });
    expect((await owner.get('/v1/connect')).json.plan).toBe('connect-pro');

    expect((await approve('ai-studio', 50000)).status).toBe(201);
    expect((await sys(`select status from hemlo_addon_entitlement where organization_id = $1 and addon_id = 'connect-pro'`, [org.id]))[0].status).toBe('canceled');
    expect((await mine('connect-pro')).entitlement).toMatchObject({ addonId: 'ai-studio', active: true }); // on, through AI Studio
    const c = (await owner.get('/v1/connect')).json;
    expect(c.plan).toBe('ai-studio');
    expect(c.ai).toMatchObject({ open: true, limits: { day: 60, week: 300, month: 1000 } });
    expect((await owner.post('/v1/billing/addons/connect-pro/request', { billing: 'month' })).json.error).toBe('ADDON_ALREADY_ACTIVE');
    expect((await owner.get('/v1/studio')).json).toMatchObject({ active: true, allowance: { copy: 200, images: 60, videos: 0 }, tools: { copy: true, image: false, video: false } });
    expect((await owner.post('/v1/web/site/publish')).status).toBe(402); // the website was canceled, and nothing brings it back
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
