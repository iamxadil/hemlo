// The real estate website ("estate"): a storefront for homes. It reads like a good shop: a floating glass header, the
// search first, categories with photographs, product cards you can save, a filter bar with sorting, and a property page
// laid out like a product page (gallery, a sticky box with the price and the actions, specs, similar homes).
// Built on shadcn/ui's design language (its tokens, Button, Badge, Card, Input, Select, Tabs, Sheet, Separator),
// written as plain HTML and CSS because a customer's site is rendered at the edge with no framework: one request, no
// hydration, instant on a phone. Type is Poppins with Vazirmatn for Arabic, served from the site's own address.
import type { WebSection, WebTheme } from '@hemlo/db/schema';
import type { WebsiteListing, WebsiteProperty } from './adapters';
import { W, pick, esc, attr, icon, fill, waHref, telHref, sectionHeading, type Lang } from './theme';
import { initials, paras, field, STATUS, LINE, langQ, pageHref, propHref, listQ, type Ctx, type Two } from './context';
import { typeName, featureName } from '../realestate/common';
import { hwBadge, hwEmblem, HW_BADGE_CSS } from './badge';

// ---------- words ----------
const E = {
  ar: {
    saved: 'المحفوظة', savedTitle: 'العقارات المحفوظة', savedEmpty: 'اضغط على القلب في أي عقار ليبقى هنا.', save: 'حفظ', savedOne: 'محفوظ', remove: 'إزالة',
    menu: 'القائمة', homesNow: '{n} عقاراً متاحاً الآن', homesOne: 'عقار واحد متاح الآن', browse: 'تصفّح العقارات', viewAll: 'عرض الكل',
    catsEyebrow: 'تصفّح', catsTitle: 'اختر ما يناسبك', latestEyebrow: 'جديد في السوق', latestTitle: 'أحدث العقارات', all: 'الكل', sale: 'للبيع', rent: 'للإيجار',
    homesN: '{n} عقار', type: 'النوع', anyType: 'كل الأنواع', where: 'أين', wherePh: 'المنطقة أو المدينة', search: 'ابحث', buy: 'شراء', lease: 'إيجار',
    stHomes: 'عقار متاح', stSale: 'للبيع', stRent: 'للإيجار', stAreas: 'منطقة نغطيها', aboutEyebrow: 'عن المكتب',
    contactEyebrow: 'تواصل', pageTitle: 'العقارات', home: 'الرئيسية', sort: 'الترتيب', sortNew: 'الأحدث', sortAsc: 'السعر: من الأقل', sortDesc: 'السعر: من الأعلى',
    clear: 'مسح الكل', more: 'خيارات أكثر', keyword: 'كلمة', currency: 'العملة', any: 'الكل', min: 'السعر من', max: 'السعر إلى',
    noneTitle: 'لا توجد عقارات تطابق بحثك', noneSub: 'جرّب خيارات أقل، أو أخبرنا عمّا تبحث عنه.', isNew: 'جديد',
    book: 'احجز معاينة', listedBy: 'يعرضه', overview: 'نظرة عامة', details: 'التفاصيل', location: 'الموقع', similar: 'قد يعجبك أيضاً', share: 'مشاركة', copied: 'تم نسخ الرابط',
    fType: 'النوع', fPurpose: 'الغرض', fSize: 'المساحة', fLand: 'الأرض', fBeds: 'غرف النوم', fBaths: 'الحمّامات', fFloors: 'الطوابق', fParking: 'موقف سيارات', fYear: 'سنة البناء',
    explore: 'تصفّح', contact: 'تواصل', haveHome: 'تبحث عن بيت؟', haveHomeSub: 'أخبرنا بما تريد، ونرسل لك ما يناسبك.',
    sample: 'موقع نموذجي', sampleLine: 'هكذا يبدو موقع Hemlo لمكتب عقارات. الأسماء والأسعار تجريبية.', sampleGet: 'احصل على Hemlo Website',
  },
  en: {
    saved: 'Saved', savedTitle: 'Saved homes', savedEmpty: 'Tap the heart on any home to keep it here.', save: 'Save', savedOne: 'Saved', remove: 'Remove',
    menu: 'Menu', homesNow: '{n} homes available now', homesOne: 'One home available now', browse: 'Browse properties', viewAll: 'View all',
    catsEyebrow: 'Browse', catsTitle: 'Find your kind of place', latestEyebrow: 'New on the market', latestTitle: 'Latest homes', all: 'All', sale: 'For sale', rent: 'For rent',
    homesN: '{n} homes', type: 'Type', anyType: 'Any type', where: 'Where', wherePh: 'Area or city', search: 'Search', buy: 'Buy', lease: 'Rent',
    stHomes: 'homes available', stSale: 'for sale', stRent: 'for rent', stAreas: 'areas we cover', aboutEyebrow: 'The office',
    contactEyebrow: 'Contact', pageTitle: 'Properties', home: 'Home', sort: 'Sort', sortNew: 'Newest', sortAsc: 'Price: low to high', sortDesc: 'Price: high to low',
    clear: 'Clear all', more: 'More filters', keyword: 'Keyword', currency: 'Currency', any: 'Any', min: 'Min price', max: 'Max price',
    noneTitle: 'No homes match your search', noneSub: 'Try fewer filters, or tell us what you are looking for.', isNew: 'New',
    book: 'Book a viewing', listedBy: 'Listed by', overview: 'Overview', details: 'Details', location: 'Location', similar: 'You may also like', share: 'Share', copied: 'Link copied',
    fType: 'Type', fPurpose: 'Purpose', fSize: 'Size', fLand: 'Land', fBeds: 'Bedrooms', fBaths: 'Bathrooms', fFloors: 'Floors', fParking: 'Parking', fYear: 'Year built',
    explore: 'Explore', contact: 'Contact', haveHome: 'Looking for a home?', haveHomeSub: 'Tell us what you want and we’ll send you what fits.',
    sample: 'Sample site', sampleLine: 'This is how a Hemlo Website looks for a real estate office. Names and prices are made up.', sampleGet: 'Get Hemlo Website',
  },
} as const;
const PLURAL: Record<Lang, Record<string, string>> = {
  ar: { apartment: 'شقق', house: 'بيوت', villa: 'فلل', land: 'أراضٍ', office: 'مكاتب', shop: 'محلات', commercial: 'عقارات تجارية', building: 'عمارات', warehouse: 'مخازن', farm: 'بساتين ومزارع' },
  en: { apartment: 'Apartments', house: 'Houses', villa: 'Villas', land: 'Land', office: 'Offices', shop: 'Shops', commercial: 'Commercial', building: 'Buildings', warehouse: 'Warehouses', farm: 'Farms & orchards' },
};
const ALL_TYPES = ['apartment', 'house', 'villa', 'land', 'office', 'shop', 'commercial', 'building', 'warehouse', 'farm'];

// ---------- icons (lucide's geometry, drawn at 1.75) ----------
const P: Record<string, string> = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  heart: '<path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7Z"/>',
  menu: '<path d="M4 9h16M4 15h16"/>', x: '<path d="M18 6 6 18M6 6l12 12"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>', chev: '<path d="m9 6 6 6-6 6"/>', chevl: '<path d="m15 6-6 6 6 6"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  bed: '<path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4M12 4v6M2 18h20"/>',
  bath: '<path d="M9 6 6.5 3.5a1.5 1.5 0 0 0-1-.5C4.7 3 4 3.7 4 4.5V17a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5M2 12h20M7 19v2M17 19v2"/>',
  size: '<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>',
  land: '<path d="M2 20h20M5 20l4-9 3 5 3-3 4 7"/><circle cx="17" cy="6" r="2"/>',
  layers: '<path d="m12 3 9 4.5-9 4.5-9-4.5Z"/><path d="m3 12 9 4.5 9-4.5M3 16.5 12 21l9-4.5"/>',
  car: '<path d="M5 17h14M3 13l2-5.5A2 2 0 0 1 6.9 6h10.2A2 2 0 0 1 19 7.5L21 13v4H3Z"/><circle cx="7.5" cy="13.5" r=".6"/><circle cx="16.5" cy="13.5" r=".6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1Z"/>',
  tag: '<path d="M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4Z"/><circle cx="7.5" cy="7.5" r="1.2"/>',
  cal: '<path d="M8 2v4M16 2v4M3 10h18"/><rect x="3" y="4" width="18" height="18" rx="2"/>', share: '<path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7M16 6l-4-4-4 4M12 2v13"/>',
  check: '<path d="M20 6 9 17l-5-5"/>', mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 6-10 7L2 6"/>', grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
};
const ic = (n: string, cls = 'i') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] ?? ''}</svg>`;
const defaultLang = (ctx: Ctx) => (ctx.site.lang === 'en' ? 'en' : 'ar');
const waFor = (ctx: Ctx, what: string, url = ctx.origin + '/') => (ctx.contact.whatsapp ? waHref(ctx.contact.whatsapp, fill(ctx.t.waHello, { what, url })) : null);
/** "$750 / month" → the amount large, the period small. */
const priceHtml = (price: string) => { const [v, per] = price.split(' / '); return `<bdi class="num">${esc(v)}</bdi>${per ? `<small> / ${esc(per)}</small>` : ''}`; };
const brandMark = (ctx: Ctx) => (ctx.logo ? `<img src="${attr(ctx.logo)}" alt="" width="32" height="32">` : `<span class="mono">${esc(initials(ctx.name))}</span>`);
const where = (l: { area: string | null; city: string | null }) => [l.area, l.city].filter(Boolean).join(' · ');

// ---------- the product card ----------
export function estateCard(ctx: Ctx, l: WebsiteListing, i: number) {
  const e = E[ctx.lang], held = l.status === 'reserved' || l.status === 'negotiating';
  const href = propHref(ctx, l.slug);
  const save = JSON.stringify({ slug: l.slug, title: l.title, price: l.price, cover: l.cover, href, where: where(l) });
  const facts = [l.bedrooms ? `<span>${ic('bed')}${l.bedrooms}</span>` : '', l.bathrooms ? `<span>${ic('bath')}${l.bathrooms}</span>` : '', l.size ? `<span>${ic('size')}${fill(ctx.t.sqm, { n: l.size })}</span>` : ''].join('');
  return `<article class="ecard" data-purpose="${attr(l.purpose)}">
