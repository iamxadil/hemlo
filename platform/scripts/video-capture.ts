// Captures the demo shop for the product video: crisp 2× screenshots of every beat, plus where things are on screen
// (so the video's cursor and camera land exactly on them). Output: video/demo-shop/public/shots/{ar,en}/.
// Run: npx tsx scripts/video-capture.ts   (SKIP_BUILD=1 to reuse the last system build)
import { FAKE_NOW } from './video-clock';
process.env.TZ = 'UTC';
import { createServer } from 'node:http';
import { execSync } from 'node:child_process';
import { readFile, stat, mkdir, writeFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { serve } from '@hono/node-server';
import { chromium, type BrowserContext, type Page } from 'playwright-core';
import { createPgliteDb } from '@hemlo/db/pglite';
import { createApp } from '../apps/api/src/app';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const API = 'http://localhost:8797', ACC = 'http://localhost:4331', SYS = 'http://localhost:4334', WEB = 'http://localhost:4390';
const OUT = new URL('../../video/demo-shop/public/shots/', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
const dist = (p: string) => new URL(p, import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
const W = 1440, H = 900;

if (!process.env.SKIP_BUILD) execSync('npm run build -w @hemlo/system', { stdio: 'ignore', env: { ...process.env, VITE_API_URL: API, VITE_ACCOUNT_URL: ACC } });

const { db } = await createPgliteDb();
const { app } = createApp({ db, env: { AUTH_SECRET: 'video-capture-secret-video-capture-000', API_URL: API, ACCOUNT_URL: ACC,
  TRUSTED_ORIGINS: `${ACC},${SYS},${API}`, PASSKEY_RP_ID: 'localhost', DEV_CONSOLE_MESSAGES: '1' } as any });
const api = serve({ fetch: app.fetch, port: 8797 });
const types: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.xml': 'application/xml' };
const serveDir = (dir: string, port: number, spa: boolean) => createServer(async (req, res) => {
  let p = join(dir, decodeURIComponent(new URL(req.url!, 'http://x').pathname));
  try { if ((await stat(p)).isDirectory()) p = join(p, 'index.html'); res.writeHead(200, { 'content-type': types[extname(p)] ?? 'application/octet-stream' }); res.end(await readFile(p)); }
  catch { if (spa) { res.writeHead(200, { 'content-type': types['.html'] }); res.end(await readFile(join(dir, 'index.html'))); } else { res.writeHead(404); res.end(); } }
}).listen(port);
const sys = serveDir(dist('../apps/system/dist/'), 4334, true), web = serveDir(dist('../../website/dist/'), 4390, false);

type Rect = { x: number; y: number; w: number; h: number };
const rects: Record<string, Record<string, Rect | Rect[]>> = {};
const box = async (p: Page, sel: string): Promise<Rect> => { const b = (await p.locator(sel).first().boundingBox())!; return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; };
const boxes = async (p: Page, sel: string): Promise<Rect[]> => Promise.all((await p.locator(sel).all()).map(async (l) => { const b = (await l.boundingBox())!; return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; }));
const settle = async (p: Page, ms = 450) => { await p.mouse.move(1, 1); await p.evaluate(() => (document.activeElement as HTMLElement | null)?.blur?.()); await p.waitForLoadState('networkidle').catch(() => {}); await p.waitForTimeout(ms); };
let dir = '';
const shot = async (p: Page, name: string, marks: Record<string, Rect | Rect[]> = {}) => { await p.screenshot({ path: `${dir}/${name}.png` }); rects[name] = marks; console.log('  ·', name); };

const browser = await chromium.launch({ executablePath: EDGE, headless: true });
const fresh = async (opts: Parameters<typeof browser.newContext>[0]) => {
  const ctx = await browser.newContext({ timezoneId: 'Asia/Baghdad', reducedMotion: 'reduce', ...opts });
  await ctx.clock.install({ time: FAKE_NOW }); await ctx.clock.resume();
  return ctx;
};
// no caret, no focus rings, no scrollbars: a clean frame
const CLEAN = '*{caret-color:transparent!important} ::-webkit-scrollbar{display:none} .reveal,.rise{opacity:1!important;transform:none!important;animation:none!important}';

try {
  for (const lang of ['ar', 'en'] as const) {
    console.log(lang);
    dir = `${OUT}${lang}`; await mkdir(dir, { recursive: true });
    Object.keys(rects).forEach((k) => delete rects[k]);
    const ctx: BrowserContext = await fresh({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.error('page error:', e.message));

    // 1. the website: "Try the demo shop"
    await page.goto(`${WEB}/${lang === 'en' ? 'en/' : ''}systems/stores/`);
    await page.addStyleTag({ content: CLEAN });
    await settle(page, 700);
    await shot(page, 'web', { demo: await box(page, '.hero a[href*="demo=1"]') });

    // 2. opening the shop (held for a moment, to photograph it)
    let release!: () => void; const held = new Promise<void>((r) => (release = r));
    await page.route(`${API}/v1/demo/start`, async (route) => { await held; await route.continue(); });
    await page.goto(`${SYS}/?demo=1&lang=${lang}`);
    await page.waitForSelector('.gate .spinner'); await page.addStyleTag({ content: CLEAN }); await page.waitForTimeout(300);
    await shot(page, 'opening', { spinner: await box(page, '.gate .spinner') });
    release();

    // 3. today
    await page.waitForSelector('.kpi.hero .v'); await page.addStyleTag({ content: CLEAN }); await settle(page, 900);
    console.log("  browser clock:", await page.evaluate(() => new Date().toString()));
    await shot(page, 'today', { kpis: await boxes(page, '.kpis >> nth=0 >> .kpi'), kpis2: await boxes(page, '.kpis >> nth=1 >> .kpi'), tour: await box(page, '.try'), banner: await box(page, '.demo-bar'), chart: await box(page, '.bars') });
    await page.click('.chips .chip >> nth=2'); await settle(page, 900);
    await shot(page, 'today-week', { kpis: await boxes(page, '.kpis >> nth=0 >> .kpi'), chart: await box(page, '.bars') });

    // 4. selling: the customer display joins in on a second screen
    await page.goto(`${SYS}/#/sell`); await page.waitForSelector('.try-code'); await settle(page);
    const display = await ctx.newPage(); await display.goto(`${SYS}/#/display`); await display.addStyleTag({ content: CLEAN });
    await page.bringToFront();
    await shot(page, 'sell-0', { codes: await boxes(page, '.try-code'), cart: await box(page, '.cart'), scan: await box(page, '.scan'), pay: await box(page, '.cart .pay-btn') });
    for (const i of [0, 1, 2]) {
      await page.click(`.try-code >> nth=${i}`); await page.waitForFunction((n) => document.querySelectorAll('.cart-lines .line').length === n, i + 1); await settle(page, 350);
      await shot(page, `sell-${i + 1}`, { lines: await boxes(page, '.cart-lines .line'), total: await box(page, '.cart .grand'), pay: await box(page, '.cart .pay-btn'), cart: await box(page, '.cart') });
    }
    await display.waitForTimeout(600); await display.screenshot({ path: `${dir}/display.png` }); rects.display = {};

    // 5. paying: cash, what the customer handed over, the change
    await page.click('.cart .pay-btn'); await page.waitForSelector('.sheet .chip'); await settle(page, 500);
    await shot(page, 'pay-0', { sheet: await box(page, '.sheet'), chips: await boxes(page, '.sheet .chip'), payBtn: await box(page, '.sheet-f .pay-btn') });
    const received = page.locator('.sheet input').first();
    if (await received.count()) { await received.fill('30000'); await settle(page, 300); }
    await shot(page, 'pay-1', { sheet: await box(page, '.sheet'), input: await box(page, '.sheet input'), payBtn: await box(page, '.sheet-f .pay-btn'), change: await box(page, '.sheet .change') });
    await page.click('.sheet-f .pay-btn'); await page.waitForSelector('.big-total'); await settle(page, 500);
    await shot(page, 'done', { sheet: await box(page, '.sheet'), total: await box(page, '.big-total'), change: await box(page, '.sheet .change') });
    await display.waitForTimeout(600); await display.screenshot({ path: `${dir}/display-done.png` });
    await page.keyboard.press('Enter'); await display.close();

    // 6. the debt book, the stock, closing the day, and the drawer history
    await page.goto(`${SYS}/#/customers`); await settle(page, 700);
    await shot(page, 'customers', { rows: (await boxes(page, 'main.page .row')).slice(0, 6) });
    await page.goto(`${SYS}/#/products`); await settle(page, 700);
    await shot(page, 'products', {});
    await page.goto(`${SYS}/#/home`); await page.waitForSelector('.kpi.hero .v'); await settle(page);
    const drawerBtn = await box(page, 'header.top .btn');
    await shot(page, 'home-after', { button: drawerBtn, kpis: await boxes(page, '.kpis >> nth=0 >> .kpi') });
    await page.click('header.top .btn'); await page.waitForSelector('.sheet input'); await settle(page, 500);
    await shot(page, 'drawer-0', { button: drawerBtn, sheet: await box(page, '.sheet'), input: await box(page, '.sheet input') });
    const expected = await page.evaluate(() => { const el = [...document.querySelectorAll('.sheet .font-semibold .money, .sheet .font-semibold span:last-child')].pop(); return Number((el?.textContent ?? '').replace(/[^\d٠-٩]/g, '').replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))); });
    await page.locator('.sheet input').first().fill(String(Math.max(0, expected - 1000)));
    await settle(page, 400);
    await shot(page, 'drawer-1', { sheet: await box(page, '.sheet'), diff: await box(page, '.sheet .change') });
    await page.keyboard.press('Escape');
    await page.goto(`${SYS}/#/shifts`); await settle(page, 700);
    await shot(page, 'shifts', {});
    await ctx.close();

    // 7. on a phone
    const phone = await fresh({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    const pp = await phone.newPage();
    await pp.goto(`${SYS}/?demo=1&lang=${lang}`); await pp.waitForSelector('.kpi.hero .v'); await pp.addStyleTag({ content: CLEAN }); await settle(pp, 900);
    await pp.screenshot({ path: `${dir}/phone-today.png` });
    await pp.goto(`${SYS}/#/sell`); await pp.waitForSelector('.try-code'); await pp.addStyleTag({ content: CLEAN });
    await pp.click('.try-code >> nth=1'); await pp.click('.try-code >> nth=2'); await settle(pp, 600);
    await pp.screenshot({ path: `${dir}/phone-sell.png` });
    await pp.goto(`${SYS}/#/customers`); await settle(pp, 700);
    await pp.screenshot({ path: `${dir}/phone-customers.png` });
    await phone.close();

    await writeFile(`${dir}/rects.json`, JSON.stringify({ viewport: { w: W, h: H }, rects }, null, 1));
  }
} finally { await browser.close(); api.close(); sys.close(); web.close(); }
console.log('captured.');
process.exit(0);
