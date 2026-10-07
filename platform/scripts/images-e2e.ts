// Browser test of pictures in Hemlo Systems: the shop logo, a product photo, a receipt photo — picked with the real
// file picker, shrunk in the browser, uploaded, and shown (sidebar, Sell tiles, receipt, customer display, full screen).
// Run: npx tsx scripts/images-e2e.ts   (SKIP_BUILD=1 to reuse the last build)
process.env.TZ = 'UTC';
import { createServer } from 'node:http';
import { execSync } from 'node:child_process';
import { readFile, stat, mkdir } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { serve } from '@hono/node-server';
import { chromium, type Page } from 'playwright-core';
import { createPgliteDb } from '@hemlo/db/pglite';
import { createApp } from '../apps/api/src/app';
import { memoryStore } from '../apps/api/src/files';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const API = 'http://localhost:8797', ACC = 'http://localhost:4331', SYS = 'http://localhost:4334';
const SHOTS = 'scripts/shots/images';
const here = (p: string) => new URL(p, import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
const LOGO = here('../../website/public/icon-512.png');
const PHOTO = here('../../website/public/video/demo-shop-en-v1.jpg');
const RECEIPT = here('../../website/public/images/invoice-demo-en.png');

if (!process.env.SKIP_BUILD) execSync('npm run build -w @hemlo/system', { stdio: 'ignore', env: { ...process.env, VITE_API_URL: API, VITE_ACCOUNT_URL: ACC } });

const { db } = await createPgliteDb();
const files = memoryStore();
const { app } = createApp({ db, files, env: { AUTH_SECRET: 'images-test-secret-images-test-secret-0', API_URL: API, ACCOUNT_URL: ACC,
  TRUSTED_ORIGINS: `${ACC},${SYS},${API}`, PASSKEY_RP_ID: 'localhost', DEV_CONSOLE_MESSAGES: '1' } as any });
const api = serve({ fetch: app.fetch, port: 8797 });
const types: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const sys = createServer(async (req, res) => {
  let p = join(here('../apps/system/dist/'), decodeURIComponent(new URL(req.url!, 'http://x').pathname));
  try { if ((await stat(p)).isDirectory()) p = join(p, 'index.html'); res.writeHead(200, { 'content-type': types[extname(p)] ?? 'application/octet-stream' }); res.end(await readFile(p)); }
  catch { res.writeHead(200, { 'content-type': types['.html'] }); res.end(await readFile(join(here('../apps/system/dist/'), 'index.html'))); }
}).listen(4334);
await mkdir(SHOTS, { recursive: true });

let step = 0; const ok = (m: string) => console.log(`✓ ${++step}. ${m}`);
const shot = (p: Page, n: string, full = false) => p.screenshot({ path: `${SHOTS}/${n}.png`, fullPage: full });
const choose = async (p: Page, click: () => Promise<unknown>, file: string) => { const [fc] = await Promise.all([p.waitForEvent('filechooser'), click()]); await fc.setFiles(file); };

const browser = await chromium.launch({ executablePath: EDGE, headless: true });
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error('page error:', e.message));
  await page.goto(`${SYS}/?demo=1&lang=en`);
  await page.waitForSelector('.demo-bar');

  // the logo: Settings → pick → shrunk → uploaded → saved; the sidebar shows it
  await page.goto(`${SYS}/#/settings`);
  await page.waitForSelector('.img-pick');
  await choose(page, () => page.click('.img-pick .img-box'), LOGO);
  await page.waitForSelector('.toast:has-text("Logo saved")');
  await page.waitForSelector('.biz-logo');
  await page.waitForTimeout(300);
  await shot(page, '01-settings-logo');
  ok('logo picked, shrunk, uploaded, saved; shown in Settings and the sidebar');

  // a product photo, then the Sell screen shows it
  await page.goto(`${SYS}/#/products`);
  await page.click('.row:has-text("Pepsi 330ml")');
  await page.click('button:has-text("Edit product")');
  await choose(page, () => page.click('.sheet .img-pick .img-box'), PHOTO);
  await page.waitForSelector('.sheet .img-pick img');
  await shot(page, '02-product-photo');
  await page.click('.sheet-f .btn-accent');
  await page.waitForSelector('.toast:has-text("Saved")');
  await page.goto(`${SYS}/#/sell`);
  await page.waitForSelector('.tile.has-img .tile-img img');
  const natural = await page.$eval('.tile.has-img .tile-img img', (i) => (i as HTMLImageElement).naturalWidth);
  if (!natural || natural > 800) throw new Error('product photo not shrunk: ' + natural);
  await shot(page, '03-sell-tiles');
  ok(`product photo (shrunk to ${natural}px wide) on the product and on the Sell tile`);

  // a sale: the printed receipt carries the logo; the customer display shows it
  const display = await ctx.newPage(); await display.goto(`${SYS}/#/display`);
  await page.bringToFront();
  await page.click('.tile.has-img');
  await display.waitForSelector('.cd-logo');
  await display.screenshot({ path: `${SHOTS}/04-display.png` });
  await page.click('.cart .pay-btn'); await page.click('.sheet .chip >> nth=0'); await page.click('.sheet-f .pay-btn');
  await page.waitForSelector('.big-total');
  if (!(await page.$('.receipt .r-logo'))) throw new Error('receipt has no logo');
  await page.keyboard.press('Enter');
  ok('the customer display and the printed receipt show the logo');

  // an expense with a receipt photo; the list shows it; tap → full screen
  await page.goto(`${SYS}/#/expenses`);
  await page.click('button:has-text("New expense")');
  await page.locator('.sheet .field input').first().fill('25000');
  await choose(page, () => page.click('.sheet .attach-add'), RECEIPT);
  await page.waitForSelector('.sheet .attach-thumb img');
  await shot(page, '05-expense-photo');
  await page.click('.sheet-f .btn-accent');
  await page.waitForSelector('.rows .attach-thumb img');
  await page.click('.rows .attach-thumb');
  await page.waitForSelector('.lightbox img');
  await page.waitForTimeout(300);
  await shot(page, '06-lightbox');
  await page.keyboard.press('Escape');
  ok('expense saved with its receipt photo; the list shows it; opens full screen');

  // on a phone, Arabic
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce', storageState: await ctx.storageState() });
  const pp = await phone.newPage();
  await pp.goto(`${SYS}/?lang=ar#/sell`); await pp.waitForSelector('.tile.has-img'); await pp.waitForTimeout(400);
  await shot(pp, '07-sell-ar-phone');
  await pp.goto(`${SYS}/?lang=ar#/settings`); await pp.waitForSelector('.img-pick img'); await shot(pp, '08-settings-ar-phone', true);
  ok('Arabic on a phone: photo tiles and the logo setting');
} catch (e) { for (const p of browser.contexts().flatMap((c) => c.pages())) await p.screenshot({ path: `${SHOTS}/zz-fail-${Math.random().toString(36).slice(2, 6)}.png` }).catch(() => {}); throw e; } finally {
  await browser.close(); api.close(); sys.close();
}
console.log(`\nAll picture flows passed. (${files.size()} images stored)`);
process.exit(0);