<div class="ecard-media">${l.cover ? `<img src="${attr(l.cover)}" alt="" loading="${i < 4 ? 'eager' : 'lazy'}" decoding="async" style="view-transition-name:p-${attr(l.slug)}">` : `<span class="ecard-ph">${ic('home')}</span>`}
<div class="ecard-tags"><span class="ebadge">${esc(l.purpose === 'rent' ? ctx.t.forRent : ctx.t.forSale)}</span>${held ? `<span class="ebadge warn">${esc(STATUS[ctx.lang][l.status])}</span>` : l.fresh ? `<span class="ebadge new">${esc(e.isNew)}</span>` : ''}</div>
<button class="esave" type="button" data-save="${attr(save)}" aria-pressed="false" aria-label="${attr(e.save)}">${ic('heart')}</button></div>
<div class="ecard-body"><p class="ecard-price">${priceHtml(l.price)}</p><h3 class="ecard-title"><a class="ecard-link" href="${attr(href)}">${esc(l.title)}</a></h3>
<p class="ecard-where">${ic('pin')}<span>${esc(where(l))}</span><span class="ecard-type">${esc(typeName(l.type, ctx.lang))}</span></p>${facts ? `<div class="ecard-facts">${facts}</div>` : ''}</div></article>`;
}

// ---------- the search: buy or rent, what kind, where ----------
function search(ctx: Ctx, onPage: boolean) {
  const e = E[ctx.lang], f = ctx.filters, ls = ctx.listings;
  const types = onPage ? ALL_TYPES : [...new Set(ls.map((l) => l.type))];
  const places = [...new Set(ls.flatMap((l) => [l.area, l.city]).filter(Boolean) as string[])].slice(0, 30);
  const tabs = ([['', e.all], ['sale', e.buy], ['rent', e.lease]] as const)
    .map(([k, label]) => `<label><input type="radio" name="purpose" value="${k}"${(f.purpose ?? '') === k ? ' checked' : ''}><span>${esc(label)}</span></label>`).join('');
  const lang = ctx.lang !== defaultLang(ctx) ? `<input type="hidden" name="lang" value="${ctx.lang}">` : '';
  const opened = !!(f.currency || f.min != null || f.max != null || f.q);
  const more = onPage ? `<details class="emore"${opened ? ' open' : ''}><summary>${ic('grid')}${esc(e.more)}</summary><div class="emore-b">
<label class="efield"><small>${esc(e.keyword)}</small><input name="q" value="${attr(f.q ?? '')}" maxlength="80"></label>
<label class="efield"><small>${esc(e.currency)}</small><select name="currency"><option value="">${esc(e.any)}</option>${['USD', 'IQD'].map((c) => `<option${f.currency === c ? ' selected' : ''}>${c}</option>`).join('')}</select></label>
<label class="efield"><small>${esc(e.min)}</small><input name="min" type="number" inputmode="numeric" value="${attr(String(f.min ?? ''))}"></label>
<label class="efield"><small>${esc(e.max)}</small><input name="max" type="number" inputmode="numeric" value="${attr(String(f.max ?? ''))}"></label></div></details>` : '';
  return `<form class="esearch${onPage ? ' on-page' : ''}" id="esf" method="get" action="${attr(ctx.basePath)}/properties" role="search">${lang}
<fieldset class="etabs">${tabs}</fieldset>
<div class="row2"><label class="efield"><small>${esc(e.type)}</small><select name="type"><option value="">${esc(e.anyType)}</option>${types.map((k) => `<option value="${attr(k)}"${f.type === k ? ' selected' : ''}>${esc(typeName(k, ctx.lang))}</option>`).join('')}</select></label>
<label class="efield"><small>${esc(e.where)}</small><input name="where" list="eplaces" value="${attr(f.place ?? f.area ?? f.city ?? '')}" placeholder="${attr(e.wherePh)}" maxlength="80" autocomplete="off"><datalist id="eplaces">${places.map((x) => `<option value="${attr(x)}">`).join('')}</datalist></label></div>
<button class="ebtn ebtn-accent ebtn-lg go" type="submit">${ic('search')}<span>${esc(e.search)}</span></button>${more}</form>`;
}

// ---------- sections ----------
function hero(ctx: Ctx, sec: WebSection) {
  const e = E[ctx.lang], t = ctx.t, lang = ctx.lang;
  const title = pick((sec as any).title as Two, lang) || ctx.name, text = field(sec, 'text', lang) || ctx.tagline;
  const own = typeof (sec as any).image === 'string' && /^https:\/\//.test((sec as any).image) ? (sec as any).image as string : null;
  const img = own ?? ctx.listings.find((l) => l.cover)?.cover ?? null;
  const n = ctx.listings.length, cities = [...new Set(ctx.listings.map((l) => l.city).filter(Boolean))].slice(0, 3).join(' · ');
  const chip = n ? `<span class="echip"><i></i>${esc(n === 1 ? e.homesOne : fill(e.homesNow, { n }))}${cities ? `<span class="sep"></span>${esc(cities)}` : ''}</span>` : '';
  const wa = waFor(ctx, ctx.name);
  return `<section class="ehero${img ? '' : ' no-photo'}"><div class="ewrap"><div class="ehero-card">${img ? `<img src="${attr(img)}" alt="" fetchpriority="high" decoding="async">` : ''}
<div class="ehero-body">${chip}<h1 class="display">${esc(title)}</h1>${text ? `<p class="lead">${esc(text)}</p>` : ''}
<div class="ehero-cta">${n ? `<a class="ebtn ebtn-light ebtn-lg" href="${attr(listQ(ctx))}">${esc(e.browse)}${ic('arrow', 'i dir')}</a>` : ''}${wa ? `<a class="ebtn ebtn-glass ebtn-lg" href="${attr(wa)}" rel="noopener">${icon('wa', 'i')}${t.whatsapp}</a>` : ''}</div></div></div>
${n ? search(ctx, false) : ''}</div></section>`;
}

function shelf(ctx: Ctx) {
  const e = E[ctx.lang], ls = ctx.listings;
  if (!ls.length) return '';
  const counts = new Map<string, { n: number; cover: string | null }>();
  for (const l of ls) { const c = counts.get(l.type) ?? { n: 0, cover: null }; c.n++; c.cover ??= l.cover; counts.set(l.type, c); }
  const cats = [...counts].sort((a, b) => b[1].n - a[1].n);
  const rail = cats.length > 1 ? `<section class="esec"><div class="ewrap"><div class="ehead"><div><p class="eeyebrow">${esc(e.catsEyebrow)}</p><h2 class="eh2">${esc(e.catsTitle)}</h2></div><a class="elink" href="${attr(listQ(ctx))}">${esc(e.viewAll)}${ic('arrow', 'i dir')}</a></div>
<div class="ecats">${cats.map(([k, c]) => `<a class="ecat" href="${attr(listQ(ctx, { type: k }))}">${c.cover ? `<img src="${attr(c.cover)}" alt="" loading="lazy" decoding="async">` : ''}<span class="ecat-t"><span><b>${esc(PLURAL[ctx.lang][k] ?? typeName(k, ctx.lang))}</b><small>${esc(fill(e.homesN, { n: c.n }))}</small></span><span class="ecat-go">${ic('arrow', 'i dir')}</span></span></a>`).join('')}</div></div></section>` : '';
  const shown = ls.slice(0, 8), both = shown.some((l) => l.purpose === 'sale') && shown.some((l) => l.purpose === 'rent');
  const toggle = both ? `<div class="etoggle" role="group">${([['', e.all], ['sale', e.sale], ['rent', e.rent]] as const).map(([k, label], i) => `<button type="button" data-show="${k}" aria-pressed="${i === 0}">${esc(label)}</button>`).join('')}</div>` : '';
  return `${rail}<section class="esec" data-shelf><div class="ewrap"><div class="ehead"><div><p class="eeyebrow">${esc(e.latestEyebrow)}</p><h2 class="eh2">${esc(e.latestTitle)}</h2></div><div class="ehead-r">${toggle}<a class="elink" href="${attr(listQ(ctx))}">${esc(e.viewAll)} <span class="num">(${ls.length})</span>${ic('arrow', 'i dir')}</a></div></div>
<div class="egrid">${shown.map((l, i) => estateCard(ctx, l, i)).join('')}</div></div></section>`;
}

function listingsPage(ctx: Ctx) {
  const e = E[ctx.lang], f = ctx.filters, ls = ctx.listings;
  const chips: string[] = [];
  const drop = (keys: string[]) => { const q: Record<string, string> = {}; for (const [k, v] of Object.entries({ purpose: f.purpose, type: f.type, where: f.place ?? f.area ?? f.city, q: f.q, currency: f.currency, min: f.min, max: f.max, sort: f.sort })) if (v != null && v !== '' && !keys.includes(k)) q[k] = String(v); return listQ(ctx, q); };
  const chip = (label: string, keys: string[]) => chips.push(`<span class="efilter">${esc(label)}<a href="${attr(drop(keys))}" aria-label="${attr(e.remove)}">${ic('x')}</a></span>`);
  if (f.purpose) chip(f.purpose === 'rent' ? ctx.t.forRent : ctx.t.forSale, ['purpose']);
  if (f.type) chip(PLURAL[ctx.lang][f.type] ?? typeName(f.type, ctx.lang), ['type']);
  if (f.place ?? f.area ?? f.city) chip(String(f.place ?? f.area ?? f.city), ['where']);
  if (f.q) chip(`“${f.q}”`, ['q']);
  if (f.currency || f.min != null || f.max != null) chip([f.currency, f.min != null ? `≥ ${f.min}` : '', f.max != null ? `≤ ${f.max}` : ''].filter(Boolean).join(' '), ['currency', 'min', 'max']);
  const sort = `<label class="esort">${esc(e.sort)}<select name="sort" form="esf" data-autosubmit>${([['', e.sortNew], ['price-asc', e.sortAsc], ['price-desc', e.sortDesc]] as const).map(([k, label]) => `<option value="${k}"${(f.sort ?? '') === k ? ' selected' : ''}>${esc(label)}</option>`).join('')}</select></label>`;
  const body = ls.length ? `<div class="egrid">${ls.map((l, i) => estateCard(ctx, l, i)).join('')}</div>`
    : `<div class="eempty">${ic('search', 'i lg')}<h2>${esc(e.noneTitle)}</h2><p>${esc(e.noneSub)}</p><div class="eempty-a"><a class="ebtn ebtn-outline" href="${attr(listQ(ctx))}">${esc(e.clear)}</a>${ctx.contact.whatsapp ? `<a class="ebtn ebtn-wa" href="${attr(waFor(ctx, e.pageTitle)!)}" rel="noopener">${icon('wa', 'i')}${ctx.t.whatsapp}</a>` : ''}</div></div>`;
  return `<section class="epage"><div class="ewrap"><nav class="ecrumb" aria-label="breadcrumb"><a href="${attr(pageHref(ctx, ''))}">${esc(e.home)}</a>${ic('chev', 'i dir')}<span>${esc(e.pageTitle)}</span></nav>
