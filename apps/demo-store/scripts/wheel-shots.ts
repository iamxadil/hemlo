// The home hero's sentence wheel: at rest, mid-turn, after a click, and on the keyboard (laptop + phone, both languages).
// Run with the built site previewing: node scripts/wheel-shots.ts [tag] [base]
import { chromium } from 'playwright-core';
const TAG = process.argv[2] ?? 'now', BASE = process.argv[3] ?? 'http://localhost:4642';
const b = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
const errs: string[] = [];
for (const lang of ['en', 'ar'] as const) {
  for (const [dev, w, h, m] of [['desk', 1440, 900, false], ['phone', 390, 844, true]] as const) {
    const c = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: m ? 2 : 1, isMobile: m, hasTouch: m, reducedMotion: 'no-preference' });
    const p = await c.newPage(); p.on('pageerror', (e) => errs.push(`${lang}/${dev}: ${e.message}`));
    await p.goto(`${BASE}${lang === 'en' ? '/en' : ''}/`, { waitUntil: 'networkidle' }); await p.waitForTimeout(1600);
    await p.screenshot({ path: `shots/wh-${TAG}-rest-${lang}-${dev}.png` });
    // the drum mid-turn: start the next one by hand and catch it moving
    await p.locator('.hs-word').nth(1).click(); await p.waitForTimeout(140);
    await p.screenshot({ path: `shots/wh-${TAG}-turning-${lang}-${dev}.png` });
    await p.waitForTimeout(1200);
    await p.screenshot({ path: `shots/wh-${TAG}-picked-${lang}-${dev}.png` });
    const state = await p.evaluate(() => ({ checked: [...document.querySelectorAll('.hs-word')].findIndex((x) => x.getAttribute('aria-checked') === 'true'),
      href: document.querySelector<HTMLAnchorElement>('[data-go]')!.getAttribute('href'), front: document.querySelector('.hs-phone[data-rel="0"]')!.getAttribute('data-i') }));
    console.log(lang, dev, JSON.stringify(state));
    if (dev === 'desk') {
      await p.locator('.hs-word[aria-checked="true"]').focus(); await p.keyboard.press('ArrowDown'); await p.waitForTimeout(1200);
      console.log(lang, 'after ArrowDown', await p.evaluate(() => [...document.querySelectorAll('.hs-word')].findIndex((x) => x.getAttribute('aria-checked') === 'true')));
      await p.screenshot({ path: `shots/wh-${TAG}-key-${lang}-${dev}.png`, clip: { x: 0, y: 0, width: 760, height: 900 } });
    }
    await c.close();
  }
}
await b.close();
console.log(errs.length ? errs.join('\n') : 'no errors');
