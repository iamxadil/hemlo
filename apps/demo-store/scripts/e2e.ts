// End-to-end check of the demo store in a real browser: shop → bag → code → checkout → order page; the control panel
// changing a price, a photo, an order and the colour while a shop tab is open (no reload); search; the pinned story;
// the bag sheet dragged away on a phone; Arabic; the Jordan market; persistence; no console errors.
// Run (with `npm run preview` up on :4501):  node scripts/e2e.ts      (BASE=https://demo.hemlohq.com for the live site)
import { chromium, type Page } from 'playwright-core';

const BASE = process.env.BASE ?? 'http://localhost:4501';
const SHOTS = process.env.SHOTS ?? 'scripts/shots';
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'en-US' });
const errors: string[] = [];
const watch = (p: Page) => { p.on('pageerror', (e) => errors.push(`${p.url()}: ${e.message}`)); p.on('console', (m) => m.type() === 'error' && errors.push(`${p.url()}: ${m.text()}`)); };
let n = 0;
const ok = (msg: string) => console.log(`✓ ${++n}. ${msg}`);
const shot = (p: Page, name: string, full = false) => p.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: full });
const settle = (p: Page, ms = 600) => p.waitForTimeout(ms);

// 1. the shop opens in English with the Iraqi catalogue and real photographs
const shop = await ctx.newPage(); watch(shop);
await shop.goto(`${BASE}/?lang=en&market=iq`);
await shop.waitForSelector('.hero-title');
if (!(await shop.textContent('.logo'))?.includes('Nafha')) throw new Error('logo');
await shop.waitForFunction(() => [...document.querySelectorAll('.hero-slide.on img')].some((i) => (i as HTMLImageElement).complete && (i as HTMLImageElement).naturalWidth > 600 && (i as HTMLImageElement).currentSrc.includes('/photos/')));
if (!(await shop.locator('.card').count())) throw new Error('no featured products');
await settle(shop); await shot(shop, '01-home-en');
ok('home: full-screen photograph (AVIF/WebP from /photos), spotlight, worlds and most loved');

// 2. the scent story pins and changes note as you scroll
const story = await shop.locator('.story').boundingBox();
if (!story) throw new Error('no story');
await shop.evaluate((y) => scrollTo(0, y), story.y + story.height * 0.55);
await shop.waitForFunction(() => [...document.querySelectorAll('.story-notes li')].findIndex((l) => l.classList.contains('on')) >= 1);
ok('pinned scent story: scrolling moves from saffron to the next note');

// 3. search drops down with live results
await shop.evaluate(() => scrollTo(0, 0));
await shop.click('.nav-act .icon-btn >> nth=0');
await shop.fill('.search-field', 'oud');
await shop.waitForSelector('.search-results li a[href^="/p/"]');
await settle(shop, 400); await shot(shop, '02-search');
await shop.keyboard.press('Enter');
await shop.waitForURL(/\/search\?q=oud/);
await shop.waitForSelector('.grid .card');
ok(`search: live results as you type, then ${await shop.locator('.grid .card').count()} results for "oud"`);

// 4. a product, then the bag
await shop.goto(`${BASE}/p/nafha-noir`);
await shop.waitForSelector('.pdp-title');
const priceBefore = await shop.textContent('.pdp-price span');
await shop.click('.pdp-buy .icon-btn >> nth=1'); // quantity 2
await shop.click('.pdp-add');
await shop.waitForFunction(() => document.querySelector('.bag-count')?.textContent === '2');
await shop.waitForSelector('.pdp-add.done'); // the button answers in place
await shop.waitForSelector('.minibag'); // and the mini bag drops from the bag pill
await shop.click('.bag-pill');
await shop.waitForSelector('.sheet .lines li');
await settle(shop, 700); await shot(shop, '03-bag');
ok(`product page and bag: 2 × Nafha Noir at ${priceBefore}; Added confirmed in place, mini bag shown`);

