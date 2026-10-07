// Browser test of system.hemlohq.com (Hemlo Systems · Stores & Markets), end to end, with screenshots.
// Run: npx tsx scripts/system-e2e.ts   (SKIP_BUILD=1 to reuse the last builds)
process.env.TZ = 'UTC';
import { createServer } from 'node:http';
import { execSync } from 'node:child_process';
import { readFile, stat, mkdir } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { serve } from '@hono/node-server';
import { chromium, type Page } from 'playwright-core';
import { createPgliteDb } from '@hemlo/db/pglite';
import { outbox } from '@hemlo/notify';
import { createApp } from '../apps/api/src/app';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const API = 'http://localhost:8797', ACC = 'http://localhost:4331', SYS = 'http://localhost:4334';
const SHOTS = 'scripts/shots/system';
const root = (app: string) => new URL(`../apps/${app}/dist/`, import.meta.url).pathname.replace(/^\/(\w:)/, '$1');

if (!process.env.SKIP_BUILD) {
  const env = { ...process.env, PUBLIC_API_URL: API, PUBLIC_ACCOUNT_URL: ACC, PUBLIC_RETURN_HOSTS: 'localhost', VITE_API_URL: API, VITE_ACCOUNT_URL: ACC };
  execSync('npm run build -w @hemlo/account', { stdio: 'ignore', env });
  execSync('npm run build -w @hemlo/system', { stdio: 'ignore', env });
}

// a fake FIB that follows the documented API; the test marks payments paid, like a customer scanning the QR code
const fibPays = new Map<string, { amount: number; status: string }>();
let fibN = 0;
const QR = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 29 29"><path d="M0 0h7v7H0zM22 0h7v7h-7zM0 22h7v7H0zM9 9h11v11H9z"/></svg>').toString('base64');
const fakeFib = createServer(async (req, res) => {
  const url = new URL(req.url!, 'http://x'); let body = ''; for await (const c of req) body += c;
  const json = (st: number, b?: unknown) => { res.writeHead(st, { 'content-type': 'application/json' }); res.end(b ? JSON.stringify(b) : ''); };
  if (url.pathname.endsWith('/openid-connect/token')) return new URLSearchParams(body).get('client_secret') === 'demo-secret' ? json(200, { access_token: 'tok', expires_in: 60 }) : json(401);
  const m = url.pathname.match(/^\/protected\/v1\/payments(?:\/([^/]+)\/(status|cancel|refund))?$/);
  if (!m) return json(404);
  if (!m[1]) { const id = 'p' + ++fibN; fibPays.set(id, { amount: Number(JSON.parse(body).monetaryValue.amount), status: 'UNPAID' }); return json(202, { paymentId: id, readableCode: 'HMLO-7K2Q-X9PA', qrCode: QR, personalAppLink: 'https://personal.fib.iq/x', validUntil: new Date(Date.now() + 300_000).toISOString() }); }
  const p = fibPays.get(m[1])!;
  if (m[2] === 'status') return json(200, { paymentId: m[1], status: p.status, paidAt: p.status === 'PAID' ? new Date().toISOString() : null, amount: { amount: p.amount, currency: 'IQD' }, paidBy: p.status === 'PAID' ? { name: 'Zainab Ali' } : null });
  if (m[2] === 'cancel') { if (p.status === 'UNPAID') p.status = 'DECLINED'; return json(204); }
  return json(202);
}).listen(8799);

const { db } = await createPgliteDb();
const { app } = createApp({ db, env: { AUTH_SECRET: 'system-test-secret-system-test-secret-0', API_URL: API, ACCOUNT_URL: ACC,
  TRUSTED_ORIGINS: `${ACC},${SYS},${API}`, PASSKEY_RP_ID: 'localhost', PHONE_SIGN_IN: '1', DEV_CONSOLE_MESSAGES: '1', BUSINESS_CREATION: 'open', FIB_BASE_URL: 'http://localhost:8799' } as any });