<div class="epage-head"><h1 class="eh1">${esc(e.pageTitle)}</h1><p class="emuted num">${esc(fill(ctx.t.results, { n: ls.length }))}</p></div>
${search(ctx, true)}<div class="etoolbar"><div class="efilters">${chips.join('')}${chips.length ? `<a class="elink sm" href="${attr(listQ(ctx))}">${esc(e.clear)}</a>` : ''}</div>${sort}</div>${body}</div></section>`;
}

function about(ctx: Ctx, sec: WebSection) {
  const e = E[ctx.lang], lang = ctx.lang, ls = ctx.listings;
  const body = field(sec, 'text', lang) || field(sec, 'body', lang) || pick(ctx.site.about, lang);
  if (!body) return '';
  const label = sectionHeading('about', undefined, lang), own = pick(sec.title as Two, lang);
  const heading = own && own !== label && !['About us', 'من نحن'].includes(own) ? own : LINE[lang].about;
  const pic = ls.find((l, i) => i > 0 && l.cover)?.cover ?? ls[0]?.cover ?? null;
  const areas = new Set(ls.map((l) => l.area || l.city).filter(Boolean)).size;
  const stats = ls.length > 1 ? [[ls.length, e.stHomes], [ls.filter((l) => l.purpose === 'sale').length, e.stSale], [ls.filter((l) => l.purpose === 'rent').length, e.stRent], [areas, e.stAreas]]
    .filter(([n]) => n).map(([n, l]) => `<div class="estat"><b class="num">${n}</b><span>${esc(String(l))}</span></div>`).join('') : '';
  return `<section class="esec"><div class="ewrap"><div class="eabout">${pic ? `<figure><img src="${attr(pic)}" alt="" loading="lazy" decoding="async"></figure>` : ''}
<div class="eabout-b"><p class="eeyebrow">${esc(e.aboutEyebrow)}</p><h2 class="eh2">${esc(heading)}</h2><div class="eprose">${paras(body)}</div>${stats ? `<div class="estats">${stats}</div>` : ''}</div></div></div></section>`;
}

function contact(ctx: Ctx, sec: WebSection) {
  const e = E[ctx.lang], t = ctx.t, c = ctx.contact, label = sectionHeading('contact', undefined, ctx.lang), own = pick(sec.title as Two, ctx.lang);
  const wa = waFor(ctx, ctx.name), tel = telHref(c.phone);
  const acts = [wa ? `<a class="ebtn ebtn-wa ebtn-lg" href="${attr(wa)}" rel="noopener">${icon('wa', 'i')}${t.whatsapp}</a>` : '', tel ? `<a class="ebtn ebtn-outline ebtn-lg" href="${attr(tel)}">${icon('call', 'i')}${t.call}</a>` : '',
    `<button class="ebtn ebtn-light ebtn-lg" type="button" data-inquire>${t.inquire}</button>`].join('');
  const dl = [c.phone ? `<div><dt>${t.phoneLabel}</dt><dd><bdi class="num">${esc(c.phone)}</bdi></dd></div>` : '', c.email ? `<div><dt>${t.emailLabel}</dt><dd><a href="mailto:${attr(c.email)}">${esc(c.email)}</a></dd></div>` : '',
    c.address ? `<div><dt>${t.whereLabel}</dt><dd>${c.mapUrl && /^https:\/\//.test(c.mapUrl) ? `<a href="${attr(c.mapUrl)}" rel="noopener" target="_blank">${esc(c.address)}</a>` : esc(c.address)}</dd></div>` : ''].join('');
  return `<section class="esec" id="contact"><div class="ewrap"><div class="econtact"><p class="eeyebrow">${esc(e.contactEyebrow)}</p><h2 class="display">${esc(own && own !== label ? own : t.letsTalk)}</h2><p class="lead">${esc(t.replyNote)}</p>
<div class="acts">${acts}</div>${dl ? `<dl>${dl}</dl>` : ''}</div></div></section>`;
}

/** The estate design stages these sections itself; anything else falls back to the shared rendering. */
export function estateSection(ctx: Ctx, sec: WebSection, _first: boolean): string | null {
  switch (sec.type) {
    case 'hero': return hero(ctx, sec);
    case 'listings': return ctx.pageSlug === 'properties' ? listingsPage(ctx) : shelf(ctx);
    case 'about': return about(ctx, sec);
    case 'contact': return contact(ctx, sec);
    default: return null;
  }
}

// ---------- the header, the sheets, the footer, the phone bar ----------
function navItems(ctx: Ctx) {
  const items = ctx.pages.slice(0, 5).map((p) => ({ slug: p.slug, label: pick(p.title, ctx.lang) || p.slug || ctx.t.hero }));
  if (!items.some((p) => p.slug === 'properties')) items.splice(1, 0, { slug: 'properties', label: ctx.t.listings });
  return items;
}
function langSwitch(ctx: Ctx, altHref: string) {
  const other: Lang = ctx.lang === 'ar' ? 'en' : 'ar';
  return `<a class="elang" href="${attr(altHref)}" hreflang="${other}" lang="${other}" aria-label="${other === 'en' ? 'English' : 'العربية'}"><span${ctx.lang === 'en' ? ' class="on"' : ''}>EN</span><span${ctx.lang === 'ar' ? ' class="on"' : ''}>ع</span></a>`;
}
export function estateHeader(ctx: Ctx, current: string, altHref: string) {
  const e = E[ctx.lang], wa = waFor(ctx, ctx.name);
  const links = navItems(ctx).map((p) => `<a href="${attr(pageHref(ctx, p.slug))}"${p.slug === current ? ' aria-current="page"' : ''}>${esc(p.label)}</a>`).join('');
  const sample = ctx.sample ? `<div class="esample">${hwEmblem(18)}<span><b>${esc(e.sample)}</b> · ${esc(e.sampleLine)}</span><a href="https://hemlohq.com/${ctx.lang === 'en' ? 'en/' : ''}systems/#addons">${esc(e.sampleGet)}${ic('arrow', 'i dir')}</a></div>` : '';
  return `${sample}<div id="etop" aria-hidden="true"></div><header class="enav" data-enav><div class="enav-in">
<a class="ebrand" href="${attr(pageHref(ctx, ''))}">${brandMark(ctx)}<span>${esc(ctx.name)}</span></a>
<nav class="elinks" aria-label="${attr(e.menu)}"><span class="epill" aria-hidden="true"></span>${links}</nav>
<div class="eacts">${langSwitch(ctx, altHref)}<button class="eicon" type="button" data-open="esaved" aria-label="${attr(e.savedTitle)}">${ic('heart')}<span class="ecount num" data-saved-count hidden>0</span></button>
${wa ? `<a class="ebtn ebtn-primary ehead-wa" href="${attr(wa)}" rel="noopener">${icon('wa', 'i')}${ctx.t.whatsapp}</a>` : ''}<button class="eicon emenu" type="button" data-open="emenu" aria-label="${attr(e.menu)}">${ic('menu')}</button></div></div></header>`;
}
/** The saved homes and the phone menu: two sheets, shared by every page. */
export function estateChrome(ctx: Ctx, altHref: string) {
  const e = E[ctx.lang], wa = waFor(ctx, ctx.name), tel = telHref(ctx.contact.phone);
  const links = navItems(ctx).map((p) => `<a href="${attr(pageHref(ctx, p.slug))}">${esc(p.label)}${ic('chev', 'i dir')}</a>`).join('');
  return `<dialog id="esaved" class="esheet" aria-label="${attr(e.savedTitle)}"><div class="esheet-h"><b>${esc(e.savedTitle)}</b><button class="eicon" type="button" data-close aria-label="${attr(ctx.t.close)}">${ic('x')}</button></div>
<div class="esheet-b"><div data-saved-list></div><p class="esheet-empty" data-saved-empty>${ic('heart', 'i lg')}<span>${esc(e.savedEmpty)}</span></p></div></dialog>
<dialog id="emenu" class="esheet" aria-label="${attr(e.menu)}"><div class="esheet-h"><a class="ebrand" href="${attr(pageHref(ctx, ''))}">${brandMark(ctx)}<span>${esc(ctx.name)}</span></a><button class="eicon" type="button" data-close aria-label="${attr(ctx.t.close)}">${ic('x')}</button></div>
<div class="esheet-b"><nav class="emenu-links">${links}</nav><div class="emenu-foot">${langSwitch(ctx, altHref)}${wa ? `<a class="ebtn ebtn-wa ebtn-lg eblock" href="${attr(wa)}" rel="noopener">${icon('wa', 'i')}${ctx.t.whatsapp}</a>` : ''}${tel ? `<a class="ebtn ebtn-outline ebtn-lg eblock" href="${attr(tel)}">${icon('call', 'i')}${ctx.t.call}</a>` : ''}</div></div></dialog>`;
}
export function estateFooter(ctx: Ctx) {
  const e = E[ctx.lang], c = ctx.contact, wa = waFor(ctx, ctx.name);
  const links = navItems(ctx).map((p) => `<li><a href="${attr(pageHref(ctx, p.slug))}">${esc(p.label)}</a></li>`).join('');
  const contact = [c.phone ? `<li><a href="${attr(telHref(c.phone)!)}"><bdi class="num">${esc(c.phone)}</bdi></a></li>` : '', c.email ? `<li><a href="mailto:${attr(c.email)}">${esc(c.email)}</a></li>` : '', c.address ? `<li>${esc(c.address)}</li>` : ''].join('');
  return `<footer class="efoot"><div class="ewrap"><div class="efoot-top"><div class="efoot-brand"><a class="ebrand" href="${attr(pageHref(ctx, ''))}">${brandMark(ctx)}<span>${esc(ctx.name)}</span></a>${ctx.tagline ? `<p>${esc(ctx.tagline)}</p>` : ''}</div>
<div><h4>${esc(e.explore)}</h4><ul>${links}</ul></div>${contact ? `<div><h4>${esc(e.contact)}</h4><ul>${contact}</ul></div>` : ''}
<div class="efoot-cta"><h4>${esc(e.haveHome)}</h4><p>${esc(e.haveHomeSub)}</p>${wa ? `<a class="ebtn ebtn-wa" href="${attr(wa)}" rel="noopener">${icon('wa', 'i')}${ctx.t.whatsapp}</a>` : `<button class="ebtn ebtn-primary" type="button" data-inquire>${ctx.t.inquire}</button>`}</div></div>
<div class="efoot-bot"><span>© ${new Date().getFullYear()} ${esc(ctx.name)}</span>${hwBadge(ctx.lang, `https://hemlohq.com/${ctx.lang === 'en' ? 'en/' : ''}systems/#addons`)}</div></div></footer>`;
}
/** On a phone, the two actions that matter stay under the thumb. */
export function estateBar(ctx: Ctx) {
  const wa = waFor(ctx, ctx.name);
  return `<div class="ebar">${wa ? `<a class="ebtn ebtn-wa ebtn-lg" href="${attr(wa)}" rel="noopener">${icon('wa', 'i')}${ctx.t.whatsapp}</a>` : ''}<button class="ebtn ebtn-primary ebtn-lg" type="button" data-inquire>${ctx.t.inquire}</button></div>`;
}

