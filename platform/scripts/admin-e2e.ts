// Browser test of admin.hemlohq.com + the early-access link, end to end, with screenshots.
// Run: npx tsx scripts/admin-e2e.ts   (builds the account and admin apps against the local API first)
process.env.TZ = 'UTC';
import { createServer } from 'node:http';
import { execSync } from 'node:child_process';
import { readFile, stat, mkdir } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { serve } from '@hono/node-server';
import { chromium, type Page } from 'playwright-core';
import { createPgliteDb } from '@hemlo/db/pglite';
import { outbox } from '@hemlo/notify';
import { newId } from '@hemlo/core';
import { createApp } from '../apps/api/src/app';
import { forgetAllPrincipals } from '../apps/api/src/principal';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const API = 'http://localhost:8797', ACC = 'http://localhost:4331', ADM = 'http://localhost:4332';
const SHOTS = 'scripts/shots/admin';
const root = (app: string) => new URL(`../apps/${app}/dist/`, import.meta.url).pathname.replace(/^\/(\w:)/, '$1');

if (!process.env.SKIP_BUILD) {
  const env = { ...process.env, PUBLIC_API_URL: API, PUBLIC_ACCOUNT_URL: ACC, PUBLIC_RETURN_HOSTS: 'localhost' };
  execSync('npm run build -w @hemlo/account', { stdio: 'ignore', env });
  execSync('npm run build -w @hemlo/admin', { stdio: 'ignore', env });
}

const { db, client } = await createPgliteDb();
const { app } = createApp({ db, env: { AUTH_SECRET: 'admin-test-secret-admin-test-secret-00', API_URL: API, ACCOUNT_URL: ACC, ADMIN_URL: ADM,
  TRUSTED_ORIGINS: `${ACC},${ADM},${API}`, PASSKEY_RP_ID: 'localhost', PHONE_SIGN_IN: '1', DEV_CONSOLE_MESSAGES: '1' } });
const api = serve({ fetch: app.fetch, port: 8797 });
const types: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const serveDir = (dir: string, port: number, spa = false) => createServer(async (req, res) => {
  let p = join(dir, decodeURIComponent(new URL(req.url!, 'http://x').pathname));
  try { if ((await stat(p)).isDirectory()) p = join(p, 'index.html'); res.writeHead(200, { 'content-type': types[extname(p)] ?? 'application/octet-stream' }); res.end(await readFile(p)); }
  catch { if (spa) { res.writeHead(200, { 'content-type': types['.html'] }); res.end(await readFile(join(dir, 'index.html'))); } else { res.writeHead(404); res.end(); } }
}).listen(port);
const acc = serveDir(root('account'), 4331), adm = serveDir(root('admin'), 4332, true);
await mkdir(SHOTS, { recursive: true });

// ---- seed: 30 days of requests and a few accounts ----
const people = [
  ['علي حسين', 'ورشة النور للموبايل', 'phone-repair', 'بغداد'], ['Sara Kareem', 'Sara Phones', 'phone-repair', 'Erbil'], ['مصطفى جاسم', 'مركز الرافدين للتبريد', 'ac-appliances', 'البصرة'],
  ['حيدر عباس', 'كراج الأمانة', 'car-repair', 'النجف'], ['Noor Salim', 'Noor Café', 'cafe-restaurant', 'Sulaymaniyah'], ['زينب محمد', 'صالون زينب', 'clinic-salon', 'بغداد'],
  ['أحمد فاضل', 'سوبرماركت الخير', 'store', 'كربلاء'], ['Omar Taha', 'Omar Motors', 'car-repair', 'Kirkuk'], ['رسل كاظم', 'عيادة الشفاء', 'clinic-salon', 'بابل'],
  ['يوسف علي', 'ورشة يوسف للإلكترونيات', 'phone-repair', 'بغداد'], ['ليث حميد', 'مقهى ليالي', 'cafe-restaurant', 'بغداد'], ['Dana Aziz', 'Dana Fix', 'phone-repair', 'Duhok'],
] as const;
const statuses = ['new', 'new', 'contacted', 'new', 'declined', 'contacted', 'new', 'approved', 'new', 'new', 'contacted', 'new'];
for (const [i, [name, business, kind, city]] of people.entries()) {
  const daysAgo = Math.floor((i * 29) / people.length) + (i % 3);
  await client.query(`insert into early_access (id, created_at, name, phone_number, business, kind, city, locale, status) values ($1, now() - ($2 || ' days')::interval, $3, $4, $5, $6, $7, $8, $9)`,
    [newId(), String(29 - daysAgo), name, `+96477000100${String(i).padStart(2, '0')}`, business, kind, city, /[a-z]/i.test(name) ? 'en' : 'ar', statuses[i]]);
}
for (let i = 0; i < 9; i++) await client.query(`insert into "user" (id, name, email, email_verified, created_at, updated_at) values ($1, $2, $3, true, now() - ($4 || ' days')::interval, now())`,
  [newId(), ['حسن', 'مريم', 'Karim', 'علي', 'Lana', 'سيف', 'هدى', 'Aras', 'رامي'][i], `seed${i}@example.com`, String((i * 7) % 28)]);

