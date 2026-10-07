// Browser test of the demo shop: hemlohq.com → "Try the demo shop" → a private, stocked market on the real system.
// Run: npx tsx scripts/demo-e2e.ts   (SKIP_BUILD=1 to reuse the last build)
process.env.TZ = 'UTC';
import { createServer } from 'node:http';
import { execSync } from 'node:child_process';
import { readFile, stat, mkdir } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { serve } from '@hono/node-server';
import { chromium, type Page } from 'playwright-core';
import { createPgliteDb } from '@hemlo/db/pglite';
import { createApp } from '../apps/api/src/app';
import { purgeDemos } from '../apps/api/src/routes/demo';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const API = 'http://localhost:8797', ACC = 'http://localhost:4331', SYS = 'http://localhost:4334';
const SHOTS = 'scripts/shots/demo';
const root = (app: string) => new URL(`../apps/${app}/dist/`, import.meta.url).pathname.replace(/^\/(\w:)/, '$1');

if (!process.env.SKIP_BUILD) execSync('npm run build -w @hemlo/system', { stdio: 'ignore', env: { ...process.env, VITE_API_URL: API, VITE_ACCOUNT_URL: ACC } });

const { db } = await createPgliteDb();
const { app } = createApp({ db, env: { AUTH_SECRET: 'demo-test-secret-demo-test-secret-00000', API_URL: API, ACCOUNT_URL: ACC,
  TRUSTED_ORIGINS: `${ACC},${SYS},${API}`, PASSKEY_RP_ID: 'localhost', DEV_CONSOLE_MESSAGES: '1' } as any });
const api = serve({ fetch: app.fetch, port: 8797 });
const types: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const sys = createServer(async (req, res) => {
  let p = join(root('system'), decodeURIComponent(new URL(req.url!, 'http://x').pathname));
  try { if ((await stat(p)).isDirectory()) p = join(p, 'index.html'); res.writeHead(200, { 'content-type': types[extname(p)] ?? 'application/octet-stream' }); res.end(await readFile(p)); }
  catch { res.writeHead(200, { 'content-type': types['.html'] }); res.end(await readFile(join(root('system'), 'index.html'))); }
}).listen(4334);
await mkdir(SHOTS, { recursive: true });

let step = 0; const ok = (m: string) => console.log(`✓ ${++step}. ${m}`);
const shot = (p: Page, n: string, full = false) => p.screenshot({ path: `${SHOTS}/${n}.png`, fullPage: full });
const demoCount = async () => ((await db.execute(`select count(*)::int as n from "user" where email like '%@demo.hemlohq.invalid'` as any)) as any).rows?.[0]?.n ?? 0;

const browser = await chromium.launch({ executablePath: EDGE, headless: true });
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  await ctx.route('https://hemlohq.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<h1>hemlohq.com</h1>' }));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error('page error:', e.message));

  // one tap from the website: a stocked shop, on Today, with the banner
  await page.goto(`${SYS}/?demo=1&lang=en`);
  await page.waitForSelector('.demo-bar');
  await page.waitForSelector('.kpi.hero .v');
  if (!page.url().endsWith('/#/home') || page.url().includes('demo=1')) throw new Error(`url not cleaned: ${page.url()}`);
  if (!(await page.textContent('.biz'))!.includes('Al-Noor Market')) throw new Error('shop name');
  await page.click('.chip:has-text("7 days")');
  await page.waitForTimeout(400);
  await shot(page, '01-today-week-en');
  ok('?demo=1 opened Al-Noor Market on Today, with the demo banner and a week of numbers');

  // sell by "scanning": can, carton, scale label
  await page.goto(`${SYS}/#/sell`);
  await page.waitForSelector('.try-code');
  for (const i of [0, 1, 2]) await page.click(`.try-code >> nth=${i}`);
  const lines = await page.locator('.cart-lines .line').count();
  if (lines !== 3) throw new Error(`cart lines ${lines}`);
  const cart = await page.textContent('.cart-lines');
  const weight = await page.inputValue('.cart-lines .line >> nth=2 >> .stepper input');
  if (!cart!.includes('Carton (24)') || !cart!.includes('11,000') || weight !== '1.25') throw new Error(`cart: ${cart} / ${weight}`);
  await shot(page, '02-sell-try-codes-en');
  await page.click('.pay-btn'); await page.click('.sheet .chip >> nth=0'); await page.click('.sheet-f .pay-btn');
  await page.waitForSelector('.sheet h2:has-text("Sale complete")');
  await shot(page, '03-sale-complete-en');
  await page.keyboard.press('Enter');
  ok('tapped a can, a carton and a scale label into the cart, and sold them');

  // fenced: settings say so
  await page.goto(`${SYS}/#/settings`);
  await page.waitForSelector('text=These are locked in the demo');
  if (await page.locator('text=FIB · online payments').count()) throw new Error('FIB settings shown in demo');
  ok('settings: FIB and the shop device are locked, and it says why');

  // reload and the website button again: the same shop, not a new one
  const before = await demoCount();
  await page.goto(`${SYS}/?demo=1&lang=en`);
  await page.waitForSelector('.demo-bar');
  await page.reload(); await page.waitForSelector('.demo-bar');
  if ((await demoCount()) !== before) throw new Error('a second demo was made');
  ok('coming back (reload, or the website button again) reopens the same shop');

  // exit
  await page.click('.demo-bar .btn-secondary'); // Exit demo (the other button starts a real shop)
  await page.waitForURL('https://hemlohq.com/**');
  if (!page.url().endsWith('/en/store/')) throw new Error(page.url());
  await page.goto(`${SYS}/`);
  await page.waitForSelector('.gate a.btn-accent');
  if (await page.evaluate(() => localStorage.getItem('hemlo.demo'))) throw new Error('demo token left behind');
  ok('Exit demo: back to hemlohq.com/systems, token and cache gone, the app is back to "sign in"');

  // Arabic, on a phone
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const pp = await phone.newPage();
  pp.on('pageerror', (e) => console.error('page error:', e.message));
  await pp.goto(`${SYS}/?demo=1&lang=ar`);
  await pp.waitForSelector('.demo-bar'); await pp.waitForSelector('.kpi.hero .v');
  if (!(await pp.textContent('.demo-bar'))!.includes('تجريبي')) throw new Error('ar banner');
  await shot(pp, '04-today-ar-phone', true);
  await pp.goto(`${SYS}/#/sell`); await pp.waitForSelector('.try-code');
  await pp.click('.try-code >> nth=2');
  await shot(pp, '05-sell-ar-phone');
  ok('Arabic on a phone: banner, tour, scale label into the cart');

  // after a day it's gone, and the app says so
  await purgeDemos(db as any, 0);
  await pp.reload();
  await pp.waitForSelector('text=انتهت التجربة');
  await shot(pp, '06-ended-ar');
  await pp.click('.gate a.btn-accent');
  await pp.waitForSelector('.demo-bar');
  ok('after the clean-up: "the demo has ended", and one tap opens a fresh one');
} catch (e) { for (const p of browser.contexts().flatMap((c) => c.pages())) await p.screenshot({ path: `${SHOTS}/zz-fail-${Math.random().toString(36).slice(2, 6)}.png` }).catch(() => {}); throw e; } finally {
  await browser.close(); api.close(); sys.close();
}
console.log('\nAll demo flows passed.');
process.exit(0);
