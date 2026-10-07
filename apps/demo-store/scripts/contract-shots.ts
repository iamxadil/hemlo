// The contract maker in the demo agency: the list, the editor (a signed sale and a deposit being drafted), on a laptop
// and a phone, and the sale contract printed to A4 as a PDF. Run with the local API (8787) and app (4333):
// node scripts/contract-shots.ts [tag]
import { chromium } from 'playwright-core';
const TAG = process.argv[2] ?? 'now', SYS = process.env.SYS ?? 'http://localhost:4333';
const b = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
const errors: string[] = [];
for (const lang of ['ar', 'en'] as const) {
  for (const [dev, w, h, m] of [['desk', 1440, 900, false], ['phone', 390, 844, true]] as const) {
    const c = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: m ? 2 : 1, isMobile: m, hasTouch: m });
    const p = await c.newPage();
    p.on('pageerror', (e) => errors.push(`${lang}/${dev}: ${e.message}`));
    p.on('console', (x) => { if (x.type() === 'error' && !/favicon|fonts|Failed to load resource/.test(x.text())) errors.push(`${lang}/${dev} console: ${x.text().slice(0, 200)}`); });
    await p.goto(`${SYS}/?demo=realestate&lang=${lang}`, { waitUntil: 'networkidle' });
    await p.waitForSelector('.ref', { timeout: 60000 });
    await p.addStyleTag({ content: '.demo-bar{display:none!important}' });
    const ids = await p.evaluate(async () => {
      const t = JSON.parse(localStorage.getItem('hemlo.demo')!).token;
      const x = await (await fetch('http://localhost:8787/v1/re/contracts', { headers: { authorization: `Bearer ${t}` } })).json();
      return { sale: x.contracts.find((k: any) => k.kind === 'sale')?.id, deposit: x.contracts.find((k: any) => k.kind === 'deposit')?.id };
    });
    await p.evaluate(() => { location.hash = '#/contracts'; }); await p.waitForTimeout(1300);
    await p.screenshot({ path: `shots/ct-${TAG}-list-${lang}-${dev}.png` });
    await p.evaluate((id) => { location.hash = `#/contract?id=${id}`; }, ids.deposit); await p.waitForTimeout(1500);
    await p.screenshot({ path: `shots/ct-${TAG}-draft-${lang}-${dev}.png` });
    if (dev === 'phone') { await p.locator('.ct-tabs button').nth(1).click(); await p.waitForTimeout(500); await p.screenshot({ path: `shots/ct-${TAG}-draft-preview-${lang}-${dev}.png`, fullPage: true }); }
    else {
      // type into the draft: the paper follows, the amount in words too
      await p.locator('.ct-form input.money').nth(0).fill('15000'); await p.waitForTimeout(1200);
      await p.screenshot({ path: `shots/ct-${TAG}-typed-${lang}-${dev}.png` });
      await p.evaluate((id) => { location.hash = `#/contract?id=${id}`; }, ids.sale); await p.waitForTimeout(1500);
      await p.screenshot({ path: `shots/ct-${TAG}-signed-${lang}-${dev}.png` });
      // the print: the paper alone on A4
      await p.evaluate(() => { const el = document.querySelector('.ct-paper')!; const r = document.createElement('div'); r.className = 're-print-root'; r.appendChild(el.cloneNode(true)); document.body.appendChild(r); });
      await p.emulateMedia({ media: 'print' });
      await p.pdf({ path: `shots/ct-${TAG}-sale-${lang}.pdf`, format: 'A4', preferCSSPageSize: true, printBackground: true });
      await p.emulateMedia({ media: 'screen' });
      // a new contract from a property
      await p.evaluate(() => { location.hash = '#/contracts?new=1'; }); await p.waitForTimeout(1200);
      await p.screenshot({ path: `shots/ct-${TAG}-new-${lang}-${dev}.png` });
    }
    await c.close();
  }
}
await b.close();
console.log(errors.length ? errors.join('\n') : 'no errors');
