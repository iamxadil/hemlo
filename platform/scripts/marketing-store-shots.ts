// Screenshots of the real shop for hemlohq.com/systems/stores: a private demo shop per language (till with a basket,
// the owner's day, the debt book, the till on a phone), then the demo is deleted.
// Run: npx tsx scripts/marketing-store-shots.ts → scripts/shots/marketing/*.png (website/scripts/dental-images.mjs makes the webp)
import { chromium, type Page } from 'playwright-core';
const SYS = 'https://system.hemlohq.com', API = 'https://api.hemlohq.com', OUT = 'scripts/shots/marketing';
const b = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const clean = (p: Page) => p.addStyleTag({ content: '.demo-bar, .try { display: none !important; }' }); // the demo's own banner and hints aren't part of the picture
const go = async (p: Page, hash: string, ms = 2600) => { await p.evaluate((h) => { location.hash = h; }, hash); await p.waitForTimeout(ms); };
const scan = async (p: Page) => { for (const code of ['6281036001017', '6281036001017', '2100042012503']) { await p.keyboard.type(code); await p.keyboard.press('Enter'); await p.waitForTimeout(500); } };

for (const lang of ['en', 'ar'] as const) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, colorScheme: 'light' });
  const p = await ctx.newPage();
  await p.goto(`${SYS}/?demo=1&lang=${lang}`);
  await p.waitForFunction(() => !!localStorage.getItem('hemlo.demo'), null, { timeout: 60_000 });
  await clean(p);
  const demo = await p.evaluate(() => localStorage.getItem('hemlo.demo')!);
  await go(p, '#/home', 3200); await p.screenshot({ path: `${OUT}/store-home-${lang}.png` });
  await go(p, '#/customers'); await p.screenshot({ path: `${OUT}/store-debts-${lang}.png` });
  await go(p, '#/sell'); await scan(p); await p.waitForTimeout(1200); await p.screenshot({ path: `${OUT}/sell-${lang}.png` });

  const phone = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, colorScheme: 'light' });
  await phone.addInitScript(([d, l]) => { localStorage.setItem('hemlo.demo', d); localStorage.setItem('hemlo.lang', l); }, [demo, lang] as const);
  const ph = await phone.newPage();
  await ph.goto(`${SYS}/?lang=${lang}#/sell`); await ph.waitForTimeout(3500); await clean(ph);
  await scan(ph); await ph.waitForTimeout(1200);
  await ph.screenshot({ path: `${OUT}/phone-sell-${lang}.png` });
  await phone.close();

  const token = JSON.parse(demo).token;
  await p.request.post(`${API}/v1/demo/end`, { headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, data: {} }).catch(() => {});
  await ctx.close(); console.log(lang, 'done');
}
await b.close();
