// Screenshots of the real gym system for hemlohq.com/systems/gym: the demo gym on a local copy of the API (desk with a
// member just let in, the member's file, reports, a phone, the door screen greeting someone), in English and Arabic.
// Run: npx tsx scripts/marketing-gym-shots.ts → scripts/shots/marketing-gym/*.png (website/scripts/gym-images.mjs makes the webp)
process.env.TZ = 'UTC';
import { createServer } from 'node:http';
import { execSync } from 'node:child_process';
import { readFile, stat, mkdir } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { serve } from '@hono/node-server';
import { chromium, type Page } from 'playwright-core';
import { createPgliteDb } from '@hemlo/db/pglite';
import { createApp } from '../apps/api/src/app';

const API = 'http://localhost:8799', ACC = 'http://localhost:4332', SYS = 'http://localhost:4336', OUT = 'scripts/shots/marketing-gym';
const root = new URL('../apps/system/dist/', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
if (!process.env.SKIP_BUILD) execSync('npm run build -w @hemlo/system', { stdio: 'ignore', env: { ...process.env, VITE_API_URL: API, VITE_ACCOUNT_URL: ACC } });
const { db } = await createPgliteDb();
const { app } = createApp({ db, env: { AUTH_SECRET: 'demo-test-secret-demo-test-secret-00000', API_URL: API, ACCOUNT_URL: ACC, TRUSTED_ORIGINS: `${ACC},${SYS},${API}`, PASSKEY_RP_ID: 'localhost' } as any });
const api = serve({ fetch: app.fetch, port: 8799 });
const types: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png' };
const sys = createServer(async (req, res) => {
  let p = join(root, decodeURIComponent(new URL(req.url!, 'http://x').pathname));
  try { if ((await stat(p)).isDirectory()) p = join(p, 'index.html'); res.writeHead(200, { 'content-type': types[extname(p)] ?? 'application/octet-stream' }); res.end(await readFile(p)); }
  catch { res.writeHead(200, { 'content-type': types['.html'] }); res.end(await readFile(join(root, 'index.html'))); }
}).listen(4336);
await mkdir(OUT, { recursive: true });

const b = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const clean = (p: Page) => p.addStyleTag({ content: '.demo-bar, .plan-bar { display: none !important; } .toast { display: none !important; }' });
const go = async (p: Page, hash: string, ms = 1800) => { await p.evaluate((h) => { location.hash = h; }, hash); await p.waitForTimeout(ms); };
try {
  for (const lang of ['en', 'ar'] as const) {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, colorScheme: 'light', reducedMotion: 'reduce' });
    await ctx.route('https://hemlohq.com/**', (r) => r.fulfill({ status: 200, body: '' }));
    const p = await ctx.newPage();
    await p.goto(`${SYS}/?demo=gym&lang=${lang}`);
    await p.waitForSelector('.gy-scan-in'); await clean(p); await p.waitForTimeout(1500);
    const demo = await p.evaluate(() => localStorage.getItem('hemlo.demo')!);
    const token = JSON.parse(demo).token;
    const members = await p.evaluate(async ([API, t]) => (await (await fetch(`${API}/v1/gym/members?status=all`, { headers: { authorization: `Bearer ${t}` } })).json()).members, [API, token] as const);
    const fresh = members.filter((m: any) => m.state === 'active' && (!m.lastVisitAt || Date.now() - +new Date(m.lastVisitAt) > 4 * 3600_000));
    const who = fresh.find((m: any) => /Zainab|زينب/.test(m.name)) ?? fresh[0];
    // the desk: a member just checked in
    await p.fill('.gy-scan-in', who.name); await p.waitForSelector('.gy-scan-hit'); await p.keyboard.press('Enter');
    await p.waitForSelector('.gy-pass'); await p.mouse.move(5, 5); await p.waitForTimeout(1200);
    await p.screenshot({ path: `${OUT}/desk-${lang}.png` });
    // the member's file, and their progress
    const ali = members.find((m: any) => /Ali Hussein|علي حسين/.test(m.name));
    await go(p, `#/member?id=${ali.id}`, 2200); await p.screenshot({ path: `${OUT}/member-${lang}.png` });
    await p.click('.sseg button:nth-child(4)'); await p.waitForTimeout(1500); await p.screenshot({ path: `${OUT}/progress-${lang}.png` });
    await go(p, '#/renewals', 2000); await p.screenshot({ path: `${OUT}/renewals-${lang}.png` });
    await go(p, '#/classes', 2000); await p.screenshot({ path: `${OUT}/classes-${lang}.png` });
    await go(p, '#/reports', 2600); await p.evaluate(() => document.querySelector('.gy-heat')?.scrollIntoView({ block: 'center' })); await p.waitForTimeout(600);
    await p.screenshot({ path: `${OUT}/reports-${lang}.png` });
    // the door screen, greeting someone the desk just let in
    const door = await ctx.newPage();
    await door.goto(`${SYS}/#/door?l=${lang}`); await door.waitForSelector('.door-now b'); await door.click('.door-start'); await door.waitForTimeout(1500);
    await door.screenshot({ path: `${OUT}/door-${lang}.png` });
    await go(p, '#/desk', 1500);
    const next = fresh.find((m: any) => m.id !== who.id && m.gender === 'f') ?? fresh.find((m: any) => m.id !== who.id);
    await p.fill('.gy-scan-in', next.name); await p.waitForSelector('.gy-scan-hit'); await p.keyboard.press('Enter'); await p.waitForSelector('.gy-pass');
    await door.waitForSelector('.door-hi', { timeout: 30_000 }); await door.waitForTimeout(900);
    await door.screenshot({ path: `${OUT}/door-hi-${lang}.png` });
    // a phone
    const phone = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, colorScheme: 'light', reducedMotion: 'reduce' });
    await phone.addInitScript(([d, l]) => { localStorage.setItem('hemlo.demo', d); localStorage.setItem('hemlo.lang', l); }, [demo, lang] as const);
    const ph = await phone.newPage();
    await ph.goto(`${SYS}/?lang=${lang}#/member?id=${ali.id}`); await ph.waitForSelector('.gy-hero'); await clean(ph); await ph.waitForTimeout(1800);
    await ph.screenshot({ path: `${OUT}/phone-member-${lang}.png` });
    await ph.goto(`${SYS}/?lang=${lang}#/desk`); await ph.waitForSelector('.gy-scan-in'); await clean(ph); await ph.waitForTimeout(1600);
    await ph.screenshot({ path: `${OUT}/phone-desk-${lang}.png` });
    await phone.close(); await ctx.close();
    console.log(lang, 'done');
  }
} finally { await b.close(); api.close(); sys.close(); }
