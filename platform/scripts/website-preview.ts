// Local preview of a generated Hemlo Website: the real API and renderer on an in-memory database, with the demo agency's
// properties and photographs, served the way a customer's subdomain is. Run: npx tsx scripts/website-preview.ts
// → http://localhost:8799/ (Arabic) and http://localhost:8799/?lang=en. Edit the renderer and restart to see the change.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { eq } from 'drizzle-orm';
import { withOrg, withSystem } from '@hemlo/db';
import { hemloSubscription, hemloAddonEntitlement, member } from '@hemlo/db/schema';
import { newId } from '@hemlo/core';
import { setup, Browser, signInEmail, createOrg } from '../tests/helpers';
import { seedDemoRealEstate } from '../apps/api/src/demo-realestate';

// SITE=sample previews the public sample (no data needed) instead of the seeded agency.
const PORT = Number(process.env.PORT ?? 8799), ORIGIN = `http://localhost:${PORT}`, SUB = process.env.SITE === 'sample' ? 'sample' : 'nakheel';
const PUBLIC = new URL('../apps/system/public', import.meta.url).pathname;
const TYPES: Record<string, string> = { '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };

const t = await setup({ SYSTEM_URL: ORIGIN, BUSINESS_CREATION: 'open' });
const owner = new Browser(t.app);
await signInEmail(owner, 'preview@example.com');
const org = await createOrg(owner, 'Nakheel');
await owner.post('/v1/auth/organization/set-active', { organizationId: org.id });
const [m] = await withSystem(t.db, (tx) => tx.select().from(member).where(eq(member.organizationId, org.id)));
await withSystem(t.db, (tx) => tx.insert(hemloSubscription).values({ organizationId: org.id, edition: 'realestate', status: 'active', seats: 3 }));
await withOrg(t.db, org.id, async (tx) => {
  await tx.insert(hemloAddonEntitlement).values({ id: newId(), organizationId: org.id, addonId: 'website', edition: 'realestate', status: 'active', billing: 'month', price: 15000 });
  await seedDemoRealEstate(tx, org.id, m.userId, m.id, 'ar', [], ORIGIN);
});
await owner.post('/v1/web/site/enable');
const put = await owner.put('/v1/web/site', {
  subdomain: 'nakheel', name: { ar: 'دار النخيل للعقارات', en: 'Nakheel Real Estate' },
  tagline: { ar: 'بيوت مختارة في أربيل وبغداد، بأسعار واضحة ومواعيد معاينة تناسبك.', en: 'Considered homes in Erbil and Baghdad, honestly priced, shown when it suits you.' },
  about: { ar: 'مكتب عائلي منذ 2009. لا نعرض إلا ما زرناه بأنفسنا، ونقول السعر كما هو، ونرتّب المعاينة حين تناسبك.', en: 'A family office since 2009. We only show homes we have walked through ourselves, we tell you the price as it is, and we arrange viewings when it suits you.' },
  settings: { contact: { phone: '07701234567', whatsapp: '07701234567', email: 'hello@nakheel.iq', address: '100 Street, Erbil' }, cta: { whatsapp: true, phone: true, inquiry: true } },
  ...(process.env.THEME ? { theme: JSON.parse(process.env.THEME) } : {}),
});
if (put.status !== 200) throw new Error(`site: ${put.status} ${JSON.stringify(put.json)}`);
const pub = await owner.post('/v1/web/site/publish');
if (pub.status !== 200) throw new Error(`publish: ${pub.status} ${JSON.stringify(pub.json)}`);

createServer(async (req, res) => {
  const u = new URL(req.url!, ORIGIN);
  if (u.pathname.startsWith('/demo/')) {
    try { res.writeHead(200, { 'content-type': TYPES[extname(u.pathname)] ?? 'application/octet-stream' }); res.end(await readFile(join(PUBLIC, u.pathname))); }
    catch { res.writeHead(404); res.end(); }
    return;
  }
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const r = await t.app.request(`http://localhost:8787/v1/web/pub${u.pathname === '/' ? '' : u.pathname}${u.search}`, {
    method: req.method, body: chunks.length ? Buffer.concat(chunks) : undefined,
    headers: { ...(req.headers as Record<string, string>), 'x-hemlo-site': SUB, host: `${SUB}.hemlohq.com`, origin: ORIGIN },
  });
  res.writeHead(r.status, Object.fromEntries(r.headers));
  res.end(Buffer.from(await r.arrayBuffer()));
}).listen(PORT, () => console.log(`Hemlo Website preview → ${ORIGIN}/`));