// 5. a discount code
await shop.fill('.sheet .code-box .input', 'welcome10');
await shop.click('.sheet .code-box button[type=submit]');
await shop.waitForSelector('.sheet .sums .good');
ok(`code WELCOME10 applied: ${await shop.textContent('.sheet .sums .good dd')}`);

// 6. checkout → order page
await shop.click('.sheet-foot a[href="/checkout"]');
await shop.waitForSelector('.co-form');
await shop.click('.co-place'); // empty form: errors shown, nothing placed
if ((await shop.locator('.field-err').count()) < 4) throw new Error('validation');
await shop.fill('input[autocomplete=name]', 'Test Customer');
await shop.fill('input[type=tel]', '+964 770 555 0101');
await shop.fill('input[autocomplete=address-level2]', 'Baghdad, Karrada');
await shop.fill('input[autocomplete=street-address]', 'Street 62, house 14');
await settle(shop); await shot(shop, '04-checkout', true);
await shop.click('.co-place');
await shop.waitForURL(/\/order\/\d+$/);
const orderNo = shop.url().split('/').pop();
await shop.waitForSelector('.steps li.done');
await settle(shop, 1300); await shot(shop, '05-order');
ok(`checkout validated, then placed order #${orderNo}`);

// 7. the control panel in a second tab; the shop tab stays open on the product page
await shop.goto(`${BASE}/p/nafha-noir`); await shop.waitForSelector('.pdp-price');
const panel = await ctx.newPage(); watch(panel);
await panel.goto(`${BASE}/admin`);
await panel.waitForSelector('.kpis');
await settle(panel); await shot(panel, '06-panel-home');
if ((await panel.textContent('.adm-nav em'))?.trim() !== '2') throw new Error('new orders badge (seed 1 + ours 1)');
ok('control panel: dashboard, new-orders badge = 2, live preview beside it');

// 8. change Nafha Noir's price in the panel → the shop tab updates without a reload
await panel.click('a[href="/admin/products"]');
await panel.waitForSelector('.prod-row');
await panel.click('a[href="/admin/products/p-nafha-noir"]');
await panel.waitForSelector('.money-in .input');
await panel.fill('.money-in .input >> nth=0', '99000');
await panel.click('.save-btn');
await panel.waitForSelector('.adm-save:not(.busy)');
await shop.waitForFunction(() => document.querySelector('.pdp-price span')?.textContent?.includes('99,000'), null, { timeout: 5000 });
await settle(panel); await shot(panel, '07-panel-product');
ok(`price changed in the panel → shop tab shows ${await shop.textContent('.pdp-price span')} with no reload`);

// 9. upload a photo for the product (a real 1440×900 screenshot: also checks it gets shrunk and stored)
await panel.setInputFiles('.pics-add input[type=file]', `${SHOTS}/01-home-en.png`);
await panel.waitForFunction(() => document.querySelectorAll('.pics-item').length === 3);
await panel.click('.save-btn');
await shop.waitForFunction(() => document.querySelectorAll('.pdp-gallery .pdp-pic').length === 3, null, { timeout: 5000 });
ok('photo uploaded in the panel (shrunk, kept in the browser) → the product page shows it');

// 10. move our order along → the customer's order page follows
await panel.goto(`${BASE}/admin/orders/${orderNo}`);
await panel.waitForSelector('.actions .btn-solid');
await panel.click('.actions .btn-solid'); // new → preparing
await shop.goto(`${BASE}/order/${orderNo}`);
await shop.waitForSelector('.steps li.done >> nth=1');
await panel.click('.actions .btn-solid'); // preparing → shipped
await shop.waitForFunction(() => document.querySelectorAll('.steps li.done').length === 3, null, { timeout: 5000 });
ok('order moved to "with courier" in the panel → order page shows it live');

// 11. theme colour from settings
await panel.goto(`${BASE}/admin/settings`);
await panel.click('.swatches button >> nth=1');
await shop.waitForFunction(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim().toLowerCase() === '#1f3a5f', null, { timeout: 5000 });
ok('accent colour changed in settings → shop recoloured live');