// ---- seed: shops using Hemlo Systems (busy, steady, quiet, asleep) and a demo shop that must stay out of the numbers ----
const shopsSeed: [string, string, string, number[]][] = [ // name, kind, city, sales per day (index 0 = today, 1 = yesterday, ...)
  ['سوبرماركت الخير', 'store', 'كربلاء', [38, 41, 35, 30, 33, 29, 31, 26, 22, 24, 18, 15, 12, 9]],
  ['Baghdad Mini Market', 'store', 'Baghdad', [21, 25, 19, 24, 22, 18, 20, 23, 19, 17, 21, 20, 18, 16]],
  ['ماركت الأمل', 'store', 'البصرة', [0, 0, 0, 6, 9, 12, 10, 14, 11, 9, 12, 8, 10, 7]],
  ['Erbil Fresh', 'store', 'Erbil', [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 6, 5, 8]],
  ['عيادة الابتسامة', 'dental', 'النجف', [3, 4, 2, 5]],
];
await client.query("select set_config('app.system', 'on', false)"); // seeding across shops, as the system (row-level security)
for (const [name, kind, city, perDay] of [...shopsSeed, ['ماركت النور', 'store', 'بغداد', [30, 30]] as [string, string, string, number[]]]) {
  const org = newId(), owner = newId(), demo = name === 'ماركت النور';
  await client.query(`insert into "user" (id, name, email, email_verified, phone_number, created_at, updated_at) values ($1, $2, $3, true, $4, now() - interval '40 days', now())`,
    [owner, demo ? 'أبو علي' : name.split(' ')[0] === 'Baghdad' ? 'Mustafa Kareem' : 'حسين ' + city, demo ? `visitor-${org.toLowerCase()}@demo.hemlohq.invalid` : `owner-${org.toLowerCase()}@example.com`, demo ? null : `+96477012${String(Math.floor(Math.random() * 1e5)).padStart(5, '0')}`]);
  await client.query(`insert into organization (id, name, slug, created_at, metadata) values ($1, $2, $3, now() - interval '35 days', $4)`, [org, name, org.toLowerCase(), JSON.stringify({ kind, city, ...(demo ? { demo: true } : {}) })]);
  await client.query(`insert into member (id, organization_id, user_id, role, created_at) values ($1, $2, $3, 'owner', now() - interval '35 days')`, [newId(), org, owner]);
  let n = 0;
  for (const [ago, count] of perDay.entries()) for (let k = 0; k < count; k++) {
    const total = 1000 + Math.floor(Math.random() * 18) * 500;
    await client.query(`insert into sys_sale (id, organization_id, number, created_at, subtotal, total, paid, method) values ($1, $2, $3, now() - ($4 || ' hours')::interval, $5, $5, $5, 'cash')`,
      [newId(), org, ++n, String(ago * 24 + 1 + (k % 9)), total]);
  }
  // a clinic on its 7-day trial, 2 days left
  if (kind === 'dental') await client.query(`insert into hemlo_subscription (organization_id, edition, status, seats, trial_ends_at) values ($1, 'dental', 'trial', 1, now() + interval '2 days')`, [org]);
}
await client.query("select set_config('app.system', 'off', false)");

