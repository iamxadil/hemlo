import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const errs: string[] = [];
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
p.on('pageerror', (e) => errs.push(e.message));
p.on('response', (r) => { if (r.url().includes('api.hemlohq.com') && r.status() >= 400) errs.push(`${r.status()} ${r.url()}`); });
const t0 = Date.now();
await p.goto('https://system.hemlohq.com/?demo=dental&lang=en');
try { await p.waitForSelector('.glance', { timeout: 60000 }); } catch (e) { await p.screenshot({ path: 'scripts/shots/live-fail.png' }); console.log('FAILED', errs.join(' / ')); throw e; }
console.log('demo clinic open in', Date.now() - t0, 'ms; rows:', await p.locator('.t-card').count());
await p.screenshot({ path: 'scripts/shots/live-dental-today.png' });
for (const path of ['schedule', 'patients', 'lab', 'reports', 'clinic']) { await p.goto(`https://system.hemlohq.com/#/${path}`); await p.waitForLoadState('networkidle'); }
const w = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const r = await w.goto('https://hemlohq.com/en/systems/dental/');
console.log('website dental page:', r?.status(), await w.title());
const s = await w.goto('https://hemlohq.com/systems/'); console.log('systems page:', s?.status(), (await w.locator('.trade.now').count()), 'live trades');
console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no errors');
await b.close();
