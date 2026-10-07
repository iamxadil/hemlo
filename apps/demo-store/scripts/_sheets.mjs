// Contact sheets of the candidates: 6 across, numbered, one sheet per group of queries.
import sharp from 'sharp';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const T = process.env.TEMP + '/photos';
const C = JSON.parse(readFileSync(T + '/candidates.json', 'utf8'));
const W = 220, H = 264, COLS = 6;
mkdirSync(T + '/sheets', { recursive: true });
const index = {};
let n = 0;
const groups = Object.entries(C);
for (let g = 0; g < groups.length; g += 2) {
  const part = groups.slice(g, g + 2).flatMap(([q, list]) => list.map((x) => ({ q, ...x })));
  const tiles = await Promise.all(part.map(async (x) => {
    const no = ++n; index[no] = x;
    try {
      const r = await fetch(`https://images.unsplash.com/${x.id}?w=${W}&h=${H}&fit=crop&q=55&fm=jpg`);
      const buf = Buffer.from(await r.arrayBuffer());
      const label = Buffer.from(`<svg width="${W}" height="${H}"><rect x="0" y="0" width="54" height="28" fill="#000" opacity=".75"/><text x="6" y="20" font-size="18" font-family="Arial" font-weight="bold" fill="#fff">${no}</text></svg>`);
      return await sharp(buf).resize(W, H, { fit: 'cover' }).composite([{ input: label }]).jpeg({ quality: 70 }).toBuffer();
    } catch { return await sharp({ create: { width: W, height: H, channels: 3, background: '#888' } }).jpeg().toBuffer(); }
  }));
  const rows = Math.ceil(tiles.length / COLS);
  const sheet = sharp({ create: { width: COLS * W + (COLS - 1) * 4, height: rows * H + (rows - 1) * 4, channels: 3, background: '#fff' } })
    .composite(tiles.map((t, i) => ({ input: t, left: (i % COLS) * (W + 4), top: Math.floor(i / COLS) * (H + 4) })));
  const name = `${T}/sheets/s${String(g / 2 + 1).padStart(2, '0')}.jpg`;
  await sheet.jpeg({ quality: 72 }).toFile(name);
  console.log(name, groups.slice(g, g + 2).map(([q]) => q).join(' + '), part.length);
}
writeFileSync(T + '/index.json', JSON.stringify(index, null, 1));