const api = serve({ fetch: app.fetch, port: 8797 });
const types: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const serveDir = (dir: string, port: number, spa = false) => createServer(async (req, res) => {
  let p = join(dir, decodeURIComponent(new URL(req.url!, 'http://x').pathname));
  try { if ((await stat(p)).isDirectory()) p = join(p, 'index.html'); res.writeHead(200, { 'content-type': types[extname(p)] ?? 'application/octet-stream' }); res.end(await readFile(p)); }
  catch { if (spa) { res.writeHead(200, { 'content-type': types['.html'] }); res.end(await readFile(join(dir, 'index.html'))); } else { res.writeHead(404); res.end(); } }
}).listen(port);
const acc = serveDir(root('account'), 4331), sys = serveDir(root('system'), 4334, true);
await mkdir(SHOTS, { recursive: true });

const code = (to: string) => [...outbox].reverse().find((m) => m.to.toLowerCase() === to.toLowerCase() && m.kind === 'code')!.text.match(/\b(\d{6})\b/)![1];
let step = 0; const ok = (m: string) => console.log(`✓ ${++step}. ${m}`);
const shot = (p: Page, n: string, full = false) => p.screenshot({ path: `${SHOTS}/${n}.png`, fullPage: full });
const call = (p: Page, path: string, body?: unknown) => p.evaluate(async ([u, b]) => {
  const r = await fetch(u as string, { method: b ? 'POST' : 'GET', credentials: 'include', headers: b ? { 'content-type': 'application/json' } : {}, body: b ? JSON.stringify(b) : undefined });
  return { status: r.status, json: await r.json().catch(() => ({})) };
}, [API + path, body] as const);

