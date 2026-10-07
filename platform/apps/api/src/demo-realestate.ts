// The demo agency: a believable Erbil agency with a month of life. Villas in Dream City and English Village, apartments
// in Empire World and Ankawa, a Baghdad villa, offices, a shop, land and an orchard; owners with their agreements;
// buyers and tenants with real requirements (so the matcher has work to do); a month of page views; viewings today and
// tomorrow; follow-ups overdue and due; a negotiation waiting for an answer; a deal closed this month with commission
// half collected; a collection the customer has opened and hearted; and a viewing request that just came in from a
// public page. Deterministic, written in one statement like the other demos; times are around "now".
// Photographs: free Unsplash photos, credited in apps/system/public/demo/re/credits.json.
import { newId } from '@hemlo/core';
import type { Database } from '@hemlo/db';
import {
  sysSettings, reSettings, reAgent, reOwner, reProperty, reMedia, reLead, reLeadProperty, reCollection, reCollectionItem, reViewing, reFollowup,
  reDeal, reOffer, rePayment, reActivity, reStat, reNotice, sysSequence,
} from '@hemlo/db/schema';
import { insertAll, rng, type Batch } from './demo-data';
import { newSlug, token } from './routes/realestate/common';

type Lang = 'ar' | 'en';
const HOUR = 3600_000, DAY = 24 * HOUR;
const PHOTOS_AT = 'https://system.hemlohq.com';
export const DEMO_AGENCY = { ar: { name: 'الواحة للعقارات', owner: 'سارة كريم' }, en: { name: 'Al-Waha Real Estate', owner: 'Sara Kareem' } };
/** Midnight in Baghdad, n days from today, plus h hours. */
const at = (days: number, h = 0) => { const n = new Date(Date.now() + 3 * HOUR); return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()) - 3 * HOUR + days * DAY + h * HOUR); };
const ymd = (days: number) => new Date(Date.now() + 3 * HOUR + days * DAY).toISOString().slice(0, 10);
// public links are random for every demo (they're unique across Hemlo: many visitors' demos live side by side)

// [key, type, purpose, status, title ar, title en, area, city, price, currency, size, land, beds, baths, floors, parking, year, furnished, condition, features, photos, owner index, days listed, extra]
type P = [string, string, 'sale' | 'rent', string, string, string, string, string, number | null, 'USD' | 'IQD', number | null, number | null, number | null, number | null, number | null, number | null, number | null, string | null, string | null, string[], string[], number, number, { rentPeriod?: string; published?: boolean; views?: number; desc?: [string, string]; lat?: number; lng?: number; exact?: boolean }?];
const NEAR: Record<string, [number, number]> = { 'Dream City': [36.2445, 43.9408], 'English Village': [36.2163, 43.9829], 'Italian Village': [36.2311, 43.9935], 'Empire World': [36.2057, 43.9668],
  Gulan: [36.1985, 44.0073], Ankawa: [36.2316, 43.9962], '100m Street': [36.1781, 44.0292], Kasnazan: [36.2528, 44.1498], Shaqlawa: [36.4052, 44.3218], Zayouna: [33.3204, 44.4532], Mansour: [33.3149, 44.3456] };
