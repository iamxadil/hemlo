// The store's photography: real photos from Unsplash (free for commercial use; we credit every photographer anyway).
// Downloads each original once (photos-src/, not committed), then makes responsive AVIF + WebP sizes in public/photos/
// and the manifest src/data/photos.ts (size, focal point, colour, a tiny blurred preview, credit).
// Run: node scripts/photos.ts           (add --credits to re-read photographer names from Unsplash; needs Edge/Chrome)
import { chromium } from 'playwright-core';
import sharp from 'sharp';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

// key, Unsplash photo id, focal point (object-position) for crops
const PHOTOS: [key: string, id: string, focal: string][] = [
  // products
  ['noir', 'photo-1716857591457-7d7fa45199c6', '64% 62%'],
  ['amber', 'photo-1743309043742-9b4976a16478', '50% 62%'],
  ['musk', 'photo-1705899853374-d91c048b81d2', '50% 40%'],
  ['musk-flat', 'photo-1705899844877-81bb0a0665c1', '50% 50%'],
  ['rose', 'photo-1589807502973-c7be2ee95d99', '50% 58%'],
  ['saffron', 'photo-1638295916768-459f6cf440bc', '50% 52%'],
  ['cedar', 'photo-1594125311687-3b1b3eafa9f4', '50% 55%'],
  ['iris', 'photo-1720423514789-15a33e59fc81', '50% 50%'],
  ['ember', 'photo-1617661338085-d1ec6a89a6d8', '50% 55%'],
  ['oud-oil', 'photo-1738414808975-201966230c59', '46% 62%'],
  ['bakhoor', 'photo-1684039568465-24c31d0cc80f', '50% 58%'],
  ['attar', 'photo-1646149757906-e6e9e9a7c77f', '50% 55%'],
  ['reserve', 'photo-1574670700790-fa314ab37787', '50% 55%'],
  ['cream', 'photo-1671575192248-5d8e42f18a9c', '50% 50%'],
  ['hand-cream', 'photo-1712168044214-f5a272c23a5b', '50% 50%'],
  ['hand-cream-2', 'photo-1638609927040-8a7e97cd9d6a', '50% 50%'],
  ['lotion', 'photo-1623143445418-40c192fa3d11', '50% 55%'],
  ['body-oil', 'photo-1650529192647-ce4eb5fb3314', '55% 50%'],
  ['discovery', 'photo-1592903297149-37fb25202dfa', '50% 45%'],
  ['gift-box', 'photo-1668127693714-791b24af126a', '55% 60%'],
  // categories
  ['cat-perfumes', 'photo-1682251008222-412b140cbf4f', '50% 40%'],
  ['cat-oud', 'photo-1627677710948-0662e3394f94', '62% 45%'],
  ['cat-care', 'photo-1636740599648-ae84f705fc2e', '50% 55%'],
  ['cat-gifts', 'photo-1545844568-98bb15133ec0', '50% 70%'],
  // banners, story, editorial
  ['ritual', 'photo-1652768787394-b7bca615acb3', '62% 40%'],
  ['ritual-tall', 'photo-1652768742119-3a4d0f7fb653', '50% 35%'],
  ['atelier', 'photo-1709666414115-47ecd5143293', '50% 55%'],
  ['note-saffron', 'photo-1613549026666-73c9c9083c62', '50% 50%'],
  ['note-rose', 'photo-1578439231583-9eca0a363860', '50% 45%'],
  ['note-oud', 'photo-1698706382117-6ee2a5547aee', '50% 50%'],
  ['care-ritual', 'photo-1619451427882-6aaaded0cc61', '50% 52%'],
  ['shadow', 'photo-1752520836249-2b8738e12664', '50% 50%'],
];

const SRC = 'photos-src', OUT = 'public/photos', CREDITS = 'scripts/photo-credits.json';
mkdirSync(SRC, { recursive: true }); mkdirSync(OUT, { recursive: true });

