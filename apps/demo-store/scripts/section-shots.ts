// One section of a hemlohq.com page (laptop + phone, both languages), with the scroll reveals settled.
// Run: node scripts/section-shots.ts <path> <selector> [tag] [base]
import { chromium } from 'playwright-core';
const [PATH = '/', SEL = 'main', TAG = 'now', BASE = 'http://localhost:4642'] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
for (const lang of ['ar', 'en'] as const) {
  for (const [dev, w, h, m] of [['desk', 1440, 900, false], ['phone', 390, 844, true]] as const) {
    const c = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: m ? 2 : 1, isMobile: m, hasTouch: m });
    const p = await c.newPage();
    await p.goto(BASE + (lang === 'en' ? '/en' : '') + PATH, { waitUntil: 'networkidle' });
    await p.addStyleTag({ content: '.reveal{opacity:1!important;transform:none!important}' });
    const el = p.locator(SEL).first();
    await el.scrollIntoViewIfNeeded();
    await p.evaluate(() => document.querySelectorAll('img[loading="lazy"]').forEach((i) => ((i as HTMLImageElement).loading = 'eager')));
    await p.waitForTimeout(1200);
    await el.screenshot({ path: `shots/sec-${TAG}-${lang}-${dev}.png` });
    await c.close();
  }
}
await b.close();
console.log('done');