const LISTINGS: P[] = [
  ['dream', 'villa', 'sale', 'available', 'فيلا بحديقة في دريم ستي', 'Villa with a garden in Dream City', 'Dream City', 'Erbil', 185000, 'USD', 320, 400, 4, 3, 2, 2, 2019, 'semi', 'excellent',
    ['garden', 'garage', 'generator', 'central_ac', 'title_deed'], ['villa-1', 'living-1', 'kitchen-2', 'bedroom-3', 'bath-3', 'garden-3'], 0, 18,
    { views: 380, lat: 36.2063, lng: 43.9611, desc: ['فيلا عائلية على طابقين في دريم ستي، بحديقة أمامية وكراج لسيارتين. المطبخ مجدّد بالكامل، والصالة واسعة ومضيئة.\n\nأربع غرف نوم، منها غرفة رئيسية بحمّام خاص، وخط مولدة وتكييف مركزي. الطابو صرف وجاهز للتنازل.', 'A two-storey family villa in Dream City with a front garden and a garage for two cars. The kitchen is fully renovated and the living room is wide and bright.\n\nFour bedrooms, including a main bedroom with its own bathroom, a generator line and central air conditioning. Clear title deed, ready to transfer.'] }],
  ['english', 'villa', 'sale', 'negotiating', 'فيلا بمسبح في القرية الإنكليزية', 'Villa with a pool in English Village', 'English Village', 'Erbil', 345000, 'USD', 450, 600, 5, 4, 2, 3, 2016, 'full', 'excellent',
    ['pool', 'garden', 'garage', 'generator', 'central_ac', 'security', 'maid_room', 'gated'], ['villa-5', 'living-2', 'kitchen-1', 'bedroom-1', 'garden-2', 'bath-1'], 1, 34,
    { views: 612, desc: ['فيلا واسعة داخل مجمع القرية الإنكليزية المغلق، بمسبح خاص وحديقة كبيرة. خمس غرف نوم وغرفة خادمة، ومؤثثة بالكامل.', 'A spacious villa inside the gated English Village, with a private pool and a large garden. Five bedrooms and a maid’s room, fully furnished.'] }],
  ['italian', 'villa', 'sale', 'available', 'فيلا حديثة في القرية الإيطالية', 'Modern villa in Italian Village', 'Italian Village', 'Erbil', 265000, 'USD', 380, 450, 4, 4, 3, 2, 2021, 'none', 'new',
    ['garden', 'garage', 'roof', 'solar', 'generator', 'gated'], ['villa-4', 'living-4', 'kitchen-4', 'bedroom-5', 'bath-2'], 2, 9, { views: 205 }],
  ['empire', 'villa', 'sale', 'available', 'فيلا فاخرة في إمباير وورلد', 'Luxury villa in Empire World', 'Empire World', 'Erbil', 520000, 'USD', 600, 750, 6, 6, 3, 4, 2022, 'full', 'new',
    ['pool', 'garden', 'garage', 'elevator', 'central_ac', 'security', 'view', 'gated', 'basement'], ['villa-3', 'living-6', 'kitchen-5', 'bedroom-2', 'bath-1'], 3, 61, { views: 940 }],
  ['zayouna', 'villa', 'sale', 'available', 'بيت فخم في زيونة', 'Large family house in Zayouna', 'Zayouna', 'Baghdad', 410000, 'USD', 300, 300, 4, 3, 2, 2, 2015, 'semi', 'good',
    ['garage', 'generator', 'two_streets', 'title_deed', 'water_tank'], ['villa-6', 'living-5', 'bedroom-4'], 4, 52, { views: 120 }],
  ['gulan', 'villa', 'sale', 'available', 'فيلا جديدة على الخارطة في كولان', 'New-build villa off-plan in Gulan', 'Gulan', 'Erbil', 198000, 'USD', 260, 300, 3, 3, 2, 1, 2027, 'none', 'new',
    ['garden', 'garage', 'solar', 'gated'], ['villa-2', 'villa-8', 'kitchen-3'], 5, 4, { views: 96 }],
  ['ankawa-villa', 'villa', 'rent', 'available', 'فيلا مفروشة للإيجار في عنكاوة', 'Furnished villa for rent in Ankawa', 'Ankawa', 'Erbil', 2200, 'USD', 280, 350, 4, 3, 2, 2, 2018, 'full', 'excellent',
    ['garden', 'garage', 'generator', 'central_ac', 'kitchen'], ['villa-7', 'living-3', 'bedroom-5', 'kitchen-4'], 6, 12, { rentPeriod: 'month', views: 233 }],
  ['empire-flat', 'apartment', 'sale', 'available', 'شقة بإطلالة في إمباير وورلد', 'Apartment with a view in Empire World', 'Empire World', 'Erbil', 165000, 'USD', 180, null, 3, 2, null, 1, 2020, 'semi', 'excellent',
    ['elevator', 'balcony', 'view', 'security', 'generator', 'central_ac'], ['apartment-1', 'flatin-1', 'kitchen-2', 'bedroom-4', 'bath-2'], 7, 23, { views: 310 }],
  ['ankawa-flat', 'apartment', 'rent', 'available', 'شقة للإيجار في عنكاوة', 'Apartment for rent in Ankawa', 'Ankawa', 'Erbil', 750, 'USD', 120, null, 2, 1, null, 1, 2017, 'full', 'good',
    ['elevator', 'balcony', 'generator'], ['apartment-3', 'flatin-3', 'bedroom-1'], 6, 6, { rentPeriod: 'month', views: 148 }],
  ['mansour-flat', 'apartment', 'sale', 'available', 'شقة واسعة في المنصور', 'Spacious apartment in Mansour', 'Mansour', 'Baghdad', 240000, 'USD', 210, null, 3, 2, null, 1, 2019, 'none', 'excellent',
    ['elevator', 'generator', 'security', 'balcony'], ['apartment-4', 'flatin-4', 'kitchen-1'], 4, 15, { views: 176 }],
  ['office', 'office', 'rent', 'available', 'مكتب على شارع 100', 'Office on 100m Street', '100m Street', 'Erbil', 1500, 'USD', 160, null, null, 2, null, 3, 2018, 'none', 'excellent',
    ['elevator', 'main_street', 'generator', 'central_ac'], ['office-2', 'office-3'], 8, 27, { rentPeriod: 'month', views: 84 }],
  ['shop', 'shop', 'sale', 'available', 'محل تجاري على شارع رئيسي في كولان', 'Shop on a main street in Gulan', 'Gulan', 'Erbil', 310000, 'USD', 95, null, null, 1, null, null, 2014, null, 'good',
    ['main_street', 'corner', 'title_deed'], ['shop-1'], 8, 44, { views: 66 }],
  ['dream-land', 'land', 'sale', 'available', 'أرض سكنية في توسعة دريم ستي', 'Residential plot in the Dream City extension', 'Dream City', 'Erbil', 120000, 'USD', null, 600, null, null, null, null, null, null, null,
    ['corner', 'title_deed', 'two_streets'], ['land-1'], 2, 30, { views: 142 }],
  ['kasnazan', 'land', 'sale', 'available', 'أرض في كسنزان', 'Land in Kasnazan', 'Kasnazan', 'Erbil', 95000, 'USD', null, 2000, null, null, null, null, null, null, null, ['title_deed'], ['land-3'], 5, 70, { views: 38 }],
  ['farm', 'farm', 'sale', 'available', 'بستان في شقلاوة', 'Orchard in Shaqlawa', 'Shaqlawa', 'Erbil', 260000, 'USD', 120, 10000, 2, 1, 1, 2, 2005, 'semi', 'good', ['water_tank', 'view'], ['farm-1', 'garden-3'], 1, 40, { views: 91 }],
  ['sold', 'villa', 'sale', 'sold', 'فيلا في دريم ستي (بيعت)', 'Villa in Dream City (sold)', 'Dream City', 'Erbil', 178000, 'USD', 300, 360, 4, 3, 2, 2, 2018, 'semi', 'excellent', ['garden', 'garage', 'generator'], ['villa-6', 'living-1', 'kitchen-3'], 0, 46, { views: 455 }],
];
const OWNERS: [string, string, string][] = [
  ['الحاج كمال عزيز', 'Hajji Kamal Aziz', '+9647501112233'], ['د. هيفاء سليم', 'Dr Haifa Saleem', '+9647502223344'], ['آزاد كريم', 'Azad Karim', '+9647503334455'],
  ['شركة إعمار الشمال', 'Imar Al-Shamal Co.', '+9647504445566'], ['أبو علي البغدادي', 'Abu Ali Al-Baghdadi', '+9647705556677'], ['هيوا عمر', 'Hewa Omar', '+9647506667788'],
  ['ماريا يوسف', 'Maria Youssef', '+9647507778899'], ['ريبوار جلال', 'Rebwar Jalal', '+9647508889900'], ['مجموعة الزهراء التجارية', 'Al-Zahraa Trading Group', '+9647509990011'],
];
// [name ar, name en, phone, source, purpose, types, areas, min, max, beds, sizeMin, status, last contact days ago, extra]
type L = [string, string, string, string, 'sale' | 'rent', string[], string[], number | null, number | null, number | null, number | null, string, number, { must?: string[]; notes?: [string, string]; lang?: Lang; consent?: boolean }?];
const LEADS: L[] = [
  ['أحمد صالح', 'Ahmed Saleh', '+9647701234567', 'whatsapp', 'sale', ['villa'], ['Dream City', 'Zawa'], 150000, 220000, 3, 250, 'viewing', 1, { notes: ['يريد الانتقال قبل العام الدراسي. يفضّل حديقة.', 'Wants to move before the school year. Prefers a garden.'], consent: true }],
  ['سارة محمود', 'Sara Mahmoud', '+9647702345678', 'instagram', 'sale', ['apartment'], ['Empire World', 'Dream City'], 120000, 180000, 2, 140, 'active', 3, { must: ['elevator'] }],
  ['عمر الجبوري', 'Omar Al-Jubouri', '+9647703456789', 'referral', 'sale', ['villa'], ['English Village', 'Italian Village'], 250000, 380000, 4, 350, 'negotiating', 0, { must: ['pool'] }],
  ['ليلى حسن', 'Layla Hassan', '+9647704567890', 'website', 'rent', ['apartment', 'villa'], ['Ankawa'], 600, 1000, 2, null, 'new', 0, { lang: 'en' }],
  ['جون ميلر', 'John Miller', '+9647505678901', 'phone', 'rent', ['villa'], ['Ankawa', 'English Village'], 1800, 2600, 3, null, 'active', 5, { lang: 'en', notes: ['Relocating with an oil company; needs it furnished from next month.', 'Relocating with an oil company; needs it furnished from next month.'] }],
  ['زينب عباس', 'Zainab Abbas', '+9647806789012', 'facebook', 'sale', ['apartment'], ['Mansour', 'Yarmouk'], 180000, 260000, 3, 180, 'active', 12],
  ['كاروان أحمد', 'Karwan Ahmed', '+9647507890123', 'walk_in', 'sale', ['land'], ['Dream City', 'Kasnazan'], 80000, 130000, null, null, 'active', 9],
  ['حيدر الكعبي', 'Haidar Al-Kaabi', '+9647708901234', 'ad', 'sale', ['villa'], ['Zayouna', 'Mansour'], 350000, 450000, 4, 280, 'active', 14],
  ['شركة النور للتجارة', 'Al-Noor Trading Co.', '+9647509012345', 'referral', 'rent', ['office'], ['100m Street'], 1000, 2000, null, 120, 'viewing', 2],
  ['ريم سعد', 'Reem Saad', '+9647700123456', 'instagram', 'sale', ['villa', 'house'], ['Gulan', 'Dream City'], 170000, 210000, 3, 240, 'new', 1, { consent: true }],
  ['مصطفى علي', 'Mustafa Ali', '+9647711223344', 'whatsapp', 'sale', ['shop'], ['Gulan', '100m Street'], 250000, 330000, null, null, 'active', 20],
  ['نادية فاضل', 'Nadia Fadhil', '+9647722334455', 'website', 'sale', ['villa'], ['Dream City'], 160000, 200000, 4, 280, 'won', 30],
];

