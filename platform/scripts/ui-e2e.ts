// Browser test of the account screens: real Edge (headless), the real API on an in-memory Postgres,
// and a virtual authenticator standing in for a fingerprint. Run: npx tsx scripts/ui-e2e.ts
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
const DIST = new URL('../apps/account/dist/', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
const SHOTS = process.env.SHOTS ?? 'scripts/shots';
const types: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.ico': 'image/x-icon' };

// Build the screens against the LOCAL API (the normal build points at api.hemlohq.com).
if (!process.env.SKIP_BUILD) execSync('npm run build -w @hemlo/account', { stdio: 'ignore', env: { ...process.env, PUBLIC_API_URL: 'http://localhost:8797', PUBLIC_RETURN_HOSTS: 'localhost' } });

const { db } = await createPgliteDb();
const { app } = createApp({ db, env: { AUTH_SECRET: 'ui-test-secret-ui-test-secret-000000', API_URL: 'http://localhost:8797', ACCOUNT_URL: 'http://localhost:4331',
  TRUSTED_ORIGINS: 'http://localhost:4331,http://localhost:8797', PASSKEY_RP_ID: 'localhost', PHONE_SIGN_IN: '1', DEV_CONSOLE_MESSAGES: '1', BUSINESS_CREATION: 'open' } });
const api = serve({ fetch: app.fetch, port: 8797 });
const web = createServer(async (req, res) => {
  let p = join(DIST, decodeURIComponent(new URL(req.url!, 'http://x').pathname));
  try { if ((await stat(p)).isDirectory()) p = join(p, 'index.html'); res.writeHead(200, { 'content-type': types[extname(p)] ?? 'application/octet-stream' }); res.end(await readFile(p)); }
  catch { res.writeHead(404); res.end('404'); }
}).listen(4331);
await mkdir(SHOTS, { recursive: true });

const code = (to: string) => [...outbox].reverse().find((m) => m.to.toLowerCase() === to.toLowerCase() && m.kind === 'code')!.text.match(/\b(\d{6})\b/)![1];
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
let step = 0;
const ok = (msg: string) => console.log(`✓ ${++step}. ${msg}`);
const shot = (p: Page, name: string) => p.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true, timeout: 8000 }).catch(() => {});