// photographer names and real photo-page links, read from Unsplash once (its pages need a real browser)
let credits: Record<string, { name: string; url: string }> = existsSync(CREDITS) ? JSON.parse(readFileSync(CREDITS, 'utf8')) : {};
const missing = PHOTOS.filter(([key]) => !credits[key]);
if (process.argv.includes('--credits') || missing.length) {
  const b = await chromium.launch({ executablePath: process.env.CHROME ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
  const p = await b.newPage({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 Edg/130.0' });
  for (const [key, id] of process.argv.includes('--credits') ? PHOTOS : missing) {
    // the search result we picked from links to the photo page; the page names the photographer
    const cand = JSON.parse(readFileSync(`${process.env.TEMP}/photos/candidates.json`, 'utf8')) as Record<string, { href: string; id: string }[]>;
    const href = Object.values(cand).flat().find((x) => x.id === id)?.href;
    if (!href) { console.log('no page for', key); continue; }
    await p.goto(`https://unsplash.com${href}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await p.waitForTimeout(2500);
    const name = await p.evaluate(() => {
      const t = document.querySelector('meta[property="og:title"]')?.getAttribute('content') ?? document.title;
      return /Photo by (.+?) on Unsplash/.exec(t)?.[1] ?? '';
    });
    credits[key] = { name, url: `https://unsplash.com${href}` };
    console.log(key, '→', name || '(unknown)');
  }
  await b.close();
  writeFileSync(CREDITS, JSON.stringify(credits, null, 1));
}

const WIDTHS = [400, 640, 960, 1400, 2000, 2800];
type Entry = { w: number; h: number; widths: number[]; focal: string; color: string; lqip: string };
const manifest: Record<string, Entry> = {};
for (const [key, id, focal] of PHOTOS) {
  const file = `${SRC}/${key}.jpg`;
  if (!existsSync(file)) {
    const r = await fetch(`https://images.unsplash.com/${id}?w=3000&q=85&fm=jpg`);
    if (!r.ok) throw new Error(`${key}: ${r.status}`);
    writeFileSync(file, Buffer.from(await r.arrayBuffer()));
  }
  const img = sharp(file), m = await img.metadata();
  const widths = WIDTHS.filter((w) => w <= m.width!);
  for (const w of widths) {
    if (!existsSync(`${OUT}/${key}-${w}.avif`)) await sharp(file).resize({ width: w }).avif({ quality: 52, effort: 5 }).toFile(`${OUT}/${key}-${w}.avif`);
    if (!existsSync(`${OUT}/${key}-${w}.webp`)) await sharp(file).resize({ width: w }).webp({ quality: 74, effort: 5 }).toFile(`${OUT}/${key}-${w}.webp`);
  }
  const { dominant } = await sharp(file).stats();
  const lqip = (await sharp(file).resize({ width: 12 }).webp({ quality: 35 }).toBuffer()).toString('base64'); // blurred anyway
  manifest[key] = {
    w: m.width!, h: m.height!, widths, focal,
    color: `#${[dominant.r, dominant.g, dominant.b].map((c) => c.toString(16).padStart(2, '0')).join('')}`,
    lqip,
  };
  console.log(key, `${m.width}×${m.height}`, widths.join(','));
}

writeFileSync('src/data/photos.ts', `// Generated by scripts/photos.ts — do not edit by hand. Real photographs from Unsplash (credits: photo-credits.ts).
// Each: original size, the widths made (AVIF + WebP in /photos), focal point for crops, average colour, a tiny preview.
export interface Photo { w: number; h: number; widths: number[]; focal: string; color: string; lqip: string }
export const PHOTOS: Record<string, Photo> = ${JSON.stringify(manifest, null, 1)};
`);
// the photographers, for the credits on the "how it works" page (kept out of the shop's main download)
const people = [...new Map(PHOTOS.map(([key]) => credits[key]).filter((c) => c?.name).map((c) => [c.name, c.url])).entries()].map(([name, url]) => ({ name, url }));
writeFileSync('src/data/photo-credits.ts', `// Generated by scripts/photos.ts — the photographers behind the demo store's pictures (Unsplash).
export const CREDITS: { name: string; url: string }[] = ${JSON.stringify(people, null, 1)};
`);
console.log('done:', Object.keys(manifest).length, 'photos,', people.length, 'photographers');
