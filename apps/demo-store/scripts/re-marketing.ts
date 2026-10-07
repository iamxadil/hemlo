// Real screens of the Real Estate demo agency for hemlohq.com/realestate (no demo bar), as webp at two widths.
// Run with the local API (8787) and system app (4333): node scripts/re-marketing.ts
import { chromium } from 'playwright-core';
import sharp from 'sharp';
const SYS = process.env.SYS ?? 'http://localhost:4333';
const OUT = '../website/public/images/realestate';
const b = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
const save = async (buf: Buffer, name: string, widths: number[]) => {
  for (const w of widths) await sharp(buf).resize({ width: w }).webp({ quality: 80 }).toFile(`${OUT}/${name}-${w}.webp`);
};
for (const lang of ['ar', 'en'] as const) {
  for (const [dev, w, h, m] of [['desk', 1440, 900, false], ['phone', 390, 844, true]] as const) {
    const c = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: m ? 2.15 : 1.25, isMobile: m, hasTouch: m });
    const p = await c.newPage();
    await p.goto(`${SYS}/?demo=realestate&lang=${lang}`, { waitUntil: 'networkidle' });
    await p.waitForSelector('.ref', { timeout: 60000 });
    await p.addStyleTag({ content: '.demo-bar{display:none!important}' });
    await p.waitForTimeout(1000);
    const ids = await p.evaluate(async () => {
      const t = JSON.parse(localStorage.getItem('hemlo.demo')!).token, H = { authorization: `Bearer ${t}` };
      const props = await (await fetch('http://localhost:8787/v1/re/properties?status=live&limit=40', { headers: H })).json();
      const leads = await (await fetch('http://localhost:8787/v1/re/leads?limit=40', { headers: H })).json();
      const deals = await (await fetch('http://localhost:8787/v1/re/deals', { headers: H })).json();
      const v = props.properties.find((x: any) => x.ref === 4810);
      return { prop: v?.id, slug: v?.slug, lead: leads.leads.find((l: any) => /Ahmed|أحمد/.test(l.name))?.id, deal: deals.deals.find((d: any) => d.stage === 'negotiation')?.id };
    });
    const shots: [string, string][] = dev === 'desk'
      ? [['today', '#/today'], ['property', `#/property?id=${ids.prop}`], ['lead', `#/lead?id=${ids.lead}`], ['deals', `#/deals?id=${ids.deal}`], ['studio', `#/studio?id=${ids.prop}&step=4`], ['reports', '#/reports']]
      : [['phone-today', '#/today'], ['phone-property', `#/property?id=${ids.prop}`]];
    for (const [name, hash] of shots) {
      await p.evaluate((x) => { location.hash = x; }, hash);
      await p.waitForTimeout(1800);
      await save(await p.screenshot(), `${name}-${lang}`, dev === 'desk' ? [1000, 1800] : [420, 840]);
    }
    if (dev === 'phone') {
      const pub = await c.newPage();
      await pub.goto(`http://localhost:8787/v1/re/pub/p/${ids.slug}?lang=${lang}`, { waitUntil: 'networkidle' }); await pub.waitForTimeout(800);
      await save(await pub.screenshot(), `phone-public-${lang}`, [420, 840]);
    }
    await c.close();
  }
}
await b.close();
console.log('done');
