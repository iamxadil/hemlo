// Try candidate typefaces on hemlohq.com's hero (Arabic + English) and lay the results side by side for a decision.
// Run: node scripts/font-compare.ts
import { chromium } from 'playwright-core';
import sharp from 'sharp';
const CANDS: [string, string, string, string][] = [
  // name, Google Fonts css2 families, Arabic stack, Latin stack
  ['now: Readex + Vazirmatn', '', '', ''],
  ['IBM Plex Sans Arabic + Plex Sans', 'family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&family=IBM+Plex+Sans:wght@300;400;500;600;700', '"IBM Plex Sans Arabic"', '"IBM Plex Sans"'],
  ['Alexandria (both)', 'family=Alexandria:wght@300;400;500;600;700', 'Alexandria', 'Alexandria'],
  ['Poppins + Plex Arabic', 'family=Poppins:wght@300;400;500;600;700&family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700', '"IBM Plex Sans Arabic"', 'Poppins'],
  ['Noto Kufi Arabic + Inter Tight', 'family=Noto+Kufi+Arabic:wght@300;400;500;600;700&family=Inter+Tight:wght@300;400;500;600;700', '"Noto Kufi Arabic"', '"Inter Tight"'],
];
const b = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
const tiles: Buffer[] = [];
for (const [name, fam, arS, enS] of CANDS) {
  for (const path of ['/', '/en/']) {
    const p = await (await b.newContext({ viewport: { width: 1440, height: 780 }, reducedMotion: 'reduce' })).newPage();
    await p.goto('https://hemlohq.com' + path, { waitUntil: 'networkidle' });
    if (fam) {
      await p.addStyleTag({ url: `https://fonts.googleapis.com/css2?${fam}&display=block` });
      await p.addStyleTag({ content: `html body,html[lang="ar"] body{font-family:${path === '/' ? arS + ',' + enS : enS + ',' + arS},sans-serif!important}` });
      await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(1200);
    }
    const shot = await p.screenshot({ clip: { x: 0, y: 60, width: 1440, height: 700 } });
    const label = Buffer.from(`<svg width="1440" height="56"><rect width="1440" height="56" fill="#111"/><text x="24" y="37" font-size="26" font-family="Arial" fill="#fff">${name} — ${path === '/' ? 'AR' : 'EN'}</text></svg>`);
    tiles.push(await sharp({ create: { width: 1440, height: 756, channels: 3, background: '#fff' } }).composite([{ input: label, top: 0, left: 0 }, { input: shot, top: 56, left: 0 }]).png().toBuffer());
    await p.context().close();
  }
}
for (let i = 0; i < CANDS.length; i++) {
  await sharp({ create: { width: 2880, height: 756, channels: 3, background: '#fff' } })
    .composite([{ input: tiles[i * 2], left: 0, top: 0 }, { input: tiles[i * 2 + 1], left: 1440, top: 0 }]).png().toBuffer().then((x) => sharp(x).resize(1800).png().toFile(`shots/font-${i}.png`));
}
await b.close(); console.log('ok');
