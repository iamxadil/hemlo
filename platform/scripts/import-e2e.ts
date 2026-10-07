// Browser test of Excel/CSV import in every system: the demo shop's debt book, the demo clinic's patients, the demo gym's
// members (with their memberships). A CSV with Arabic headers goes in; the columns are matched by themselves.
// Run: npx tsx scripts/import-e2e.ts   (SKIP_BUILD=1 to reuse the last build)
process.env.TZ = 'UTC';
import { createServer } from 'node:http';
import { execSync } from 'node:child_process';
import { readFile, stat, mkdir, writeFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { serve } from '@hono/node-server';
import { chromium, type Page } from 'playwright-core';
import { createPgliteDb } from '@hemlo/db/pglite';
import { createApp } from '../apps/api/src/app';

const API = 'http://localhost:8796', ACC = 'http://localhost:4332', SYS = 'http://localhost:4337', SHOTS = 'scripts/shots/import';
const root = new URL('../apps/system/dist/', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
if (!process.env.SKIP_BUILD) execSync('npm run build -w @hemlo/system', { stdio: 'ignore', env: { ...process.env, VITE_API_URL: API, VITE_ACCOUNT_URL: ACC } });
const { db } = await createPgliteDb();
const { app } = createApp({ db, env: { AUTH_SECRET: 'demo-test-secret-demo-test-secret-00000', API_URL: API, ACCOUNT_URL: ACC, TRUSTED_ORIGINS: `${ACC},${SYS},${API}`, PASSKEY_RP_ID: 'localhost' } as any });
const api = serve({ fetch: app.fetch, port: 8796 });
const types: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const sys = createServer(async (req, res) => {
  let p = join(root, decodeURIComponent(new URL(req.url!, 'http://x').pathname));
  try { if ((await stat(p)).isDirectory()) p = join(p, 'index.html'); res.writeHead(200, { 'content-type': types[extname(p)] ?? 'application/octet-stream' }); res.end(await readFile(p)); }
  catch { res.writeHead(200, { 'content-type': types['.html'] }); res.end(await readFile(join(root, 'index.html'))); }
}).listen(4337);
await mkdir(SHOTS, { recursive: true });
const errors: string[] = [];
let step = 0; const ok = (m: string) => console.log(`✓ ${++step}. ${m}`);
const end = new Date(Date.now() + 20 * 86400_000).toISOString().slice(0, 10);
const csv = async (name: string, lines: string[]) => { const f = `${SHOTS}/${name}.csv`; await writeFile(f, '﻿' + lines.join('\r\n')); return f; };

const b = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const open = async (demo: string) => {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  await ctx.route('https://hemlohq.com/**', (r) => r.fulfill({ status: 200, body: '' }));
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(`page error: ${e.message}`));
  p.on('response', (r) => { if (r.url().startsWith(API) && r.status() >= 400) errors.push(`${r.status()} ${r.url().replace(API, '')}`); });
  await p.goto(`${SYS}/?demo=${demo}&lang=ar`); await p.waitForSelector('.demo-bar');
  return p;
};
const run = async (p: Page, file: string, shot: string, want: RegExp) => {
  await p.setInputFiles('.sheet input[type=file]', file);
  await p.waitForSelector('.sheet table tbody tr');
  await p.screenshot({ path: `${SHOTS}/${shot}-matched.png` });
  await p.click('.sheet-f .btn-accent');
  await p.waitForSelector('.sheet .change');
  const done = (await p.textContent('.sheet .change'))!;
  await p.screenshot({ path: `${SHOTS}/${shot}-done.png` });
  if (!want.test(done)) throw new Error(`${shot}: ${done}`);
  return done;
};
try {
  // the shop: customers and their old debts
  const shop = await open('1');
  await shop.evaluate(() => { location.hash = '#/customers'; }); await shop.waitForSelector('a[href="#/customers?id=import"]');
  await shop.click('a[href="#/customers?id=import"]');
  const f1 = await csv('customers', ['الاسم,الهاتف,الدين,ملاحظات', 'أبو مصطفى,07709998877,"35,000",يدفع آخر الشهر', 'أم حسين,0780 999 8866,0,', 'بلا هاتف,,12000,']);
  ok(`shop debt book: ${await run(shop, f1, 'customers', /3/)}`);
  await shop.keyboard.press('Escape');
  await shop.waitForSelector('a.row:has-text("أبو مصطفى")');
  ok('the imported customer is in the debt book');

  // the clinic: patients with file numbers
  const clinic = await open('dental');
  await clinic.evaluate(() => { location.hash = '#/patients'; }); await clinic.waitForSelector('button:has-text("Excel")');
  await clinic.click('button:has-text("Excel")');
  const f2 = await csv('patients', ['الاسم,الهاتف,رقم الملف,الجنس,تاريخ الميلاد', 'رسل فاضل,07701110099,500,أنثى,14/03/1995', 'كرم سعد,07701110088,,ذكر,1988-11-02']);
  ok(`clinic patients: ${await run(clinic, f2, 'patients', /2/)}`);

  // the gym: members and the membership they have now
  const gym = await open('gym');
  await gym.evaluate(() => { location.hash = '#/members'; }); await gym.waitForSelector('button:has-text("Excel")');
  await gym.click('button:has-text("Excel")');
  const f3 = await csv('members', ['الاسم,الهاتف,الجنس,الاشتراك,تاريخ الانتهاء,الزيارات المتبقية,الدين', `سجاد ناصر,07501119988,ذكر,شهر واحد,${end},,10000`, `ريم علي,07501119977,أنثى,12 زيارة خلال شهر,${end},5,`]);
  ok(`gym members: ${await run(gym, f3, 'members', /2/)}`);
  await gym.keyboard.press('Escape');
  await gym.fill('.search input', 'سجاد ناصر'); await gym.waitForSelector('.gy-mrow:has-text("سجاد ناصر")');
  await gym.screenshot({ path: `${SHOTS}/members-found.png` });
  ok('the imported member is active with their membership');

  // the plan page (every system has it): plans, monthly or yearly, Enterprise through Studio
  await gym.evaluate(() => { location.hash = '#/plan'; }); await gym.waitForSelector('.plan-card');
  await gym.click('.seg button:nth-child(2)'); await gym.waitForTimeout(300);
  await gym.screenshot({ path: `${SHOTS}/plan-gym-ar.png`, fullPage: true });
  if ((await gym.locator('.plan-card').count()) !== 4) throw new Error('plan cards');
  ok('the plan page: three gym plans and Enterprise, yearly prices');

  if (errors.length) throw new Error(errors.join('\n'));
  console.log('\nAll good.');
} finally { await b.close(); api.close(); sys.close(); }
