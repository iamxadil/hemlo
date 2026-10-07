// Screenshots for a design review: key pages on a laptop and a phone, scrolled through so reveals and photos settle.
// Run (with `npm run preview` up): node scripts/look.ts [lang]
import { chromium } from 'playwright-core';
const BASE = process.env.BASE ?? 'http://localhost:4501', OUT = 'scripts/shots/look', lang = process.argv[2] ?? 'en';
const b = await chromium.launch({ executablePath: process.env.CHROME ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
const errors: string[] = [];
async function run(name: string, w: number, h: number, mobile: boolean, pages: [string, string, number[]][]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(e.message)); p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await p.goto(`${BASE}/?lang=${lang}&market=iq`); await p.waitForTimeout(1500);
  for (const [tag, url, stops] of pages) {
    await p.goto(BASE + url); await p.waitForTimeout(1400);
    for (const y of stops) {
      await p.evaluate((y) => window.scrollTo(0, y), y); await p.waitForTimeout(1100);
      await p.screenshot({ path: `${OUT}/${name}-${tag}-${y}.png` });
    }
  }
  await ctx.close();
}
await run('desk', 1440, 900, false, [['home', '/', [0, 900, 2000, 2900, 3800, 4800, 5800, 6800]], ['cat', '/c/perfumes', [0, 700]], ['pdp', '/p/nafha-noir', [0, 900, 1800]], ['how', '/how', [0, 900]]]);
await run('phone', 390, 844, true, [['home', '/', [0, 760, 1600, 2600, 3400]], ['pdp', '/p/amber-dusk', [0, 700]]]);
await b.close();
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no console errors');
