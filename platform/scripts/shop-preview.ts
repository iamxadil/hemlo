// Local preview of a shop's Hemlo Website (an online store): the real API and renderer on an in-memory database, with a
// perfume shop's products and the demo store's photographs, served the way a customer's subdomain is.
// Run: npx tsx scripts/shop-preview.ts → http://localhost:8798/ (Arabic) and http://localhost:8798/?lang=en.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { withOrg, withSystem } from '@hemlo/db';
import { hemloSubscription, hemloAddonEntitlement } from '@hemlo/db/schema';
import { newId } from '@hemlo/core';
import { setup, Browser, signInEmail, createOrg } from '../tests/helpers';

const PORT = Number(process.env.PORT ?? 8798), ORIGIN = `http://localhost:${PORT}`, SUB = process.env.SITE ?? 'nafha';
const DEMO = new URL('../apps/system/public/', import.meta.url);
const PHOTOS = new URL('../../apps/demo-store/dist/photos/', import.meta.url);

const t = await setup({ SYSTEM_URL: ORIGIN, API_URL: ORIGIN, BUSINESS_CREATION: 'open' });
const owner = new Browser(t.app);
await signInEmail(owner, 'shop-preview@example.com');
const org = await createOrg(owner, 'Nafha');
await owner.post('/v1/auth/organization/set-active', { organizationId: org.id });
await withSystem(t.db, (tx) => tx.insert(hemloSubscription).values({ organizationId: org.id, edition: 'store', status: 'active', seats: 3 }));
await withOrg(t.db, org.id, (tx) => tx.insert(hemloAddonEntitlement).values({ id: newId(), organizationId: org.id, addonId: 'website', edition: 'store', status: 'active', billing: 'month', price: 10000 }));

const items: [string, string, string, number, number, string?][] = [
  ['amber', 'عنبر الليل · 100 مل', 'عطور', 85000, 12, 'عنبر دافئ مع لمسة فانيلا وخشب الصندل. يدوم طويلاً على البشرة والملابس.'],
  ['rose', 'ورد الطائف · 50 مل', 'عطور', 65000, 3],
  ['iris', 'سوسن أبيض · 75 مل', 'عطور', 72000, 9],
  ['noir', 'نوار · 100 مل', 'عطور', 95000, 0],
  ['oud-oil', 'دهن عود كمبودي · 3 مل', 'عود', 120000, 6],
  ['saffron', 'زعفران ملكي · 50 مل', 'عود', 78000, 15],
  ['bakhoor', 'بخور معمول · 50 غ', 'بخور', 25000, 30],
  ['attar', 'عطر زيتي · المسك', 'عود', 30000, 25],
  ['hand-cream', 'كريم يدين بالورد', 'عناية', 18000, 40],
  ['body-oil', 'زيت الجسم بالعنبر', 'عناية', 32000, 18],
  ['gift-box', 'صندوق هدية · ثلاث عطور', 'هدايا', 150000, 5],
  ['discovery', 'مجموعة الاكتشاف', 'هدايا', 45000, 20],
];
// a few products with a whole gallery (the cover, then more), like a shop's
const more: Record<string, string[]> = { amber: ['ember', 'cedar', 'musk'], 'hand-cream': ['hand-cream-2', 'cream', 'lotion'], 'gift-box': ['discovery', 'care-ritual'] };
const send = async (file: string) => {
  const bytes = new Uint8Array(await readFile(new URL(`${file}-640.webp`, PHOTOS)));
  const up = await owner.upload('/v1/sys/files?purpose=product', bytes, 'image/webp');
  if (up.status !== 201) throw new Error(`upload ${file}: ${up.status} ${JSON.stringify(up.json)}`);
  return up.json.file?.id ?? up.json.id;
};
for (const [file, name, category, price, stock, description] of items) {
  const cover = await send(file), photoIds = [];
  for (const x of more[file] ?? []) photoIds.push(await send(x));
  const r = await owner.post('/v1/sys/products', { name, category, price, stock, lowStock: 4, online: true, imageId: cover, photoIds, description: description ?? null });
  if (r.status !== 201) throw new Error(`product ${file}: ${r.status} ${JSON.stringify(r.json)}`);
}
// the public sample (sample-shop) is rendered from its own list, not from a site in the database
if (SUB !== 'sample-shop') {
await owner.post('/v1/web/site/enable');
const put = await owner.put('/v1/web/site', {
  subdomain: SUB, name: { ar: 'نفحة', en: 'Nafha' },
  tagline: { ar: 'عطور وعود وبخور مختارة بعناية، تصلك إلى باب بيتك في بغداد وأربيل.', en: 'Perfumes, oud and bakhoor chosen with care, delivered to your door in Baghdad and Erbil.' },
  about: { ar: 'متجر عائلي في الكرادة منذ 2012. نختار كل عطر بأنفسنا، ونغلّف كل طلب كأنه هدية.', en: 'A family shop in Karrada since 2012. We choose every scent ourselves and wrap every order like a gift.' },
  settings: { contact: { phone: '07701234567', whatsapp: '07701234567', address: 'الكرادة، شارع 62، بغداد' }, cta: { whatsapp: true, phone: true },
    shop: { delivery: true, pickup: true, fee: 5000, fees: [{ city: 'أربيل', fee: 8000 }], freeOver: 100000, minOrder: 10000, cities: ['بغداد', 'أربيل'] } },
  ...(process.env.THEME ? { theme: JSON.parse(process.env.THEME) } : {}),
});
if (put.status !== 200) throw new Error(`site: ${put.status} ${JSON.stringify(put.json)}`);
const pub = await owner.post('/v1/web/site/publish');
if (pub.status !== 200) throw new Error(`publish: ${pub.status} ${JSON.stringify(pub.json)}`);
}

createServer(async (req, res) => {
  const u = new URL(req.url!, ORIGIN);
  // the sample shop's photos live with the system app (/demo/shop/…), as they do in production
  if (u.pathname.startsWith('/demo/')) { try { res.writeHead(200, { 'content-type': 'image/webp' }); res.end(await readFile(new URL('.' + u.pathname, DEMO))); } catch { res.writeHead(404); res.end(); } return; }
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  // the photos' own links (/v1/files/…) go to the API as they are; everything else is the shop's site
  const path = u.pathname.startsWith('/v1/') ? u.pathname : `/v1/web/pub${u.pathname === '/' ? '' : u.pathname}`;
  const r = await t.app.request(`http://localhost:8787${path}${u.search}`, {
    method: req.method, body: chunks.length ? Buffer.concat(chunks) : undefined,
    headers: { ...(req.headers as Record<string, string>), 'x-hemlo-site': SUB, host: `${SUB}.hemlohq.com`, origin: ORIGIN },
  });
  res.writeHead(r.status, Object.fromEntries(r.headers));
  res.end(Buffer.from(await r.arrayBuffer()));
}).listen(PORT, () => console.log(`Hemlo shop preview → ${ORIGIN}/`));
