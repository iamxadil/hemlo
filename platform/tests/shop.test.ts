// Hemlo Systems · a shop's online store (Website add-on): products shown online, a bag priced by the shop (never the
// browser), checkout with delivery or pickup and cash on delivery, the order's own page, and the order in the System:
// confirmed, out for delivery, delivered, at which point it becomes a sale and the goods leave stock. Plus Connect
// in a shop: the store's prices, its automations, and a chat that belongs to the customer in its book.
import { describe, it, expect, beforeAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { withOrg, withSystem } from '@hemlo/db';
import { hemloSubscription, hemloAddonEntitlement, sysProduct, sysSale, shopOrder } from '@hemlo/db/schema';
import { newId } from '@hemlo/core';
import { setup, Browser, signInEmail, createOrg } from './helpers';

let t: Awaited<ReturnType<typeof setup>>;
let owner: Browser;
let orgId: string;
const sub = 'noor-market';
const site = { 'x-hemlo-site': sub, host: `${sub}.hemlohq.com` };
let tea: any, rice: any, hidden: any;

beforeAll(async () => {
  t = await setup();
  owner = new Browser(t.app);
  await signInEmail(owner, 'shop-owner@example.com');
  const org = await createOrg(owner, 'Al-Noor Market');
  orgId = org.id;
  await owner.post('/v1/auth/organization/set-active', { organizationId: orgId });
  await withSystem(t.db, (tx) => tx.insert(hemloSubscription).values({ organizationId: orgId, edition: 'store', status: 'trial', seats: 1, trialEndsAt: new Date(Date.now() + 20 * 86400_000) }));
  await withOrg(t.db, orgId, (tx) => tx.insert(hemloAddonEntitlement).values({ id: newId(), organizationId: orgId, addonId: 'website', edition: 'store', status: 'active', billing: 'month', price: 10000 }));
  tea = (await owner.post('/v1/sys/products', { name: 'Ahmad Tea 500g', category: 'Tea', price: 6000, cost: 4500, stock: 5, online: true, description: 'Strong black tea.' })).json.product;
  rice = (await owner.post('/v1/sys/products', { name: 'Basmati Rice', category: 'Rice', price: 3000, unit: 'kg', stock: 40, online: true })).json.product;
  hidden = (await owner.post('/v1/sys/products', { name: 'Shop-only cigarettes', price: 4000, stock: 10 })).json.product;
  expect((await owner.post('/v1/web/site/enable')).status).toBe(200);
  const r = await owner.put('/v1/web/site', { subdomain: sub, name: { ar: 'متجر النور', en: 'Al-Noor Market' }, settings: { contact: { whatsapp: '07701112222' }, shop: { delivery: true, pickup: true, fee: 5000, fees: [{ city: 'Erbil', fee: 8000 }], freeOver: 30000, minOrder: 2000 } } });
  expect(r.status).toBe(200);
  expect((await owner.post('/v1/web/site/publish')).json.site.status).toBe('published');
});

describe('the online shop', () => {
  it('gives every product an address, and starts a shop’s site with its products', async () => {
    expect(tea.slug).toMatch(/^ahmad-tea-500g-[a-z0-9]{5}$/);
    expect(tea.online).toBe(true);
    const pages = (await owner.get('/v1/web/site')).json.pages;
    expect(pages.find((p: any) => p.slug === '').sections[1].type).toBe('products');
  });

  it('shows only the products the shop put online, on the home page, the catalogue and their own page', async () => {
    const pub = new Browser(t.app);
    const home = String((await pub.get('/v1/web/pub?lang=en', site)).json);
    expect(home).toContain('Ahmad Tea 500g');
    expect(home).not.toContain('cigarettes');
    expect(home).toContain('data-add='); // add to bag
    const cat = String((await pub.get('/v1/web/pub/products?c=Rice&lang=en', site)).json);
    expect(cat).toContain('Basmati Rice');
    expect(cat).not.toContain('Ahmad Tea');
    const page = await pub.get(`/v1/web/pub/products/${tea.slug}?lang=en`, site);
    expect(page.status).toBe(200);
    expect(String(page.json)).toContain('Strong black tea.');
    expect(String(page.json)).toContain('"@type":"Product"');
    expect(String(page.json)).not.toContain('4500'); // never the cost
    expect((await pub.get(`/v1/web/pub/products/${hidden.slug}`, site)).status).toBe(404);
  });

  it('prices the bag itself: today’s price, the city’s fee, free delivery over the threshold, pickup without a fee', async () => {
    const pub = new Browser(t.app);
    const q = (await pub.post('/v1/web/pub/cart/quote', { lines: [{ id: tea.id, qty: 2 }, { id: rice.id, qty: 1.5 }], city: 'Erbil', delivery: 'delivery' }, site)).json;
    expect(q.subtotal).toBe(2 * 6000 + 4500);
    expect(q.fee).toBe(8000);
    expect(q.total).toBe(16500 + 8000);
    expect(q.ok).toBe(true);
    const free = (await pub.post('/v1/web/pub/cart/quote', { lines: [{ id: rice.id, qty: 10 }], city: 'Baghdad' }, site)).json;
    expect(free.fee).toBe(0);
    expect((await pub.post('/v1/web/pub/cart/quote', { lines: [{ id: tea.id, qty: 1 }], delivery: 'pickup' }, site)).json).toMatchObject({ delivery: 'pickup', fee: 0 });
    // more than the shop has, and a product that isn't online
    expect((await pub.post('/v1/web/pub/cart/quote', { lines: [{ id: tea.id, qty: 9 }] }, site)).json.problem).toBe('OUT_OF_STOCK');
    expect((await pub.post('/v1/web/pub/cart/quote', { lines: [{ id: hidden.id, qty: 1 }] }, site)).json.problem).toBe('EMPTY_CART');
    expect((await pub.post('/v1/web/pub/cart/quote', { lines: [{ id: rice.id, qty: 0.5 }] }, site)).json.problem).toBe('BELOW_MINIMUM');
  });

  let code: string, orderId: string;
  it('takes an order with cash on delivery, and the customer follows it by its link', async () => {
    const pub = new Browser(t.app);
    expect((await pub.post('/v1/web/pub/checkout', { lines: [{ id: tea.id, qty: 2 }], name: 'Ahmed', phone: '123', city: 'Baghdad', address: 'Karrada' }, site)).json.error).toBe('BAD_PHONE');
    expect((await pub.post('/v1/web/pub/checkout', { lines: [{ id: tea.id, qty: 2 }], name: 'Ahmed', phone: '07709998888', delivery: 'delivery' }, site)).json.error).toBe('BAD_ADDRESS');
    const r = await pub.post('/v1/web/pub/checkout', { lines: [{ id: tea.id, qty: 2, price: 1 }], name: 'Ahmed Ali', phone: '07709998888', delivery: 'delivery', city: 'Baghdad', area: 'Karrada', address: 'Near the park', lang: 'en' }, site);
    expect(r.status).toBe(201);
    code = r.json.code;
    expect(code).toMatch(/^[a-z0-9]{12}$/);
    const [o] = await withOrg(t.db, orgId, (tx) => tx.select().from(shopOrder).where(eq(shopOrder.code, code)));
    orderId = o.id;
    expect(o).toMatchObject({ subtotal: 12000, deliveryFee: 5000, total: 17000, phone: '+9647709998888', status: 'new' }); // the browser's "price: 1" is ignored
    const page = await pub.get(`/v1/web/pub/order/${code}?lang=en`, site);
    expect(page.status).toBe(200);
    expect(String(page.json)).toContain('Ahmad Tea 500g');
    expect(page.headers.get('cache-control')).toBe('no-store');
    expect((await pub.get('/v1/web/pub/order/notarealcode', site)).status).toBe(404);
  });

  it('moves the order along in the System, and delivered it becomes a sale: stock out, profit counted', async () => {
    const list = await owner.get('/v1/shop/orders');
    expect(list.json.orders.map((o: any) => o.id)).toContain(orderId);
    expect((await owner.get('/v1/shop/orders/count')).json).toMatchObject({ open: 1, new: 1 });
    expect((await owner.req('PATCH', `/v1/shop/orders/${orderId}`, { status: 'delivered' })).json.error).toBe('BAD_STEP'); // confirm first
    expect((await owner.req('PATCH', `/v1/shop/orders/${orderId}`, { status: 'confirmed' })).status).toBe(200);
    expect((await owner.req('PATCH', `/v1/shop/orders/${orderId}`, { status: 'ready' })).json.error).toBe('BAD_STEP'); // it's a delivery
    expect((await owner.req('PATCH', `/v1/shop/orders/${orderId}`, { status: 'out' })).status).toBe(200);
    const done = await owner.req('PATCH', `/v1/shop/orders/${orderId}`, { status: 'delivered' });
    expect(done.status).toBe(200);
    expect(done.json.order.saleId).toBeTruthy();
    const [sale] = await withOrg(t.db, orgId, (tx) => tx.select().from(sysSale).where(eq(sysSale.id, done.json.order.saleId)));
    expect(sale).toMatchObject({ total: 12000, paid: 12000, cost: 9000, method: 'cash' });
    const [p] = await withOrg(t.db, orgId, (tx) => tx.select().from(sysProduct).where(eq(sysProduct.id, tea.id)));
    expect(p.stock).toBe(3);
    expect((await new Browser(t.app).get(`/v1/web/pub/order/${code}?lang=en`, site)).json).toContain('Delivered');
  });

  it('keeps the checkout rules when the site’s other settings are saved, and checks them', async () => {
    await owner.put('/v1/web/site', { settings: { contact: { whatsapp: '07701112222' } } });
    expect((await owner.get('/v1/shop/settings')).json.shop).toMatchObject({ fee: 5000, pickup: true });
    expect((await owner.put('/v1/shop/settings', { fee: -1 })).status).toBe(400);
    expect((await owner.put('/v1/shop/settings', { delivery: true, fee: 4000, cities: ['Baghdad'] })).json.shop).toMatchObject({ fee: 4000, cities: ['Baghdad'] });
    const q = (await new Browser(t.app).post('/v1/web/pub/cart/quote', { lines: [{ id: rice.id, qty: 1 }], city: 'Basra' }, site)).json;
    expect(q.problem).toBe('NO_DELIVERY_THERE');
  });

  it('nobody else sees the shop’s orders', async () => {
    const other = new Browser(t.app);
    await signInEmail(other, 'other-shop@example.com');
    const org = await createOrg(other, 'Other Shop');
    await other.post('/v1/auth/organization/set-active', { organizationId: org.id });
    await withSystem(t.db, (tx) => tx.insert(hemloSubscription).values({ organizationId: org.id, edition: 'store', status: 'trial', seats: 1, trialEndsAt: new Date(Date.now() + 20 * 86400_000) }));
    expect((await other.get('/v1/shop/orders')).json.orders).toEqual([]);
    expect((await other.get(`/v1/shop/orders/${orderId}`)).status).toBe(404);
  });
});

describe('Hemlo Connect in a shop', () => {
  it('offers the shop’s tiers at the shop’s prices, and the shop’s automations', async () => {
    const r = await owner.get('/v1/connect');
    expect(r.status).toBe(200);
    expect(r.json.edition).toBe('store');
    expect(r.json.offers.map((o: any) => [o.code, o.priceMonth])).toEqual([['connect', 0], ['connect-pro', 25000], ['ai-studio', 35000]]);
    expect(r.json.recipes.map((x: any) => x.key)).toEqual(['instant_reply', 'order_update', 'debt_reminder']);
  });

  it('a chat belongs to the customer in the book with that phone; a message from the site waits in the inbox', async () => {
    const cu = (await owner.post('/v1/sys/customers', { name: 'Ahmed Ali', phone: '07709998888' })).json.customer;
    await owner.post('/v1/connect/channel/sandbox');
    const sim = await owner.post('/v1/connect/simulate', { text: 'Do you have tea?', phone: '+9647709998888' });
    expect(sim.status).toBe(201);
    const chat = (await owner.get(`/v1/connect/conversations/${sim.json.conversationId}`)).json;
    expect(chat.customer.id).toBe(cu.id);
    expect(chat.orders[0].number).toBeGreaterThan(0);
    // the site's contact form: into the inbox, waiting on a person
    const sent = await new Browser(t.app).post('/v1/web/pub/inquiry', { name: 'Sara', phone: '07705556666', message: 'Is the rice Indian?' }, site);
    expect(sent.status).toBe(201);
    const inbox = (await owner.get('/v1/connect/conversations?filter=waiting')).json.conversations;
    expect(inbox.some((c: any) => c.phone === '+9647705556666' && c.preview === 'Is the rice Indian?')).toBe(true);
  });

  it('sends a product into a chat, with its page on the shop', async () => {
    const conv = (await owner.get('/v1/connect/conversations')).json.conversations.find((c: any) => c.phone === '+9647709998888');
    const list = (await owner.get('/v1/connect/products?q=tea')).json.products;
    expect(list[0].name).toBe('Ahmad Tea 500g');
    const sent = await owner.post(`/v1/connect/conversations/${conv.id}/product`, { productId: tea.id, lang: 'en' });
    expect(sent.status).toBe(201);
    expect(sent.json.message.body).toContain(`https://${sub}.hemlohq.com/products/${tea.slug}`);
    expect(sent.json.message.body).toContain('6,000 IQD');
  });
});
