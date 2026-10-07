// Browser test of Hemlo AI, phase 1, with the REAL free engine (Cloudflare Workers AI, reached through your wrangler
// login): in the demo shop, read the sample invoice and a real photo into a purchase, save it, then ask the shop questions.
// Run: npx tsx scripts/ai-e2e.ts   (SKIP_BUILD=1 to reuse the last build)
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
import { workersAi } from '../apps/api/src/ai/engine';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const API = 'http://localhost:8796', ACC = 'http://localhost:4330', SYS = 'http://localhost:4336';
const SHOTS = 'scripts/shots/ai';
const ACCOUNT = '7438b8edfc81f18f2d61025d5e000f92';
const root = (app: string) => new URL(`../apps/${app}/dist/`, import.meta.url).pathname.replace(/^\/(\w:)/, '$1');

if (!process.env.SKIP_BUILD) execSync('npm run build -w @hemlo/system', { stdio: 'ignore', env: { ...process.env, VITE_API_URL: API, VITE_ACCOUNT_URL: ACC } });

// the Workers AI binding, over Cloudflare's REST API with the wrangler login (the token is never printed)
const token = JSON.parse(execSync('npx wrangler auth token --json', { cwd: 'apps/api', stdio: ['ignore', 'pipe', 'ignore'] }).toString()).token;
const binding = { async run(model: string, input: Record<string, unknown>) {
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/ai/run/${model}`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(input) });
  const j: any = await r.json(); if (!j.success) throw new Error(JSON.stringify(j.errors)); return j.result;
} };

const { db } = await createPgliteDb();
const { app } = createApp({ db, files: memoryStore(), ai: workersAi(binding), env: { AUTH_SECRET: 'ai-test-secret-ai-test-secret-000000000', API_URL: API, ACCOUNT_URL: ACC,
  TRUSTED_ORIGINS: `${ACC},${SYS},${API}`, PASSKEY_RP_ID: 'localhost', DEV_CONSOLE_MESSAGES: '1' } as any });
const api = serve({ fetch: app.fetch, port: 8796 });
const types: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.webmanifest': 'application/manifest+json' };
const sys = createServer(async (req, res) => {
  let p = join(root('system'), decodeURIComponent(new URL(req.url!, 'http://x').pathname));
  try { if ((await stat(p)).isDirectory()) p = join(p, 'index.html'); res.writeHead(200, { 'content-type': types[extname(p)] ?? 'application/octet-stream' }); res.end(await readFile(p)); }
  catch { res.writeHead(200, { 'content-type': types['.html'] }); res.end(await readFile(join(root('system'), 'index.html'))); }
}).listen(4336);
await mkdir(SHOTS, { recursive: true });

let step = 0; const ok = (m: string) => console.log(`✓ ${++step}. ${m}`);
const shot = (p: Page, n: string, full = false) => p.screenshot({ path: `${SHOTS}/${n}.png`, fullPage: full });
const errors: string[] = [];
const browser = await chromium.launch({ executablePath: EDGE, headless: true });
try {
  for (const lang of ['en', 'ar'] as const) {
    const ctx = await browser.newContext({ viewport: lang === 'en' ? { width: 1440, height: 900 } : { width: 390, height: 844 }, ...(lang === 'ar' ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}), reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('response', (r) => { if (r.url().startsWith(API) && r.status() >= 400) errors.push(`${r.status()} ${r.url().replace(API, '')}`); });
    await page.goto(`${SYS}/?demo=1&lang=${lang}`);
    await page.waitForSelector('.kpi.hero .v');

    // 1. the sample invoice: instant, free, the lines fill in
    await page.goto(`${SYS}/#/purchases?invoice=new`);
    await page.waitForSelector('.ai-scan');
    await shot(page, `01-scan-panel-${lang}`);
    await page.click(`.ai-scan button:has-text("${lang === 'en' ? 'Try a sample invoice' : 'جرّب بفاتورة نموذجية'}")`);
    await page.waitForSelector('.ai-done', { timeout: 15_000 });
    const sampleLines = await page.locator('.ai-tag').count();
    if (sampleLines !== 4) throw new Error(`sample lines ${sampleLines}`);
    await shot(page, `02-sample-filled-${lang}`, true);
    ok(`${lang}: the sample invoice filled 4 lines, with the supplier and the amount paid`);

    if (lang === 'en') {
      // 2. a real photo, read by the real free model
      await page.goto(`${SYS}/#/purchases`); await page.goto(`${SYS}/#/purchases?invoice=new`);
      await page.waitForSelector('.ai-scan');
      const t0 = Date.now();
      await page.setInputFiles('.ai-scan input[type=file]', 'scripts/ai-samples/invoice-photo.jpg');
      await page.waitForSelector('.ai-reading', { timeout: 10_000 }); await shot(page, '03-reading-en');
      await page.waitForSelector('.ai-done, .ai-err', { timeout: 60_000 });
      if (await page.locator('.ai-err').count()) throw new Error('scan failed: ' + await page.locator('.ai-err').textContent());
      const lines = await page.locator('.ai-tag').count();
      await shot(page, '04-photo-filled-en', true);
      ok(`en: a real photo read by the free model in ${((Date.now() - t0) / 1000).toFixed(1)} s: ${lines} lines matched to products`);
      // 3. save it: stock goes up, the supplier owes appear
      const before = Number((await (await page.request.get(`${API}/v1/sys/products`, { headers: { authorization: `Bearer ${await page.evaluate(() => JSON.parse(localStorage.getItem('hemlo.demo')!).token)}` } })).json()).products.find((p: any) => p.name === 'Pepsi 330ml').stock);
      const sup = page.locator('select').first();
      if (!(await sup.inputValue())) await sup.selectOption({ index: 1 });
      await page.click('.sheet .btn-accent:has-text("Save")');
      await page.waitForTimeout(1200);
      const after = Number((await (await page.request.get(`${API}/v1/sys/products`, { headers: { authorization: `Bearer ${await page.evaluate(() => JSON.parse(localStorage.getItem('hemlo.demo')!).token)}` } })).json()).products.find((p: any) => p.name === 'Pepsi 330ml').stock);
      if (after - before !== 72) throw new Error(`Pepsi stock +${after - before}, expected +72 (3 cartons of 24)`);
      ok('en: saved: Pepsi stock went up by 3 cartons (72 cans)');
    }

    // 4. ask the shop: a ready question (free), then the model routes a question in the shop's own words
    await page.goto(`${SYS}/#/home`);
    await page.waitForSelector('.ai-ask');
    await page.click('.ai-presets .chip >> nth=0');
    await page.waitForSelector('.ai-answer > p');
    await shot(page, `05-ask-preset-${lang}`);
    await page.fill('.ai-q input', lang === 'en' ? 'who owes me the most money?' : 'منو أكثر واحد عليه دين؟');
    await page.click('.ai-q button');
    await page.waitForSelector('.ai-answer .ai-list, .ai-answer > p:not(.sub)', { timeout: 60_000 });
    const said = (await page.textContent('.ai-answer'))!;
    if (!/owe|عليهم|دين/.test(said)) throw new Error('ask: ' + said);
    await shot(page, `06-ask-free-${lang}`);
    ok(`${lang}: "ask your shop" answered a preset and a question in the shop's own words: ${said.slice(0, 70)}…`);
    await ctx.close();
  }
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no errors');
} finally { await browser.close(); api.close(); sys.close(); }
