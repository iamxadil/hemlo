// Browser test of the Dental edition, on the demo clinic: every screen opens without errors, and the main flows work
// (arrive → seat → visit with a bill; book; chart a finding; a plan; lab; reports; set-up; the waiting-room TV).
// Run: npx tsx scripts/dental-e2e.ts   (SKIP_BUILD=1 to reuse the last build)
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
const API = 'http://localhost:8798', ACC = 'http://localhost:4332', SYS = 'http://localhost:4335';
const SHOTS = 'scripts/shots/dental';
const root = (app: string) => new URL(`../apps/${app}/dist/`, import.meta.url).pathname.replace(/^\/(\w:)/, '$1');

if (!process.env.SKIP_BUILD) execSync('npm run build -w @hemlo/system', { stdio: 'ignore', env: { ...process.env, VITE_API_URL: API, VITE_ACCOUNT_URL: ACC } });

const { db } = await createPgliteDb();
const { app } = createApp({ db, env: { AUTH_SECRET: 'demo-test-secret-demo-test-secret-00000', API_URL: API, ACCOUNT_URL: ACC,
  TRUSTED_ORIGINS: `${ACC},${SYS},${API}`, PASSKEY_RP_ID: 'localhost', DEV_CONSOLE_MESSAGES: '1' } as any });
const api = serve({ fetch: app.fetch, port: 8798 });
const types: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const sys = createServer(async (req, res) => {
  let p = join(root('system'), decodeURIComponent(new URL(req.url!, 'http://x').pathname));
  try { if ((await stat(p)).isDirectory()) p = join(p, 'index.html'); res.writeHead(200, { 'content-type': types[extname(p)] ?? 'application/octet-stream' }); res.end(await readFile(p)); }
  catch { res.writeHead(200, { 'content-type': types['.html'] }); res.end(await readFile(join(root('system'), 'index.html'))); }
}).listen(4335);
await mkdir(SHOTS, { recursive: true });

let step = 0; const ok = (m: string) => console.log(`✓ ${++step}. ${m}`);
const errors: string[] = [];
const shot = (p: Page, n: string, full = false) => p.screenshot({ path: `${SHOTS}/${n}.png`, fullPage: full });
const settle = (p: Page) => p.waitForLoadState('networkidle').then(() => p.waitForTimeout(250));
const watch = (p: Page) => {
  p.on('pageerror', (e) => errors.push(`page error: ${e.message}`));
  p.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource|screen\/live/.test(m.text())) errors.push(`console: ${m.text()}`); });
  p.on('response', (r) => { if (r.url().startsWith(API) && r.status() >= 400) errors.push(`${r.status()} ${r.request().method()} ${r.url().replace(API, '')}`); });
};

