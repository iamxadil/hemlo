// Collects free (non-Plus) Unsplash photo candidates for the demo store, per query, from the public search pages.
import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';
const Q = ['perfume bottle', 'perfume minimal', 'perfume dark moody', 'perfume amber', 'fragrance bottle glass', 'perfume rose', 'perfume luxury', 'cologne bottle', 'attar oil bottle', 'perfume oil roller',
  'incense burner bakhoor', 'oud incense smoke', 'body cream jar', 'hand cream tube', 'hair mist spray', 'luxury gift box', 'saffron threads', 'rose petals', 'agarwood oud', 'bergamot', 'vanilla pods', 'sandalwood',
  'perfume woman', 'perfume vanity', 'perfume spray hand', 'perfume shop', 'cosmetics flat lay beige', 'skincare bottles neutral'];
const BRANDS = /chanel|dior|gucci|ysl|saint laurent|tom ford|versace|armani|prada|herm[eè]s|lanc[oô]me|calvin|klein|jo malone|byredo|le labo|creed|burberry|givenchy|valentino|jean paul|gaultier|carolina|marc jacobs|dolce|gabbana|bvlgari|bulgari|cartier|kenzo|hugo|boss|lacoste|diesel|mugler|paco|rabanne|zara|victoria|sauvage|libre|coco|n[°º]5|aesop|diptyque|kilian|maison|margiela|replica|glossier|nivea|dove|loewe|celine|fenty|rihanna|ariana|azzaro|montblanc|davidoff|issey|miyake|nina ricci|guerlain|estee|clinique|olay|ordinary/i;
const b = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
const p = await b.newPage({ viewport: { width: 1400, height: 1000 }, userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 Edg/130.0' });
const out: Record<string, { href: string; alt: string; id: string }[]> = {};
for (const q of Q) {
  await p.goto(`https://unsplash.com/s/photos/${encodeURIComponent(q.replace(/ /g, '-'))}?license=free`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(3500);
  for (let i = 0; i < 3; i++) { await p.mouse.wheel(0, 2500); await p.waitForTimeout(900); }
  const items = await p.$$eval('a[href^="/photos/"]', (as) => as.map((a) => { const img = a.querySelector('img'); return { href: a.getAttribute('href') ?? '', alt: img?.getAttribute('alt') ?? '', src: img?.getAttribute('src') ?? '' }; }));
  const seen = new Set<string>();
  out[q] = items.filter((x) => x.src.startsWith('https://images.unsplash.com/photo-') && !BRANDS.test(x.alt + ' ' + x.href))
    .map((x) => ({ href: x.href, alt: x.alt, id: x.src.match(/photo-[0-9a-z-]+/)![0] }))
    .filter((x) => !seen.has(x.id) && seen.add(x.id)).slice(0, 24);
  console.log(q, out[q].length);
}
writeFileSync(process.env.TEMP + '/photos/candidates.json', JSON.stringify(out, null, 1));
await b.close();
