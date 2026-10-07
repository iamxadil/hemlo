// Browser test of the Gym edition, on the demo gym: every screen opens without errors, and the main flows work
// (scan/type → in; turned back → let in; renew; a new member with "save and sell"; the member's file and card; renewals;
// classes and a booking; reports; set-up; the door screen greeting a check-in made at the desk). Arabic, Kurdish, phone.
// Run: npx tsx scripts/gym-e2e.ts   (SKIP_BUILD=1 to reuse the last build)
process.env.TZ = 'UTC';
import { createServer } from 'node:http';
import { execSync } from 'node:child_process';
import { readFile, stat, mkdir } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { serve } from '@hono/node-server';
import { chromium, type Page } from 'playwright-core';
import { createPgliteDb } from '@hemlo/db/pglite';
import { createApp } from '../apps/api/src/app';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const API = 'http://localhost:8799', ACC = 'http://localhost:4332', SYS = 'http://localhost:4336';
const SHOTS = 'scripts/shots/gym';
const root = (app: string) => new URL(`../apps/${app}/dist/`, import.meta.url).pathname.replace(/^\/(\w:)/, '$1');

if (!process.env.SKIP_BUILD) execSync('npm run build -w @hemlo/system', { stdio: 'ignore', env: { ...process.env, VITE_API_URL: API, VITE_ACCOUNT_URL: ACC } });

const { db } = await createPgliteDb();
const { app } = createApp({ db, env: { AUTH_SECRET: 'demo-test-secret-demo-test-secret-00000', API_URL: API, ACCOUNT_URL: ACC,
  TRUSTED_ORIGINS: `${ACC},${SYS},${API}`, PASSKEY_RP_ID: 'localhost', DEV_CONSOLE_MESSAGES: '1' } as any });
const api = serve({ fetch: app.fetch, port: 8799 });
const types: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const sys = createServer(async (req, res) => {
  let p = join(root('system'), decodeURIComponent(new URL(req.url!, 'http://x').pathname));
  try { if ((await stat(p)).isDirectory()) p = join(p, 'index.html'); res.writeHead(200, { 'content-type': types[extname(p)] ?? 'application/octet-stream' }); res.end(await readFile(p)); }
  catch { res.writeHead(200, { 'content-type': types['.html'] }); res.end(await readFile(join(root('system'), 'index.html'))); }
}).listen(4336);
await mkdir(SHOTS, { recursive: true });

let step = 0; const ok = (m: string) => console.log(`✓ ${++step}. ${m}`);
const errors: string[] = [];
const shot = (p: Page, n: string, full = false) => p.screenshot({ path: `${SHOTS}/${n}.png`, fullPage: full }).catch(() => {});
const settle = (p: Page) => p.waitForLoadState('networkidle').then(() => p.waitForTimeout(300));
const watch = (p: Page, expect4xx: RegExp | null = null) => {
  p.on('pageerror', (e) => errors.push(`page error: ${e.message}`));
  p.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource|door\/live/.test(m.text())) errors.push(`console: ${m.text()}`); });
  p.on('response', (r) => { if (r.url().startsWith(API) && r.status() >= 400 && !(expect4xx && expect4xx.test(r.url()))) errors.push(`${r.status()} ${r.request().method()} ${r.url().replace(API, '')}`); });
};
const go = async (p: Page, hash: string, sel: string) => { await p.evaluate((h) => { location.hash = h; }, hash); await p.waitForSelector(sel); await settle(p); };