const code = (to: string) => [...outbox].reverse().find((m) => m.to.toLowerCase() === to.toLowerCase() && m.kind === 'code')!.text.match(/\b(\d{6})\b/)![1];
let step = 0; const ok = (m: string) => console.log(`✓ ${++step}. ${m}`);
const shot = (p: Page, n: string, full = false) => p.screenshot({ path: `${SHOTS}/${n}.png`, fullPage: full });

const browser = await chromium.launch({ executablePath: EDGE, headless: true });
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error('page error:', e.message));
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  await cdp.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } });

  // the founder signs up by email and creates a passkey, then becomes Hemlo staff
  await page.goto(`${ACC}/en/sign-in/`);
  await page.click('#tabs [data-tab="email"]');
  await page.fill('#email', 'adil@hemlohq.com');
  await page.click('#send');
  await page.waitForSelector('#code:not([hidden])');
  await page.fill('#otp', code('adil@hemlohq.com'));
  await page.waitForSelector('#profile:not([hidden])');
  await page.fill('#name', 'Adil Tahseen');
  await page.click('#save-profile');
  await page.waitForSelector('#offer:not([hidden])');
  await page.click('#offer-add');
  await page.waitForURL(`${ACC}/en/`);
  await client.query(`update "user" set role = 'admin' where email = 'adil@hemlohq.com'`); forgetAllPrincipals(); // signed-in people are remembered for 15 s
  ok('founder account with a passkey; made Hemlo staff');

  // the admin gate: an email session is not enough
  await page.goto(`${ADM}/en/`);
  await page.waitForSelector("#gate-actions button");
  await shot(page, '01-passkey-gate');
  await page.click('#gate-actions button');
  await page.waitForSelector('#app:not([hidden]) .kpi');
  await page.waitForTimeout(300);
  await shot(page, '02-overview-en', true);
  ok('passkey gate shown for an email session; the passkey opened the dashboard');

  // requests: list, drawer, contacted, approve → link
  await page.click('[data-nav="requests"]');
  await page.waitForSelector('.tbl tbody tr');
  await shot(page, '03-requests-en');
  await page.click('.tbl tbody tr:has-text("Sara Phones")');
  await page.waitForSelector('#drawer.open');
  await page.waitForTimeout(350);
  await page.fill('#drawer textarea', 'Called on WhatsApp. Two branches, wants a demo Sunday.');
  await page.locator('#drawer textarea').blur();
  await page.click('#drawer .drawer-f .btn-primary');
  await page.waitForSelector('#drawer .link-box');
  await page.waitForTimeout(350);
  await shot(page, '04-request-approved-en');
  const link = await page.textContent('#drawer .link-box code');
  const wa = await page.getAttribute('#drawer .link-box a.btn-wa', 'href');
  if (!link?.includes('/welcome/?t=') || !wa?.startsWith('https://wa.me/964770001')) throw new Error('approve link missing');
  ok('request opened, note saved, approved: private link + WhatsApp button');

  // the person opens the link, signs in, and their business is set up
  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p2 = await ctx2.newPage();
  p2.on('pageerror', (e) => console.error('page error:', e.message));
  await p2.goto(link!);
  await p2.waitForSelector('#w-actions button');
  await shot(p2, '05-welcome-en');
  await p2.click('#w-actions button');
  await p2.waitForURL(/sign-in/);
  await p2.click('#tabs [data-tab="email"]');
  await p2.fill('#email', 'sara@shop.iq');
  await p2.click('#send');
  await p2.waitForSelector('#code:not([hidden])');
  await p2.fill('#otp', code('sara@shop.iq'));
  await p2.waitForURL((u) => u.pathname.includes('/welcome/'));
  await p2.waitForSelector('#w-actions button');
  await p2.click('#w-actions button');
  await p2.waitForURL(/\/business\//);
  await p2.waitForSelector('#members .row');
  const orgName = await p2.textContent('#org-name');
  if (orgName?.trim() !== 'Sara Phones') throw new Error('business not created: ' + orgName);
  await shot(p2, '06-sara-business-en');
  ok('link → sign in → "Sara Phones" created with Sara as owner');

  // back in admin: activated, users, businesses
  await page.keyboard.press('Escape');
  await page.waitForSelector('#drawer:not(.open)');
  await page.click('#refresh');
  await page.waitForTimeout(500);
  await page.goto(`${ADM}/en/#/requests?status=activated`);
  await page.waitForSelector('.tbl tbody tr:has-text("Sara Phones")');
  await page.click('[data-nav="users"]'); await page.waitForSelector('.tbl tbody tr'); await shot(page, '07-users-en');
  await page.click('[data-nav="businesses"]'); await page.waitForSelector('.tbl tbody tr:has-text("Sara Phones")'); await shot(page, '08-businesses-en');
  ok('admin shows Sara as activated, in users and in businesses');

  // usage: every shop's health, the platform against its limits, and one shop's details
  await page.click('[data-nav="usage"]'); await page.waitForSelector('.meters .meter'); await page.waitForSelector('.tbl tbody tr');
  await page.waitForTimeout(400);
  const listed = await page.locator('.tbl tbody tr').allTextContents();
  if (listed.some((r) => r.includes('ماركت النور'))) throw new Error('a demo shop is listed in usage');
  if (!listed[0].includes('سوبرماركت الخير')) throw new Error('busiest active shop should come first: ' + listed[0]);
  if (!listed.some((r) => r.includes('Erbil Fresh') && r.includes('Asleep'))) throw new Error('Erbil Fresh should be asleep');
  await shot(page, '08b-usage-en', true);
  await page.click('.tbl tbody tr:has-text("ماركت الأمل")'); await page.waitForSelector('#drawer.open .nudge'); await page.waitForTimeout(350);
  await shot(page, '08c-usage-shop-en');
  await page.keyboard.press('Escape'); await page.waitForSelector('#drawer:not(.open)');
  // a clinic on trial: extend it from the drawer
  await page.click('.tbl tbody tr:has-text("عيادة الابتسامة")'); await page.waitForSelector('#drawer.open .pill.plan-trial');
  await page.click('#drawer button:has-text("Extend trial 7 days")'); await page.waitForSelector('#drawer.open .sub:has-text("trial until")');
  await page.waitForTimeout(300); await shot(page, '08d-usage-clinic-plan-en');
  const left = await page.textContent('.tbl tbody tr:has-text("عيادة الابتسامة") .pill.plan-trial');
  if (!left?.includes('9 days')) throw new Error('trial not extended: ' + left);
  await page.keyboard.press('Escape'); await page.waitForSelector('#drawer:not(.open)');
  await page.click('.tabs a:has-text("Quiet")'); await page.waitForTimeout(200);
  if ((await page.locator('.tbl tbody tr').count()) < 1) throw new Error('quiet filter');
  ok('usage: shops by health (demo shops left out), plan meters, filters, a shop drawer with a call nudge, and a clinic\'s trial extended');

  // billing: a payment for the clinic from its drawer, then the money page and the price list
  await page.click('.tabs a:has-text("All")'); await page.waitForTimeout(200);
  await page.click('.tbl tbody tr:has-text("عيادة الابتسامة")'); await page.waitForSelector('#drawer.open .pay-box');
  await page.selectOption('#drawer select >> nth=0', { label: 'Clinic · 75,000 IQD' });
  await page.selectOption('#drawer .pay-box select >> nth=1', 'fib');
  await page.fill('#drawer .pay-box input >> nth=1', 'FIB-0042');
  await page.waitForTimeout(150); await shot(page, '08e-usage-clinic-pay-en');
  await page.click('#drawer button:has-text("Record and activate")'); await page.waitForSelector('#drawer.open .pill.plan-active');
  await page.waitForSelector('#drawer.open .pay-list li');
  await shot(page, '08f-usage-clinic-paid-en');
  await page.keyboard.press('Escape'); await page.waitForSelector('#drawer:not(.open)');
  await page.click('[data-nav="billing"]'); await page.waitForSelector('.kpis .kpi');
  const mrr = await page.textContent('.kpis .kpi .value');
  if (!mrr?.includes('75,000')) throw new Error('mrr: ' + mrr);
  await page.waitForSelector('.tbl tbody tr:has-text("Standard")'); await page.waitForTimeout(250); await shot(page, '08g-billing-en', true);
  await page.click('.tbl tbody tr:has-text("Standard")'); await page.waitForSelector('#drawer.open input[type=number]');
  await page.fill('#drawer label:has-text("Monthly") input', '47000');
  await shot(page, '08h-billing-plan-en');
  await page.click('#drawer .drawer-f button'); await page.waitForSelector('#drawer:not(.open)');
  await page.waitForSelector('.tbl tbody tr:has-text("47,000")');
  ok('billing: a payment recorded from the clinic drawer (Clinic plan, FIB), the money page (MRR 75,000), and a price changed in the list');

  // Arabic, dark mode, and phone
  const ctx3 = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark', reducedMotion: 'reduce', storageState: await ctx.storageState() });
  const p3 = await ctx3.newPage();
  await p3.goto(`${ADM}/#/overview`); await p3.waitForSelector('#app:not([hidden]) .kpi'); await p3.waitForTimeout(300);
  await shot(p3, '09-overview-ar-dark', true);
  await p3.goto(`${ADM}/#/requests`); await p3.waitForSelector('.tbl tbody tr');
  await p3.click('.tbl tbody tr:has-text("علي حسين")'); await p3.waitForSelector('#drawer.open'); await p3.waitForTimeout(350);
  await shot(p3, '10-request-ar-dark');
  await p3.goto(ADM + '/#/team'); await p3.waitForSelector('.matrix'); await p3.waitForTimeout(300); await shot(p3, '10b-team-ar-dark');
  await p3.goto(ADM + '/#/usage'); await p3.waitForSelector('.meters .meter'); await p3.waitForTimeout(400); await shot(p3, '10c-usage-ar-dark', true);
  const ctx4 = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, reducedMotion: 'reduce', storageState: await ctx.storageState() });
  const p4 = await ctx4.newPage();
  await p4.goto(`${ADM}/#/overview`); await p4.waitForSelector('#app:not([hidden]) .kpi'); await p4.waitForTimeout(300);
  await shot(p4, '11-overview-ar-mobile', true);
  await p4.click('#menu-btn'); await p4.waitForTimeout(350); await shot(p4, '12-menu-ar-mobile');
  await p4.goto(`${ADM}/#/usage`); await p4.waitForSelector('.meters .meter'); await p4.waitForTimeout(400); await shot(p4, '12b-usage-ar-mobile', true);
  ok('Arabic, dark mode and phone layouts rendered');

  // the team: invite Noor as an analyst, she joins, creates a passkey, sees only what analysts see
  await page.goto(ADM + "/en/#/team");
  await page.waitForSelector('.matrix');
  await page.waitForTimeout(300);
  await shot(page, '13-team-en', true);
  await page.click('a[href="#/team?id=invite"]');
  await page.waitForSelector('#drawer.open .role-cards');
  await page.fill('#drawer input[type=email]', 'noor@hemlohq.com');
  await page.locator('#drawer .field input').nth(1).fill('Noor');
  await page.locator('#drawer .field input').nth(2).fill('Data, Baghdad');
  await page.click('#drawer .role-card:has-text("Analyst")');
  await page.click('#drawer .chip:has-text("30 days")');
  await page.waitForTimeout(350);
  await shot(page, '14-invite-en');
  await page.click('#drawer .drawer-f button[type=submit]');
  await page.waitForSelector('#drawer .link-box code');
  const invite = (await page.textContent('#drawer .link-box code'))!;
  if (!invite.includes('#/join?t=')) throw new Error('invite link missing: ' + invite);
  await shot(page, '15-invite-sent-en');

  const ctx5 = await browser.newContext({ viewport: { width: 1280, height: 860 }, reducedMotion: 'reduce' });
  const p5 = await ctx5.newPage();
  p5.on('pageerror', (e) => console.error('page error (noor):', e.message));
  const cdp5 = await ctx5.newCDPSession(p5);
  await cdp5.send('WebAuthn.enable');
  await cdp5.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } });
  await p5.goto(invite);
  await p5.waitForSelector('#gate-actions a.btn-primary');
  await shot(p5, '16-join-signed-out');
  await p5.click('#gate-actions a.btn-primary');
  await p5.waitForURL(/sign-in/);
  await p5.click('#tabs [data-tab="email"]');
  await p5.fill('#email', 'noor@hemlohq.com');
  await p5.click('#send');
  await p5.waitForSelector('#code:not([hidden])');
  await p5.fill('#otp', code('noor@hemlohq.com'));
  await p5.waitForSelector('#profile:not([hidden])');
  await p5.fill('#name', 'Noor Salim');
  await p5.click('#save-profile');
  await p5.waitForSelector('#offer:not([hidden])');
  await p5.click('#offer-skip');
  await p5.waitForURL((u) => u.href.startsWith(ADM));
  await p5.waitForSelector('#gate-actions button.btn-primary');
  await shot(p5, '17-join-accept');
  await p5.click('#gate-actions button.btn-primary');
  await p5.waitForSelector('#gate-title:has-text("Create your passkey")');
  await shot(p5, '18-create-passkey');
  await p5.click('#gate-actions button.btn-primary');
  await p5.waitForSelector('#app:not([hidden]) .kpi');
  const nav = await p5.$$eval('[data-nav]', (els) => els.filter((e) => !(e as HTMLElement).hidden).map((e) => e.getAttribute('data-nav')));
  if (nav.join() !== 'overview,requests,users,businesses,usage,billing') throw new Error('analyst nav: ' + nav.join());
  await p5.waitForTimeout(300);
  await shot(p5, '19-analyst-overview');
  await p5.click('[data-nav="requests"]');
  await p5.click('.tbl tbody tr:has-text("Dana Fix")');
  await p5.waitForSelector('#drawer.open .masked-note');
  if (await p5.$('#drawer .drawer-f button')) throw new Error('analyst sees request actions');
  await p5.waitForTimeout(350);
  await shot(p5, '20-analyst-request-masked');
  ok('Noor invited as analyst → signed in → joined → created a passkey → sees 5 pages, masked contacts, no actions');

  await page.goto(ADM + "/en/#/team"); await page.reload();
  await page.waitForSelector('.tbl tbody tr:has-text("Noor Salim")');
  await page.click('.tbl tbody tr:has-text("Noor Salim")');
  await page.waitForSelector('#drawer.open .perm-list');
  await page.waitForTimeout(350);
  await shot(page, '21-member-en');
  await page.click('#drawer .drawer-f .btn-secondary'); // pause
  await page.waitForSelector('.tbl tbody tr:has-text("Paused")');
  await p5.reload();
  await p5.waitForSelector('#gate-title:has-text("paused")');
  await page.keyboard.press('Escape');
  await page.click('[data-nav="activity"]');
  await page.waitForSelector('.feed li');
  await page.waitForTimeout(300);
  await shot(page, '22-activity-en', true);
  ok('founder paused Noor (her dashboard closed at once); activity log shows who did what');
} finally {
  await browser.close(); api.close(); acc.close(); adm.close();
}
console.log('\nAll admin flows passed.');
process.exit(0);
