// Screenshots for the Studio site's "Our work" section: the control panel beside its live preview (laptop) and the
// store's home (phone), in both languages. Run with the preview up: node scripts/studio-shots.ts
import { chromium } from 'playwright-core';
const BASE = process.env.BASE ?? 'http://localhost:4501', OUT = 'scripts/shots/studio';
const b = await chromium.launch({ executablePath: process.env.CHROME ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
for (const lang of ['en', 'ar']) {
  const desk = await b.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1.25 });
  const d = await desk.newPage();
  await d.goto(`${BASE}/admin?lang=${lang}`); await d.waitForSelector('.kpis'); await d.waitForTimeout(2500);
  await d.screenshot({ path: `${OUT}/panel-${lang}.png` });
  await desk.close();
  const phone = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await phone.newPage();
  await p.goto(`${BASE}/p/nafha-noir?lang=${lang}&market=iq`); await p.waitForSelector('.pdp-title'); await p.waitForTimeout(2200);
  await p.addStyleTag({ content: '.demo-pill{display:none!important}' });
  await p.screenshot({ path: `${OUT}/phone-${lang}.png` });
  await phone.close();
}
await b.close();
console.log('ok');
