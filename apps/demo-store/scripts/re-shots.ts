// A screenshot tour of Hemlo Real Estate's demo agency (laptop + phone, both languages), for design review.
// Run with the local API (8787) and system app (4333): node scripts/re-shots.ts [tag] [pages…]
import { chromium, type Page } from 'playwright-core';
const TAG = process.argv[2] ?? 'now', ONLY = process.argv.slice(3);
const SYS = process.env.SYS ?? 'http://localhost:4333';
const b = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
const errors: string[] = [];
for (const lang of ['ar', 'en'] as const) {
  for (const [dev, w, h, m] of [['desk', 1440, 900, false], ['phone', 390, 844, true]] as const) {
    const c = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: m ? 2 : 1, isMobile: m, hasTouch: m });
    const p = await c.newPage();
    p.on('pageerror', (e) => errors.push(`${lang}/${dev}: ${e.message}`));
    p.on('console', (x) => { if (x.type() === 'error' && !/favicon|fonts|404|Failed to load resource/.test(x.text())) errors.push(`${lang}/${dev} console: ${x.text().slice(0, 200)}`); });
    await p.goto(`${SYS}/?demo=realestate&lang=${lang}`, { waitUntil: 'networkidle' });
    await p.waitForSelector('.ref', { timeout: 60000 });
    await p.waitForTimeout(1200);
    const ids = await p.evaluate(async () => {
      const t = JSON.parse(localStorage.getItem('hemlo.demo')!).token, H = { authorization: `Bearer ${t}` };
      const props = await (await fetch('http://localhost:8787/v1/re/properties?status=live&limit=40', { headers: H })).json();
      const leads = await (await fetch('http://localhost:8787/v1/re/leads?q=' + encodeURIComponent('Ahmed'), { headers: H })).json();
      const leadsAr = await (await fetch('http://localhost:8787/v1/re/leads?q=' + encodeURIComponent('أحمد'), { headers: H })).json();
      const deals = await (await fetch('http://localhost:8787/v1/re/deals', { headers: H })).json();
      return { prop: props.properties.find((x: any) => x.ref === 4810)?.id, slug: props.properties.find((x: any) => x.ref === 4810)?.slug, lead: (leads.leads[0] ?? leadsAr.leads[0])?.id, deal: deals.deals.find((d: any) => d.stage === 'negotiation')?.id };
    });
    const pages: [string, string][] = [['today', '#/today'], ['properties', '#/properties'], ['property', `#/property?id=${ids.prop}`], ['studio', `#/studio?id=${ids.prop}&step=4`], ['leads', '#/leads'],
      ['lead', `#/lead?id=${ids.lead}`], ['agenda', '#/agenda'], ['deals', `#/deals?id=${ids.deal}`], ['map', '#/map'], ['reports', '#/reports'], ['agency', '#/agency']];
    for (const [name, hash] of pages) {
      if (ONLY.length && !ONLY.includes(name)) continue;
      await p.evaluate((x) => { location.hash = x; }, hash);
      await p.waitForTimeout(name === 'map' ? 3500 : 1600);
      await p.screenshot({ path: `shots/re-${TAG}-${name}-${lang}-${dev}.png` });
    }
    if (!ONLY.length || ONLY.includes('public')) {
      const pub = await c.newPage(); pub.on('pageerror', (e) => errors.push(`public ${lang}/${dev}: ${e.message}`));
      await pub.goto(`http://localhost:8787/v1/re/pub/p/${ids.slug}?lang=${lang}`, { waitUntil: 'networkidle' }); await pub.waitForTimeout(800);
      await pub.screenshot({ path: `shots/re-${TAG}-public-${lang}-${dev}.png` });
      await pub.screenshot({ path: `shots/re-${TAG}-publicfull-${lang}-${dev}.png`, fullPage: true });
    }
    await c.close();
  }
}
await b.close();
console.log(errors.length ? errors.join('\n') : 'no errors');
