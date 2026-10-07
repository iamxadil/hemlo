// Bigger previews of the shortlist (no crop), with their real shape, to check labels and quality.
import sharp from 'sharp';
import { readFileSync, mkdirSync } from 'node:fs';
const T = process.env.TEMP + '/photos';
const index = JSON.parse(readFileSync(T + '/index.json', 'utf8'));
const pick = process.argv[2].split(',').map(Number);
mkdirSync(T + '/pre', { recursive: true });
const tiles = [];
for (const n of pick) {
  const x = index[n];
  const r = await fetch(`https://images.unsplash.com/${x.id}?w=640&q=70&fm=jpg`);
  const buf = Buffer.from(await r.arrayBuffer());
  const m = await sharp(buf).metadata();
  console.log(n, x.id, `${m.width}x${m.height}`, x.alt.slice(0, 60));
  const label = Buffer.from(`<svg width="420" height="40"><rect width="70" height="34" fill="#000" opacity=".8"/><text x="8" y="25" font-size="22" font-family="Arial" font-weight="bold" fill="#fff">${n}</text></svg>`);
  tiles.push(await sharp(buf).resize(420, 420, { fit: 'contain', background: '#ddd' }).composite([{ input: label, top: 0, left: 0 }]).jpeg().toBuffer());
}
const COLS = 4, rows = Math.ceil(tiles.length / COLS);
await sharp({ create: { width: COLS * 424, height: rows * 424, channels: 3, background: '#fff' } })
  .composite(tiles.map((t, i) => ({ input: t, left: (i % COLS) * 424, top: Math.floor(i / COLS) * 424 }))).jpeg({ quality: 75 }).toFile(T + '/pre/' + process.argv[3] + '.jpg');
