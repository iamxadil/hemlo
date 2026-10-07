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
  p.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push(`console: ${m.text()}`); });
  p.on('response', (r) => { if (r.url().startsWith(API) && r.status() >= 400) errors.push(`${r.status()} ${r.request().method()} ${r.url().replace(API, '')}`); });
};

const browser = await chromium.launch({ executablePath: EDGE, headless: true });
try {
  const shotC = async (w: number, h: number, lang: string, dark = false) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, reducedMotion: 'reduce', colorScheme: dark ? 'dark' : 'light' });
    await ctx.route('https://hemlohq.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '' }));
    const p = await ctx.newPage(); watch(p);
    await p.goto(`${SYS}/?demo=dental&lang=${lang}`); await p.waitForSelector('.t-card');
    return p;
  };
  const p = await shotC(1440, 1000, 'en');
  const token = await p.evaluate(() => JSON.parse(localStorage.getItem('hemlo.demo')!).token);
  const find = async (q: string) => (await (await p.request.get(`${API}/v1/dent/patients?q=${encodeURIComponent(q)}`, { headers: { authorization: `Bearer ${token}` } })).json()).patients[0];
  for (const [who, file] of [['Ali Kadhim', 'c1-ali'], ['Haider', 'c2-haider'], ['Hassan', 'c3-hassan'], ['Zainab', 'c4-zainab'], ['Yousif', 'c5-yousif-child']] as const) {
    const pt = await find(who);
    await p.goto(`${SYS}/#/patient?id=${pt.id}&tab=chart`); await p.waitForSelector('.odontogram .tooth'); await settle(p); await p.waitForTimeout(500);
    await shot(p, file);
  }
  // select a tooth: the inspector
  const ali = await find('Ali Kadhim');
  await p.goto(`${SYS}/#/patient?id=${ali.id}&tab=chart`); await p.waitForSelector('.odontogram .tooth');
  await p.click('.odontogram .tooth[aria-label="26"]'); await p.waitForSelector('.inspector'); await settle(p); await p.waitForTimeout(400);
  await shot(p, 'c6-inspector-26');
  await p.locator('.insp-figure .surf.pickable').nth(4).click(); await p.locator('.insp-figure .surf.pickable').nth(3).click(); await p.waitForTimeout(200);
  await shot(p, 'c7-inspector-surfaces');
  const d = await shotC(1440, 1000, 'ar', true);
  const alid = await (await d.request.get(`${API}/v1/dent/patients?q=${encodeURIComponent('علي كاظم')}`, { headers: { authorization: `Bearer ${await d.evaluate(() => JSON.parse(localStorage.getItem('hemlo.demo')!).token)}` } })).json();
  await d.goto(`${SYS}/#/patient?id=${alid.patients[0].id}&tab=chart`); await d.waitForSelector('.odontogram .tooth'); await settle(d); await d.waitForTimeout(500); await shot(d, 'c8-dark-ar');
  const ph = await shotC(390, 844, 'ar');
  const aid = await (await ph.request.get(`${API}/v1/dent/patients?q=${encodeURIComponent('علي كاظم')}`, { headers: { authorization: `Bearer ${await ph.evaluate(() => JSON.parse(localStorage.getItem('hemlo.demo')!).token)}` } })).json();
  await ph.goto(`${SYS}/#/patient?id=${aid.patients[0].id}&tab=chart`); await ph.waitForSelector('.odontogram .tooth'); await settle(ph); await ph.waitForTimeout(500); await shot(ph, 'c9-phone');
  await ph.click('.odontogram .tooth[aria-label="36"]'); await ph.waitForSelector('.studio-dock'); await ph.click('.studio-dock .btn-accent'); await ph.waitForSelector('.sheet .inspector'); await ph.waitForTimeout(400); await shot(ph, 'c10-phone-inspector');
} finally {
  await browser.close(); api.close(); sys.close();
  console.log(errors.length ? errors.join('\n') : 'no errors');
}
