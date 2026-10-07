import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { chromium } from 'playwright-core';
const DIST = new URL('../../website/dist', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
const OUT = 'scripts/shots';
const types: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png' };
const web = createServer(async (req, res) => {
  let p = join(DIST, decodeURIComponent(new URL(req.url!, 'http://x').pathname));
  try { if ((await stat(p)).isDirectory()) p = join(p, 'index.html'); res.writeHead(200, { 'content-type': types[extname(p)] ?? 'application/octet-stream' }); res.end(await readFile(p)); } catch { res.writeHead(404); res.end(); }
}).listen(8794);
const b = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const me = { user: { name: 'أحمد الكعبي', email: 'ahmed@example.com', phoneNumber: '+9647701234567' }, session: { secondFactorPending: false }, organizations: [{ id: 'o1', name: 'ورشة الرافدين', role: 'owner' }], activeOrganizationId: 'o1' };
async function shot(opts: { path: string; w: number; h: number; name: string; signedIn?: boolean; openMenu?: string; full?: boolean; dark?: boolean }) {
  const ctx = await b.newContext({ viewport: { width: opts.w, height: opts.h }, deviceScaleFactor: 2, colorScheme: opts.dark ? 'dark' : 'light', reducedMotion: 'reduce' });
  if (opts.signedIn) await ctx.addCookies([{ name: 'hemlo.hint', value: '1', domain: 'localhost', path: '/' }]);
  await ctx.route('https://api.hemlohq.com/**', (r) => r.fulfill({ status: opts.signedIn ? 200 : 401, contentType: 'application/json', body: JSON.stringify(opts.signedIn ? me : { error: 'SIGN_IN_REQUIRED' }) }));
  const p = await ctx.newPage();
  await p.goto('http://localhost:8794' + opts.path, { waitUntil: 'networkidle' });
  if (opts.openMenu) { await p.click(opts.openMenu); await p.waitForTimeout(300); }
  await p.screenshot({ path: `${OUT}/${opts.name}.png`, fullPage: !!opts.full });
  await ctx.close();
}
await shot({ path: '/en/systems/dental/', w: 1440, h: 900, name: 'w-dental-en' });
await shot({ path: '/systems/dental/', w: 1440, h: 900, name: 'w-dental-ar-full', full: true });
await shot({ path: '/systems/dental/', w: 390, h: 844, name: 'w-dental-ar-phone', dark: true });
await shot({ path: '/en/systems/', w: 1440, h: 900, name: 'w-systems-trades-en' });
await b.close(); web.close();
