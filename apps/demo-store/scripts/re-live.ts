// Live check of Hemlo Real Estate: open the demo agency on system.hemlohq.com, then its public property page
// through hemlohq.com/p/…, then the product page. Run: node scripts/re-live.ts
import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
const errors: string[] = [];
for (const [lang, w, h, m] of [['ar', 390, 844, true], ['en', 1440, 900, false]] as const) {
  const c = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: m ? 2 : 1, isMobile: m, hasTouch: m });
  const p = await c.newPage();
  p.on('pageerror', (e) => errors.push(`app ${lang}: ${e.message}`));
  const t0 = Date.now();
  await p.goto(`https://system.hemlohq.com/?demo=realestate&lang=${lang}`, { waitUntil: 'networkidle' });
  await p.waitForSelector('.ref', { timeout: 90000 });
  console.log(`${lang} demo ready in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `shots/live-re-today-${lang}.png` });
  const slug = await p.evaluate(async () => {
    const t = JSON.parse(localStorage.getItem('hemlo.demo')!).token;
    const r = await (await fetch('https://api.hemlohq.com/v1/re/properties?status=live&limit=40', { headers: { authorization: `Bearer ${t}` } })).json();
    return r.properties.find((x: any) => x.ref === 4810)?.slug;
  });
  const pub = await c.newPage();
  pub.on('pageerror', (e) => errors.push(`public ${lang}: ${e.message}`));
  const res = await pub.goto(`https://hemlohq.com/p/${slug}${lang === 'en' ? '?lang=en' : ''}`, { waitUntil: 'networkidle' });
  console.log(`${lang} public page /p/${slug}: ${res?.status()} · photos ${await pub.locator('img').count()} · title "${await pub.title()}"`);
  await pub.screenshot({ path: `shots/live-re-public-${lang}.png` });
  const ev = await pub.evaluate(async (s) => (await fetch(`/p/${s}/event`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'wa' }) })).status, slug);
  console.log(`${lang} event via proxy: ${ev}`);
  const site = await c.newPage();
  const sr = await site.goto(`https://hemlohq.com/${lang === 'en' ? 'en/' : ''}realestate/`, { waitUntil: 'networkidle' });
  await site.locator('#pricing').scrollIntoViewIfNeeded(); await site.waitForTimeout(1200);
  console.log(`${lang} product page: ${sr?.status()} · plans shown ${await site.locator('#pricing').innerText().then((x) => (x.match(/35,000|69,000|129,000/g) ?? []).length)}`);
  await site.locator('#pricing').screenshot({ path: `shots/live-re-pricing-${lang}.png` });
  await c.close();
}
await b.close();
console.log(errors.length ? errors.join('\n') : 'no errors');