const browser = await chromium.launch({ executablePath: EDGE, headless: true });
try {
  // ---------- the owner, on a phone-sized screen, in Arabic ----------
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ar-IQ' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error('page error:', e.message));
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  await cdp.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } });

  await page.goto('http://localhost:4331/sign-in/');
  await page.waitForSelector('#start-form');
  await shot(page, '01-sign-in-ar');
  await page.fill('#phone', '٠٧٧٠ ١٢٣ ٤٥٦٧'); // Arabic-Indic digits, as people type them
  await page.click('#send');
  await page.waitForSelector('#code:not([hidden])');
  await shot(page, '02-code-ar');
  await page.fill('#otp', code('+9647701234567'));
  await page.waitForSelector('#profile:not([hidden])');
  ok('phone sign-in with Arabic digits reached the name step');
  await page.fill('#name', 'أحمد');
  await page.click('#save-profile');
  await page.waitForSelector('#offer:not([hidden])');
  await shot(page, '03-passkey-offer-ar');
  await page.click('#offer-add');
  await page.waitForURL('http://localhost:4331/');
  await page.waitForSelector('#hello:not(:has(.skeleton))');
  ok('passkey created with the virtual fingerprint; landed on the account page');

  await page.fill('#org-name', 'ورشة الرافدين');
  await page.click('#org-create');
  await page.waitForSelector('#orgs .badge.ok');
  await page.fill('#pin', '4827');
  await page.click('#pin-save');
  await page.waitForFunction(() => document.querySelector('#pin-state')?.textContent);
  await shot(page, '04-account-ar');
  ok('business created, counter PIN set');

  await page.goto('http://localhost:4331/business/');
  await page.waitForSelector('#members .row');
  await page.fill('#i-contact', '0781 555 0199');
  await page.fill('#i-name', 'نور');
  await page.click('#i-send');
  await page.waitForSelector('#invite-result:not([hidden])');
  const waHref = await page.getAttribute('#invite-result a', 'href');
  if (!waHref?.startsWith('https://wa.me/9647815550199?text=')) throw new Error('WhatsApp share link missing: ' + waHref);
  await shot(page, '05-business-ar');
  ok('phone invitation created with a WhatsApp share link');
  const inviteUrl = decodeURIComponent(waHref).match(/https?:\/\/\S+invite\/\?t=\S+/)![0];

  // ---------- sign out, then sign in again with only the passkey ----------
  await page.goto('http://localhost:4331/');
  await page.waitForSelector('#sign-out');
  await page.click('#sign-out');
  await page.waitForURL(/sign-in/);
  // the browser may offer the passkey by itself (autofill); otherwise press the button
  await page.click('#passkey-btn', { timeout: 3000 }).catch(() => {});
  await page.waitForURL('http://localhost:4331/');
  ok('signed back in with the passkey alone (no code)');

  // ---------- the invited person, English, on their own phone ----------
  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p2 = await ctx2.newPage();
  p2.on('pageerror', (e) => console.error('page error:', e.message));
  console.log('invite url:', inviteUrl);
  await p2.goto(inviteUrl.replace('/invite/', '/en/invite/'));
  await p2.waitForSelector('#actions button', { timeout: 8000 }).catch(async (e) => { await shot(p2, 'debug-invite'); console.log('problem text:', await p2.textContent('#problem'), '| body:', await p2.textContent('#body')); throw e; });
  await shot(p2, '06-invite-en');
  await p2.click('#actions button');
  await p2.waitForURL(/sign-in/);
  await p2.click('#tabs [data-tab="phone"]');
  await p2.fill('#phone', '0781 555 0199');
  await p2.click('#send');
  await p2.waitForSelector('#code:not([hidden])');
  await p2.fill('#otp', code('+9647815550199'));
  await p2.waitForURL((u) => u.pathname.includes('/invite/'));
  await p2.waitForSelector('#actions button');
  await p2.click('#actions button');
  await p2.waitForURL('http://localhost:4331/en/');
  await p2.waitForSelector('#orgs .row');
  const role = await p2.textContent('#orgs .row');
  if (!/Cashier/.test(role ?? '')) throw new Error('expected cashier membership, got ' + role);
  await p2.fill('#pin', '9031');
  await p2.click('#pin-save');
  await p2.waitForFunction(() => document.querySelector('#pin-state')?.textContent);
  await shot(p2, '07-staff-account-en');
  ok('invited person signed in by phone, accepted, got the cashier role, set a PIN; name came from the invitation');

  // ---------- counter mode on the owner's (now shared) device ----------
  await page.goto('http://localhost:4331/business/');
  await page.waitForSelector('#device-form');
  await page.fill('#device-name', 'الكاونتر الأمامي');
  await page.click('#device-add');
  await page.waitForURL(/counter/);
  // trusting the device signed the owner out of it; the counter screen opens by itself
  await page.waitForSelector('#staff button');
  await shot(page, '08-counter-pick-ar');
  const names = await page.$$eval('#staff button p', (els) => els.map((e) => e.textContent));
  if (!names.includes('نور')) throw new Error('staff list: ' + names.join(','));
  await page.click('#staff button:has-text("نور")');
  for (const d of '9031') await page.click(`#pad button:text-is("${d}")`);
  await page.click('#pad button:text-is("✓")');
  await page.waitForSelector('#working:not([hidden])');
  await shot(page, '09-counter-working-ar');
  ok('shared counter: picked Noor, PIN pad unlocked her session');

  // ---------- desktop screenshots ----------
  const ctx3 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const p3 = await ctx3.newPage();
  for (const [path, name] of [['/sign-in/', '10-sign-in-ar-desktop'], ['/en/sign-up/', '11-sign-up-en-desktop'], ['/sign-up/', '12-sign-up-ar-desktop']]) {
    await p3.goto('http://localhost:4331' + path);
    await p3.waitForSelector('#start-form');
    await wait(400);
    await p3.screenshot({ path: SHOTS + '/' + name + '.png', timeout: 8000 }).catch(() => {}); // the local server can leave a web font pending
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://localhost:4331/sign-up/');
  await page.waitForSelector('#start-form');
  await shot(page, '13-sign-up-ar-mobile');
  ok('screens rendered; screenshots in ' + SHOTS);
} finally {
  await browser.close();
  api.close(); web.close();
}
console.log('\nAll UI flows passed.');
process.exit(0);
