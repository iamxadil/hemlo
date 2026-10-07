// Screenshots of the real clinic for hemlohq.com/systems/dental: a private demo clinic per language, the main screens on
// a laptop, a phone and the waiting-room TV (with a patient called in), then the demo is deleted.
// Run: npx tsx scripts/marketing-dental-shots.ts   → scripts/shots/marketing/*.png (website/scripts/dental-images.mjs makes the webp)
import { chromium, type Page } from 'playwright-core';
import { mkdir } from 'node:fs/promises';

const SYS = 'https://system.hemlohq.com', API = 'https://api.hemlohq.com', OUT = 'scripts/shots/marketing';
await mkdir(OUT, { recursive: true });
const b = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const settle = (p: Page, ms = 1400) => p.waitForTimeout(ms);
const clean = (p: Page) => p.addStyleTag({ content: '.demo-bar { display: none !important; }' }); // the demo's own banner isn't part of the picture

for (const lang of ['en', 'ar'] as const) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, colorScheme: 'light' });
  const p = await ctx.newPage();
  await p.goto(`${SYS}/?demo=dental&lang=${lang}`);
  await p.waitForSelector('.glance', { timeout: 60_000 }); await clean(p); await settle(p, 2600);
  const token = await p.evaluate(() => JSON.parse(localStorage.getItem('hemlo.demo')!).token);
  const H = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
  const get = async (path: string) => (await p.request.get(API + path, { headers: H })).json();
  await p.screenshot({ path: `${OUT}/today-${lang}.png` });

  // the chart of the patient with the most going on
  const patients = (await get('/v1/dent/patients')).patients as any[];
  let best = patients[0], most = -1;
  for (const x of patients.slice(0, 12)) { const n = ((await get(`/v1/dent/patients/${x.id}/chart`)).findings ?? []).length; if (n > most) { most = n; best = x; } }
  await p.evaluate((id) => { location.hash = `#/patient?id=${id}&tab=chart`; }, best.id);
  await p.waitForSelector('.odontogram'); await settle(p, 2200);
  const t = p.locator('.odontogram .tooth[aria-label="46"]');
  if (await t.count()) { await t.click(); await settle(p, 900); }
  await p.screenshot({ path: `${OUT}/chart-${lang}.png` });

  await p.evaluate(() => { location.hash = '#/schedule'; }); await p.waitForSelector('.day-cols'); await settle(p, 1800);
  await p.screenshot({ path: `${OUT}/schedule-${lang}.png` });
  await p.evaluate(() => { location.hash = '#/reports'; }); await p.waitForSelector('.tbl', { timeout: 30_000 }); await settle(p, 2200);
  await p.screenshot({ path: `${OUT}/reports-${lang}.png` });

  // the phone
  const phone = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, colorScheme: 'light' });
  await phone.addInitScript(([d, l]) => { localStorage.setItem('hemlo.demo', d); localStorage.setItem('hemlo.lang', l); }, [await p.evaluate(() => localStorage.getItem('hemlo.demo')!), lang] as const);
  const ph = await phone.newPage();
  await ph.goto(`${SYS}/?lang=${lang}#/today`); await ph.waitForSelector('.glance', { timeout: 60_000 }); await clean(ph); await settle(ph, 2200);
  await ph.screenshot({ path: `${OUT}/phone-today-${lang}.png` });
  await ph.evaluate((id) => { location.hash = `#/patient?id=${id}&tab=chart`; }, best.id); await ph.waitForSelector('.odontogram'); await ph.locator('.odontogram').scrollIntoViewIfNeeded(); await ph.evaluate(() => window.scrollBy(0, -90)); await settle(ph, 2000);
  await ph.screenshot({ path: `${OUT}/phone-chart-${lang}.png` });
  await phone.close();

  // the waiting-room TV, and a patient called in
  const opener = await ctx.newPage();
  await opener.goto(`${SYS}/#/waiting`); await opener.waitForURL((u) => u.hash.startsWith('#/waiting?k='), { timeout: 30_000 });
  const link = opener.url(); await opener.close();
  const tvCtx = await b.newContext({ viewport: { width: 1920, height: 1080 } });
  const tv = await tvCtx.newPage();
  await tv.goto(link); await tv.waitForSelector('.wr-chair, .wr-welcome'); await settle(tv, 2500);
  await tv.evaluate(() => document.querySelector('.wr-start')?.remove()); // the one-time start button isn't part of the picture
  await tv.screenshot({ path: `${OUT}/tv-${lang}.png` });
  const queue = (await get('/v1/dent/queue')).queue as any[], chairs = (await get('/v1/dent/setup')).chairs as any[];
  const seated = queue.find((x) => x.status === 'seated');
  if (seated) await p.request.patch(`${API}/v1/dent/appointments/${seated.id}`, { headers: H, data: { status: 'done' } });
  const busy = new Set(queue.filter((x) => x.status === 'seated' && x.id !== seated?.id).map((x) => x.chair));
  const chair = chairs.find((c) => !busy.has(c.name)), next = queue.find((x) => x.status === 'arrived');
  if (chair && next) {
    await tv.waitForTimeout(13_000);
    await p.request.patch(`${API}/v1/dent/appointments/${next.id}`, { headers: H, data: { status: 'seated', chairId: chair.id, force: true } });
    await tv.waitForSelector('.wr-call', { timeout: 30_000 }); await settle(tv, 1800);
    await tv.screenshot({ path: `${OUT}/tv-call-${lang}.png` });
  }
  await tvCtx.close();

  await p.request.post(`${API}/v1/demo/end`, { headers: H, data: {} }); // leave: the demo is deleted
  await ctx.close();
  console.log(lang, 'done; chart of', best.name, `(${most} findings)`);
}
await b.close();