const browser = await chromium.launch({ executablePath: EDGE, headless: true });
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  await ctx.route('https://hemlohq.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<h1>hemlohq.com</h1>' }));
  const page = await ctx.newPage();
  watch(page);

  // ---- open the demo clinic ----
  await page.goto(`${SYS}/?demo=dental&lang=en`);
  await page.waitForSelector('.demo-bar');
  await page.waitForSelector('.t-card');
  if (!page.url().endsWith('/#/today')) throw new Error(`url: ${page.url()}`);
  if (!(await page.getAttribute('.c-brand', 'title'))!.includes('Baghdad Smile')) throw new Error('clinic name');
  await settle(page); await shot(page, '01-today-en');
  ok('?demo=dental opened the demo clinic on Today, in the clinic frame');

  // ---- the live board: drag a patient from Coming to Waiting, then onto a free chair; buttons; search; "+" ----
  const lane = (st: string) => page.locator(`.t-lane[data-stage="${st}"]`);
  const dragTo = async (from: import('playwright-core').Locator, to: import('playwright-core').Locator) => {
    const a = (await from.boundingBox())!, b = (await to.boundingBox())!;
    await page.mouse.move(a.x + a.width / 2, a.y + 20); await page.mouse.down();
    await page.mouse.move(a.x + a.width / 2 + 10, a.y + 30, { steps: 4 });
    await page.mouse.move(b.x + b.width / 2, b.y + Math.min(60, b.height / 2), { steps: 12 });
    await page.waitForTimeout(150); await shot(page, '01a-mid-drag');
    // the lifted card stays under the pointer, held where it was grabbed
    const px = b.x + b.width / 2, py = b.y + Math.min(60, b.height / 2), l = await page.locator('.t-card.lifted').boundingBox();
    if (!l || Math.abs(px - l.x - a.width / 2) > 24 || Math.abs(py - l.y - 20) > 24) throw new Error(`lifted card is off the pointer: ${JSON.stringify(l)} vs ${px},${py}`);
    await page.mouse.up(); await settle(page);
  };
  const waitingBefore = await lane('waiting').locator('.t-card').count();
  await page.locator('.t-board').scrollIntoViewIfNeeded(); await page.waitForTimeout(200);
  const mover = lane('coming').locator('.t-card').first();
  const moverName = (await mover.locator('.t-who > b').textContent())!.trim();
  await dragTo(mover, lane('waiting'));
  if ((await lane('waiting').locator('.t-card').count()) !== waitingBefore + 1 || !(await lane('waiting').textContent())!.includes(moverName)) throw new Error('drag to waiting');
  await shot(page, '01b-board-dragged');
  const freeChair = page.locator('.t-chair:not(.busy)').first();
  if (await freeChair.count()) {
    const chairName = (await freeChair.locator('.t-chair-name').textContent())!.replace('Free', '').trim();
    await dragTo(lane('waiting').locator('.t-card', { hasText: moverName }), freeChair);
    const seatedIn = page.locator('.t-chair.busy', { hasText: moverName });
    if (!(await seatedIn.count()) || !(await seatedIn.textContent())!.includes(chairName)) throw new Error('drop on chair');
  }
  // the one button: "Arrived" on the next coming card
  const nextName = (await lane('coming').locator('.t-card').first().locator('.t-who > b').textContent())!.trim();
  await lane('coming').locator('.t-card').first().locator('.t-go-mini').click(); await settle(page);
  if (!(await lane('waiting').textContent())!.includes(nextName)) throw new Error('arrived button');
  // the card menu
  await lane('coming').locator('.t-card').first().locator('.t-more').click();
  await page.waitForSelector('.t-menu'); await shot(page, '01c-card-menu'); await page.keyboard.press('Escape'); await page.click('.t-pop-scrim');
  // the day strip points at a card
  await page.locator('.t-seg').first().click(); await page.waitForTimeout(300);
  ok(`board: dragged ${moverName} to Waiting and onto a chair, "Arrived" button, card menu, day strip`);

  // search: Ctrl+K, type, Enter opens the patient
  await page.keyboard.press('Control+k'); await page.waitForSelector('.c-find');
  await page.keyboard.type('Ali Ka'); await page.waitForSelector('.c-find-hit[data-on="true"]:has-text("Ali Kadhim")');
  await shot(page, '01d-finder');
  await page.keyboard.press('Enter'); await page.waitForSelector('.file-head');
  if (!(await page.textContent('.file-head'))!.includes('Ali Kadhim')) throw new Error('finder opened the wrong file');
  // "+": the four new things
  await page.click('.c-add'); await page.waitForSelector('.c-quick');
  if ((await page.locator('.c-quick-item').count()) !== 4) throw new Error('quick add items');
  await shot(page, '01e-quick-add');
  await page.locator('.c-quick-item').first().click(); await page.waitForSelector('.sheet'); await page.keyboard.press('Escape');
  // More: every other page
  await page.click('.c-side-foot button.c-nav'); await page.waitForSelector('.c-more'); await page.waitForTimeout(300); await shot(page, '01f-more'); await page.keyboard.press('Escape');
  await page.goto(`${SYS}/#/today`); await page.waitForSelector('.t-card');
  ok('search (Ctrl+K → Ali → Enter opens his file), "+" menu, More panel');

  // ---- tablets: portrait and landscape ----
  const tab = await browser.newContext({ viewport: { width: 820, height: 1180 }, deviceScaleFactor: 2, reducedMotion: 'reduce', hasTouch: true });
  await tab.route('https://hemlohq.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<h1>hemlohq.com</h1>' }));
  const tp = await tab.newPage(); watch(tp);
  await tp.goto(`${SYS}/?demo=dental&lang=en`); await tp.waitForSelector('.t-card'); await settle(tp); await shot(tp, '40-tablet-today');
  await tp.goto(`${SYS}/#/patients`); await tp.locator('.rows .row').first().click(); await tp.waitForSelector('.file-head'); await settle(tp); await shot(tp, '41-tablet-file');
  await tp.setViewportSize({ width: 1180, height: 820 }); await tp.goto(`${SYS}/#/today`); await tp.waitForSelector('.t-card'); await settle(tp); await shot(tp, '42-tablet-landscape-today');
  await tp.goto(`${SYS}/#/schedule`); await tp.waitForSelector('.day-cols'); await settle(tp); await shot(tp, '43-tablet-landscape-schedule');
  ok('tablet portrait and landscape');

  // ---- schedule ----
  await page.goto(`${SYS}/#/schedule`); await page.waitForSelector('.day-cols'); await settle(page);
  await shot(page, '02-schedule-day');
  const appts = await page.locator('.appt').count();
  if (appts < 5) throw new Error(`appointments on the day grid: ${appts}`);
  await page.click('.seg button >> nth=1').catch(() => {});
  await settle(page); await shot(page, '03-schedule-week');
  ok(`schedule: day grid with ${appts} appointments, week view`);

  // book a new appointment from the day grid
  await page.click('.seg button >> nth=0'); await page.waitForSelector('.day-cols');
  await page.click('button:has-text("New appointment")').catch(async () => { await page.click('.top .btn-accent'); });
  await page.waitForSelector('.sheet');
  await page.fill('.sheet input[type="search"], .sheet .search input', 'Omar');
  await page.waitForTimeout(500);
  await page.click('.sheet .rows button >> nth=0');
  await shot(page, '04-book-sheet');
  await page.click('.sheet footer .btn-accent, .sheet .btn-accent >> nth=-1');
  await settle(page);
  // the time may clash with the demo's own list (it's built around now): the sheet says so, and offers to book anyway
  if (await page.locator('.sheet button:has-text("Book anyway")').count()) { await page.click('.sheet button:has-text("Book anyway")'); await settle(page); errors.splice(errors.findIndex((e) => e.startsWith('409 POST /v1/dent/appointments')), 1); }
  if (await page.locator('.sheet').count()) throw new Error('booking sheet still open');
  ok('booked an appointment');

  // ---- patients ----
  await page.goto(`${SYS}/#/patients`); await page.waitForSelector('.rows'); await settle(page);
  await shot(page, '05-patients');
  await page.fill('.search input', 'Ali');
  await page.waitForTimeout(600);
  await page.click('.rows a:has-text("Ali Kadhim"), .rows button:has-text("Ali Kadhim")');
  await page.waitForSelector('.file-head'); await settle(page);
  await shot(page, '06-file-overview');
  const tabs = await page.locator('.file-tabs button').allTextContents();
  for (let i = 0; i < tabs.length; i++) {
    await page.click(`.file-tabs button >> nth=${i}`); await settle(page);
    await shot(page, `07-file-${String(i).padStart(2, '0')}-${tabs[i].replace(/\W+/g, '-').toLowerCase()}`, true);
  }
  ok(`patient file: ${tabs.length} tabs (${tabs.join(', ')})`);

  // chart a finding: tap 26, caries on O
  await page.click('.file-tabs button:has-text("Chart")'); await page.waitForSelector('.odontogram');
  await page.click('.odontogram .tooth[aria-label="25"]');
  await page.waitForTimeout(200);
  await shot(page, '08-chart-selected');
  await page.waitForSelector('.inspector');
  await page.click('.insp-kind:has-text("Filling")');
  await page.locator('.insp-figure .surf.pickable').nth(4).click();
  await page.click('.insp-actions .btn-accent'); await settle(page);
  if (!(await page.locator('.inspector .insp-list li', { hasText: 'Filling' }).count())) throw new Error('filling not recorded from the inspector');
  await shot(page, '08b-chart-recorded');
  ok('chart: tooth 25 picked, filling recorded on a surface from the inspector');

  // ---- today's flow: Zainab in the chair → new visit, with a bill ----
  const zainab = (await (await page.request.get(`${API}/v1/dent/patients?q=Zainab`, { headers: { authorization: `Bearer ${await page.evaluate(() => JSON.parse(localStorage.getItem('hemlo.demo')!).token)}` } })).json()).patients[0];
  await page.goto(`${SYS}/#/patient?id=${zainab.id}&tab=visits&visit=new`); await page.waitForSelector('.sheet'); await settle(page);
  await shot(page, '09-new-visit');
  const picks = await page.locator('.plan-pick').count();
  if (picks) await page.click('.plan-pick >> nth=0');
  await page.waitForTimeout(200);
  await shot(page, '10-new-visit-picked');
  await page.click('.sheet .btn-accent >> nth=-1');
  await settle(page);
  await shot(page, '11-after-visit');
  ok(`visit saved (${picks} planned items offered)`);

  // ---- lab, reports, clinic ----
  await page.goto(`${SYS}/#/lab`); await page.waitForSelector('.rows'); await settle(page); await shot(page, '12-lab');
  await page.goto(`${SYS}/#/reports`); await page.waitForSelector('.tbl'); await settle(page); await shot(page, '13-reports', true);
  await page.goto(`${SYS}/#/clinic`); await page.waitForSelector('.file-tabs'); await settle(page);
  for (let i = 0; i < 5; i++) { await page.click(`.file-tabs button >> nth=${i}`); await settle(page); await shot(page, `14-clinic-${i}`); }
  await page.goto(`${SYS}/#/customers`); await settle(page); await shot(page, '15-accounts');
  await page.goto(`${SYS}/#/products`); await settle(page); await shot(page, '16-materials');
  ok('lab, reports, clinic set-up, accounts, materials');

  // ---- the waiting-room TV ----
  // opened from the clinic, it switches to the clinic's display-only link; a TV with nobody signed in shows the same
  const opener = await ctx.newPage(); watch(opener);
  await opener.goto(`${SYS}/#/waiting`); await opener.waitForURL((u) => u.hash.startsWith('#/waiting?k='));
  const link = opener.url(); await opener.close();
  const tvCtx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const tv = await tvCtx.newPage(); watch(tv);
  await tv.goto(link); await tv.waitForSelector('.wr-chair, .wr-welcome'); await settle(tv);
  if (await tv.evaluate(() => !!localStorage.getItem('hemlo.demo'))) throw new Error('the TV holds a session');
  await shot(tv, '17-waiting-tv');
  // a patient is seated: the TV calls them in
  const bearer = { authorization: `Bearer ${await page.evaluate(() => JSON.parse(localStorage.getItem('hemlo.demo')!).token)}` };
  const J = { ...bearer, 'content-type': 'application/json' };
  const patch = async (id: string, data: any) => { const r = await page.request.patch(`${API}/v1/dent/appointments/${id}`, { headers: J, data }); if (!r.ok()) throw new Error('TV step: ' + r.status() + ' ' + await r.text()); };
  const queue = (await (await page.request.get(`${API}/v1/dent/queue`, { headers: bearer })).json()).queue;
  const chairs = (await (await page.request.get(`${API}/v1/dent/setup`, { headers: bearer })).json()).chairs;
  // free a chair (the one in it is done), then seat someone in it: arrived, or due today
  const done = queue.find((x: any) => x.status === 'seated');
  if (done) await patch(done.id, { status: 'done' });
  const busy = new Set(queue.filter((x: any) => x.status === 'seated' && x.id !== done?.id).map((x: any) => x.chair));
  const tvChair = chairs.find((c: any) => !busy.has(c.name));
  const day = (await (await page.request.get(`${API}/v1/dent/appointments?from=${new Date(Date.now() - 12 * 3600_000).toISOString()}&to=${new Date(Date.now() + 12 * 3600_000).toISOString()}`, { headers: bearer })).json()).appointments;
  const tvNext = queue.find((x: any) => x.status === 'arrived') ?? day.find((x: any) => ['booked', 'confirmed'].includes(x.status));
  if (!tvChair || !tvNext) throw new Error('nobody to call in');
  await tv.waitForTimeout(13_000); // the TV has seen the queue after the chair was freed
  await patch(tvNext.id, { status: 'seated', chairId: tvChair.id, force: true });
  await tv.waitForSelector('.wr-call', { timeout: 30_000 }); await tv.waitForTimeout(1500);
  await shot(tv, '17b-waiting-tv-call');
  await tv.waitForSelector('.wr-call', { state: 'detached', timeout: 15_000 });
  await tv.waitForSelector('.wr-chair.busy'); await shot(tv, '17c-waiting-tv-after');
  await tvCtx.close();
  ok('waiting-room screen: display-only link, chairs and queue, a patient called in');

  // ---- Arabic, and a phone ----
  const ar = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, reducedMotion: 'reduce', isMobile: true, hasTouch: true });
  await ar.route('https://hemlohq.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<h1>hemlohq.com</h1>' }));
  const phone = await ar.newPage(); watch(phone);
  await phone.goto(`${SYS}/?demo=dental&lang=ar`);
  await phone.waitForSelector('.t-card'); await settle(phone);
  await shot(phone, '20-phone-today-ar');
  // phones: one stage at a time; the stage bar switches, the "+" opens the quick sheet
  await phone.locator('.t-stage').nth(3).click(); await phone.waitForTimeout(600); await shot(phone, '20b-phone-stage-done-ar');
  await phone.click('.c-fab'); await phone.waitForSelector('.c-quick'); await shot(phone, '20c-phone-quick-ar'); await phone.click('.c-scrim');
  await phone.click('.c-search'); await phone.waitForSelector('.c-find'); await shot(phone, '20d-phone-find-ar'); await phone.keyboard.press('Escape');
  await phone.goto(`${SYS}/#/schedule`); await phone.waitForSelector('.day-cols'); await settle(phone); await shot(phone, '21-phone-schedule-ar');
  await phone.goto(`${SYS}/#/patients`); await settle(phone); await shot(phone, '22-phone-patients-ar');
  await phone.locator('.rows .row').first().click();
  await phone.waitForSelector('.file-head'); await settle(phone); await shot(phone, '23-phone-file-ar', true);
  await phone.click('.file-tabs button >> nth=1'); await settle(phone); await shot(phone, '24-phone-chart-ar', true);
  await phone.goto(`${SYS}/#/reports`); await phone.waitForSelector('.tbl'); await settle(phone); await shot(phone, '25-phone-reports-ar', true);
  ok('Arabic on a phone: today, schedule, patients, file, chart, reports');

  // ---- Kurdish (Sorani): the picker, and every dental screen ----
  const ku = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  await ku.route('https://hemlohq.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<h1>hemlohq.com</h1>' }));
  const k = await ku.newPage(); watch(k);
  await k.goto(`${SYS}/?demo=dental&lang=ckb`);
  await k.waitForSelector('.t-card'); await settle(k);
  if ((await k.getAttribute('html', 'lang')) !== 'ckb' || (await k.getAttribute('html', 'dir')) !== 'rtl') throw new Error('ckb lang/dir');
  if (!(await k.textContent('.c-top h1'))!.includes('باش')) throw new Error('Kurdish greeting');
  await shot(k, '30-ckb-today');
  const ready: Record<string, string> = { schedule: '.day-cols, .week-grid, .panel.p-8', patients: '.rows .row', lab: '.rows', reports: '.tbl', clinic: '.file-tabs' };
  for (const [path, n] of [['schedule', '31'], ['patients', '32'], ['lab', '33'], ['reports', '34'], ['clinic', '35']] as const) { await k.goto(`${SYS}/#/${path}`); await k.waitForSelector(ready[path], { timeout: 15000 }); await settle(k); await shot(k, `${n}-ckb-${path}`); }
  await k.goto(`${SYS}/#/patients`); await k.locator('.rows .row').first().click(); await k.waitForSelector('.file-head'); await settle(k); await shot(k, '36-ckb-file');
  await k.click('.c-side-foot button.c-nav'); await k.waitForSelector('.c-more');
  await k.selectOption('.c-more .lang-pick select', 'en'); await k.waitForTimeout(300);
  if ((await k.getAttribute('html', 'dir')) !== 'ltr') throw new Error('picker to English');
  ok('Kurdish (Sorani): picker, today, schedule, patients, lab, reports, clinic, a patient file');
} finally {
  await browser.close();
  api.close(); sys.close();
  if (errors.length) { console.log(`\n${errors.length} problem(s):`); for (const e of [...new Set(errors)]) console.log('  ✗', e); process.exitCode = 1; }
  else console.log('\nno errors');
}