// 12. everything survives a reload
await shop.reload(); await shop.waitForSelector('.steps');
await shop.goto(`${BASE}/p/nafha-noir`); await shop.waitForSelector('.pdp-price');
if (!(await shop.textContent('.pdp-price span'))?.includes('99,000')) throw new Error('persist');
if ((await shop.locator('.pdp-gallery .pdp-pic').count()) !== 3) throw new Error('persist photo');
ok('reload: price, photo, order and colour are still there');

// 13. Arabic on a phone: the bag sheet follows a drag and flies away when let go
const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const m = await phone.newPage(); watch(m);
await m.goto(`${BASE}/?lang=ar`);
await m.waitForSelector('.hero-title');
if ((await m.getAttribute('html', 'dir')) !== 'rtl') throw new Error('rtl');
await settle(m, 1200); await shot(m, '08-phone-ar');
await m.goto(`${BASE}/p/white-musk`); await m.waitForSelector('.pdp-add');
await m.click('.nav-burger'); await m.waitForSelector('.nav.open .menu-row'); await settle(m, 800); await shot(m, '09-phone-menu');
await m.keyboard.press('Escape'); await m.waitForSelector('.nav:not(.open)');
await m.click('.pdp-add'); await m.click('.bag-pill');
await m.waitForSelector('.sheet .lines li'); await settle(m, 700);
await shot(m, '09-phone-bag');
// swipe a row (towards the start in Arabic: right) to reveal Remove, and remove it
await m.goto(`${BASE}/p/amber-dusk`); await m.waitForSelector('.pdp-add'); await m.click('.pdp-add'); await m.click('.bag-pill');
await m.waitForSelector('.sheet .swipe-front'); await settle(m, 700);
const row = (await m.locator('.swipe-front >> nth=0').boundingBox())!;
await m.mouse.move(row.x + row.width / 2, row.y + 30); await m.mouse.down();
for (let i = 1; i <= 8; i++) { await m.mouse.move(row.x + row.width / 2 + i * 14, row.y + 30); await m.waitForTimeout(16); }
await m.mouse.up(); await settle(m, 600);
const before = await m.locator('.sheet .lines li').count();
await m.click('.swipe-del >> nth=0');
await m.waitForFunction((n) => document.querySelectorAll('.sheet .lines li').length === n - 1, before);
ok('phone menu opened; a bag row swiped open (right to left) and removed');
const head = (await m.locator('.sheet-head').boundingBox())!;
await m.mouse.move(head.x + 60, head.y + 10); await m.mouse.down();
for (let i = 1; i <= 8; i++) { await m.mouse.move(head.x + 60, head.y + 10 + i * 45); await m.waitForTimeout(12); }
await m.mouse.up();
await m.waitForSelector('.sheet', { state: 'detached', timeout: 3000 });
ok('Arabic on a phone, right to left; the bag sheet followed a drag down and was thrown closed');
await m.goto(`${BASE}/admin?lang=ar`); await m.waitForSelector('.kpis'); await settle(m); await shot(m, '10-phone-panel-ar');
ok('control panel on a phone (tab bar), in Arabic');

// 14. the Jordanian store
const jo = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const j = await jo.newPage(); watch(j);
await j.goto(`${BASE}/p/nafha-noir?market=jo&lang=en`);
await j.waitForSelector('.pdp-price');
const jPrice = await j.textContent('.pdp-price span');
if (!jPrice?.includes('JOD')) throw new Error(`jo price: ${jPrice}`);
await settle(j); await shot(j, '11-jordan');
ok(`?market=jo opens the Jordanian store: Nafha Noir ${jPrice}`);

// 15. how it works, with the photographers credited
await j.goto(`${BASE}/how`); await j.waitForSelector('.how-parts');
if ((await j.locator('.credits li').count()) < 20) throw new Error('credits');
await settle(j); await shot(j, '12-how');
ok(`"How does your store work?" page, crediting ${await j.locator('.credits li').count()} photographers`);

await browser.close();
if (errors.length) { console.log('\nConsole errors:\n' + errors.join('\n')); process.exit(1); }
console.log('\nAll good.');
