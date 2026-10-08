// Live check of the register reader: open the demo gym on system.hemlohq.com, draw the sample page (as the demo does),
// then send that picture to the real AI as an ordinary photo, and compare what it read with what is on the page.
// Also checks "what Hemlo brought back". Run: node scripts/register-live.ts
import { chromium } from 'playwright-core';
const SYS = 'https://system.hemlohq.com', API = 'https://api.hemlohq.com';
const b = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
const c = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await c.newPage();
const errors: string[] = [];
p.on('pageerror', (e) => errors.push(e.message));
await p.goto(`${SYS}/?demo=gym&lang=ar`, { waitUntil: 'networkidle' });
await p.waitForSelector('.gy-desk, .gy-scan', { timeout: 90000 });
const token = await p.evaluate(() => JSON.parse(localStorage.getItem('hemlo.demo')!).token);
const H = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
const impact = await (await fetch(`${API}/v1/sys/impact`, { headers: H })).json();
console.log('impact:', JSON.stringify({ total: impact.total, renewals: impact.renewals, payments: impact.payments, price: impact.price }));
// the sample page, drawn by the app
await p.evaluate(() => { location.hash = '#/members'; }); await p.waitForTimeout(1500);
await p.locator('button', { hasText: 'صوّر سجلّ المشتركين' }).first().click(); await p.waitForTimeout(600);
await p.locator('button', { hasText: 'جرّب صفحة نموذجية' }).click();
await p.waitForSelector('.gy-reg-shot img', { timeout: 30000 });
const image = await p.locator('.gy-reg-shot img').getAttribute('src');
const truth = await (await fetch(`${API}/v1/sys/ai/members`, { method: 'POST', headers: H, body: JSON.stringify({ sample: true }) })).json();
console.log('page as written:', truth.page.map((x: any) => `${x.name} | ${x.phone} | ${x.plan} | ${x.from} | ${x.owes}`).join('\n  '));
// the same picture, read by the real model
const t0 = Date.now();
const res = await fetch(`${API}/v1/sys/ai/members`, { method: 'POST', headers: H, body: JSON.stringify({ image }) });
const read = await res.json();
console.log(`real read: HTTP ${res.status} in ${((Date.now() - t0) / 1000).toFixed(1)}s, engine ${read.engine ?? read.error ?? read.code}`);
for (const r of read.rows ?? []) console.log(`  ${r.name} | ${r.phone} | ${r.plan} | ends ${r.endsOn} | owes ${r.balance} | check ${r.check.join(',')}`);
// score: names and phones found
const names = new Set((read.rows ?? []).map((r: any) => r.name.replace(/\s+/g, ' ').trim()));
const phones = new Set((read.rows ?? []).map((r: any) => r.phone));
const digits = (s: string) => s.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/\D/g, '');
console.log(`names right: ${truth.page.filter((x: any) => names.has(x.name)).length}/${truth.page.length}, phones right: ${truth.page.filter((x: any) => phones.has(digits(x.phone).replace(/^7/, '07'))).length}/${truth.page.length}`);
await b.close();
console.log(errors.length ? errors.join('\n') : 'no page errors');
