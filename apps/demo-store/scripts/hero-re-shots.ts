// The home hero's tabs and the Systems hero, with Real Estate picked (laptop + phone, both languages).
// Run: node scripts/hero-re-shots.ts [tag] [base]
import { chromium } from 'playwright-core';
const TAG = process.argv[2] ?? 'now', BASE = process.argv[3] ?? 'http://localhost:4642';
const b = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
const errs: string[] = [];
for (const lang of ['ar', 'en'] as const) {
  for (const [dev, w, h, m] of [['desk', 1440, 900, false], ['phone', 390, 844, true]] as const) {
    const c = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: m ? 2 : 1, isMobile: m, hasTouch: m, reducedMotion: 'no-preference' });
    const p = await c.newPage(); p.on('pageerror', (e) => errs.push(`${lang}/${dev}: ${e.message}`));
    const pre = lang === 'en' ? '/en' : '';
    await p.goto(`${BASE}${pre}/`, { waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
    await p.screenshot({ path: `shots/hh-${TAG}-home-${lang}-${dev}.png` });
    await p.locator('.hs-tab').nth(3).click(); await p.waitForTimeout(1400);
    await p.screenshot({ path: `shots/hh-${TAG}-home-re-${lang}-${dev}.png` });
    await p.goto(`${BASE}${pre}/systems/`, { waitUntil: 'networkidle' }); await p.waitForTimeout(800);
    await p.locator('[data-pick="realestate"]').click();
    for (const step of [0, 1, 2]) {
      await p.locator('[data-stage="realestate"] [data-step]').nth(step).click();
      await p.waitForTimeout(3200);
      await p.locator('[data-stage="realestate"]').screenshot({ path: `shots/hh-${TAG}-sys-re${step}-${lang}-${dev}.png` });
    }
    if (dev === 'desk') await p.screenshot({ path: `shots/hh-${TAG}-sys-${lang}-${dev}.png` });
    await c.close();
  }
}
await b.close();
console.log(errs.length ? errs.join('\n') : 'no errors');
