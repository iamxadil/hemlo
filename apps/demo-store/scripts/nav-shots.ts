// Close-ups of the header's right side: language switch and bag, empty and with items, light and dark, both languages,
// laptop and phone. Run with the preview up: node scripts/nav-shots.ts
import { chromium } from 'playwright-core';
const BASE = process.env.BASE ?? 'http://localhost:4501', OUT = 'scripts/shots/nav';
const b = await chromium.launch({ executablePath: process.env.CHROME ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
for (const lang of ['en', 'ar']) {
  for (const [kind, vp, dsf] of [['desk', { width: 1440, height: 900 }, 2], ['phone', { width: 390, height: 844 }, 3]] as const) {
    const c = await b.newContext({ viewport: vp, deviceScaleFactor: dsf, isMobile: kind === 'phone', hasTouch: kind === 'phone' });
    const p = await c.newPage();
    const snap = async (name: string) => { const box = (await p.locator('.nav-bar').boundingBox())!; await p.screenshot({ path: `${OUT}/${lang}-${kind}-${name}.png`, clip: { x: box.x - 8, y: box.y - 8, width: box.width + 16, height: box.height + 16 } }); };
    await p.goto(`${BASE}/?lang=${lang}&market=iq`); await p.waitForTimeout(1400); await snap('dark-empty');
    await p.goto(`${BASE}/p/nafha-noir`); await p.waitForTimeout(900); await p.evaluate(() => scrollTo(0, 500)); await p.waitForTimeout(500); await snap('light-empty');
    await p.click('.pdp-add'); await p.waitForTimeout(150); await snap('light-adding');
    await p.keyboard.press('Escape'); await p.mouse.click(5, 600); await p.waitForTimeout(900); await snap('light-1');
    await p.goto(`${BASE}/?lang=${lang}`); await p.waitForTimeout(1400); await snap('dark-1');
    await c.close();
  }
}
await b.close(); console.log('ok');