// ---------- the property page: a product page for a home ----------
export function estateProperty(ctx: Ctx, p: WebsiteProperty, similar: WebsiteListing[], canonical: string) {
  const e = E[ctx.lang], t = ctx.t, lang = ctx.lang;
  const unavailable = ['sold', 'rented'].includes(p.status), held = p.status === 'reserved' || p.status === 'negotiating';
  const photos = p.photos;
  const gallery = photos.length ? `<div class="egal"><div class="egal-track" data-gal>${photos.map((x, i) => `<button type="button" data-photo="${attr(x.url)}" aria-label="${attr(x.caption ?? p.title)}"><img src="${attr(x.url)}" alt="${attr(x.caption ?? p.title)}" ${i ? 'loading="lazy"' : `fetchpriority="high" style="view-transition-name:p-${attr(p.slug)}"`} decoding="async"></button>`).join('')}</div>
${photos.length > 1 ? `<button class="egal-nav prev" type="button" data-gal-prev aria-label="${attr(t.prev)}">${ic('chevl', 'i dir')}</button><button class="egal-nav next" type="button" data-gal-next aria-label="${attr(t.next)}">${ic('chev', 'i dir')}</button><span class="egal-n num" data-gal-n>1 / ${photos.length}</span>` : ''}</div>
${photos.length > 1 ? `<div class="egal-thumbs">${photos.map((x, i) => `<button type="button" data-go="${i}"${i ? '' : ' aria-current="true"'} aria-label="${i + 1}"><img src="${attr(x.url)}" alt="" loading="lazy" decoding="async"></button>`).join('')}</div>` : ''}` : '';
  const key = (i: string, v: string | number | null, label: string) => (v == null || v === '' ? '' : `<div class="ekey">${ic(i)}<b>${esc(String(v))}</b><small>${esc(label)}</small></div>`);
  const keys = [key('bed', p.bedrooms, e.fBeds), key('bath', p.bathrooms, e.fBaths), key('size', p.size ? fill(t.sqm, { n: p.size }) : null, e.fSize), key('land', p.land ? fill(t.sqm, { n: p.land }) : null, e.fLand)].filter(Boolean).slice(0, 4).join('');
  const row = (i: string, label: string, v: string | number | null) => (v == null || v === '' ? '' : `<div>${ic(i)}<span><dt>${esc(label)}</dt><dd>${esc(String(v))}</dd></span></div>`);
  const dl = [row('home', e.fType, typeName(p.type, lang)), row('tag', e.fPurpose, p.purpose === 'rent' ? t.forRent : t.forSale), row('size', e.fSize, p.size ? fill(t.sqm, { n: p.size }) : null),
    row('land', e.fLand, p.land ? fill(t.sqm, { n: p.land }) : null), row('bed', e.fBeds, p.bedrooms), row('bath', e.fBaths, p.bathrooms), row('layers', e.fFloors, p.floors),
    row('car', e.fParking, p.parking), row('clock', e.fYear, p.yearBuilt)].join('');
  const wa = ctx.contact.whatsapp ? waHref(ctx.contact.whatsapp, fill(t.waHello, { what: p.title, url: canonical })) : null, tel = telHref(ctx.contact.phone);
  const href = propHref(ctx, p.slug);
  const save = JSON.stringify({ slug: p.slug, title: p.title, price: p.price, cover: photos[0]?.url ?? null, href, where: where(p) });
  const tags = `<div class="ebuy-tags"><span class="ebadge soft">${esc(typeName(p.type, lang))}</span><span class="ebadge soft">${esc(p.purpose === 'rent' ? t.forRent : t.forSale)}</span>${held || unavailable ? `<span class="ebadge warn">${esc(STATUS[lang][p.status] ?? p.status)}</span>` : ''}</div>`;
  const buy = `<aside class="ebuy">${tags}<h1 class="eh1">${esc(p.title)}</h1><p class="ebuy-where">${ic('pin')}${esc(where(p))}</p>
<div class="ebuy-price"><span class="v">${priceHtml(p.price)}</span>${p.negotiable && !unavailable ? `<span class="ebadge soft">${esc(t.negotiable)}</span>` : ''}</div>${keys ? `<div class="ekeys">${keys}</div>` : ''}
${unavailable ? `<p class="eunavail">${esc(t.unavailable)}</p><a class="ebtn ebtn-outline ebtn-lg eblock" href="${attr(listQ(ctx))}">${esc(t.allProperties)}</a>`
    : `<button class="ebtn ebtn-primary ebtn-lg eblock" type="button" data-inquire>${ic('cal')}${esc(e.book)}</button>${wa ? `<a class="ebtn ebtn-wa ebtn-lg eblock" href="${attr(wa)}" rel="noopener">${icon('wa', 'i')}${t.whatsapp}</a>` : ''}`}
<div class="ebuy-row">${tel && !unavailable ? `<a class="ebtn ebtn-outline" href="${attr(tel)}">${icon('call', 'i')}${t.call}</a>` : ''}<button class="ebtn ebtn-outline" type="button" data-save="${attr(save)}" aria-pressed="false">${ic('heart')}<span data-save-label>${esc(e.save)}</span></button><button class="ebtn ebtn-outline" type="button" data-share>${ic('share')}${esc(e.share)}</button></div>
<div class="ebuy-office">${brandMark(ctx)}<span><small>${esc(e.listedBy)}</small><b>${esc(ctx.name)}</b></span></div></aside>`;
  const desc = p.description[lang] ?? p.description[lang === 'ar' ? 'en' : 'ar'];
  const blocks = [desc ? `<section class="eblock"><h2>${esc(e.overview)}</h2><div class="eprose">${paras(desc)}</div></section>` : '',
    dl ? `<section class="eblock"><h2>${esc(e.details)}</h2><dl class="edl">${dl}</dl></section>` : '',
    p.features.length ? `<section class="eblock"><h2>${esc(t.features)}</h2><ul class="efeat">${p.features.map((f) => `<li>${ic('check')}${esc(featureName(f, lang))}</li>`).join('')}</ul></section>` : '',
    p.map || (p.video && /^https:\/\//.test(p.video)) ? `<section class="eblock"><h2>${esc(e.location)}</h2><div class="eblock-a">${p.map ? `<a class="ebtn ebtn-outline" href="https://www.openstreetmap.org/?mlat=${p.map.lat}&mlon=${p.map.lng}#map=16/${p.map.lat}/${p.map.lng}" rel="noopener" target="_blank">${ic('pin')}${esc(t.map)}</a>` : ''}${p.video && /^https:\/\//.test(p.video) ? `<a class="ebtn ebtn-outline" href="${attr(p.video)}" rel="noopener" target="_blank">${esc(t.video)}</a>` : ''}</div></section>` : ''].join('');
  const more = similar.length ? `<section class="esimilar"><div class="ehead"><div><h2 class="eh2">${esc(e.similar)}</h2></div><a class="elink" href="${attr(listQ(ctx, { type: p.type }))}">${esc(e.viewAll)}${ic('arrow', 'i dir')}</a></div><div class="egrid">${similar.map((l, i) => estateCard(ctx, l, i + 4)).join('')}</div></section>` : '';
  const main = `<main class="epdp"><div class="ewrap"><nav class="ecrumb" aria-label="breadcrumb"><a href="${attr(pageHref(ctx, ''))}">${esc(e.home)}</a>${ic('chev', 'i dir')}<a href="${attr(listQ(ctx))}">${esc(e.pageTitle)}</a>${ic('chev', 'i dir')}<span>${esc(p.title)}</span></nav>
<div class="epdp-top"><div class="epdp-gal">${gallery}</div>${buy}<div class="epdp-body">${blocks}</div></div>${more}</div></main>`;
  const bar = unavailable ? '' : `<div class="ebar pdp"><span class="ebar-p">${priceHtml(p.price)}</span>${wa ? `<a class="ebtn ebtn-wa ebtn-lg sq" href="${attr(wa)}" rel="noopener" aria-label="${attr(t.whatsapp)}">${icon('wa', 'i')}</a>` : ''}<button class="ebtn ebtn-primary ebtn-lg" type="button" data-inquire>${esc(e.book)}</button></div>`;
  return { main, bar };
}

// ---------- behaviour: one small script ----------
export const estateScript = (lang: Lang) => {
  const e = E[lang];
  const S = { save: e.save, saved: e.savedOne, remove: e.remove, copied: e.copied, x: ic('x') };
  return `(function(){var S=${JSON.stringify(S).replace(/</g, '\\u003c')},d=document,rtl=d.dir==='rtl';
var nav=d.querySelector('[data-enav]'),top=d.getElementById('etop');if(nav&&top&&'IntersectionObserver' in window)new IntersectionObserver(function(x){nav.classList.toggle('is-stuck',!x[0].isIntersecting)}).observe(top);
var links=d.querySelector('.elinks'),pill=links&&links.querySelector('.epill');if(pill){var cur=links.querySelector('[aria-current]');var place=function(a){if(!a){pill.style.opacity='0';return}pill.style.opacity='1';pill.style.width=a.offsetWidth+'px';pill.style.transform='translateX('+a.offsetLeft+'px)'};
[].forEach.call(links.querySelectorAll('a'),function(a){a.addEventListener('pointerenter',function(){place(a)});a.addEventListener('focus',function(){place(a)})});links.addEventListener('pointerleave',function(){place(cur)});requestAnimationFrame(function(){pill.style.transition='none';place(cur);requestAnimationFrame(function(){pill.style.transition=''})})}
var KEY='hemlo-saved:'+location.host;function load(){try{return JSON.parse(localStorage.getItem(KEY)||'[]')}catch(_){return[]}}var saved=load();
function has(s){return saved.some(function(x){return x.slug===s})}
function render(){var list=d.querySelector('[data-saved-list]'),empty=d.querySelector('[data-saved-empty]');if(!list)return;list.textContent='';empty.hidden=!!saved.length;saved.forEach(function(it){var row=d.createElement('div');row.className='esitem';var a=d.createElement('a');a.href=it.href;var img=d.createElement('img');img.alt='';if(it.cover)img.src=it.cover;var t=d.createElement('span'),b=d.createElement('b'),s=d.createElement('small'),m=d.createElement('em');b.textContent=it.title;s.textContent=it.where||'';m.textContent=it.price;t.append(b,s,m);a.append(img,t);var x=d.createElement('button');x.type='button';x.className='eicon';x.setAttribute('aria-label',S.remove);x.innerHTML=S.x;x.addEventListener('click',function(){toggle(it)});row.append(a,x);list.append(row)})}
function sync(){[].forEach.call(d.querySelectorAll('[data-save]'),function(b){var it;try{it=JSON.parse(b.getAttribute('data-save'))}catch(_){return}var on=has(it.slug);b.setAttribute('aria-pressed',String(on));var l=b.querySelector('[data-save-label]');if(l)l.textContent=on?S.saved:S.save});[].forEach.call(d.querySelectorAll('[data-saved-count]'),function(c){c.textContent=String(saved.length);c.hidden=!saved.length});render()}
function toggle(it){saved=has(it.slug)?saved.filter(function(x){return x.slug!==it.slug}):[it].concat(saved).slice(0,50);try{localStorage.setItem(KEY,JSON.stringify(saved))}catch(_){}sync()}
d.addEventListener('click',function(ev){var t=ev.target;if(!(t instanceof Element))return;var b=t.closest('[data-save]');if(b){ev.preventDefault();ev.stopPropagation();toggle(JSON.parse(b.getAttribute('data-save')));b.classList.remove('pop');void b.offsetWidth;b.classList.add('pop');if(navigator.vibrate)navigator.vibrate(8);return}
var o=t.closest('[data-open]');if(o){var dl=d.getElementById(o.getAttribute('data-open'));if(dl&&dl.showModal){dl.showModal();d.body.classList.add('e-lock')}return}
var c=t.closest('[data-close]');if(c){var p=c.closest('dialog');if(p)p.close();return}
if(t.tagName==='DIALOG'&&t.classList.contains('esheet'))t.close()});
[].forEach.call(d.querySelectorAll('dialog.esheet'),function(x){x.addEventListener('close',function(){d.body.classList.remove('e-lock')})});
[].forEach.call(d.querySelectorAll('#emenu a'),function(a){a.addEventListener('click',function(){var m=d.getElementById('emenu');if(m)m.close()})});
[].forEach.call(d.querySelectorAll('[data-show]'),function(b){b.addEventListener('click',function(){var v=b.getAttribute('data-show'),g=b.closest('[data-shelf]');[].forEach.call(g.querySelectorAll('[data-show]'),function(x){x.setAttribute('aria-pressed',String(x===b))});[].forEach.call(g.querySelectorAll('.ecard'),function(c){c.classList.toggle('is-hidden',!!v&&c.getAttribute('data-purpose')!==v)})})});
var tr=d.querySelector('[data-gal]');if(tr){var n=tr.children.length,cnt=d.querySelector('[data-gal-n]'),th=d.querySelectorAll('[data-go]');var idx=function(){return Math.round(Math.abs(tr.scrollLeft)/tr.clientWidth)};var go=function(i){i=(i+n)%n;tr.scrollTo({left:(rtl?-1:1)*i*tr.clientWidth,behavior:'smooth'})};
tr.addEventListener('scroll',function(){var i=idx();if(cnt)cnt.textContent=(i+1)+' / '+n;[].forEach.call(th,function(x,k){if(k===i)x.setAttribute('aria-current','true');else x.removeAttribute('aria-current')})},{passive:true});
[].forEach.call(th,function(x){x.addEventListener('click',function(){go(+x.getAttribute('data-go'))})});var pv=d.querySelector('[data-gal-prev]'),nx=d.querySelector('[data-gal-next]');if(pv)pv.addEventListener('click',function(){go(idx()-1)});if(nx)nx.addEventListener('click',function(){go(idx()+1)})}
function toast(m){var x=d.createElement('div');x.className='etoast';x.setAttribute('role','status');x.textContent=m;d.body.append(x);setTimeout(function(){x.classList.add('out');setTimeout(function(){x.remove()},400)},1800)}
[].forEach.call(d.querySelectorAll('[data-share]'),function(b){b.addEventListener('click',function(){var u=location.href.split('#')[0];if(navigator.share)navigator.share({title:d.title,url:u}).catch(function(){});else if(navigator.clipboard)navigator.clipboard.writeText(u).then(function(){toast(S.copied)})})});
[].forEach.call(d.querySelectorAll('[data-autosubmit]'),function(s){s.addEventListener('change',function(){var f=s.form;if(f){if(f.requestSubmit)f.requestSubmit();else f.submit()}})});
sync()})();`;
};

// ---------- the look ----------
const LATIN = 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD';
const ARABIC = 'U+0600-06FF, U+0750-077F, U+0870-089F, U+08A0-08FF, U+200C-200E, U+FB50-FDFF, U+FE70-FEFF';
export function estateCss(_theme: WebTheme, fontBase: string) {
  const f = (w: number) => `@font-face{font-family:"Poppins";font-style:normal;font-weight:${w};font-display:swap;src:url(${fontBase}/poppins-${w}.woff2) format("woff2");unicode-range:${LATIN}}`;
  return `${f(400)}${f(500)}${f(600)}@font-face{font-family:"Vazirmatn";font-weight:300 700;font-display:swap;src:url(${fontBase}/vazirmatn.woff2) format("woff2");unicode-range:${ARABIC}}
:root{--bg:#FFFFFF;--surface:#F5F5F4;--card:#FFFFFF;--ink:#0C0A09;--ink2:#44403C;--muted:#78716C;--line:#E7E5E4;--line2:#D6D3D1;--r:12px;--primary:var(--accent);
--text:"Poppins","Vazirmatn",ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;--display:var(--text);--wrap:min(1240px,100% - 32px);
--sh-sm:0 1px 2px rgba(12,10,9,.06);--sh:0 1px 3px rgba(12,10,9,.06),0 10px 30px -14px rgba(12,10,9,.22);--sh-lg:0 30px 70px -28px rgba(12,10,9,.4);--e:cubic-bezier(.23,1,.32,1);--e-sheet:cubic-bezier(.32,.72,0,1)}
html[lang=ar]{--text:"Vazirmatn","Poppins",ui-sans-serif,system-ui,sans-serif}
html[data-dark]{--bg:#0C0A09;--surface:#1C1917;--card:#141210;--ink:#FAFAF9;--ink2:#D6D3D1;--muted:#A8A29E;--line:#292524;--line2:#3A3532}
@media (min-width:768px){:root{--wrap:min(1240px,100% - 64px)}}
body{font-size:15.5px;letter-spacing:-.005em;line-height:1.6;-webkit-tap-highlight-color:transparent}html[lang=ar] body{letter-spacing:0;line-height:1.75}
body.e-lock{overflow:hidden}
:where(button){margin:0;padding:0;border:0;background:none;font:inherit;color:inherit;letter-spacing:inherit}[hidden]{display:none!important}
.display{font-weight:600;letter-spacing:-.04em;line-height:1.03}html[lang=ar] .display{font-weight:700;letter-spacing:0;line-height:1.3}
:focus-visible{outline:2px solid var(--primary);outline-offset:2px;border-radius:8px}
.ewrap{width:var(--wrap);margin-inline:auto}.num{font-variant-numeric:tabular-nums}.emuted{color:var(--muted);margin:0}
.i{width:18px;height:18px;flex:none}.i.lg{width:28px;height:28px}html[dir=rtl] .i.dir{transform:scaleX(-1)}
/* Button (shadcn): default, accent, outline, ghost; WhatsApp in its own green */
.ebtn{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:40px;padding:0 16px;border-radius:10px;border:1px solid transparent;font-size:14px;font-weight:500;line-height:1;white-space:nowrap;cursor:pointer;user-select:none;-webkit-user-select:none;transition:background-color .2s,border-color .2s,color .2s,box-shadow .2s,opacity .2s,transform .16s var(--e)}
.ebtn:active{transform:scale(.97);transition-duration:.08s}.ebtn .i{width:17px;height:17px}
.ebtn-lg{height:48px;padding:0 22px;font-size:15px;border-radius:12px}.ebtn-lg.sq{width:48px;padding:0}.eblock{width:100%}
.ebtn-primary{background:var(--ink);color:var(--bg)}.ebtn-primary:hover{opacity:.88}
.ebtn-accent{background:var(--primary);color:#fff}.ebtn-accent:hover{background:color-mix(in oklab,var(--primary) 88%,#000)}
.ebtn-outline{background:var(--card);border-color:var(--line);color:var(--ink);box-shadow:var(--sh-sm)}.ebtn-outline:hover{background:var(--surface)}
.ebtn-wa{background:#1F9D55;color:#fff}.ebtn-wa:hover{background:#1A8A4A}
.ebtn-light{background:#fff;color:#0C0A09}.ebtn-light:hover{background:#F5F5F4}
.ebtn-glass{background:rgba(255,255,255,.14);border-color:rgba(255,255,255,.3);color:#fff;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)}.ebtn-glass:hover{background:rgba(255,255,255,.22)}
.eicon{position:relative;display:grid;place-items:center;width:40px;height:40px;border-radius:999px;color:var(--ink);transition:background-color .2s,transform .16s var(--e)}.eicon:hover{background:var(--surface)}.eicon:active{transform:scale(.92)}
/* Badge */
.ebadge{display:inline-flex;align-items:center;gap:6px;height:24px;padding:0 9px;border-radius:999px;font-size:12px;font-weight:500;white-space:nowrap;background:rgba(255,255,255,.94);color:#0C0A09;box-shadow:var(--sh-sm)}
.ebadge.new{background:var(--primary);color:#fff}.ebadge.warn{background:#FEF3C7;color:#92400E}.ebadge.soft{background:var(--surface);color:var(--ink2);box-shadow:none}
.eeyebrow{margin:0;font-size:12px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--primary)}html[lang=ar] .eeyebrow{letter-spacing:0;font-size:13.5px}
.eh1{margin:0;font-size:clamp(28px,3.6vw,42px);font-weight:600;letter-spacing:-.035em;line-height:1.1}.eh2{margin:8px 0 0;font-size:clamp(24px,2.8vw,34px);font-weight:600;letter-spacing:-.03em;line-height:1.12}
html[lang=ar] .eh1,html[lang=ar] .eh2{font-weight:700;letter-spacing:0;line-height:1.35}
.ehead{display:flex;flex-wrap:wrap;align-items:end;justify-content:space-between;gap:14px 24px;margin-bottom:26px}.ehead-r{display:flex;flex-wrap:wrap;align-items:center;gap:10px 18px}
.elink{display:inline-flex;align-items:center;gap:6px;font-size:14px;font-weight:500;color:var(--ink);border-radius:8px}.elink .i{width:16px;height:16px;transition:transform .35s var(--e)}.elink:hover .i{transform:translateX(3px)}html[dir=rtl] .elink:hover .i{transform:scaleX(-1) translateX(3px)}
.elink.sm{font-size:13px;color:var(--muted)}
.esec{padding:64px 0}@media (max-width:640px){.esec{padding:48px 0}}
/* the header: a glass capsule that floats over the page */
.esample{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:6px 12px;padding:9px 16px;background:#0E1420;color:#E9E2D1;font-size:13px;text-align:center}.esample b{color:#F1DCA7;font-weight:600}.esample a{display:inline-flex;align-items:center;gap:4px;color:#fff;font-weight:600;text-decoration:underline;text-underline-offset:3px}.esample .i{width:14px;height:14px}
#etop{height:1px}
.enav{position:sticky;top:10px;z-index:40;width:var(--wrap);margin:10px auto 0;border-radius:999px;background:color-mix(in oklab,var(--bg) 74%,transparent);backdrop-filter:blur(24px) saturate(180%);-webkit-backdrop-filter:blur(24px) saturate(180%);box-shadow:inset 0 0 0 1px color-mix(in oklab,var(--ink) 9%,transparent),0 10px 30px -20px rgba(12,10,9,.35);transition:box-shadow .35s var(--e)}
.enav.is-stuck{box-shadow:inset 0 0 0 1px color-mix(in oklab,var(--ink) 11%,transparent),0 18px 44px -20px rgba(12,10,9,.45)}
.enav-in{display:flex;align-items:center;gap:8px;height:60px;padding-inline:16px 8px;transition:height .35s var(--e)}.enav.is-stuck .enav-in{height:54px}
.ebrand{display:flex;align-items:center;gap:10px;min-width:0;font-weight:600;font-size:16px;letter-spacing:-.02em;color:var(--ink)}html[lang=ar] .ebrand{letter-spacing:0}
.ebrand .mono{display:grid;place-items:center;flex:none;width:32px;height:32px;border-radius:9px;background:var(--ink);color:var(--bg);font-size:12.5px;font-weight:600;letter-spacing:0}.ebrand img{flex:none;width:32px;height:32px;border-radius:9px;object-fit:cover}
.ebrand span:last-child{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.elinks{position:relative;display:flex;gap:2px;margin-inline:auto}
.elinks a{position:relative;z-index:1;padding:8px 14px;border-radius:999px;font-size:14px;font-weight:500;color:var(--ink2);transition:color .2s}.elinks a:hover,.elinks a[aria-current]{color:var(--ink)}
.elinks a[aria-current]::after{content:"";position:absolute;bottom:2px;left:50%;width:4px;height:4px;margin-left:-2px;border-radius:50%;background:var(--primary)}
.epill{position:absolute;z-index:0;left:0;top:0;height:100%;width:0;border-radius:999px;background:var(--surface);opacity:0;transition:transform .35s var(--e),width .35s var(--e),opacity .2s}
.eacts{display:flex;align-items:center;gap:4px;margin-inline-start:auto}.elinks+.eacts{margin-inline-start:0}
.elang{display:inline-flex;direction:ltr;padding:3px;margin-inline-end:4px;border-radius:999px;background:var(--surface);font-size:12px;font-weight:600;line-height:1}.elang span{padding:6px 10px;border-radius:999px;color:var(--muted);transition:background-color .2s,color .2s}.elang span.on{background:var(--card);color:var(--ink);box-shadow:var(--sh-sm)}
.ecount{position:absolute;top:3px;inset-inline-end:2px;display:grid;place-items:center;min-width:17px;height:17px;padding:0 4px;border-radius:999px;background:var(--primary);color:#fff;font-size:10.5px;font-weight:600;box-shadow:0 0 0 2px var(--bg)}
.ehead-wa{margin-inline-start:4px;border-radius:999px}.emenu{display:none}
@media (max-width:900px){.elinks,.ehead-wa{display:none}.emenu{display:grid}.enav{border-radius:20px}.enav-in{height:56px;padding-inline:14px 6px}.eacts .elang{display:none}}
/* hero: the house, the name, the search */
.ehero{padding-top:14px}
.ehero-card{position:relative;isolation:isolate;overflow:hidden;display:flex;align-items:flex-end;min-height:clamp(480px,74svh,720px);border-radius:28px;background:#1C1917;color:#fff}
.ehero-card>img{position:absolute;inset:0;z-index:-2;width:100%;height:100%;object-fit:cover;animation:esettle 2.4s var(--e) both}
.ehero-card::after{content:"";position:absolute;inset:0;z-index:-1;background:linear-gradient(180deg,rgba(12,10,9,.1) 25%,rgba(12,10,9,.78)),linear-gradient(var(--side,90deg),rgba(12,10,9,.5),transparent 70%)}html[dir=rtl] .ehero-card{--side:270deg}
.ehero.no-photo .ehero-card{background:radial-gradient(110% 120% at 0% 0%,color-mix(in oklab,var(--primary) 75%,#000),#0C0A09 70%)}
@media (max-width:640px){.ehero-card{min-height:min(560px,68svh);border-radius:24px}.ehero-cta .ebtn-lg{height:46px;padding:0 18px}}
.ehero-body{max-width:780px;padding:clamp(24px,4.5vw,60px);padding-bottom:clamp(84px,9vw,112px)}
.echip{display:inline-flex;align-items:center;gap:9px;min-height:32px;padding:4px 14px;border-radius:999px;font-size:13px;font-weight:500;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.24);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);animation:erise .9s var(--e) both .1s}
.echip i{width:7px;height:7px;border-radius:50%;background:#4ADE80;box-shadow:0 0 0 3px rgba(74,222,128,.25)}.echip .sep{width:1px;height:12px;background:rgba(255,255,255,.35)}
.ehero h1{margin:18px 0 0;font-size:clamp(2.6rem,6.6vw,5.6rem);text-wrap:balance;text-shadow:0 2px 30px rgba(0,0,0,.2);animation:erise 1s var(--e) both .18s}
.ehero .lead{max-width:560px;margin:16px 0 0;font-size:clamp(15.5px,1.7vw,18.5px);line-height:1.6;color:rgba(255,255,255,.86);animation:erise 1s var(--e) both .26s}
.ehero-cta{display:flex;flex-wrap:wrap;gap:10px;margin-top:28px;animation:erise 1s var(--e) both .34s}
@keyframes esettle{from{transform:scale(1.07)}to{transform:none}}@keyframes erise{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
/* the search (Tabs + Select + Input + Button, in one Card) */
.esearch{position:relative;z-index:2;display:grid;gap:8px;width:min(1000px,100% - 24px);margin:-56px auto 0;padding:10px;border-radius:20px;background:var(--card);border:1px solid var(--line);box-shadow:var(--sh-lg);animation:erise 1s var(--e) both .42s}
@media (min-width:880px){.esearch{grid-template-columns:auto minmax(0,1fr) minmax(0,1.3fr) auto;align-items:center}.row2{display:contents}}
@media (max-width:879px){.row2{display:grid;grid-template-columns:1fr 1fr;gap:4px}.esearch .go{width:100%}}
.esearch.on-page{width:100%;margin:0 0 18px;box-shadow:var(--sh);animation:none}
.etabs{display:flex;gap:2px;min-width:0;margin:0;padding:4px;border:0;border-radius:13px;background:var(--surface)}.etabs label{position:relative;flex:1}.etabs input{position:absolute;opacity:0;pointer-events:none}
.etabs span{display:grid;place-items:center;height:42px;padding:0 18px;border-radius:10px;font-size:14px;font-weight:500;white-space:nowrap;color:var(--muted);cursor:pointer;transition:background-color .2s,color .2s,box-shadow .2s}
.etabs input:checked+span{background:var(--card);color:var(--ink);box-shadow:var(--sh-sm)}.etabs input:focus-visible+span{outline:2px solid var(--primary);outline-offset:2px}
.efield{position:relative;display:grid;gap:1px;min-width:0;padding:7px 14px;border-radius:12px;cursor:text;transition:background-color .2s}.efield:hover,.efield:focus-within{background:var(--surface)}
.efield small{font-size:11.5px;font-weight:500;color:var(--muted)}
.efield select,.efield input{width:100%;height:24px;padding:0;border:0;background:transparent;color:var(--ink);font:inherit;font-size:15px;font-weight:500;outline:none;appearance:none;-webkit-appearance:none}.efield input::placeholder{color:var(--muted);font-weight:400}
.efield select{cursor:pointer;padding-inline-end:18px;background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2378716C' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E") no-repeat right center/14px}html[dir=rtl] .efield select{background-position:left center}
@media (min-width:880px){.row2 .efield+.efield::before{content:"";position:absolute;inset-block:12px;inset-inline-start:-4px;width:1px;background:var(--line)}}
.esearch .go{height:54px;padding:0 26px;border-radius:14px}
.emore{grid-column:1/-1}.emore summary{display:inline-flex;align-items:center;gap:6px;padding:6px 8px;border-radius:8px;font-size:13.5px;font-weight:500;color:var(--ink2);cursor:pointer;list-style:none}.emore summary::-webkit-details-marker{display:none}.emore summary .i{width:15px;height:15px}
.emore-b{display:grid;gap:4px;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));padding:4px 0 2px}
/* categories with photographs */
.ecats{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(210px,1fr);gap:14px;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;margin-inline:-4px;padding:4px}.ecats::-webkit-scrollbar{display:none}
@media (max-width:640px){.ecats{grid-auto-columns:64%}}
.ecat{position:relative;isolation:isolate;display:block;aspect-ratio:4/5;overflow:hidden;border-radius:20px;background:var(--surface);color:#fff;scroll-snap-align:start}
.ecat img{position:absolute;inset:0;z-index:-2;width:100%;height:100%;object-fit:cover;transition:transform 1s var(--e)}.ecat::after{content:"";position:absolute;inset:0;z-index:-1;background:linear-gradient(180deg,transparent 45%,rgba(12,10,9,.72))}
.ecat-t{position:absolute;inset-inline:16px;bottom:16px;display:flex;align-items:end;justify-content:space-between;gap:10px}.ecat-t b{display:block;font-size:18px;font-weight:600;letter-spacing:-.02em;line-height:1.2}html[lang=ar] .ecat-t b{letter-spacing:0}.ecat-t small{display:block;margin-top:2px;font-size:12.5px;opacity:.82}
.ecat-go{display:grid;place-items:center;flex:none;width:36px;height:36px;border-radius:999px;background:rgba(255,255,255,.18);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);transition:background-color .25s,color .25s}.ecat-go .i{width:16px;height:16px}
@media (hover:hover) and (pointer:fine){.ecat:hover img{transform:scale(1.06)}.ecat:hover .ecat-go{background:#fff;color:#0C0A09}}
/* product cards (Card) */
.egrid{display:grid;gap:22px 18px;grid-template-columns:repeat(auto-fill,minmax(min(100%,272px),1fr))}
.ecard{position:relative;display:flex;flex-direction:column;overflow:hidden;border-radius:18px;background:var(--card);border:1px solid var(--line);transition:box-shadow .35s var(--e),transform .35s var(--e),border-color .2s}
.ecard.is-hidden{display:none}
@media (max-width:640px){[data-shelf] .egrid,.esimilar .egrid{grid-auto-flow:column;grid-auto-columns:84%;grid-template-columns:none;gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;margin-inline:-16px;padding:2px 16px 6px;scroll-padding-inline:16px}
[data-shelf] .egrid::-webkit-scrollbar,.esimilar .egrid::-webkit-scrollbar{display:none}[data-shelf] .ecard,.esimilar .ecard{scroll-snap-align:start}}
@media (hover:hover) and (pointer:fine){.ecard:hover{transform:translateY(-3px);box-shadow:var(--sh);border-color:var(--line2)}.ecard:hover .ecard-media img{transform:scale(1.05)}}
.ecard-media{position:relative;aspect-ratio:4/3;overflow:hidden;background:var(--surface)}.ecard-media img{width:100%;height:100%;object-fit:cover;transition:transform 1s var(--e)}
.ecard-ph{display:grid;place-items:center;height:100%;color:var(--muted)}
.ecard-tags{position:absolute;top:12px;inset-inline-start:12px;z-index:2;display:flex;gap:6px;pointer-events:none}
.esave{position:absolute;top:10px;inset-inline-end:10px;z-index:3;display:grid;place-items:center;width:38px;height:38px;border-radius:999px;background:rgba(255,255,255,.94);color:#0C0A09;box-shadow:var(--sh-sm);transition:transform .16s var(--e),color .2s}
.esave:active{transform:scale(.86)}.esave .i{width:18px;height:18px}
[data-save][aria-pressed=true]{color:#E11D48}[data-save][aria-pressed=true] .i{fill:currentColor}.pop .i{animation:epop .45s var(--e)}@keyframes epop{40%{transform:scale(1.32)}}
.ecard-body{display:grid;gap:3px;padding:14px 16px 16px}
.ecard-price{margin:0;font-size:19px;font-weight:600;letter-spacing:-.02em}.ecard-price small,.ebuy-price small,.ebar-p small{font-size:.68em;font-weight:500;color:var(--muted);letter-spacing:0}
.ecard-title{margin:0;font-size:15px;font-weight:500;line-height:1.45;color:var(--ink);display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden}
.ecard-link::after{content:"";position:absolute;inset:0;z-index:1}
.ecard-where{display:flex;align-items:center;gap:5px;min-width:0;margin:0;font-size:13px;color:var(--muted)}.ecard-where .i{width:14px;height:14px}.ecard-where span:first-of-type{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ecard-type{flex:none}
.ecard-facts{display:flex;flex-wrap:wrap;gap:6px 16px;margin-top:10px;padding-top:12px;border-top:1px solid var(--line);font-size:13px;font-weight:500;color:var(--ink2)}.ecard-facts span{display:inline-flex;align-items:center;gap:6px}.ecard-facts .i{width:16px;height:16px;color:var(--muted)}
.etoggle{display:inline-flex;gap:2px;padding:3px;border-radius:11px;background:var(--surface)}.etoggle button{height:32px;padding:0 13px;border-radius:8px;font-size:13px;font-weight:500;color:var(--muted);transition:background-color .2s,color .2s,box-shadow .2s}.etoggle button[aria-pressed=true]{background:var(--card);color:var(--ink);box-shadow:var(--sh-sm)}
/* the office */
.eabout{display:grid;gap:32px 64px;align-items:center}@media (min-width:900px){.eabout{grid-template-columns:1fr 1fr}}
.eabout figure{margin:0;aspect-ratio:5/4;overflow:hidden;border-radius:24px;background:var(--surface)}.eabout figure img{width:100%;height:100%;object-fit:cover}
.eprose{margin-top:14px;color:var(--ink2);font-size:16px;line-height:1.75}.eprose p{margin:0 0 12px}html[lang=ar] .eprose{line-height:1.95}
.estats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:26px}
.estat{padding:16px 18px;border-radius:16px;border:1px solid var(--line);background:var(--card)}.estat b{display:block;font-size:30px;font-weight:600;letter-spacing:-.03em;line-height:1}.estat span{display:block;margin-top:8px;font-size:13px;color:var(--muted)}
/* contact */
.econtact{position:relative;isolation:isolate;overflow:hidden;padding:clamp(28px,5.5vw,72px);border-radius:28px;background:#0C0A09;color:#FAFAF9}
.econtact::before{content:"";position:absolute;inset:-40% -10% auto auto;z-index:-1;width:70%;aspect-ratio:1;border-radius:50%;background:radial-gradient(closest-side,color-mix(in oklab,var(--primary) 55%,transparent),transparent);opacity:.7}
html[dir=rtl] .econtact::before{inset:-40% auto auto -10%}
.econtact .eeyebrow{color:color-mix(in oklab,var(--primary) 45%,#fff)}.econtact h2{margin:12px 0 0;max-width:15ch;font-size:clamp(32px,5vw,60px)}.econtact .lead{margin:14px 0 0;color:rgba(250,250,249,.7)}
.econtact .acts{display:flex;flex-wrap:wrap;gap:10px;margin-top:30px}.econtact .ebtn-outline{background:transparent;border-color:rgba(250,250,249,.24);color:#FAFAF9;box-shadow:none}.econtact .ebtn-outline:hover{background:rgba(250,250,249,.08)}
.econtact dl{display:grid;gap:18px;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));margin:44px 0 0;padding-top:26px;border-top:1px solid rgba(250,250,249,.12)}
.econtact dt{font-size:12px;font-weight:500;letter-spacing:.1em;text-transform:uppercase;color:rgba(250,250,249,.5)}html[lang=ar] .econtact dt{letter-spacing:0;font-size:13px}.econtact dd{margin:6px 0 0;font-size:16px;font-weight:500}
/* the properties page */
.epage{padding:26px 0 72px}
.ecrumb{display:flex;flex-wrap:wrap;align-items:center;gap:6px;font-size:13px;color:var(--muted)}.ecrumb a:hover{color:var(--ink)}.ecrumb .i{width:14px;height:14px}.ecrumb span{color:var(--ink2);max-width:40ch;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.epage-head{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:8px 16px;margin:14px 0 22px}
.etoolbar{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;margin-bottom:22px}.efilters{display:flex;flex-wrap:wrap;align-items:center;gap:6px}
.efilter{display:inline-flex;align-items:center;gap:4px;height:32px;padding-inline:12px 4px;border-radius:999px;background:var(--surface);font-size:13px;font-weight:500}.efilter a{display:grid;place-items:center;width:24px;height:24px;border-radius:999px;color:var(--muted)}.efilter a:hover{background:var(--line);color:var(--ink)}.efilter .i{width:14px;height:14px}
.esort{display:inline-flex;align-items:center;gap:8px;margin-inline-start:auto;font-size:13px;color:var(--muted)}.esort select{height:38px;padding-inline:12px 32px;border-radius:10px;border:1px solid var(--line);background:var(--card) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2378716C' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E") no-repeat right 10px center/14px;color:var(--ink);font:inherit;font-size:13.5px;font-weight:500;appearance:none;-webkit-appearance:none;box-shadow:var(--sh-sm);cursor:pointer}
html[dir=rtl] .esort select{background-position:left 10px center}
.eempty{display:grid;justify-items:center;gap:6px;padding:64px 20px;border:1px dashed var(--line2);border-radius:22px;text-align:center;color:var(--muted)}.eempty h2{margin:8px 0 0;font-size:18px;font-weight:600;color:var(--ink)}.eempty p{margin:0}.eempty-a{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;margin-top:14px}
/* the property page */
.epdp{padding:24px 0 80px}
.epdp-top{display:grid;gap:24px;margin-top:16px}@media (min-width:1000px){.epdp-top{grid-template-columns:minmax(0,1fr) 380px;grid-template-areas:"gal buy" "body buy";gap:0 40px;align-items:start}.epdp-gal{grid-area:gal}.epdp-body{grid-area:body;margin-top:28px}.ebuy{grid-area:buy}}
.egal{position:relative}.egal-track{display:flex;aspect-ratio:3/2;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;border-radius:22px;background:var(--surface)}.egal-track::-webkit-scrollbar{display:none}
.egal-track button{flex:0 0 100%;padding:0;border:0;background:none;scroll-snap-align:center;cursor:zoom-in}.egal-track img{width:100%;height:100%;object-fit:cover}
.egal-nav{position:absolute;top:50%;display:grid;place-items:center;width:42px;height:42px;margin-top:-21px;border-radius:999px;background:rgba(255,255,255,.94);color:#0C0A09;box-shadow:var(--sh);opacity:0;transition:opacity .25s,transform .16s var(--e)}.egal-nav:active{transform:scale(.92)}
.egal-nav.prev{inset-inline-start:14px}.egal-nav.next{inset-inline-end:14px}.egal:hover .egal-nav,.egal-nav:focus-visible{opacity:1}@media (hover:none){.egal-nav{display:none}}
.egal-n{position:absolute;bottom:14px;inset-inline-end:14px;padding:4px 10px;border-radius:999px;background:rgba(12,10,9,.62);color:#fff;font-size:12.5px;font-weight:500;backdrop-filter:blur(8px)}
.egal-thumbs{display:flex;gap:8px;margin-top:10px;overflow-x:auto;scrollbar-width:none;padding:2px}.egal-thumbs::-webkit-scrollbar{display:none}
.egal-thumbs button{flex:0 0 88px;aspect-ratio:4/3;overflow:hidden;padding:0;border-radius:12px;border:0;opacity:.6;box-shadow:0 0 0 2px transparent;transition:opacity .2s,box-shadow .2s}.egal-thumbs button[aria-current]{opacity:1;box-shadow:0 0 0 2px var(--primary)}.egal-thumbs img{width:100%;height:100%;object-fit:cover}
@media (max-width:640px){.egal-track{aspect-ratio:4/3;margin-inline:-16px;border-radius:0}.egal-thumbs{display:none}}
.ebuy{display:grid;gap:14px;padding:24px;border-radius:22px;border:1px solid var(--line);background:var(--card);box-shadow:var(--sh)}@media (min-width:1000px){.ebuy{position:sticky;top:90px}}
.ebuy-tags{display:flex;flex-wrap:wrap;gap:6px}.ebuy .eh1{font-size:clamp(24px,2.4vw,30px)}
.ebuy-where{display:flex;align-items:center;gap:6px;margin:-6px 0 0;font-size:14px;color:var(--muted)}.ebuy-where .i{width:16px;height:16px}
.ebuy-price{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:6px 10px;padding:14px 0;border-block:1px solid var(--line)}.ebuy-price .v{font-size:30px;font-weight:600;letter-spacing:-.03em}
.ekeys{display:grid;grid-template-columns:1fr 1fr;gap:8px}.ekey{display:grid;grid-template-columns:auto 1fr;align-items:center;gap:0 10px;padding:10px 12px;border-radius:14px;background:var(--surface)}.ekey .i{grid-row:span 2;width:20px;height:20px;color:var(--muted)}.ekey b{font-size:15px;font-weight:600}.ekey small{font-size:11.5px;color:var(--muted)}
.ebuy-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(90px,1fr));gap:8px}.ebuy-row .ebtn{padding:0 10px;font-size:13.5px}
.ebuy-office{display:flex;align-items:center;gap:10px;padding-top:14px;border-top:1px solid var(--line)}.ebuy-office .mono,.ebuy-office img{width:38px;height:38px;border-radius:10px;display:grid;place-items:center;background:var(--ink);color:var(--bg);font-size:13px;font-weight:600;object-fit:cover}.ebuy-office span{display:grid;line-height:1.3}.ebuy-office small{font-size:12px;color:var(--muted)}.ebuy-office b{font-size:14.5px;font-weight:600}
.eunavail{margin:0;padding:12px 14px;border-radius:12px;background:#FEF3C7;color:#92400E;font-size:14px}
.eblock{padding:30px 0;border-top:1px solid var(--line)}@media (max-width:999px){.epdp-body .eblock:first-child{border-top:0;padding-top:8px}}.eblock h2{margin:0 0 14px;font-size:20px;font-weight:600;letter-spacing:-.02em}html[lang=ar] .eblock h2{letter-spacing:0}
.eblock .eprose{margin:0}.eblock-a{display:flex;flex-wrap:wrap;gap:8px}
.edl{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin:0}.edl>div{display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:14px;border:1px solid var(--line)}.edl .i{width:20px;height:20px;color:var(--muted)}.edl span{display:grid}.edl dt{font-size:12px;color:var(--muted)}.edl dd{margin:0;font-size:15px;font-weight:600}
.efeat{display:flex;flex-wrap:wrap;gap:8px;margin:0;padding:0;list-style:none}.efeat li{display:inline-flex;align-items:center;gap:7px;height:36px;padding:0 14px;border-radius:999px;background:var(--surface);font-size:14px;font-weight:500}.efeat .i{width:15px;height:15px;color:var(--primary)}
.esimilar{margin-top:56px}
/* the phone bar */
.ebar{display:none}
@media (max-width:999px){.ebar{position:fixed;inset-inline:0;bottom:0;z-index:30;display:flex;align-items:center;gap:8px;padding:10px 14px calc(10px + env(safe-area-inset-bottom));background:color-mix(in oklab,var(--bg) 88%,transparent);backdrop-filter:blur(20px) saturate(180%);-webkit-backdrop-filter:blur(20px) saturate(180%);border-top:1px solid var(--line)}.ebar>.ebtn{flex:1}.ebar>.ebtn.sq{flex:none}body.has-bar .efoot{padding-bottom:110px}}
.ebar-p{flex:1;min-width:0;font-size:18px;font-weight:600;letter-spacing:-.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ebar.pdp>.ebtn-primary{flex:none}
/* footer */
.efoot{margin-top:32px;padding:56px 0 28px;border-top:1px solid var(--line);background:color-mix(in oklab,var(--surface) 55%,var(--bg))}
.efoot-top{display:grid;gap:32px}@media (min-width:860px){.efoot-top{grid-template-columns:1.5fr 1fr 1.1fr 1.3fr}}
.efoot-brand p{max-width:34ch;margin:14px 0 0;font-size:14px;color:var(--ink2)}
.efoot h4{margin:0 0 12px;font-size:13px;font-weight:600;color:var(--ink)}.efoot ul{display:grid;gap:9px;margin:0;padding:0;list-style:none;font-size:14px;color:var(--ink2)}.efoot ul a:hover{color:var(--ink)}
.efoot-cta p{margin:0 0 14px;font-size:14px;color:var(--ink2)}
.efoot-bot{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:14px;margin-top:44px;padding-top:20px;border-top:1px solid var(--line);font-size:13px;color:var(--muted)}
${HW_BADGE_CSS}
/* sheets (Sheet): saved homes, the phone menu. A side panel on a computer, a bottom sheet on a phone */
dialog.esheet{position:fixed;inset:0 0 0 auto;width:min(420px,100vw);height:100dvh;max-width:none;max-height:none;margin:0;padding:0;border:0;border-radius:0;background:var(--card);color:var(--ink);box-shadow:-24px 0 70px -24px rgba(0,0,0,.4);opacity:1;transform:none;transition:transform .45s var(--e-sheet),overlay .45s allow-discrete,display .45s allow-discrete}
html[dir=rtl] dialog.esheet{inset:0 auto 0 0}
dialog.esheet:not([open]){transform:translateX(100%)}html[dir=rtl] dialog.esheet:not([open]){transform:translateX(-100%)}
@starting-style{dialog.esheet[open]{transform:translateX(100%)}html[dir=rtl] dialog.esheet[open]{transform:translateX(-100%)}}
dialog.esheet::backdrop{background:rgba(12,10,9,.4);backdrop-filter:blur(3px)}
@media (max-width:640px){dialog.esheet,html[dir=rtl] dialog.esheet{inset:auto 0 0 0;width:100%;height:auto;max-height:88dvh;border-radius:26px 26px 0 0}
dialog.esheet:not([open]),html[dir=rtl] dialog.esheet:not([open]){transform:translateY(100%)}@starting-style{dialog.esheet[open],html[dir=rtl] dialog.esheet[open]{transform:translateY(100%)}}
.esheet-h::before{content:"";position:absolute;top:7px;left:50%;width:38px;height:5px;margin-left:-19px;border-radius:999px;background:var(--line2)}}
dialog.esheet[open]{display:flex;flex-direction:column}
.esheet-h{position:relative;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:18px 14px 14px 20px;border-bottom:1px solid var(--line)}.esheet-h>b{font-size:16px;font-weight:600}
.esheet-b{flex:1;overflow:auto;padding:12px 20px calc(24px + env(safe-area-inset-bottom))}
.esheet-empty{display:grid;justify-items:center;gap:10px;margin:0;padding:48px 12px;text-align:center;color:var(--muted)}
.esitem{display:flex;align-items:center;gap:6px;padding:8px 0;border-bottom:1px solid var(--line)}.esitem a{display:flex;align-items:center;gap:12px;flex:1;min-width:0}.esitem img{flex:none;width:76px;height:60px;border-radius:10px;object-fit:cover;background:var(--surface)}
.esitem span{display:grid;min-width:0}.esitem b{font-size:14px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.esitem small{font-size:12.5px;color:var(--muted)}.esitem em{font-style:normal;font-size:14px;font-weight:600}
.emenu-links{display:grid}.emenu-links a{display:flex;align-items:center;justify-content:space-between;padding:14px 2px;border-bottom:1px solid var(--line);font-size:20px;font-weight:600;letter-spacing:-.02em;animation:erise .5s var(--e) both}html[lang=ar] .emenu-links a{letter-spacing:0}
.emenu-links a:nth-child(2){animation-delay:.04s}.emenu-links a:nth-child(3){animation-delay:.08s}.emenu-links a:nth-child(4){animation-delay:.12s}.emenu-links a:nth-child(5){animation-delay:.16s}.emenu-links .i{color:var(--muted)}
.emenu-foot{display:grid;gap:10px;margin-top:24px}.emenu-foot .elang{justify-self:start;font-size:13px}
.etoast{position:fixed;left:50%;bottom:calc(88px + env(safe-area-inset-bottom));z-index:60;padding:10px 16px;border-radius:999px;background:var(--ink);color:var(--bg);font-size:14px;font-weight:500;box-shadow:var(--sh-lg);transform:translateX(-50%);animation:erise .35s var(--e) both;transition:opacity .35s}.etoast.out{opacity:0}
/* the shared inquiry dialog, in this design's type */
dialog#inq{border-radius:22px;border:1px solid var(--line)}dialog#inq h3{font-weight:600;letter-spacing:-.02em;font-size:24px}html[lang=ar] dialog#inq h3{letter-spacing:0}
dialog#inq .btn{border-radius:12px;height:46px}dialog#inq .win{height:44px;border-radius:10px}dialog#inq textarea.win{height:96px}
@media (prefers-reduced-motion:reduce){.ehero-card>img,.echip,.ehero h1,.ehero .lead,.ehero-cta,.esearch,.emenu-links a{animation:none!important}}`;
}