export async function seedDemoRealEstate(tx: Database, org: string, userId: string, memberId: string, lang: Lang, first: Batch[] = [], systemUrl = PHOTOS_AT) {
  const PHOTOS = `${systemUrl.replace(/\/$/, '')}/demo/re/`;
  const L = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const r = rng(20261007);
  const me = memberId;
  const owners = OWNERS.map(([ar, en, phone], i) => ({ id: newId(), organizationId: org, name: L(ar, en), phone, whatsapp: phone, lang: i === 6 ? 'en' : 'ar', agentId: me,
    commission: { kind: 'percent' as const, value: i === 3 ? 150 : 200 }, createdAt: at(-80 + i) }));
  const props: any[] = [], media: any[] = [], stats: any[] = [], activities: any[] = [];
  const byKey: Record<string, any> = {};
  LISTINGS.forEach(([key, type, purpose, status, tAr, tEn, area, city, price, currency, size, land, beds, baths, floors, parking, year, furnished, condition, features, photos, ownerIdx, daysListed, x = {}], i) => {
    const id = newId(), created = at(-daysListed, 10), published = status !== 'draft' && x.published !== false;
    const views = x.views ?? 0;
    const st = { views, wa: Math.round(views * 0.07), calls: Math.round(views * 0.03), shares: Math.round(views * 0.02), qr: Math.round(views * 0.01), requests: Math.round(views * 0.012), favorites: Math.round(views * 0.015) };
    const p = { id, organizationId: org, ref: 4810 + i, slug: newSlug(type), title: L(tAr, tEn), titleEn: tEn, type, purpose, status, publishedAt: published ? new Date(+created + 2 * HOUR) : null,
      price, currency, rentPeriod: x.rentPeriod ?? null, negotiable: true, ownerMin: price && purpose === 'sale' ? Math.round(price * 0.93 / 1000) * 1000 : null, city: L(city === 'Erbil' ? 'أربيل' : city === 'Baghdad' ? 'بغداد' : city, city), area,
      lat: x.lat ?? (NEAR[area] ? NEAR[area][0] + (r() - .5) * .01 : null), lng: x.lng ?? (NEAR[area] ? NEAR[area][1] + (r() - .5) * .012 : null), showExact: !!x.exact, size, land, bedrooms: beds, bathrooms: baths, floors, parking, yearBuilt: year, furnished, condition, features,
      description: x.desc ? { ar: x.desc[0], en: x.desc[1] } : {}, ownerId: owners[ownerIdx].id, agentId: me, stats: st, createdAt: created, updatedAt: at(-Math.min(daysListed, 3)), statusAt: status === 'sold' ? at(-6, 12) : created };
    props.push(p); byKey[key] = p;
    photos.forEach((ph, k) => media.push({ id: newId(), organizationId: org, propertyId: id, url: `${PHOTOS}${ph}.webp`, width: 1400, height: 933, sort: k }));
    (p as any).coverId = media.find((m) => m.propertyId === id)?.id ?? null;
    // a month of daily numbers that add up to the totals (more at the start, as listings are)
    const days = Math.min(30, daysListed);
    for (let dd = 0; dd < days; dd++) {
      const w = (days - dd + 2) / ((days * (days + 5)) / 2);
      stats.push({ organizationId: org, propertyId: id, day: ymd(-dd), views: Math.round(views * w * (0.7 + r() * 0.6)), wa: r() < 0.25 ? 1 : 0, calls: r() < 0.1 ? 1 : 0, requests: r() < 0.05 ? 1 : 0 });
    }
    activities.push({ id: newId(), organizationId: org, kind: 'property.created', propertyId: id, ownerId: p.ownerId, userId, detail: { status: 'available' }, at: created });
    if (published) activities.push({ id: newId(), organizationId: org, kind: 'property.published', propertyId: id, ownerId: p.ownerId, userId, detail: {}, at: new Date(+created + 2 * HOUR) });
  });
  // a price change on the slow Baghdad house, a week ago
  activities.push({ id: newId(), organizationId: org, kind: 'property.price', propertyId: byKey.zayouna.id, ownerId: byKey.zayouna.ownerId, userId, detail: { from: 430000, to: 410000, currency: 'USD' }, at: at(-7, 11) });

  const leads = LEADS.map(([ar, en, phone, source, purpose, types, areas, min, max, beds, sizeMin, status, contactAgo, x = {}], i) => ({
    id: newId(), organizationId: org, name: L(ar, en), phone, whatsapp: phone, lang: x.lang ?? lang, purpose, source, status, agentId: me, budgetMin: min, budgetMax: max, currency: 'USD',
    types, areas, city: L('أربيل', 'Erbil'), bedrooms: beds, sizeMin, must: x.must ?? [], notes: x.notes ? L(...x.notes) : null, consent: !!x.consent,
    lastContactAt: at(-contactAgo, 13), createdAt: at(-(contactAgo + 6 + i)), updatedAt: at(-contactAgo, 13),
  }));
  const lead = (name: string) => leads.find((l) => l.name === name || LEADS[leads.indexOf(l)][1] === name)!;
  const ahmed = lead('Ahmed Saleh'), sara = lead('Sara Mahmoud'), omar = lead('Omar Al-Jubouri'), layla = lead('Layla Hassan'), john = lead('John Miller'), zainab = lead('Zainab Abbas'),
    karwan = lead('Karwan Ahmed'), noor = lead('Al-Noor Trading Co.'), reem = lead('Reem Saad'), nadia = lead('Nadia Fadhil');

  // what was sent to whom, and what they did with it
  const lp: any[] = [];
  const send = (l: any, p: any, status: string, daysAgo: number, opens = 0) => lp.push({ id: newId(), organizationId: org, leadId: l.id, propertyId: p.id, status, sentAt: at(-daysAgo, 12), opens, lastOpenAt: opens ? at(-daysAgo + 0.5, 20) : null, score: null });
  send(ahmed, byKey.dream, 'viewed', 6, 4); send(ahmed, byKey.gulan, 'favorite', 3, 3); send(ahmed, byKey.italian, 'opened', 3, 1);
  send(sara, byKey['empire-flat'], 'opened', 4, 2); send(omar, byKey.english, 'viewed', 12, 6); send(omar, byKey.italian, 'opened', 12, 1);
  send(john, byKey['ankawa-villa'], 'viewed', 5, 2); send(zainab, byKey['mansour-flat'], 'sent', 12); send(karwan, byKey['dream-land'], 'opened', 9, 1);
  send(noor, byKey.office, 'viewed', 4, 3); send(reem, byKey.gulan, 'sent', 1); send(nadia, byKey.sold, 'viewed', 20, 5);

  // a collection for Ahmed, opened last night, one home hearted
  const col = { id: newId(), organizationId: org, token: token(10), title: L('مختارات أحمد: فلل بحديقة', 'Ahmed’s selection: villas with a garden'),
    note: L('ثلاث فلل تناسب ما طلبته. الثانية جديدة وبسعر جيد.', 'Three villas that fit what you asked for. The second is new and well priced.'), leadId: ahmed.id, agentId: me, opens: 5, lastOpenAt: at(-1, 22), createdBy: userId, createdAt: at(-3, 12) };
  const colItems = [byKey.dream, byKey.gulan, byKey.italian].map((p, i) => ({ id: newId(), organizationId: org, collectionId: col.id, propertyId: p.id, sort: i, favorite: i === 1, opens: [2, 3, 1][i] }));

  // viewings: done, today, tomorrow, one requested from the public page just now
  const viewings: any[] = [];
  const view = (p: any, l: any, startsAt: Date | null, status: string, x: Record<string, unknown> = {}) => { const v = { id: newId(), organizationId: org, propertyId: p.id, leadId: l.id, agentId: me, startsAt, minutes: 45, status, source: 'agent', createdBy: userId, createdAt: at(-8), updatedAt: at(-1), ...x }; viewings.push(v); return v; };
  view(byKey.dream, ahmed, at(-6, 17), 'completed', { outcome: 'liked', feedback: L('أعجبته الحديقة، يريد رؤية المطبخ مع زوجته.', 'Loved the garden; wants to see the kitchen again with his wife.') });
  view(byKey.english, omar, at(-11, 16), 'completed', { outcome: 'liked' });
  view(byKey['ankawa-villa'], john, at(-4, 11), 'completed', { outcome: 'maybe', feedback: 'Wants a third bathroom.' });
  view(byKey.office, noor, at(-3, 10), 'completed', { outcome: 'liked' });
  view(byKey.sold, nadia, at(-19, 17), 'completed', { outcome: 'liked' });
  view(byKey.dream, ahmed, at(0, 17), 'confirmed', { notes: L('مع زوجته', 'With his wife') });
  view(byKey['empire-flat'], sara, at(0, 19.5), 'scheduled');
  view(byKey.gulan, reem, at(1, 11), 'scheduled');
  view(byKey['ankawa-flat'], layla, null, 'requested', { source: 'public', preferred: L('غداً مساءً', 'Tomorrow evening'), notes: L('هل يوجد موقف سيارة؟', 'Is there parking?'), createdAt: at(0, 9) });

  // follow-ups: overdue, today, upcoming
  const fu = (l: any, p: any, kind: string, due: Date, note: string) => ({ id: newId(), organizationId: org, leadId: l.id, propertyId: p?.id ?? null, agentId: me, kind, note, dueAt: due, createdBy: userId, createdAt: at(-5) });
  const followups = [
    fu(zainab, byKey['mansour-flat'], 'call', at(-2, 11), L('اسألها عن رأيها بشقة المنصور', 'Ask what she thought of the Mansour apartment')),
    fu(john, byKey['ankawa-villa'], 'send', at(-1, 15), L('أرسل له بدائل بثلاث حمّامات', 'Send alternatives with three bathrooms')),
    fu(ahmed, byKey.dream, 'call', at(0, 12), L('بعد المعاينة الثانية: هل هو جاهز لعرض؟', 'After the second viewing: ready to make an offer?')),
    fu(omar, byKey.english, 'negotiation', at(0, 16), L('ردّ المالك على عرض عمر', 'The owner’s answer to Omar’s offer')),
    fu(karwan, byKey['dream-land'], 'whatsapp', at(2, 11), L('أرسل له خريطة القطعة', 'Send him the plot’s map')),
    fu(sara, byKey['empire-flat'], 'call', at(3, 12), L('بعد معاينة الليلة', 'After tonight’s viewing')),
  ];
  for (const l of leads) { const mine = followups.filter((f) => f.leadId === l.id).map((f) => +f.dueAt); (l as any).nextFollowAt = mine.length ? new Date(Math.min(...mine)) : null; }

  // deals: Omar negotiating the English Village villa (the last word is his), Nadia's closed deal this month
  const omarDeal = { id: newId(), organizationId: org, propertyId: byKey.english.id, leadId: omar.id, ownerId: byKey.english.ownerId, agentId: me, purpose: 'sale', stage: 'negotiation', asking: 345000, currency: 'USD',
    commissionKind: 'percent', commissionValue: 200, agentShare: 4000, createdBy: userId, createdAt: at(-10), updatedAt: at(-1, 18) };
  const nadiaDeal = { id: newId(), organizationId: org, propertyId: byKey.sold.id, leadId: nadia.id, ownerId: byKey.sold.ownerId, agentId: me, purpose: 'sale', stage: 'closed', asking: 185000, agreed: 178000, currency: 'USD',
    commissionKind: 'percent', commissionValue: 200, agentShare: 4000, closedAt: at(-6, 12), createdBy: userId, createdAt: at(-18), updatedAt: at(-6, 12) };
  const johnDeal = { id: newId(), organizationId: org, propertyId: byKey['ankawa-villa'].id, leadId: john.id, ownerId: byKey['ankawa-villa'].ownerId, agentId: me, purpose: 'rent', stage: 'viewing', asking: 2200, currency: 'USD',
    commissionKind: 'fixed', commissionValue: 1100, agentShare: 4000, createdBy: userId, createdAt: at(-5), updatedAt: at(-4) };
  const offers = [
    { id: newId(), organizationId: org, dealId: omarDeal.id, kind: 'asking', amount: 345000, userId, at: at(-10) },
    { id: newId(), organizationId: org, dealId: omarDeal.id, kind: 'offer', amount: 300000, userId, at: at(-8, 14) },
    { id: newId(), organizationId: org, dealId: omarDeal.id, kind: 'counter', amount: 335000, userId, at: at(-5, 12) },
    { id: newId(), organizationId: org, dealId: omarDeal.id, kind: 'offer', amount: 318000, note: L('عرضه الأخير، يدفع نقداً', 'His final offer, paying cash'), userId, at: at(-1, 18) },
    { id: newId(), organizationId: org, dealId: nadiaDeal.id, kind: 'asking', amount: 185000, userId, at: at(-18) },
    { id: newId(), organizationId: org, dealId: nadiaDeal.id, kind: 'offer', amount: 172000, userId, at: at(-14) },
    { id: newId(), organizationId: org, dealId: nadiaDeal.id, kind: 'agreed', amount: 178000, userId, at: at(-9) },
    { id: newId(), organizationId: org, dealId: johnDeal.id, kind: 'asking', amount: 2200, userId, at: at(-5) },
  ];
  const payments = [{ id: newId(), organizationId: org, dealId: nadiaDeal.id, amount: 1780, from: 'owner', paidOn: ymd(-5), userId, note: L('نصف العمولة من المالك', 'The owner’s half'), createdAt: at(-5) }];

  // the timeline's story for the people in it
  const act = (kind: string, refs: Record<string, string | null>, daysAgo: number, detail: Record<string, unknown> = {}, h = 12) => activities.push({ id: newId(), organizationId: org, kind, userId: kind.startsWith('lead.opened') || kind === 'collection.opened' || kind === 'lead.favorite' || kind === 'viewing.requested' ? null : userId, detail, at: at(-daysAgo, h), ...refs });
  for (const l of leads) act('lead.created', { leadId: l.id }, Math.round((Date.now() - +l.createdAt) / DAY), { source: l.source });
  act('lead.sent', { leadId: ahmed.id, propertyId: byKey.dream.id }, 6, { channel: 'whatsapp' }, 11); act('lead.opened', { leadId: ahmed.id, propertyId: byKey.dream.id }, 6, { opens: 1 }, 21);
  act('viewing.completed', { leadId: ahmed.id, propertyId: byKey.dream.id }, 6, { outcome: 'liked' }, 18);
  act('lead.collection', { leadId: ahmed.id }, 3, { title: col.title, count: 3 }); act('collection.opened', { leadId: ahmed.id }, 1, { title: col.title }, 22);
  act('lead.favorite', { leadId: ahmed.id, propertyId: byKey.gulan.id }, 1, {}, 22);
  act('offer.offer', { dealId: omarDeal.id, propertyId: byKey.english.id, leadId: omar.id }, 8, { amount: 300000, currency: 'USD' });
  act('offer.counter', { dealId: omarDeal.id, propertyId: byKey.english.id, leadId: omar.id }, 5, { amount: 335000, currency: 'USD' });
  act('offer.offer', { dealId: omarDeal.id, propertyId: byKey.english.id, leadId: omar.id }, 1, { amount: 318000, currency: 'USD' }, 18);
  act('deal.stage', { dealId: nadiaDeal.id, propertyId: byKey.sold.id, leadId: nadia.id }, 6, { from: 'reserved', to: 'closed' });
  act('property.status', { propertyId: byKey.sold.id }, 6, { from: 'reserved', to: 'sold' });
  act('commission.paid', { dealId: nadiaDeal.id, propertyId: byKey.sold.id }, 5, { amount: 1780, from: 'owner', currency: 'USD' });
  act('viewing.requested', { leadId: layla.id, propertyId: byKey['ankawa-flat'].id }, 0, { preferred: 'Tomorrow evening' }, 9);

  const notices = [
    { id: newId(), organizationId: org, kind: 'request', agentId: me, leadId: layla.id, propertyId: byKey['ankawa-flat'].id, viewingId: viewings[viewings.length - 1].id, detail: { name: layla.name, ref: byKey['ankawa-flat'].ref, title: byKey['ankawa-flat'].title }, createdAt: at(0, 9) },
    { id: newId(), organizationId: org, kind: 'match', agentId: me, propertyId: byKey.gulan.id, detail: { leads: 2, ref: byKey.gulan.ref, title: byKey.gulan.title }, createdAt: at(-4, 10) },
    { id: newId(), organizationId: org, kind: 'offer', agentId: me, dealId: omarDeal.id, propertyId: byKey.english.id, detail: { amount: 318000, currency: 'USD' }, createdAt: at(-1, 18) },
  ];

  await insertAll(tx, [
    ...first,
    [sysSettings, [{ organizationId: org }]],
    [reSettings, [{ organizationId: org, phone: '+9647501234567', whatsapp: '+9647501234567', email: 'hello@alwaha.example', city: L('أربيل', 'Erbil'), currency: 'USD', usdRate: 1450, defaultCommission: 200,
      about: { ar: 'مكتب عقاري في أربيل منذ 2012: بيع وإيجار الفلل والشقق والأراضي.', en: 'An Erbil property agency since 2012: villas, apartments and land, for sale and rent.' } }]],
    [reAgent, [{ memberId: me, organizationId: org, userId, name: DEMO_AGENCY[lang].owner, phone: '+9647501234567', whatsapp: '+9647501234567', title: L('مديرة المكتب', 'Managing agent'), agentShare: 4000 }]],
    [reOwner, owners], [reProperty, props], [reMedia, media], [reLead, leads], [reLeadProperty, lp], [reCollection, [col]], [reCollectionItem, colItems],
    [reViewing, viewings], [reFollowup, followups], [reDeal, [omarDeal, nadiaDeal, johnDeal]], [reOffer, offers], [rePayment, payments],
    [reActivity, activities], [reStat, stats], [reNotice, notices],
    [sysSequence, [{ organizationId: org, name: 're_property', value: 4810 + LISTINGS.length }]],
  ]);
  return { listings: props.length, leads: leads.length };
}
