// Screenshots for Studio's "Our work" showcase: each live project's whole page on a laptop (shown in a browser frame
// that scrolls through it on hover) and its first screen on a phone, in both languages.
// Run: node scripts/studio-work-shots.ts   (writes to ../studio/public/work/)
import { chromium, type Page } from 'playwright-core';
import sharp from 'sharp';
const OUT = '../studio/public/work/';
const MAX_H = 4600; // a long page is cut here: enough to show its story without a huge file
const SITES: Record<string, Record<'en' | 'ar', string>> = {
  alwafi: { en: 'https://alwafi.net/', ar: 'https://alwafi.net/ar/' },
  hemlo: { en: 'https://hemlohq.com/en/', ar: 'https://hemlohq.com/' },
  tools: { en: 'https://tools.hemlohq.com/?lang=en', ar: 'https://tools.hemlohq.com/?lang=ar' },
};
const b = await chromium.launch({ executablePath: process.env.CHROME ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });

// scroll the page through once so everything that reveals on scroll has revealed, then back to the top
async function settle(p: Page) {
  await p.addStyleTag({ content: '.reveal,.rv,.rise,[data-reveal]{opacity:1!important;transform:none!important;filter:none!important} *{scroll-behavior:auto!important}' });
  const h = await p.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < Math.min(h, MAX_H + 900); y += 500) { await p.evaluate((v) => scrollTo(0, v), y); await p.waitForTimeout(140); }
  await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(900);
}

for (const [id, urls] of Object.entries(SITES)) {
  for (const lang of ['en', 'ar'] as const) {
    const desk = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, locale: lang === 'ar' ? 'ar-IQ' : 'en-US' });
    const d = await desk.newPage();
    await d.goto(urls[lang], { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
    await settle(d);
    const full = await d.screenshot({ fullPage: true });
    const meta = await sharp(full).metadata();
    await sharp(full).extract({ left: 0, top: 0, width: meta.width!, height: Math.min(meta.height!, MAX_H) }).resize(1000).webp({ quality: 72 }).toFile(`${OUT}${id}-page-${lang}.webp`);
    await desk.close();

    const phone = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: lang === 'ar' ? 'ar-IQ' : 'en-US' });
    const p = await phone.newPage();
    await p.goto(urls[lang], { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
    await settle(p);
    const shot = await p.screenshot();
    for (const w of [360, 720]) await sharp(shot).resize(w).webp({ quality: 78 }).toFile(`${OUT}${id}-phone-${lang}-${w}.webp`);
    await phone.close();
    console.log('✓', id, lang, `${meta.width}×${meta.height}`);
  }
}
await b.close();
