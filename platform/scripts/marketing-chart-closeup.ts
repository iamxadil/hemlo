// The /systems showcase's chart close-up: a fresh patient in a demo clinic, three findings in the three colours
// (an existing filling, a crown planned, a filling done), captured sharp; then the demo is deleted.
import { chromium } from 'playwright-core';
const SYS = 'https://system.hemlohq.com', API = 'https://api.hemlohq.com';
const b = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 5, colorScheme: 'light', reducedMotion: 'reduce' });
const p = await ctx.newPage();
await p.goto(`${SYS}/?demo=dental&lang=en`); await p.waitForSelector('.glance', { timeout: 60000 });
const token = await p.evaluate(() => JSON.parse(localStorage.getItem('hemlo.demo')!).token);
const H = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
const pt = (await (await p.request.post(`${API}/v1/dent/patients`, { headers: H, data: { name: 'Showcase Patient', phone: '07701239999', sex: 'male' } })).json()).patient;
for (const f of [{ tooth: 47, kind: 'filling', surfaces: 'O', status: 'existing' }, { tooth: 46, kind: 'crown', status: 'planned' }, { tooth: 45, kind: 'filling', surfaces: 'OD', status: 'done' }])
  await p.request.post(`${API}/v1/dent/patients/${pt.id}/findings`, { headers: H, data: f });
await p.evaluate((id) => { location.hash = `#/patient?id=${id}&tab=chart`; }, pt.id);
await p.waitForSelector('.odontogram .tooth'); await p.waitForTimeout(1500);
await p.addStyleTag({ content: '.odontogram .tooth-n { opacity: .5 } .odontogram .midline { opacity: 0 }' });
const box = async (ts: string[]) => { const bs = await Promise.all(ts.map((t) => p.locator(`.odontogram .tooth[aria-label="${t}"]`).boundingBox())); return { x: Math.min(...bs.map((x) => x!.x)), y: Math.min(...bs.map((x) => x!.y)), r: Math.max(...bs.map((x) => x!.x + x!.width)), b: Math.max(...bs.map((x) => x!.y + x!.height)) }; };
const k = await box(['48', '47', '46', '45', '44', '43']);
await p.screenshot({ path: 'scripts/shots/chart-showcase.png', clip: { x: k.x - 8, y: k.y - 2, width: k.r - k.x + 2, height: k.b - k.y + 4 } });
await p.request.post(`${API}/v1/demo/end`, { headers: H, data: {} }).catch(() => {});
await b.close(); console.log('done');
