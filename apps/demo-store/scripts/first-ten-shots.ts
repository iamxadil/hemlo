// The two "first ten" features in the demo gym: what Hemlo brought back (reports, the desk, the plan page) and the register
// photographed (start, the sample page being read, the rows to check, added). Laptop + phone, both languages.
// Run with the local API (8787) and app (4333): node scripts/first-ten-shots.ts [tag]
import { chromium } from 'playwright-core';
const TAG = process.argv[2] ?? 'now', SYS = process.env.SYS ?? 'http://localhost:4333';
const b = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
const errors: string[] = [];
for (const lang of ['ar', 'en'] as const) {
  for (const [dev, w, h, m] of [['desk', 1440, 900, false], ['phone', 390, 844, true]] as const) {
    const c = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: m ? 2 : 1, isMobile: m, hasTouch: m });
    const p = await c.newPage();
    p.on('pageerror', (e) => errors.push(`${lang}/${dev}: ${e.message}`));
    p.on('console', (x) => { if (x.type() === 'error' && !/favicon|Failed to load resource/.test(x.text())) errors.push(`${lang}/${dev} console: ${x.text().slice(0, 200)}`); });
    await p.goto(`${SYS}/?demo=gym&lang=${lang}`, { waitUntil: 'networkidle' });
    await p.waitForSelector('.gy-desk, .gy-scan', { timeout: 60000 });
    await p.addStyleTag({ content: '.demo-bar{display:none!important}' });
    await p.waitForTimeout(1200);
    await p.screenshot({ path: `shots/ft-${TAG}-desk-${lang}-${dev}.png` });
    await p.evaluate(() => { location.hash = '#/reports'; }); await p.waitForTimeout(2200);
    await p.screenshot({ path: `shots/ft-${TAG}-reports-${lang}-${dev}.png` });
    await p.evaluate(() => { location.hash = '#/plan'; }); await p.waitForTimeout(2000);
    await p.screenshot({ path: `shots/ft-${TAG}-plan-${lang}-${dev}.png`, fullPage: dev === 'phone' });
    // the register: start, reading the sample page, the rows, added
    await p.evaluate(() => { location.hash = '#/members'; }); await p.waitForTimeout(1500);
    await p.locator('button', { hasText: lang === 'ar' ? 'صوّر سجلّ المشتركين' : 'Photograph your register' }).first().click(); await p.waitForTimeout(800);
    await p.screenshot({ path: `shots/ft-${TAG}-reg-start-${lang}-${dev}.png` });
    await p.locator('button', { hasText: lang === 'ar' ? 'جرّب صفحة نموذجية' : 'Try a sample page' }).click(); await p.waitForTimeout(900);
    await p.screenshot({ path: `shots/ft-${TAG}-reg-reading-${lang}-${dev}.png` });
    await p.waitForTimeout(2600);
    await p.screenshot({ path: `shots/ft-${TAG}-reg-review-${lang}-${dev}.png` });
    if (dev === 'desk') {
      await p.locator('.sheet-foot .btn-accent, footer .btn-accent').last().click(); await p.waitForTimeout(1800);
      await p.screenshot({ path: `shots/ft-${TAG}-reg-done-${lang}-${dev}.png` });
    }
    await c.close();
  }
}
await b.close();
console.log(errors.length ? errors.join('\n') : 'no errors');
