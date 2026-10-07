// Reads each demo photo's photographer from its own Unsplash page (for the credits list). Run after re-photos.ts.
import { chromium } from 'playwright-core';
import { readFileSync, writeFileSync } from 'node:fs';
const FILE = '../../platform/apps/system/public/demo/re/credits.json';
const credits = JSON.parse(readFileSync(FILE, 'utf8')) as Record<string, { name: string; url: string; id: string; profile?: string }>;
const b = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
const page = await (await b.newContext({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0' })).newPage();
for (const [k, c] of Object.entries(credits)) {
  if (c.name) continue;
  await page.goto(c.url, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(3500);
  const who = await page.evaluate(() => {
    const a = [...document.querySelectorAll('a[href^="/@"]')].find((x) => (x.textContent ?? '').trim().length > 1) as HTMLAnchorElement | undefined;
    const og = document.querySelector('meta[property="og:title"]')?.getAttribute('content') ?? '';
    return { name: (a?.textContent ?? '').trim() || (/Photo by (.+?) on Unsplash/.exec(og)?.[1] ?? ''), profile: a ? 'https://unsplash.com' + a.getAttribute('href') : '' };
  });
  credits[k] = { ...c, ...who };
  console.log(k, '·', who.name || '(not found)');
}
writeFileSync(FILE, JSON.stringify(credits, null, 1));
await b.close();
