// Screenshots of hemlohq.com's home hero at laptop and phone sizes, in both languages (for design review).
// Run: node scripts/hero-shots.ts [baseUrl] [tag]
import { chromium } from 'playwright-core';
const BASE = process.argv[2] ?? 'http://localhost:4620';
const TAG = process.argv[3] ?? 'now';
const OUT = process.env.OUT ?? './shots/';
const b = await chromium.launch({ executablePath: process.env.CHROME ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
for (const [lang, path] of [['ar', '/'], ['en', '/en/']] as const) {
  for (const [dev, vp, m] of [['desk', { width: 1440, height: 900 }, false], ['phone', { width: 390, height: 844 }, true]] as const) {
    for (const scheme of ['light', 'dark'] as const) {
      const c = await b.newContext({ viewport: vp, deviceScaleFactor: m ? 2 : 1, isMobile: m, hasTouch: m, colorScheme: scheme });
      const p = await c.newPage();
      const errs: string[] = []; p.on('pageerror', (e) => errs.push(e.message));
      await p.goto(BASE + path, { waitUntil: 'networkidle' });
      await p.waitForTimeout(1600);
      await p.screenshot({ path: `${OUT}hero-${TAG}-${lang}-${dev}-${scheme}.png` });
      if (errs.length) console.log('errors', lang, dev, errs);
      await c.close();
    }
  }
}
await b.close();
console.log('ok');
