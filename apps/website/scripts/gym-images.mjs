// The gym page's pictures: real screenshots of the demo gym (platform/scripts/marketing-gym-shots.ts) → small webp.
// Run: node scripts/gym-images.mjs
import sharp from 'sharp';
import { readdir, mkdir } from 'node:fs/promises';
const SRC = '../platform/scripts/shots/marketing-gym', OUT = 'public/images/gym';
await mkdir(OUT, { recursive: true });
for (const f of (await readdir(SRC)).filter((x) => x.endsWith('.png'))) {
  const name = f.replace('.png', ''), phone = name.startsWith('phone');
  for (const w of phone ? [420, 840] : [1000, 1800]) {
    const info = await sharp(`${SRC}/${f}`).resize({ width: w }).webp({ quality: 80, effort: 6 }).toFile(`${OUT}/${name}-${w}.webp`);
    console.log(`${name}-${w}.webp`, Math.round(info.size / 1024) + ' KB');
  }
}