const browser = await chromium.launch({ executablePath: EDGE, headless: true });
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error('page error:', e.message));

  // signed out: the door
  await page.goto(`${SYS}/`);
  await page.waitForSelector('.gate a.btn-accent');
  await shot(page, '01-signed-out-ar');

  // the shop owner signs in and has a business
  await page.goto(`${ACC}/en/sign-in/`);
  await page.click('#tabs [data-tab="email"]');
  await page.fill('#email', 'owner@alkhair.iq');
  await page.click('#send');
  await page.waitForSelector('#code:not([hidden])');
  await page.fill('#otp', code('owner@alkhair.iq'));
  await page.waitForSelector('#profile:not([hidden])');
  await page.fill('#name', 'Abu Hussein');
  await page.click('#save-profile');
  await page.waitForSelector('#offer:not([hidden])');
  await page.click('#offer-skip');
  await page.waitForURL(`${ACC}/en/`);
  const org = await call(page, '/v1/auth/organization/create', { name: 'Al-Khair Market', slug: 'al-khair', metadata: { kind: 'store', city: 'Baghdad' } });
  if (org.status !== 200) throw new Error('org: ' + JSON.stringify(org.json));
  const seed: [string, string | null, number, number, number, string?, number?][] = [
    ['Pepsi 330ml', '6281036001017', 500, 375, 48, 'piece', 12], ['Rice (loose)', null, 1750, 1400, 50, 'kg', 10], ['Samoon bread', null, 250, 150, 0, 'piece'],
    ['Nido milk 900g', '6281036002120', 9500, 8200, 6, 'piece', 5], ['Tea Alghazaleen 500g', '6291003071019', 4250, 3500, 20, 'piece', 5], ['Sugar 1kg', '6281036003010', 1500, 1150, 30, 'piece', 10],
    ['Eggs (30)', null, 6000, 5200, 8, 'piece', 3], ['Tomato paste', '6281036004017', 1000, 700, 2, 'piece', 6], ['Sunflower oil 1.8L', '6281036005012', 4500, 3900, 14, 'piece', 4],
  ];
  const ids: Record<string, string> = {};
  for (const [name, barcode, price, cost, stock, unit, lowStock] of seed) {
    const r = await call(page, '/v1/sys/products', { name, barcode, price, cost, stock, unit: unit ?? 'piece', lowStock: lowStock ?? null, trackStock: name !== 'Samoon bread', category: name.includes('bread') ? 'Bakery' : 'Grocery' });
    ids[name] = r.json.product.id;
  }
  ok('owner signed in, business created, 9 products added');

  // English, desktop: an empty day, then the products
  await page.goto(`${SYS}/`);
  await page.evaluate(() => localStorage.setItem('hemlo.lang', 'en')); await page.reload();
  await page.goto(`${SYS}/#/home`);
  await page.waitForSelector('.kpi.hero');
  await shot(page, '02-home-empty-en');
  await page.click('a.nav[href="#/products"]');
  await page.waitForSelector('.row:has-text("Nido")');
  await shot(page, '03-products-en');
  // add one through the form
  await page.click('a[href="#/products?id=new"]');
  await page.waitForSelector('.sheet .field');
  await page.fill('.sheet .field >> nth=0 >> input', 'Kleenex tissues');
  await page.fill('.sheet input[inputmode=numeric][dir=ltr] >> nth=0', '6281036009010');
  await page.locator('.sheet input.money').nth(0).fill('1250');
  await page.locator('.sheet input.money').nth(1).fill('900');
  await page.fill('.sheet input[placeholder="0"] >> nth=0', '24');
  await page.waitForTimeout(200);
  await shot(page, '04-add-product-en');
  await page.click('.sheet-f button');
  await page.waitForSelector('.sheet h2:has-text("Kleenex")');
  await page.waitForTimeout(250);
  await shot(page, '05-product-sheet-en');
  await page.keyboard.press('Escape');
  ok('products listed; a product added through the form (barcode, price, cost, opening stock)');

  // the checkout: scan, tap, pay cash
  await page.click('a.nav[href="#/sell"]');
  await page.waitForSelector('.tile');
  await page.keyboard.type('6281036001017'); await page.keyboard.press('Enter');     // a scanner: types then Enter
  await page.keyboard.type('6281036001017'); await page.keyboard.press('Enter');
  await page.click('.tile:has-text("Nido")');
  await page.fill('.scan input', 'rice'); await page.keyboard.press('Enter');
  await page.locator('.line:has-text("Rice") .stepper input').fill('2.5');
  await page.click('.tile:has-text("Samoon")'); for (let i = 0; i < 9; i++) await page.click('.line:has-text("Samoon") .stepper button >> nth=1');
  await page.waitForSelector('.line:has-text("Pepsi")');
  const total = await page.textContent('.totals .grand');
  if (!total?.includes('17,375')) throw new Error('total: ' + total);            // 2×500 + 9,500 + 2.5×1,750 + 10×250
  await shot(page, '06-sell-cart-en');
  await page.click('.pay-btn');
  await page.waitForSelector('.sheet .seg');
  await page.click('.sheet .chip >> nth=2');                                    // a 20,000 note
  await page.waitForTimeout(200);
  await shot(page, '07-pay-cash-en');
  await page.click('.sheet-f .pay-btn');
  await page.waitForSelector('.sheet h2:has-text("Sale complete")');
  const change = await page.textContent('.sheet .change');
  if (!change?.includes('2,625')) throw new Error('change: ' + change);
  await shot(page, '08-sale-done-en');
  await page.keyboard.press('Enter');
  await page.waitForSelector('.cart-lines .sub');
  ok('scanned twice, tapped, searched, typed 2.5 kg, 10 breads: 17,375 IQD; paid 20,000, change 2,625');

  // on account: a new customer, part paid
  await page.click('.tile:has-text("Oil")'); await page.click('.tile:has-text("Eggs")');
  await page.click('.pay-btn');
  await page.click('.sheet .seg button >> nth=2');
  await page.fill('.sheet .search input', 'Umm Zainab');
  await page.click('.sheet .row:has-text("New customer")');
  await page.fill('.sheet input[inputmode=tel]', '0771 234 5678');
  await page.click('.sheet .btn-accent:has-text("Save")');
  await page.waitForSelector('.sheet .row .avatar');
  await page.locator('.sheet input.money').last().fill('3000');
  await page.waitForTimeout(200);
  await shot(page, '09-pay-credit-en');
  await page.click('.sheet-f .pay-btn');
  await page.waitForSelector('.sheet h2:has-text("Sale complete")');
  if (!(await page.textContent('.sheet .note'))?.includes('7,500')) throw new Error('due missing');
  await page.keyboard.press('Enter');
  ok('sold 10,500 on account to a new customer, 3,000 paid now, 7,500 in the debt book');

  // the debt book: payment + reminder
  await page.click('a.nav[href="#/customers"]');
  await page.waitForSelector('.row:has-text("Umm Zainab")');
  await shot(page, '10-debt-book-en');
  await page.click('.row:has-text("Umm Zainab")');
  await page.waitForSelector('.sheet .ledger li');
  const wa = await page.getAttribute('.sheet a[href^="https://wa.me/9647712345678"]', 'href');
  if (!wa?.includes('7%2C500') && !wa?.includes('7,500')) throw new Error('reminder: ' + wa);
  await page.locator('.sheet input.money').fill('5000');
  await page.click('.sheet .btn-accent:has-text("Record")');
  await page.waitForSelector('.sheet .ledger li:has-text("Payment")');
  await page.waitForTimeout(250);
  await shot(page, '11-customer-en');
  await page.keyboard.press('Escape');
  ok('debt book: WhatsApp reminder for 7,500; 5,000 recorded, 2,500 left');

  // sales: open, void
  await page.click('a.nav[href="#/sales"]');
  await page.waitForSelector('.row:has-text("#2")');
  await shot(page, '12-sales-en');
  await page.click('.row:has-text("#1")');
  await page.waitForSelector('.sheet .ledger li');
  await page.click('.sheet-f .btn-danger'); await page.click('.sheet-f .btn-danger');
  await page.waitForSelector('.sheet .note:has-text("Voided")');
  await page.waitForTimeout(250);
  await shot(page, '13-sale-voided-en');
  await page.keyboard.press('Escape');
  const pepsi = (await call(page, '/v1/sys/products')).json.products.find((p: any) => p.name === 'Pepsi 330ml');
  if (pepsi.stock !== 48) throw new Error('void did not restore stock: ' + pepsi.stock);
  ok('receipt #1 voided by the owner: stock back to 48');

  // today
  await page.click('a.nav[href="#/home"]');
  await page.waitForSelector('.bars');
  await page.waitForTimeout(300);
  await shot(page, '14-home-en', true);
  ok('today: sales, profit, collected, debts, by hour, best sellers, low stock');

  // ================= V2 =================
  // cartons: Pepsi comes 24 to a carton
  await call(page, `/v1/sys/products/${ids['Pepsi 330ml']}`, undefined);
  await page.evaluate(async ([u, id]) => { await fetch(`${u}/v1/sys/products/${id}`, { method: 'PATCH', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ packSize: 24, packBarcode: '6281036001024', packPrice: 11000 }) }); }, [API, ids['Pepsi 330ml']] as const);

  // the drawer: open with a 25,000 float
  await page.goto(`${SYS}/#/sell`); await page.reload(); await page.waitForSelector('.tile');
  await page.click('.top button:has-text("Open drawer")');
  await page.locator('.sheet input.money').fill('25000');
  await page.click('.sheet-f button');
  await page.waitForSelector('.top button:has-text("Close drawer")');
  ok('drawer opened with a 25,000 float');

  // a carton scanned at the till
  await page.keyboard.type('6281036001024'); await page.keyboard.press('Enter');
  await page.waitForSelector('.line .pill.accent');
  await page.click('.tile:has-text("Sugar")');
  await shot(page, '20-carton-in-cart-en');
  await page.click('.pay-btn'); await page.click('.sheet .chip >> nth=0'); await page.click('.sheet-f .pay-btn');
  await page.waitForSelector('.sheet h2:has-text("Sale complete")'); await page.keyboard.press('Enter');
  const pepsiAfter = (await call(page, '/v1/sys/products')).json.products.find((p: any) => p.name === 'Pepsi 330ml').stock;
  if (pepsiAfter !== 48 - 24) throw new Error('carton stock: ' + pepsiAfter);
  ok('carton barcode scanned: one carton at 11,000, 24 pieces out of stock');

  // a return: one sugar back, cash from the drawer
  await page.click('a.nav[href="#/sales"]'); await page.waitForSelector('.row');
  await page.click('.row >> nth=0'); await page.waitForSelector('.sheet .ledger li');
  await page.click('.sheet-f button:has-text("Return")');
  await page.waitForSelector('.sheet.center .stepper');
  await page.locator('.sheet.center .stepper').last().locator('button').last().click();
  await page.waitForTimeout(200);
  await shot(page, '21-return-en');
  await page.click('.sheet.center .sheet-f .pay-btn');
  await page.waitForSelector('.sheet .sec-t:has-text("Returns")');
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  ok('one item returned from a receipt, cash refunded from the drawer');

  // a supplier and a delivery invoice: 2 cartons of Pepsi at 10,000, 5,000 paid from the drawer
  await page.goto(`${SYS}/#/purchases`); await page.waitForSelector('.kpi');
  await page.click('a[href="#/purchases?id=new"]');
  await page.fill('.sheet .field >> nth=0 >> input', 'Baghdad Wholesale'); await page.fill('.sheet input[inputmode=tel]', '0780 111 2222');
  await page.click('.sheet-f button'); await page.waitForSelector('.sheet h2:has-text("Baghdad Wholesale")'); await page.keyboard.press('Escape');
  await page.click('a[href="#/purchases?invoice=new"]');
  await page.waitForSelector('.sheet select');
  await page.fill('.sheet .field >> nth=1 >> input', 'INV-2231');
  await page.fill('.sheet .search input', 'pepsi');
  await page.click('.sheet .row .chip:has-text("carton")');
  await page.locator('.sheet .grid.gap-2.rounded-2xl input.money').fill('10000');
  await page.locator('.sheet .grid.gap-2.rounded-2xl input[inputmode=decimal]').fill('2');
  await page.locator('.sheet section.grid input.money').fill('5000');
  await page.click('.sheet label:has-text("Paid from the drawer") input');
  await page.waitForTimeout(200);
  await shot(page, '22-purchase-invoice-en');
  await page.click('.sheet-f button');
  await page.waitForSelector('.row:has-text("Baghdad Wholesale")');
  const sup = (await call(page, '/v1/sys/suppliers')).json.suppliers[0];
  if (sup.balance !== 15000) throw new Error('supplier balance: ' + sup.balance);
  await shot(page, '23-suppliers-en');
  ok('supplier added; delivery of 2 cartons (20,000): 5,000 paid from the drawer, 15,000 owed');

  // an expense from the drawer
  await page.goto(`${SYS}/#/expenses`); await page.waitForSelector('.kpi');
  await page.click('button:has-text("New expense")');
  await page.click('.sheet .chip:has-text("Generator")');
  await page.locator('.sheet input.money').fill('3000');
  await page.click('.sheet-f button');
  await page.waitForSelector('.row:has-text("Generator")');
  await shot(page, '24-expenses-en');
  ok('generator expense of 3,000 paid from the drawer');

  // import from a sheet
  await page.goto(`${SYS}/#/products`); await page.waitForSelector('.row');
  await page.click('a[href="#/products?id=import"]');
  await page.waitForSelector('.sheet input[type=file]', { state: 'attached' });
  const csv = '﻿الاسم,الباركود,سعر البيع,سعر الشراء,الكمية,الصنف\r\nشاي الغزالين 500غ,6291003071019,4500,3600,30,مواد غذائية\r\nمعكرونة,6281036007016,"1,000",750,40,مواد غذائية\r\n,123,500,,,\r\nعصير برتقال,6281036008013,1250,900,24,مشروبات\r\n';
  await page.setInputFiles('.sheet input[type=file]', { name: 'products.csv', mimeType: 'text/csv', buffer: Buffer.from(csv, 'utf8') });
  await page.waitForSelector('.sheet table tbody tr');
  await shot(page, '25-import-preview-en');
  await page.click('.sheet-f button');
  await page.waitForSelector('.sheet .change:has-text("Done")');
  const done = await page.textContent('.sheet .change');
  if (!done?.includes('2 new') || !done.includes('1 updated')) throw new Error('import: ' + done);
  await shot(page, '26-import-done-en');
  await page.keyboard.press('Escape');
  ok('CSV with Arabic headers imported: 2 new, 1 updated by barcode, 1 bad row reported');

  // close the drawer: 25,000 + 11,000 + 1,500 − 1,500 (return) − 5,000 − 3,000 = 28,000
  await page.goto(`${SYS}/#/sell`); await page.waitForSelector('.tile');
  await page.click('.top button:has-text("Close drawer")');
  await page.waitForSelector('.sheet .rounded-2xl');
  const expected = await page.textContent('.sheet .rounded-2xl .font-semibold');
  if (!expected?.includes('28,000')) throw new Error('expected in drawer: ' + expected);
  await page.locator('.sheet input.money').first().fill('27500');
  await page.waitForTimeout(200);
  await shot(page, '27-close-drawer-en');
  await page.click('.sheet-f button');
  await page.waitForSelector('.sheet .change.short');
  await page.keyboard.press('Escape');
  await page.goto(`${SYS}/#/shifts`); await page.waitForSelector('.row .pill.bad');
  await shot(page, '28-drawer-history-en');
  ok('drawer closed: expected 28,000, counted 27,500, short 500 on record');

  // today, with V2 numbers
  await page.goto(`${SYS}/#/home`); await page.waitForSelector('.bars'); await page.waitForTimeout(300);
  await shot(page, '29-home-v2-en', true);
  ok('today: net profit after expenses, returns, owed to suppliers, per cashier');

  // offline: reload the whole app with no internet: it still opens (kept on the device by the service worker)
  await page.goto(`${SYS}/#/sell`); await page.waitForSelector('.tile'); await page.waitForTimeout(800); // let the service worker settle
  await page.reload(); await page.waitForSelector('.tile');
  await ctx.setOffline(true);
  await page.reload();
  await page.waitForSelector('.tile', { timeout: 15000 });
  await page.waitForSelector('.offline');
  await shot(page, '34-offline-reload-en');
  await ctx.setOffline(false);
  ok('reloaded with no internet: the app opened from the device, products and all');

  // ================= the till =================
  // the owner connects the shop's FIB account, and turns on scale barcodes
  await page.goto(`${SYS}/#/settings`); await page.waitForSelector('text=FIB · online payments');
  await page.fill('input[autocomplete=off][dir=ltr] >> nth=0', 'hemlo-demo');
  await page.fill('input[type=password][autocomplete=new-password] >> nth=0', 'demo-secret');
  await page.click('button:has-text("Connect account")');
  await page.waitForSelector('text=Connected · Test');
  await page.click('label:has-text("Read scale barcodes") input');
  await page.waitForSelector('text=The barcode carries');
  await shot(page, '35-till-settings-en', true);
  const cheese = await call(page, '/v1/sys/products', { name: 'White cheese', unit: 'kg', price: 12000, cost: 9000, stock: 20, scaleCode: '42' });
  if (!cheese.json.product) throw new Error('cheese: ' + JSON.stringify(cheese.json));
  ok('FIB connected (credentials checked with FIB, secret sealed); scale barcodes on');

  // the customer display, then a scale label and FIB
  await page.goto(`${SYS}/#/sell`); await page.reload(); await page.waitForSelector('.tile');
  const [display] = await Promise.all([ctx.waitForEvent('page'), page.click('.cart .icon-btn[title="Customer display"]')]);
  await display.setViewportSize({ width: 1280, height: 720 });
  await display.waitForSelector('.cd-center');
  await page.keyboard.type('2100042012503'); await page.keyboard.press('Enter');          // scale label: item 00042, 1,250 g
  await page.waitForSelector('.line:has-text("White cheese")');
  const qty = await page.inputValue('.line:has-text("White cheese") .stepper input');
  if (qty !== '1.25') throw new Error('scale weight: ' + qty);
  await page.click('.tile:has-text("Sugar")');
  await display.waitForSelector('.cd-total');
  await shot(display, '36-customer-display-cart');
  await page.click('.pay-btn');
  await page.click('.sheet .seg button:has-text("FIB")');
  await page.waitForSelector('.sheet .fib-qr');
  await display.waitForSelector('.cd-qr');
  await shot(page, '37-fib-qr-en');
  await shot(display, '38-customer-display-fib');
  for (const p of fibPays.values()) p.status = 'PAID';                                   // the customer pays in the FIB app
  await page.waitForSelector('.sheet h2:has-text("Sale complete")', { timeout: 15000 });
  await display.waitForSelector('.cd-ok');
  await shot(display, '39-customer-display-thanks');
  const lastSale = (await call(page, `/v1/sys/sales?from=${new Date(Date.now() - 86400_000).toISOString()}&to=${new Date(Date.now() + 60_000).toISOString()}`)).json.sales[0];
  if (lastSale.method !== 'fib' || lastSale.total !== 15000 + 1500) throw new Error('fib sale: ' + JSON.stringify(lastSale));
  await page.keyboard.press('Enter');
  ok('scale label read (1.25 kg cheese); FIB QR on the till and the customer display; paid → sale completed by itself (16,500, method FIB)');

  // what the thermal printer would get: an image of the receipt (Arabic shaped by the browser), as ESC/POS raster bytes
  const preview = await page.evaluate(() => (globalThis as any).hemloReceiptPreview({ shop: 'ماركت الخير', city: 'بغداد', rtl: true, title: 'فاتورة #1024', meta: ['التاريخ: 29/09/2026 20:42', 'البائع: أبو حسين'],
    lines: [{ name: 'بيبسي 330 مل (كارتون 24)', detail: '1 × 11,000', amount: '11,000' }, { name: 'جبن أبيض', detail: '1.25 × 12,000', amount: '15,000' }],
    totals: [{ label: 'الإجمالي', value: '26,000 د.ع', strong: true }, { label: 'FIB', value: '26,000' }], footer: 'شكراً لزيارتكم' }, 80));
  await import('node:fs/promises').then((fs) => fs.writeFile(`${SHOTS}/40-thermal-receipt-80mm.png`, Buffer.from(preview.png.split(',')[1], 'base64')));
  if (preview.bytes < 1000) throw new Error('raster too small');
  ok(`thermal receipt rendered for 80 mm: ${preview.height} dots tall, ${preview.bytes} bytes of ESC/POS raster`);

  // Arabic, dark, and the phone
  const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark', reducedMotion: 'reduce', storageState: await ctx.storageState() });
  const p2 = await ctx2.newPage();
  p2.on('pageerror', (e) => console.error('page error (ar):', e.message));
  await p2.goto(`${SYS}/`); await p2.evaluate(() => localStorage.setItem('hemlo.lang', 'ar')); await p2.reload();
  await p2.goto(`${SYS}/#/sell`); await p2.waitForSelector('.tile');
  await p2.click('.tile:has-text("شاي")'); await p2.click('.tile:has-text("Sugar")'); await p2.click('.tile:has-text("Sugar")');
  await p2.waitForTimeout(200);
  await shot(p2, '15-sell-ar-dark');
  await p2.goto(`${SYS}/#/home`); await p2.waitForSelector('.bars'); await p2.waitForTimeout(300);
  await shot(p2, '16-home-ar-dark', true);
  const ctx3 = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, reducedMotion: 'reduce', storageState: await ctx.storageState() });
  const p3 = await ctx3.newPage();
  p3.on('pageerror', (e) => console.error('page error (phone):', e.message));
  await p3.goto(`${SYS}/`); await p3.evaluate(() => localStorage.setItem('hemlo.lang', 'ar')); await p3.reload();
  await p3.goto(`${SYS}/#/sell`); await p3.waitForSelector('.tile');
  await p3.click('.tile:has-text("Pepsi")'); await p3.click('.tile:has-text("Eggs")');
  await shot(p3, '17-sell-ar-phone', true);
  await p3.click('.tabbar a[href="#/customers"]'); await p3.waitForSelector('.row'); await p3.click('.row:has-text("Umm Zainab")'); await p3.waitForSelector('.sheet .ledger li'); await p3.waitForTimeout(300);
  await shot(p3, '18-customer-ar-phone');
  ok('Arabic, dark mode and phone layouts rendered');

  // offline: the sale waits on the device, then goes when the internet is back
  const salesBefore = (await call(page, `/v1/sys/sales?from=${new Date(Date.now() - 86400_000).toISOString()}&to=${new Date(Date.now() + 60_000).toISOString()}`)).json.sales.length;
  await page.goto(`${SYS}/#/sell`); await page.waitForSelector('.tile');
  await page.click('.tile:has-text("Sugar")');
  await ctx.setOffline(true);
  await page.click('.pay-btn'); await page.click('.sheet-f .pay-btn');
  await page.waitForSelector('.sheet .note:has-text("No internet")');
  await page.keyboard.press('Enter');
  await page.waitForSelector('.pill.warn:has-text("waiting")');
  await shot(page, '19-offline-en');
  await ctx.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.waitForSelector('.pill.warn', { state: 'detached', timeout: 15000 });
  const sales = (await call(page, `/v1/sys/sales?from=${new Date(Date.now() - 86400_000).toISOString()}&to=${new Date(Date.now() + 60_000).toISOString()}`)).json.sales;
  if (sales.length !== salesBefore + 1) throw new Error('offline sale not synced: ' + sales.length);
  ok('offline sale saved on the device, sent when the connection returned');

  // the shared shop device: a PIN for the owner, then this browser becomes the till
  const ctxD = await browser.newContext({ viewport: { width: 1280, height: 860 }, reducedMotion: 'reduce', storageState: await ctx.storageState() });
  const pd = await ctxD.newPage();
  pd.on('pageerror', (e) => console.error('page error (device):', e.message));
  await pd.goto(`${SYS}/`); await pd.evaluate(() => localStorage.setItem('hemlo.lang', 'en')); await pd.goto(`${SYS}/#/settings`); await pd.reload();
  await pd.waitForSelector('text=Your PIN for the shared device');
  await pd.fill('input[type=password]', '4827');
  await pd.click('button:has-text("Save PIN")');
  await pd.waitForSelector('text=You have a PIN');
  await pd.fill('input[placeholder="e.g. Till 1"]', 'Till 1');
  await shot(pd, '30-settings-en');
  await pd.click('button:has-text("Make this the shop device")');
  await pd.waitForSelector('text=Who’s selling?');
  await shot(pd, '31-device-locked-en');
  await pd.click('.gate .panel:has-text("Abu Hussein")');
  for (const k of '4827') await pd.click(`.pinpad button:has-text("${k}")`);
  await shot(pd, '32-device-pin-en');
  await pd.click('.pinpad button.go');
  await pd.waitForSelector('.tile');
  await pd.click('.tile:has-text("Sugar")'); await pd.click('.pay-btn'); await pd.click('.sheet .chip >> nth=0'); await pd.click('.sheet-f .pay-btn');
  await pd.waitForSelector('.sheet h2:has-text("Sale complete")'); await pd.keyboard.press('Enter');
  await shot(pd, '33-device-selling-en');
  await pd.click('.side button:has-text("Lock")');
  await pd.waitForSelector('text=Who’s selling?');
  ok('owner set a PIN, made this browser the shop device, unlocked with the PIN, sold, locked it again');

} catch (e) { for (const p of browser.contexts().flatMap((c) => c.pages())) await p.screenshot({ path: `${SHOTS}/zz-fail-${Math.random().toString(36).slice(2, 6)}.png` }).catch(() => {}); throw e; } finally {
  await browser.close(); api.close(); acc.close(); sys.close(); fakeFib.close();
}
console.log('\nAll system flows passed.');
process.exit(0);
