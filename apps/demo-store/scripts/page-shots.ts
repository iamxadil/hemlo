// Full-page screenshots of one hemlohq.com page (laptop + phone, both languages), cut into screen-high slices for review.
// Run: node scripts/page-shots.ts <path without lang prefix, e.g. /systems/> [tag] [base]
import { chromium } from 'playwright-core';
import sharp from 'sharp';
const PATH = process.argv[2] ?? '/', TAG = process.argv[3] ?? 'now', BASE = process.argv[4] ?? 'http://localhost:4641';
const b = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
for (const lang of ['ar', 'en'] as const) {
  for (const [dev, w, h, m] of [['desk', 1440, 900, false], ['phone', 390, 844, true]] as const) {
    const c = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: m, hasTouch: m });
    const p = await c.newPage(); const errs: string[] = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(BASE + (lang === 'en' ? '/en' : '') + PATH, { waitUntil: 'networkidle' });
    await p.addStyleTag({ content: '.reveal{opacity:1!important;transform:none!important} astro-dev-toolbar{display:none!important}' });
    await p.waitForTimeout(1500);
    const full = await p.screenshot({ fullPage: true });
    const H = (await sharp(full).metadata()).height!;
    const step = h * 1.6;
    for (let y = 0, k = 0; y < H && k < 8; y += step, k++) {
      await sharp(full).extract({ left: 0, top: Math.round(y), width: w, height: Math.round(Math.min(step, H - y)) }).toFile(`shots/pg-${TAG}-${lang}-${dev}-${k}.png`);
    }
    console.log(lang, dev, H, errs.length ? errs : '');
    await c.close();
  }
}
await b.close();