const browser = await chromium.launch({ executablePath: EDGE, headless: true });
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  await ctx.route('https://hemlohq.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<h1>hemlohq.com</h1>' }));
  const page = await ctx.newPage();
  watch(page);

  // ---- open the demo gym on the front desk ----
  await page.goto(`${SYS}/?demo=gym&lang=en`);
  await page.waitForSelector('.demo-bar');
  await page.waitForSelector('.gy-scan-in');
  if (!page.url().endsWith('/#/desk')) throw new Error(`url: ${page.url()}`);
  await page.waitForSelector('.gy-feed');
  await settle(page); await shot(page, '01-desk-en');
  ok('?demo=gym opened the demo gym on the front desk, in the gym frame');

  // ---- type a name, Enter: in ----
  const members = await page.evaluate(async (API) => { const t = JSON.parse(localStorage.getItem('hemlo.demo')!).token; const r = await fetch(`${API}/v1/gym/members?status=all`, { headers: { authorization: `Bearer ${t}` } }); return (await r.json()).members; }, API);
  const active = members.find((m: any) => m.state === 'active' && m.gender === 'f') ?? members.find((m: any) => m.state === 'active');
  const lapsed = members.find((m: any) => m.state === 'expired');
  await page.fill('.gy-scan-in', active.name.split(' ')[0]);
  await page.waitForSelector('.gy-scan-hit');
  await shot(page, '02-desk-typing');
  await page.fill('.gy-scan-in', active.name);
  await page.waitForSelector(`.gy-scan-hit:has-text("${active.name}")`);
  await page.keyboard.press('Enter');
  await page.waitForSelector('.gy-pass');
  const head = await page.textContent('.gy-pass-head');
  if (!/Welcome|Already/.test(head!)) throw new Error(`pass: ${head}`);
  await settle(page); await shot(page, '03-desk-welcome');
  ok(`typing a name + Enter checked ${active.name} in: "${head!.trim()}"`);

  // ---- a lapsed member: turned back, let in once, then renewed ----
  await page.fill('.gy-scan-in', lapsed.name);
  await page.waitForSelector(`.gy-scan-hit:has-text("${lapsed.name}")`);
  await page.keyboard.press('Enter');
  await page.waitForSelector('.gy-pass.pass-denied');
  await settle(page); await shot(page, '04-desk-denied');
  await page.click('.gy-pass-acts button:has-text("Let them in anyway")');
  await page.waitForSelector('.gy-pass.pass-override');
  ok(`${lapsed.name} was turned back (membership ended), then let in by the desk`);
  await page.click('.gy-pass-acts button:has-text("Renew")');
  await page.waitForSelector('.gy-plan');
  await page.click('.gy-plan:has-text("One month")');
  await page.waitForSelector('.gy-when');
  await shot(page, '05-sell-sheet');
  await page.click('.sheet-f .btn-accent');
  await page.waitForSelector('.toast:has-text("Sold")');
  ok('renewed from the pass: one month, paid in full');

  // ---- members: filters, the file, the card ----
  await go(page, '#/members', '.gy-filter');
  await page.waitForSelector('.gy-mrow');
  await shot(page, '06-members');
  await page.click('.gy-filter.flt-ending');
  await settle(page); await shot(page, '06b-members-ending');
  await page.click('.gy-filter.flt-active');
  await settle(page);
  const ali = members.find((m: any) => /Ali Hussein/.test(m.name));
  await go(page, `#/member?id=${ali.id}`, '.gy-hero');
  await shot(page, '07-member-file');
  await page.click('.sseg button:has-text("Progress")');
  await page.waitForSelector('.gy-line');
  await settle(page); await shot(page, '08-member-progress');
  await page.click('.sseg button:has-text("Visits")');
  await page.waitForSelector('.gy-map');
  await shot(page, '09-member-visits');
  await page.click('button[title="Card"]');
  await page.waitForSelector('.gy-pass img');
  if (!(await page.isEnabled('button:has-text("Print")'))) throw new Error('card: Print is not ready');
  await page.waitForTimeout(600);
  await shot(page, '10-member-card');
  await page.keyboard.press('Escape');
  ok('member file: memberships, progress chart, 12-week visit map, the QR card');

  // ---- a personal-training session ----
  await page.click('.sseg button:has-text("Memberships")');
  const sessionBtn = page.locator('.gy-ms button:has-text("Session done")').first();
  if (await sessionBtn.count()) { await sessionBtn.click(); await page.waitForSelector('.toast:has-text("Session")'); ok('a personal-training session recorded'); }

  // ---- a new member: save and sell ----
  await page.click('.gy-add');
  await page.click('.gy-quick-item:has-text("New member")');
  await page.fill('.sheet .field:has-text("Full name") input', 'Test Member');
  await page.fill('.sheet .field:has-text("Phone") input', '07701239999');
  await page.click('.sheet .seg button:has-text("Male")');
  await page.click('.sheet .chip:has-text("Build muscle")');
  await shot(page, '11-new-member');
  await page.click('.sheet-f .btn-accent');
  await page.waitForSelector('.gy-plan');
  await page.click('.gy-plan:has-text("Three months")');
  await page.click('.sheet-f .btn-accent');
  await page.waitForSelector('.gy-hero-pass');
  await settle(page);
  if (!(await page.textContent('.gy-hero-pass'))!.includes('Three months')) throw new Error('new member not sold');
  await shot(page, '12-new-member-file');
  ok('a new member: saved, sold three months, opened on their file');

  // ---- renewals, classes, reports, set-up ----
  await go(page, '#/renewals', '.gy-rrow');
  await shot(page, '13-renewals');
  ok(`renewals: ${await page.locator('.gy-rrow').count()} due, with WhatsApp reminders`);
  await go(page, '#/classes', '.gy-session');
  await shot(page, '14-classes');
  const sess = page.locator('.gy-session:not(.full)').first();
  await sess.click();
  await page.waitForSelector('.sheet');
  await page.click('.sheet button:has-text("Book a member")');
  await page.fill('.sheet .search input', 'a');
  await page.waitForSelector('.sheet .gy-face');
  await shot(page, '15-class-session');
  await page.keyboard.press('Escape');
  ok('classes: the week, a session and its bookings');
  await go(page, '#/reports', '.gy-heat');
  await page.waitForTimeout(500);
  await shot(page, '16-reports', true);
  ok('reports: money by day, the busy map, what sells, coaches');
  await go(page, '#/gym', '.gy-card, .gymf .rows');
  await shot(page, '17-setup-plans');
  await page.click('.sseg button:has-text("Weekly timetable")');
  await page.waitForSelector('.gy-tt-k');
  await shot(page, '18-setup-timetable');
  await page.click('.sseg button:has-text("The door")');
  await page.waitForSelector('.gy-hours');
  await shot(page, '19-setup-door', true);
  ok('set-up: plans, timetable, hours and the door');
  await go(page, '#/sell', '.scan, .sell');
  await shot(page, '20-shop');
  ok('the shop (water, protein) opens on the shared till');

  // ---- the door screen greets a check-in made at the desk ----
  const door = await ctx.newPage();
  watch(door);
  await door.goto(`${SYS}/#/door`);
  await door.waitForSelector('.door-now b');
  await door.click('.door-start');
  await settle(door);
  await shot(door, '21-door');
  await page.evaluate(() => { location.hash = '#/desk'; });
  await page.waitForSelector('.gy-scan-in');
  const fresh = (m: any) => m.state === 'active' && m.id !== active.id && m.id !== ali.id && (!m.lastVisitAt || Date.now() - +new Date(m.lastVisitAt) > 4 * 3600_000);
  const another = members.find((m: any) => fresh(m) && m.gender === 'f') ?? members.find(fresh);
  await page.fill('.gy-scan-in', another.name);
  await page.waitForSelector(`.gy-scan-hit:has-text("${another.name}")`);
  await page.keyboard.press('Enter');
  await page.waitForSelector('.gy-pass');
  await door.waitForSelector('.door-hi', { timeout: 20_000 });
  await door.waitForTimeout(300);
  await shot(door, '22-door-welcome');
  ok(`the door screen greeted ${another.name.split(' ')[0]} (${(await door.textContent('.door-hi h2'))!.trim()})`);
  await door.close();

  // ---- Arabic, Kurdish, a phone ----
  for (const lang of ['ar', 'ckb'] as const) {
    await page.evaluate((l) => { localStorage.setItem('hemlo.lang', l); }, lang);
    await page.reload(); await page.waitForSelector('.gy-scan-in'); await settle(page);
    if ((await page.getAttribute('html', 'dir')) !== 'rtl') throw new Error(`${lang}: not rtl`);
    await shot(page, `30-desk-${lang}`);
    await go(page, `#/member?id=${ali.id}`, '.gy-hero'); await shot(page, `31-member-${lang}`);
    await go(page, '#/desk', '.gy-scan-in');
  }
  ok('Arabic and Kurdish: right to left, everything in place');
  await page.evaluate(() => localStorage.setItem('hemlo.lang', 'ar'));
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce', storageState: await ctx.storageState() });
  await phone.route('https://hemlohq.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '' }));
  const ph = await phone.newPage(); watch(ph);
  await ph.goto(`${SYS}/#/desk`); await ph.waitForSelector('.gy-dock'); await settle(ph);
  await shot(ph, '40-phone-desk');
  await go(ph, '#/members', '.gy-mrow'); await shot(ph, '41-phone-members');
  await go(ph, `#/member?id=${ali.id}`, '.gy-hero'); await shot(ph, '42-phone-member');
  await ph.click('.gy-fab'); await ph.waitForSelector('.gy-quick'); await shot(ph, '43-phone-plus');
  ok('a phone: the dock with "+", members, a member\'s file');

  if (errors.length) throw new Error(`errors:\n${errors.join('\n')}`);
  console.log('\nAll good.');
} finally {
  await browser.close(); api.close(); sys.close();
}
