// The dental page's pictures: real screenshots of the clinic (platform/scripts/marketing-dental-shots.ts) → small webp.
// (The Stores card's till: platform/scripts/marketing-store-shots.ts → public/images/stores, same sizes.)
// Run: node scripts/dental-images.mjs
import sharp from 'sharp';
import { readdir, mkdir } from 'node:fs/promises';
const SRC = '../platform/scripts/shots/marketing', OUT = 'public/images/dental';
await mkdir(OUT, { recursive: true });
for (const f of (await readdir(SRC)).filter((x) => x.endsWith('.png'))) {
  const name = f.replace('.png', ''), phone = name.startsWith('phone');
  for (const w of phone ? [420, 840] : [1000, 1800]) {
    const info = await sharp(`${SRC}/${f}`).resize({ width: w }).webp({ quality: 80, effort: 6 }).toFile(`${OUT}/${name}-${w}.webp`);
    console.log(`${name}-${w}.webp`, Math.round(info.size / 1024) + ' KB');
  }
}
