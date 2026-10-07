// Photographs for the demo real-estate agency (Hemlo Real Estate's demo): free Unsplash photos (free for commercial use;
// every photographer is credited in re-photo-credits.json). Searches Unsplash in Edge, keeps only free images (never
// Unsplash+), downloads each once and writes 1400 px and 700 px WebP to the system app's public/demo/re/.
// Run: node scripts/re-photos.ts
import { chromium } from 'playwright-core';
import sharp from 'sharp';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const OUT = '../../platform/apps/system/public/demo/re/';
const SRC = './photos-src/re/';
// key prefix, search, how many
const WANT: [string, string, number][] = [
  ['villa', 'modern villa exterior', 8], ['house', 'house exterior middle east', 4], ['living', 'luxury living room', 6], ['kitchen', 'modern kitchen interior', 5],
  ['bedroom', 'bedroom interior', 5], ['bath', 'modern bathroom', 3], ['garden', 'villa garden pool', 3], ['apartment', 'apartment building exterior', 4],
  ['flatin', 'apartment living room', 4], ['office', 'office interior empty', 3], ['shop', 'empty retail shop interior', 2], ['land', process.env.LAND_Q ?? 'vacant land plot', 3], ['farm', 'farm orchard', 2],
];
mkdirSync(OUT, { recursive: true }); mkdirSync(SRC, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.CHROME ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
// a headless browser's own identity is turned away; an ordinary one isn't
const page = await (await b.newContext({ viewport: { width: 1400, height: 1000 }, locale: 'en-US', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0' })).newPage();
const credits: Record<string, { name: string; url: string; id: string }> = {};
const seen = new Set<string>();
// ONLY=land re-runs one kind (its credits are merged into the existing file)
const only = process.env.ONLY;
const old = only && existsSync(`${OUT}credits.json`) ? JSON.parse(readFileSync(`${OUT}credits.json`, 'utf8')) : {};
for (const [key, q, n] of WANT.filter((w) => !only || w[0] === only)) {
  await page.goto(`https://unsplash.com/s/photos/${encodeURIComponent(q.replace(/ /g, '-'))}?orientation=landscape`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(7000);
  for (let i = 0; i < 3; i++) { await page.mouse.wheel(0, 1600); await page.waitForTimeout(700); }
  // every free photo on the page: its own link, its image, and the photographer next to it (Unsplash+ images live on plus.unsplash.com: skipped)
  const found = await page.evaluate(() => [...document.querySelectorAll('a[href^="/photos/"]')].map((link) => {
    const img = link.querySelector('img[src*="images.unsplash.com/photo-"]') as HTMLImageElement | null;
    if (!img) return null;
    let box: Element | null = link, who: HTMLAnchorElement | null = null;
    for (let i = 0; i < 8 && box && !who; i++) { box = box.parentElement; who = box?.querySelector('a[href^="/@"]') as HTMLAnchorElement | null; }
    return { src: img.src.split('?')[0], url: 'https://unsplash.com' + link.getAttribute('href'), name: (who?.textContent ?? '').trim() };
  }).filter(Boolean)) as { src: string; url: string; name: string }[];
  let got = 0;
  for (const f of found) {
    if (got >= n) break;
    const id = f.src.split('/').pop()!;
    if (seen.has(id) || !id.startsWith('photo-')) continue;
    seen.add(id);
    const k = `${key}-${got + 1}`, raw = `${SRC}${k}.jpg`;
    if (!existsSync(raw)) {
      const res = await fetch(`${f.src}?w=2000&q=80&fm=jpg&fit=max`);
      if (!res.ok) continue;
      writeFileSync(raw, Buffer.from(await res.arrayBuffer()));
    }
    const meta = await sharp(raw).metadata();
    if ((meta.width ?? 0) < (meta.height ?? 0)) continue; // landscape only
    await sharp(raw).resize(1400).webp({ quality: 72 }).toFile(`${OUT}${k}.webp`);
    await sharp(raw).resize(700).webp({ quality: 70 }).toFile(`${OUT}${k}-sm.webp`);
    credits[k] = { name: f.name, url: f.url, id };
    got++;
  }
  console.log(key, got, '/', n, `(${found.length} free on the page)`);
}
writeFileSync(`${OUT}credits.json`, JSON.stringify({ ...old, ...credits }, null, 1));
await b.close();
