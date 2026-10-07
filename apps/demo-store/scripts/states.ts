// Screenshots of the interactive states (premium-storefront skill §6): the navbar at rest, hovered and over a dark
// section; the confirm-in-place button and the mini bag; the phone menu; the bag sheet open, half-dragged, and with a
// row swiped to Delete. Run (with `npm run preview` up): node scripts/states.ts [en|ar]
import { chromium } from 'playwright-core';
const BASE = process.env.BASE ?? 'http://localhost:4501', OUT = 'scripts/shots/states', lang = process.argv[2] ?? 'en';
const b = await chromium.launch({ executablePath: process.env.CHROME ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
const errors: string[] = [];
const wait = (p: any, ms = 600) => p.waitForTimeout(ms);

// laptop
{
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(`${BASE}/?lang=${lang}&market=iq`); await wait(p, 1500);
  await p.screenshot({ path: `${OUT}/${lang}-desk-nav-dark.png`, clip: { x: 0, y: 0, width: 1440, height: 160 } });
  await p.goto(`${BASE}/c/perfumes`); await wait(p, 900);
  await p.evaluate(() => scrollTo(0, 700)); await wait(p, 600);
  await p.hover('.nav-links a >> nth=3'); await wait(p, 500);
  await p.screenshot({ path: `${OUT}/${lang}-desk-nav-hover.png`, clip: { x: 0, y: 0, width: 1440, height: 160 } });
  await p.goto(`${BASE}/p/nafha-noir`); await wait(p, 1000);
  await p.click('.pdp-add'); await wait(p, 450);
  await p.screenshot({ path: `${OUT}/${lang}-desk-added.png` });
  await ctx.close();
}
// phone
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(`${BASE}/?lang=${lang}&market=iq`); await wait(p, 1500);
  await p.screenshot({ path: `${OUT}/${lang}-phone-nav.png`, clip: { x: 0, y: 0, width: 390, height: 140 } });
  await p.click('.nav-burger'); await wait(p, 120);
  await p.screenshot({ path: `${OUT}/${lang}-phone-menu-mid.png` });
  await wait(p, 900);
  await p.screenshot({ path: `${OUT}/${lang}-phone-menu.png` });
  await p.click('.nav-burger'); await wait(p, 800);
  await p.goto(`${BASE}/p/white-musk`); await wait(p, 900);
  await p.click('.pdp-add'); await wait(p, 500);
  await p.screenshot({ path: `${OUT}/${lang}-phone-added.png` });
  await p.goto(`${BASE}/p/amber-dusk`); await wait(p, 800); await p.click('.pdp-add'); await wait(p, 300);
  await p.click('.bag-pill'); await wait(p, 900);
  await p.screenshot({ path: `${OUT}/${lang}-phone-bag.png` });
  // drag the sheet halfway, take a picture mid-drag, then let go slowly (it should return)
  const head = (await p.locator('.sheet-head').boundingBox())!;
  await p.mouse.move(head.x + 40, head.y + 10); await p.mouse.down();
  for (let i = 1; i <= 10; i++) { await p.mouse.move(head.x + 40, head.y + 10 + i * 18); await p.waitForTimeout(30); }
  await p.screenshot({ path: `${OUT}/${lang}-phone-bag-drag.png` });
  await p.waitForTimeout(200); await p.mouse.up(); await wait(p, 900);
  if (!(await p.locator('.sheet').count())) errors.push('sheet closed on a slow half drag');
  // swipe a row to reveal Delete
  const row = (await p.locator('.swipe-front >> nth=0').boundingBox())!;
  const dir = lang === 'ar' ? 1 : -1;
  await p.mouse.move(row.x + row.width / 2, row.y + row.height / 2); await p.mouse.down();
  for (let i = 1; i <= 8; i++) { await p.mouse.move(row.x + row.width / 2 + dir * i * 14, row.y + row.height / 2); await p.waitForTimeout(16); }
  await p.mouse.up(); await wait(p, 700);
  await p.screenshot({ path: `${OUT}/${lang}-phone-bag-swipe.png` });
  await ctx.close();
}
await b.close();
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'ok, no errors');
