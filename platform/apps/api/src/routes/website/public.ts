// Hemlo Systems · the public side of the Website add-on, routed beneath business.hemlohq.com/s/{workspace}.
// Only a published site is served, and only the columns that belong on a public page are printed — never the address,
// the owner, internal notes or any private data. The data sections (products, listings) read the business's live Hemlo
// data through withOrg(), so Hemlo stays the single source of truth: nothing is copied. An inquiry becomes a lead in the
// business's own book (an agency's lead, a shop's customer) — the visitor needs no account.
import { Hono, type Context } from 'hono';
import { and, asc, eq, sql } from 'drizzle-orm';
import { newId, hmac, normalizeIraqiPhone } from '@hemlo/core';
import { withOrg, withSystem } from '@hemlo/db';
import { webSite, webPage, organization, sysSettings, RE_TYPES, type WebSection } from '@hemlo/db/schema';
import { fileUrl } from '../../files';
import { featureName, settingsOf, typeName } from '../realestate/common';
import { websiteAdapterFor, type WebsiteListing, type WebsiteListingFilter, type WebsiteProperty } from './adapters';
import { addonEntitlement } from '../../addons';
import { W, pick, webFrame, waHref, telHref, moneyIqd, sectionHeading, inquiryDialog, INQUIRY_SCRIPT, esc, attr, icon, fill, type Lang } from './theme';
import { designFor } from './designs';
import { actor } from '../sys-common';
import { onInquiry } from '../../connect/core';
import type { AppEnv, Deps } from '../../types';

const RESERVED = new Set(['www', 'api', 'app', 'admin', 'account', 'studio', 'mail', 'ftp', 'cdn', 'static', 'assets', 'demo', 'test', 'systems', 'tools', 'business']);
import { paras, strOf, itemsOf, field, initials, STATUS, LINE, propHref, factsOf, langQ, type Ctx, type Two } from './context';
import { SAMPLE_SUB, sampleSite, sampleListings, sampleProperty } from './sample';
import { WEB_FONTS } from './fonts.generated';

/** The buttons a page offers, from the site's contact details and its CTA switches. */
function ctaRow(ctx: Ctx, what: string, cls = 'wcta') {
  const t = ctx.t, cta = ctx.site.settings?.cta ?? {}, out: string[] = [];
  const wa = cta.whatsapp !== false && ctx.contact.whatsapp ? waHref(ctx.contact.whatsapp, fill(t.waHello, { what, url: ctx.origin + '/' })) : null;
  if (wa) out.push(`<a class="btn wa" href="${attr(wa)}" rel="noopener">${icon('wa', 'ic')}${t.whatsapp}</a>`);
  const tel = cta.phone !== false ? telHref(ctx.contact.phone) : null;
  if (tel) out.push(`<a class="btn" href="${attr(tel)}">${icon('call', 'ic')}${t.call}</a>`);
  if (cta.inquiry !== false) out.push(`<button class="btn primary" type="button" data-inquire>${t.inquire}</button>`);
  return out.length ? `<div class="${cls}">${out.join('')}</div>` : '';
}

const two = (i: number) => String(i).padStart(2, '0');
/** A section's head: its number and kind as a quiet label, and a serif line. */
function sectionHead(ctx: Ctx, sec: WebSection, extra = '') {
  const label = sectionHeading(sec.type, undefined, ctx.lang), own = pick(sec.title as Two, ctx.lang);
  const line = own && own !== label ? own : LINE[ctx.lang][sec.type] ?? label;
  return `<div class="sh rv"><div><p class="eyebrow"><span class="idx num">${two(++ctx.n)}</span>${esc(label)}</p><h2 class="display">${esc(line)}</h2></div>${extra}</div>`;
}
/** One property: a tall photograph (it carries over into the property's own page), then the words. */
function listingCard(ctx: Ctx, l: WebsiteListing, i: number) {
  const held = l.status === 'reserved' || l.status === 'negotiating';
  const badge = `<span class="badge${held ? ' warn' : ''}"><i class="dot"></i>${esc(held ? STATUS[ctx.lang][l.status] : l.purpose === 'rent' ? ctx.t.forRent : ctx.t.forSale)}</span>`;
  const where = [l.area, l.city].filter(Boolean).join(' · ');
  return `<a class="lc rv" style="--i:${i % 3}" href="${attr(propHref(ctx, l.slug))}">
<figure>${l.cover ? `<img src="${attr(l.cover)}" alt="" loading="${i < 3 ? 'eager' : 'lazy'}" decoding="async" style="view-transition-name:p-${attr(l.slug)}">` : ''}${badge}</figure>
<div><div class="meta"><span>${esc(where)}</span><span>${esc(typeName(l.type, ctx.lang))}</span></div><h3><span>${esc(l.title)}</span></h3></div>
<div class="row"><span class="facts">${esc(factsOf(ctx, l))}</span><span class="pr num" dir="ltr">${esc(l.price)}</span></div></a>`;
}

function sectionHtml(ctx: Ctx, sec: WebSection, first: boolean): string {
  const own = ctx.design.section?.(ctx, sec, first);
  if (own != null) return own;
  const t = ctx.t, lang = ctx.lang;
  const block = (inner: string, extra = '') => (inner ? `<section class="wsec"><div class="wwrap">${sectionHead(ctx, sec, extra)}${inner}</div></section>` : '');
  switch (sec.type) {
    case 'hero': {
      const title = pick((sec as any).title as Two, lang) || ctx.name;
      const text = field(sec, 'text', lang) || ctx.tagline;
      const own = typeof (sec as any).image === 'string' && /^https:\/\//.test((sec as any).image) ? (sec as any).image as string : null;
      const img = own ?? ctx.listings.find((l) => l.cover)?.cover ?? null;
      const photo = first && !!img;
      if (photo) ctx.onPhoto = true;
      const cities = [...new Set(ctx.listings.map((l) => l.city).filter(Boolean))].slice(0, 3).join(' · ');
      const wa = ctx.contact.whatsapp ? waHref(ctx.contact.whatsapp, fill(t.waHello, { what: ctx.name, url: ctx.origin + '/' })) : null;
      const acts = ctx.listings.length
        ? `<a class="btn ${photo ? 'light' : 'primary'}" href="${attr(ctx.basePath)}/properties${lang === (ctx.site.lang === 'en' ? 'en' : 'ar') ? '' : `?lang=${lang}`}">${t.browse}<span class="arrow" aria-hidden="true">→</span></a>${wa ? `<a class="btn ${photo ? 'ghost-light' : ''}" href="${attr(wa)}" rel="noopener">${icon('wa', 'ic')}${t.whatsapp}</a>` : ''}`
        : ctaRow(ctx, title, 'x').replace(/^<div class="x">|<\/div>$/g, '');
      const count = ctx.listings.length === 1 ? t.availableOne : ctx.listings.length ? fill(t.available, { n: ctx.listings.length }) : '';
      return `<section class="hero${photo ? ' photo' : ''}">${photo ? `<img class="bgimg" src="${attr(img!)}" alt="" fetchpriority="high" decoding="async">` : ''}<div class="wwrap">
${cities ? `<p class="eyebrow rise" style="--i:0">${esc(cities)}</p>` : ''}<h1 class="display rise" style="--i:1;margin-top:18px">${esc(title)}</h1>${text ? `<p class="lead rise" style="--i:2">${esc(text)}</p>` : ''}
<div class="acts rise" style="--i:3">${acts}</div>${count || ctx.contact.phone ? `<div class="foot rise" style="--i:4"><span>${esc(count)}</span>${ctx.contact.phone ? `<span class="num" dir="ltr">${esc(ctx.contact.phone)}</span>` : ''}</div>` : ''}</div></section>`;
    }
    case 'about': {
      const body = field(sec, 'text', lang) || field(sec, 'body', lang) || pick(ctx.site.about, lang);
      if (!body) return '';
      const label = sectionHeading('about', undefined, lang), own = pick(sec.title as Two, lang);
      return `<section class="wsec"><div class="wwrap about"><div class="rv"><p class="eyebrow"><span class="idx num">${two(++ctx.n)}</span>${esc(label)}</p><h2 class="display" style="font-size:clamp(28px,3.6vw,44px);margin-top:14px">${esc(own && own !== label ? own : ctx.tagline || LINE[lang].about)}</h2></div><div class="body rv" style="--i:1">${paras(body)}</div></div></section>`;
    }
    case 'products': {
      if (!ctx.products.length) return '';
      const cards = ctx.products.map((p) => `<article class="wcard rv">${p.image ? `<div class="ph"><img src="${attr(p.image)}" alt="" loading="lazy" decoding="async"></div>` : ''}
<div class="bd"><div class="tt">${esc(p.name)}</div>${p.category ? `<div class="mt">${esc(p.category)}</div>` : ''}<div class="pr num" dir="ltr">${moneyIqd(p.price, lang)}</div></div></article>`).join('');
      return block(`<div class="wgrid">${cards}</div>`);
    }
    case 'listings': {
      const all = ctx.pageSlug === 'properties';
      const search = all ? listingSearch(ctx) : '';
      if (!ctx.listings.length) return all ? block(`${search}<p class="wempty">${lang === 'ar' ? 'لا توجد عقارات تطابق بحثك.' : 'No properties match your search.'}</p>`) : '';
      const shown = all ? ctx.listings : ctx.listings.slice(0, 6);
      const toAll = `${attr(ctx.basePath)}/properties${lang === (ctx.site.lang === 'en' ? 'en' : 'ar') ? '' : `?lang=${lang}`}`;
      const extra = !all && ctx.listings.length > shown.length ? `<a class="link" href="${toAll}">${t.allProperties}<span class="arrow" aria-hidden="true">→</span></a>` : '';
      const count = all ? `<p class="count num">${esc(fill(t.results, { n: ctx.listings.length }))}</p>` : '';
      const more = extra ? `<div class="more"><a class="btn" href="${toAll}">${t.allProperties} <span class="num">(${ctx.listings.length})</span><span class="arrow" aria-hidden="true">→</span></a></div>` : '';
      return block(`${search}${count}<div class="lgrid">${shown.map((l, i) => listingCard(ctx, l, i)).join('')}</div>${more}`, extra);
    }
    case 'services': {
      const items = itemsOf(sec).map((it, i) => `<article class="wcard rv" style="--i:${i % 3}"><div class="bd"><div class="tt">${esc(strOf(it.title ?? it.name, lang))}</div>${strOf(it.text ?? it.desc, lang) ? `<div class="mt">${esc(strOf(it.text ?? it.desc, lang))}</div>` : ''}</div></article>`).join('');
      return items ? block(`<div class="wgrid">${items}</div>`) : '';
    }
    case 'gallery': {
      const imgs = (Array.isArray((sec as any).images) ? (sec as any).images : []).map((x: any) => (typeof x === 'string' ? x : x?.url)).filter((x: any) => typeof x === 'string' && /^https?:\/\//.test(x));
      return imgs.length ? block(`<div class="wgal">${imgs.map((u: string, i: number) => `<img class="rv" style="--i:${i % 4}" src="${attr(u)}" alt="" loading="lazy" decoding="async">`).join('')}</div>`) : '';
    }
    case 'team': {
      const members = itemsOf(sec).map((m, i) => `<div class="wmember rv" style="--i:${i % 4}"><span class="av">${m.photo ? `<img src="${attr(m.photo)}" alt="">` : esc(initials(strOf(m.name, lang)))}</span><b>${esc(strOf(m.name, lang))}</b>${strOf(m.title ?? m.role, lang) ? `<small>${esc(strOf(m.title ?? m.role, lang))}</small>` : ''}</div>`).join('');
      return members ? block(`<div class="wteam">${members}</div>`) : '';
    }
    case 'faq': {
      const qs = itemsOf(sec).map((q) => { const a = strOf(q.a ?? q.answer ?? q.text, lang); return `<details><summary>${esc(strOf(q.q ?? q.title, lang))}</summary>${a ? `<p>${esc(a)}</p>` : ''}</details>`; }).join('');
      return qs ? block(`<div class="wfaq rv">${qs}</div>`) : '';
    }
    case 'hours': {
      const rows = itemsOf(sec).map((h) => `<li><span>${esc(strOf(h.day, lang))}</span><span dir="ltr">${esc(strOf(h.time, lang))}</span></li>`).join('');
      return rows ? block(`<ul class="whours rv">${rows}</ul>`) : '';
    }
    case 'testimonials': {
      const qs = itemsOf(sec).map((q, i) => `<blockquote class="wquote rv" style="--i:${i % 3}"><p>${esc(strOf(q.quote ?? q.text, lang))}</p>${strOf(q.author ?? q.name, lang) ? `<small>${esc(strOf(q.author ?? q.name, lang))}</small>` : ''}</blockquote>`).join('');
      return qs ? block(`<div class="wgrid">${qs}</div>`) : '';
    }
    case 'contact': {
      const c = ctx.contact, label = sectionHeading('contact', undefined, lang), own = pick(sec.title as Two, lang);
      const wa = c.whatsapp ? waHref(c.whatsapp, fill(t.waHello, { what: ctx.name, url: ctx.origin + '/' })) : null;
      const acts = [wa ? `<a class="btn wa" href="${attr(wa)}" rel="noopener">${icon('wa', 'ic')}${t.whatsapp}</a>` : '', c.phone ? `<a class="btn" href="${attr(telHref(c.phone)!)}">${icon('call', 'ic')}${t.call}</a>` : '',
        `<button class="btn light" type="button" data-inquire>${t.inquire}</button>`].join('');
      const dl = [c.phone ? `<div><dt>${t.phoneLabel}</dt><dd class="num" dir="ltr" style="text-align:start">${esc(c.phone)}</dd></div>` : '', c.email ? `<div><dt>${t.emailLabel}</dt><dd><a href="mailto:${attr(c.email)}">${esc(c.email)}</a></dd></div>` : '',
        c.address ? `<div><dt>${t.whereLabel}</dt><dd>${c.mapUrl && /^https:\/\//.test(c.mapUrl) ? `<a href="${attr(c.mapUrl)}" rel="noopener" target="_blank">${esc(c.address)}</a>` : esc(c.address)}</dd></div>` : ''].join('');
      return `<section class="wsec band"><div class="wwrap"><p class="eyebrow rv"><span class="idx num">${two(++ctx.n)}</span>${esc(label)}</p><h2 class="display rv" style="margin-top:16px">${esc(own && own !== label ? own : t.letsTalk)}</h2><div class="acts rv">${acts}</div>${dl ? `<dl class="rv">${dl}</dl>` : ''}</div></section>`;
    }
    case 'cta': {
      const heading = sectionHeading(sec.type, sec.title as Two, lang), text = field(sec, 'text', lang) || pick(ctx.site.tagline, lang);
      return `<section class="wsec"><div class="wwrap rv" style="text-align:center"><h2 class="display" style="font-size:clamp(30px,4.4vw,52px)">${esc(heading)}</h2>${text ? `<p class="wmuted" style="margin:16px auto 0">${esc(text)}</p>` : ''}${ctaRow(ctx, heading, 'acts" style="display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin-top:28px')}</div></section>`;
    }
    default: return '';
  }
}

function listingSearch(ctx: Ctx) {
  const ar = ctx.lang === 'ar';
  const f = ctx.filters;
  const field = (name: string, label: string, value: string | number, placeholder = '', type = 'text') => `<label>${label}<input class="win" type="${type}" name="${name}" value="${attr(String(value))}" placeholder="${placeholder}" maxlength="80"></label>`;
  const purpose = `<label>${ar ? 'الغرض' : 'Purpose'}<select class="win" name="purpose"><option value="">${ar ? 'الكل' : 'Any'}</option><option value="sale"${f.purpose === 'sale' ? ' selected' : ''}>${ar ? 'للبيع' : 'For sale'}</option><option value="rent"${f.purpose === 'rent' ? ' selected' : ''}>${ar ? 'للإيجار' : 'For rent'}</option></select></label>`;
  const types: [string, string][] = ['apartment', 'house', 'villa', 'land', 'office', 'shop', 'commercial', 'building', 'warehouse', 'farm'].map((k) => [k, typeName(k, ctx.lang)]);
  const type = `<label>${ar ? 'النوع' : 'Type'}<select class="win" name="type"><option value="">${ar ? 'الكل' : 'Any'}</option>${types.map(([k, label]) => `<option value="${k}"${f.type === k ? ' selected' : ''}>${esc(label)}</option>`).join('')}</select></label>`;
  const currency = `<label>${ar ? 'العملة' : 'Currency'}<select class="win" name="currency"><option value="">${ar ? 'الكل' : 'Any'}</option><option value="USD"${f.currency === 'USD' ? ' selected' : ''}>USD</option><option value="IQD"${f.currency === 'IQD' ? ' selected' : ''}>IQD</option></select></label>`;
  return `<form class="wsearch rv" method="get" action="${attr(ctx.basePath)}/properties"><input type="hidden" name="lang" value="${ctx.lang}">${field('q', ar ? 'بحث' : 'Search', f.q ?? '')}${purpose}${type}${field('city', ar ? 'المدينة' : 'City', f.city ?? '')}${field('area', ar ? 'المنطقة' : 'Area', f.area ?? '')}${currency}${field('min', ar ? 'السعر من' : 'Min price', f.min ?? '', '', 'number')}${field('max', ar ? 'السعر إلى' : 'Max price', f.max ?? '', '', 'number')}<div class="wsearch-actions"><button class="btn primary" type="submit">${ar ? 'عرض العقارات' : 'Show properties'}</button><a class="btn" href="${attr(ctx.basePath)}/properties?lang=${ctx.lang}">${ar ? 'مسح' : 'Clear'}</a></div></form>`;
}

/** The header every page shares: the name, up to five pages, and the other language. */
function headerHtml(ctx: Ctx, pages: { slug: string; title: any }[], current: string, altHref: string) {
  const t = ctx.t, other: Lang = ctx.lang === 'ar' ? 'en' : 'ar', q = ctx.lang === (ctx.site.lang === 'en' ? 'en' : 'ar') ? '' : `?lang=${ctx.lang}`;
  const nav = pages.slice(0, 5).map((p) => `<a href="${attr(ctx.basePath)}/${p.slug}${q}"${p.slug === current ? ' aria-current="page"' : ''}>${esc(pick(p.title, ctx.lang) || p.slug || t.hero)}</a>`).join('')
    + (pages.some((p) => p.slug === 'properties') ? '' : `<a href="${attr(ctx.basePath)}/properties${q}"${current === 'properties' ? ' aria-current="page"' : ''}>${t.listings}</a>`);
  return `<header class="wtop"><div class="wwrap"><a class="wbrand" href="${attr(ctx.basePath)}/${q}">${ctx.logo ? `<img src="${attr(ctx.logo)}" alt="">` : `<span class="mono">${esc(initials(ctx.name))}</span>`}<span>${esc(ctx.name)}</span></a>
<nav class="wnav">${nav}</nav><a class="wlang" href="${attr(altHref)}" hreflang="${other}" lang="${other}">${other === 'en' ? 'English' : 'العربية'}</a></div></header>`;
}
function footerHtml(ctx: Ctx) {
  const t = ctx.t, c = ctx.contact;
  const links = [c.phone ? `<a class="num" dir="ltr" href="${attr(telHref(c.phone)!)}">${esc(c.phone)}</a>` : '', c.email ? `<a href="mailto:${attr(c.email)}">${esc(c.email)}</a>` : ''].filter(Boolean).join('');
  return `<footer class="wfoot"><div class="wwrap"><div class="top"><div><p class="name" style="margin:0">${esc(ctx.name)}</p>${ctx.tagline ? `<p style="margin:10px 0 0;max-width:46ch">${esc(ctx.tagline)}</p>` : ''}</div><div style="display:grid;gap:6px">${links}${c.address ? `<span>${esc(c.address)}</span>` : ''}</div></div>
<div class="bot"><span>© ${new Date().getFullYear()} ${esc(ctx.name)}</span><a href="https://hemlohq.com/${ctx.lang === 'en' ? 'en/' : ''}systems/" rel="noopener">${t.powered}</a></div></div></footer>`;
}

/** The shared property page: photographs, the facts, and a side card with the actions. */
function sharedProperty(ctx: Ctx, p: WebsiteProperty, logo: string | null, basePath: string) {
  const t = ctx.t, lang = ctx.lang, q = langQ(ctx);
  const canonical = `${ctx.origin}/properties/${encodeURIComponent(p.slug)}`;
  const photos = p.photos.slice(0, 5);
  // the first photograph shares its name with the card it came from: the browser carries one into the other
  const photoHtml = photos.length ? `<div class="wphotos n${Math.min(photos.length, 5)} rv">${photos.map((x, i) => `<button type="button" data-photo="${attr(x.url)}" aria-label="${attr(x.caption ?? p.title)}"><img src="${attr(x.url)}" alt="${attr(x.caption ?? p.title)}" ${i ? 'loading="lazy"' : `fetchpriority="high" style="view-transition-name:p-${attr(p.slug)}"`} decoding="async">${i === 0 && p.photos.length > 1 ? `<span class="btn sm light all">${icon('grid', 'ic')}${t.allPhotos} <span class="num">${p.photos.length}</span></span>` : ''}</button>`).join('')}</div>`
    + p.photos.slice(5).map((x) => `<span hidden data-photo="${attr(x.url)}"></span>`).join('') : '';
  const fact = (label: string, value: string | number | null) => value == null || value === '' ? '' : `<div><dt>${esc(label)}</dt><dd>${esc(String(value))}</dd></div>`;
  const ar = lang === 'ar', unavailable = ['sold', 'rented'].includes(p.status), held = p.status === 'reserved' || p.status === 'negotiating';
  const facts = [fact(ar ? 'النوع' : 'Type', typeName(p.type, lang)), fact(ar ? 'الغرض' : 'Purpose', p.purpose === 'rent' ? t.forRent : t.forSale), fact(ar ? 'المساحة' : 'Area', p.size ? fill(t.sqm, { n: p.size }) : null),
    fact(ar ? 'الأرض' : 'Land', p.land ? fill(t.sqm, { n: p.land }) : null), fact(ar ? 'غرف النوم' : 'Bedrooms', p.bedrooms), fact(ar ? 'الحمامات' : 'Bathrooms', p.bathrooms), fact(ar ? 'الطوابق' : 'Floors', p.floors),
    fact(ar ? 'موقف السيارات' : 'Parking', p.parking), fact(ar ? 'سنة البناء' : 'Year built', p.yearBuilt)].join('');
  const links = [p.map ? `<a class="link" href="https://www.openstreetmap.org/?mlat=${p.map.lat}&mlon=${p.map.lng}#map=16/${p.map.lat}/${p.map.lng}" rel="noopener" target="_blank">${icon('pin', 'ic')}${t.map}</a>` : '',
    p.video && /^https:\/\//.test(p.video) ? `<a class="link" href="${attr(p.video)}" rel="noopener" target="_blank">${t.video}<span class="arrow" aria-hidden="true">→</span></a>` : ''].filter(Boolean).join('');
  const wa = ctx.contact.whatsapp ? waHref(ctx.contact.whatsapp, fill(t.waHello, { what: p.title, url: canonical })) : null;
  const tel = telHref(ctx.contact.phone);
  const aside = unavailable ? `<aside class="aside"><p class="wempty" style="margin:0">${t.unavailable}</p><a class="btn block" href="${attr(basePath)}/properties${q}">${t.allProperties}</a></aside>`
    : `<aside class="aside"><div class="who">${logo ? `<img src="${attr(logo)}" alt="" width="40" height="40" style="border-radius:999px;object-fit:cover">` : ''}<div><b>${esc(ctx.name)}</b>${ctx.contact.address ? `<small>${esc(ctx.contact.address)}</small>` : ''}</div></div>
${wa ? `<a class="btn wa block" href="${attr(wa)}" rel="noopener">${icon('wa', 'ic')}${t.whatsapp}</a>` : ''}${tel ? `<a class="btn block" href="${attr(tel)}">${icon('call', 'ic')}${t.call}</a>` : ''}<button class="btn primary block" type="button" data-inquire>${t.inquire}</button><p class="note">${t.replyNote}</p></aside>`;
  const bar = unavailable ? '' : `<div class="mbar">${wa ? `<a class="btn wa" href="${attr(wa)}" rel="noopener">${icon('wa', 'ic')}${t.whatsapp}</a>` : ''}<button class="btn primary" type="button" data-inquire>${t.inquire}</button></div>`;
  const main = `<main class="wdetail"><div class="wwrap"><a class="crumb" href="${attr(basePath)}/properties${q}"><span class="arrow" aria-hidden="true">→</span>${t.allProperties}</a>
<div class="dhead rv"><div><p class="eyebrow">${esc([typeName(p.type, lang), p.purpose === 'rent' ? t.forRent : t.forSale].join(' · '))}</p><h1 class="display">${esc(p.title)}</h1><p class="where">${esc([p.area, p.city].filter(Boolean).join(' · '))}</p></div>
<div class="dprice"><div class="v num" dir="ltr">${esc(p.price)}</div><div class="badges">${held || unavailable ? `<span class="badge warn"><i class="dot"></i>${esc(STATUS[lang][p.status] ?? p.status)}</span>` : ''}${p.negotiable && !unavailable ? `<span class="badge">${t.negotiable}</span>` : ''}</div></div></div>
${photoHtml}<div class="dgrid"><div>${facts ? `<dl class="dfacts rv">${facts}</dl>` : ''}
${p.description[lang] ? `<div class="dblock rv"><h2 class="display">${t.aboutProperty}</h2><div class="wmuted" style="font-size:17px">${paras(p.description[lang]!)}</div></div>` : ''}
${p.features.length ? `<div class="dblock rv"><h2 class="display">${t.features}</h2><ul class="wfeatures">${p.features.map((f) => `<li>${esc(featureName(f, lang))}</li>`).join('')}</ul></div>` : ''}
${links ? `<div class="dblock rv" style="display:flex;flex-wrap:wrap;gap:24px">${links}</div>` : ''}</div>${aside}</div></div></main>`;
  return { main, bar };
}

export function webPublicRoutes(d: Deps) {
  const r = new Hono<AppEnv>();

  const subOf = (c: Context) => {
    const h = c.req.header('x-hemlo-site');
    if (h) return h.toLowerCase().trim();
    const host = (c.req.header('host') ?? '').toLowerCase().split(':')[0];
    const INFRA = ['api', 'www', 'account', 'admin', 'system', 'studio', 'tools', 'demo', 'business'];
    const bare = host.endsWith('.hemlo.site') ? host.slice(0, -'.hemlo.site'.length)
      : host.endsWith('.hemlohq.com') ? host.slice(0, -'.hemlohq.com'.length) : null;
    return bare && !INFRA.includes(bare) ? bare : '';
  };
  /** The visitor-facing origin, derived from the host so canonical/OG/WhatsApp links are right on either domain. */
  const originOf = (c: Context, sub: string) => {
    const host = (c.req.header('host') ?? '').toLowerCase().split(':')[0];
    const base = c.req.header('x-hemlo-site-base');
    const sitePath = base === `/s/${encodeURIComponent(sub)}` ? base : '';
    return host.endsWith('.hemlohq.com') || host.endsWith('.hemlo.site') ? `https://${host}${sitePath}` : `https://${sub}.hemlohq.com`;
  };
  const html = (body: string, status = 200, cache = 'public, max-age=0, s-maxage=30, stale-while-revalidate=60') =>
    new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': cache, 'x-content-type-options': 'nosniff', 'referrer-policy': 'strict-origin-when-cross-origin' } });

  function messagePage(lang: Lang, theme: any, kind: 'notFound' | 'notReady', wa: string | null) {
    const t = W[lang] as Record<string, string>;
    const body = `<main class="wnot"><div class="wwrap"><h1>${esc(t[kind])}</h1><p>${esc(t[kind + 'Sub'])}</p>
${wa ? `<a class="btn wa" style="max-width:320px;margin:0 auto" href="${attr(waHref(wa, '')!)}" rel="noopener">${icon('wa')}${t.whatsapp}</a>` : `<a class="btn" style="max-width:320px;margin:0 auto" href="https://hemlohq.com">hemlohq.com</a>`}
</div></main>`;
    return webFrame({ lang, title: t[kind], description: t[kind + 'Sub'], robots: 'noindex', theme: theme ?? {}, body });
  }

  const siteRow = async (sub: string) => sub ? (await withSystem(d.db, (tx) => tx.select().from(webSite).where(eq(webSite.subdomain, sub))))[0] ?? null : null;

  const listingFilters = (c: Context): WebsiteListingFilter => {
    const q = (c.req.query('q') ?? '').trim().slice(0, 80).replace(/[%_]/g, '');
    const city = (c.req.query('city') ?? '').trim().slice(0, 80), area = (c.req.query('area') ?? '').trim().slice(0, 80);
    const place = (c.req.query('where') ?? '').trim().slice(0, 80).replace(/[%_]/g, '');
    const purpose = ['sale', 'rent'].includes(c.req.query('purpose') ?? '') ? c.req.query('purpose') : undefined;
    const type = (RE_TYPES as readonly string[]).includes(c.req.query('type') ?? '') ? c.req.query('type') : undefined;
    const currency = ['USD', 'IQD'].includes(c.req.query('currency') ?? '') ? c.req.query('currency') : undefined;
    const minRaw = (c.req.query('min') ?? '').trim(), maxRaw = (c.req.query('max') ?? '').trim();
    const min = minRaw ? Number(minRaw) : undefined, max = maxRaw ? Number(maxRaw) : undefined;
    const validMin = min == null || (Number.isSafeInteger(min) && min >= 0 && min <= 2_000_000_000);
    const validMax = max == null || (Number.isSafeInteger(max) && max >= 0 && max <= 2_000_000_000);
    const priceRange = currency && (min != null || max != null) && validMin && validMax && (min == null || max == null || min <= max)
      ? { ...(min == null ? {} : { min }), ...(max == null ? {} : { max }) } : {};
    const sort = c.req.query('sort') === 'price-asc' ? 'price-asc' as const : c.req.query('sort') === 'price-desc' ? 'price-desc' as const : undefined;
    return { ...(sort ? { sort } : {}), ...(q ? { q } : {}), ...(city ? { city } : {}), ...(area ? { area } : {}), ...(place ? { place } : {}), ...(purpose ? { purpose } : {}), ...(type ? { type } : {}), ...(currency ? { currency } : {}), ...priceRange };
  };

  const photosAt = () => d.env.SYSTEM_URL ?? 'https://system.hemlohq.com';
  const PROPERTIES_PAGE = { id: 'public-properties', slug: 'properties', kind: 'listings', title: { ar: 'عقاراتنا', en: 'Our properties' }, sections: [{ id: 'public-listings', type: 'listings', title: { ar: 'العقارات', en: 'Properties' } }], seo: {} };
  const langOf = (c: Context, config: any): Lang => (c.req.query('lang') === 'en' ? 'en' : c.req.query('lang') === 'ar' ? 'ar' : config?.lang === 'en' ? 'en' : 'ar');
  /** A business's own site (the database), or the public sample (sample.ts): both go through the same rendering. */
  const siteFor = async (sub: string, lang: Lang) => (sub === SAMPLE_SUB ? sampleSite(lang) : await siteRow(sub));
  const validSub = (sub: string) => !!sub && !RESERVED.has(sub) && /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/.test(sub);

  /** `draft`: the owner's preview: the site as it is now (not as published), rendered the same way, never cached. */
  async function serve(c: Context, slug: string, filters: WebsiteListingFilter = {}, draft?: any) {
    const sub = draft ? (draft.subdomain ?? 'site') : subOf(c);
    if (!draft && !validSub(sub)) return html(messagePage('ar', null, 'notFound', null), 404, 'no-store');
    const sample = !draft && sub === SAMPLE_SUB;
    const site: any = draft ?? await siteFor(sub, c.req.query('lang') === 'en' ? 'en' : 'ar');
    const config = (site?.publishedSnapshot ?? site)!;
    const lang = langOf(c, config);
    if (!site) return html(messagePage(lang, null, 'notFound', null), 404, 'no-store');
    const adapter = websiteAdapterFor(site.vertical);
    if (!adapter) return html(messagePage(lang, null, 'notFound', null), 404, 'no-store');
    if (!sample && !draft && !(await addonEntitlement(d.db, site.organizationId, 'website')).active) return html(messagePage(lang, null, 'notFound', null), 404, 'no-store');
    const origin = draft ? `https://${sub}.hemlohq.com` : originOf(c, sub);
    if (!draft && site.status !== 'published') {
      const wa = site.settings?.contact?.whatsapp ?? site.settings?.contact?.phone ?? null;
      return html(messagePage(lang, site.theme, 'notReady', wa), 200, 'no-store');
    }
    const t = W[lang], design = designFor(site.vertical);
    const pageOf = (pages: any[]) => (slug === '' ? pages.find((p) => p.slug === '') : pages.find((p) => p.slug === slug)) ?? (slug === 'properties' ? PROPERTIES_PAGE : null);
    // which pages need the live listings: the ones that show them, and (for a design that stages them) the hero and the office
    const needsListings = (page: any) => { const types = new Set((page.sections ?? []).map((s: any) => s.type)); return adapter.sections.some((x) => types.has(x)) || (design.id === 'estate' && (types.has('hero') || types.has('about'))); };
    const built = sample ? (() => {
      const page = pageOf(config.pages);
      if (!page) return null;
      const cs = config.settings.contact;
      return { pages: config.pages, page, name: pick(config.name, lang), tagline: pick(config.tagline, lang), about: config.about, logo: null,
        contact: { phone: cs.phone, whatsapp: cs.whatsapp, email: cs.email, address: cs.address, mapUrl: null }, products: [],
        listings: needsListings(page) ? sampleListings(lang, photosAt(), origin, slug === 'properties' ? filters : {}) : [] };
    })() : await withOrg(d.db, site.organizationId, async (tx) => {
      const pages = site.publishedSnapshot?.pages ?? await tx.select().from(webPage).where(and(eq(webPage.organizationId, site.organizationId), eq(webPage.websiteId, site.id))).orderBy(asc(webPage.sort), asc(webPage.createdAt));
      const page: any = pageOf(pages);
      if (!page) return null;
      const [o] = await tx.select({ name: organization.name }).from(organization).where(eq(organization.id, site.organizationId));
      const [ss] = await tx.select({ logoId: sysSettings.logoId }).from(sysSettings).where(eq(sysSettings.organizationId, site.organizationId));
      const logo = (await fileUrl(d.env, site.organizationId, config.logoId)) ?? (ss?.logoId ? await fileUrl(d.env, site.organizationId, ss.logoId) : null);
      const cs = config.settings?.contact ?? {};
      const contact = { phone: cs.phone ?? null, whatsapp: cs.whatsapp ?? null, email: cs.email ?? null, address: cs.address ?? null, mapUrl: cs.mapUrl ?? null };
      if (site.vertical === 'realestate') { const s = await settingsOf(tx, site.organizationId); contact.phone ??= s.phone; contact.whatsapp ??= s.whatsapp ?? s.phone; contact.email ??= s.email; contact.address ??= s.address; }
      const content = needsListings(page) ? await adapter.load(tx, d, site.organizationId, lang, origin, slug === 'properties' ? filters : {}) : { listings: [] };
      return { pages, page, name: pick(config.name, lang) || o?.name || 'Hemlo', tagline: pick(config.tagline, lang), about: config.about, logo, contact, products: [], listings: content.listings };
    });
    if (!built) return html(messagePage(lang, site.theme, 'notFound', site.settings?.contact?.whatsapp ?? null), 404, 'no-store');

    const publishedSite = { ...site, ...config };
    const basePath = new URL(origin).pathname.replace(/\/$/, '');
    const ctx: Ctx = { d, org: site.organizationId, site: publishedSite, lang, origin, t, basePath, pageSlug: slug, filters, logo: built.logo, name: built.name, tagline: built.tagline,
      contact: built.contact, products: built.products, listings: built.listings, n: 0, onPhoto: false, design, pages: built.pages, sample };
    const other: Lang = lang === 'ar' ? 'en' : 'ar';
    const altHref = `${origin}/${slug}${other === (config.lang === 'en' ? 'en' : 'ar') ? '' : `?lang=${other}`}`;
    const content = (built.page.sections ?? []).filter((sec: any) => !sec.hidden).map((sec: any, i: number) => sectionHtml(ctx, sec, i === 0)).join('');
    const header = design.header ? design.header(ctx, slug, altHref) : headerHtml(ctx, built.pages, slug, altHref);
    const bar = design.bar?.(ctx) ?? '';
    const body = `${header}<main>${content}</main>${design.footer ? design.footer(ctx) : footerHtml(ctx)}${bar}${design.chrome?.(ctx, altHref) ?? ''}${inquiryDialog(lang, built.name)}`;
    const script = INQUIRY_SCRIPT({ send: t.send, sending: t.sending, badPhone: t.badPhone, failed: t.failed, page: slug || 'home', endpoint: `${basePath}/inquiry` });

    const seo = built.page.seo ?? {};
    const title = pick(seo.title as Two, lang) || `${pick(built.page.title as Two, lang) || built.name} · ${built.name}`;
    const description = (pick(seo.description as Two, lang) || built.tagline || pick(built.about, lang) || built.name).slice(0, 300);
    const canonical = `${origin}/${slug}`;
    const jsonld: any[] = [{ '@context': 'https://schema.org', '@type': 'Organization', name: built.name, url: origin }];
    if (built.contact.phone) jsonld[0].telephone = built.contact.phone;
    if (built.logo) jsonld[0].logo = built.logo;
    if (built.contact.address) jsonld[0].address = { '@type': 'PostalAddress', streetAddress: built.contact.address, addressCountry: 'IQ' };
    const robots = draft || sample || seo.noindex || (slug === 'properties' && Object.keys(filters).length > 0) ? 'noindex' : 'index';
    // in the preview, links stay put (it is a picture of the site) and fonts come from the API's own address
    const still = `document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a,form button[type=submit]');if(a){e.preventDefault()}},true);document.addEventListener('submit',function(e){e.preventDefault()},true);`;
    return html(webFrame({ lang, title, description, canonical, alt: altHref, image: built.listings[0]?.cover ?? null, robots, theme: config.theme, body,
      bodyClass: [ctx.onPhoto ? 'on-photo' : '', bar ? 'has-bar' : ''].join(' ').trim() || undefined, script: draft ? script + still : script, jsonld, design,
      fontBase: draft ? `${d.env.API_URL ?? ''}/v1/web/pub/_hemlo/fonts` : `${basePath}/_hemlo/fonts` }), 200, draft ? 'no-store' : undefined);
  }

  async function serveProperty(c: Context, slug: string) {
    const sub = subOf(c);
    if (!validSub(sub)) return html(messagePage('ar', null, 'notFound', null), 404, 'no-store');
    const sample = sub === SAMPLE_SUB;
    const site: any = await siteFor(sub, c.req.query('lang') === 'en' ? 'en' : 'ar');
    const config = (site?.publishedSnapshot ?? site)!;
    const lang = langOf(c, config);
    if (!site || site.status !== 'published' || (!sample && !(await addonEntitlement(d.db, site.organizationId, 'website')).active)) return html(messagePage(lang, site?.theme, 'notFound', null), 404, 'no-store');
    const adapter = websiteAdapterFor(site.vertical);
    if (!adapter) return html(messagePage(lang, site.theme, 'notFound', null), 404, 'no-store');
    const origin = originOf(c, sub), design = designFor(site.vertical);
    /** Homes like this one: the same kind first, then the same purpose, then anything else on the market. */
    const similarOf = (list: WebsiteListing[], p: { slug: string; type: string; purpose: string }) =>
      [...new Set([...list.filter((l) => l.type === p.type), ...list.filter((l) => l.purpose === p.purpose), ...list])].filter((l) => l.slug !== p.slug).slice(0, 4);
    const data = sample ? (() => {
      const property = sampleProperty(lang, photosAt(), origin, slug), cs = config.settings.contact;
      return { property, name: pick(config.name, lang), logo: null, contact: { phone: cs.phone, whatsapp: cs.whatsapp, email: cs.email, address: cs.address, mapUrl: null },
        similar: property && design.property ? similarOf(sampleListings(lang, photosAt(), origin), property) : [] };
    })() : await withOrg(d.db, site.organizationId, async (tx) => {
      const property = await adapter.loadProperty(tx, d, site.organizationId, lang, slug);
      const [org] = await tx.select({ name: organization.name }).from(organization).where(eq(organization.id, site.organizationId));
      const [settings] = await tx.select({ logoId: sysSettings.logoId }).from(sysSettings).where(eq(sysSettings.organizationId, site.organizationId));
      const logo = (await fileUrl(d.env, site.organizationId, config.logoId)) ?? (settings?.logoId ? await fileUrl(d.env, site.organizationId, settings.logoId) : null);
      const cs = config.settings?.contact ?? {};
      const contact = { phone: cs.phone ?? null, whatsapp: cs.whatsapp ?? null, email: cs.email ?? null, address: cs.address ?? null, mapUrl: cs.mapUrl ?? null };
      if (site.vertical === 'realestate') { const s = await settingsOf(tx, site.organizationId); contact.phone ??= s.phone; contact.whatsapp ??= s.whatsapp ?? s.phone; contact.email ??= s.email; contact.address ??= s.address; }
      const similar = property && design.property ? similarOf((await adapter.load(tx, d, site.organizationId, lang, origin, { limit: 24 })).listings, property) : [];
      return { property, name: pick(config.name, lang) || org?.name || 'Hemlo', logo, contact, similar };
    });
    if (!data.property) return html(messagePage(lang, site.theme, 'notFound', null), 404, 'no-store');
    const p = data.property, title = `${p.title} · ${data.name}`;
    const canonical = `${origin}/properties/${encodeURIComponent(slug)}`;
    const description = [p.price, [p.area, p.city].filter(Boolean).join(' · '), p.size ? `${p.size} m²` : '', p.description[lang]?.slice(0, 120)].filter(Boolean).join(' · ').slice(0, 300);
    const publishedSite = { ...site, ...config };
    const basePath = new URL(origin).pathname.replace(/\/$/, '');
    const pages = site.publishedSnapshot?.pages ? site.publishedSnapshot.pages.slice(0, 5) : await withOrg(d.db, site.organizationId, (tx) => tx.select({ slug: webPage.slug, title: webPage.title }).from(webPage)
      .where(and(eq(webPage.organizationId, site.organizationId), eq(webPage.websiteId, site.id))).orderBy(asc(webPage.sort)).limit(5));
    const t = W[lang], ctx: Ctx = { d, org: site.organizationId, site: publishedSite, lang, origin, t, basePath, pageSlug: `property:${slug}`, filters: {},
      logo: data.logo, name: data.name, tagline: pick(config.tagline, lang), contact: data.contact, products: [], listings: [], n: 0, onPhoto: false, design, pages, sample };
    const other: Lang = lang === 'ar' ? 'en' : 'ar', altHref = `${canonical}${other === (config.lang === 'en' ? 'en' : 'ar') ? '' : `?lang=${other}`}`;
    const unavailable = ['sold', 'rented'].includes(p.status);
    let main: string, bar: string;
    if (design.property) ({ main, bar } = design.property(ctx, p, data.similar, canonical));
    else ({ main, bar } = sharedProperty(ctx, p, data.logo, basePath));
    const header = design.header ? design.header(ctx, 'properties', altHref) : headerHtml(ctx, pages, 'properties', altHref);
    const photos = p.photos.slice(0, 5);
    const lightbox = photos.length ? `<dialog id="lb" aria-label="${attr(t.allPhotos)}"><span class="n num"></span><button class="ctl x" type="button" aria-label="${attr(t.close)}">${icon('close', 'ic')}</button><button class="ctl pv" type="button" aria-label="${attr(t.prev)}">${icon('prev', 'ic')}</button><button class="ctl nx" type="button" aria-label="${attr(t.next)}">${icon('next', 'ic')}</button><div class="stage"><img alt=""></div></dialog>` : '';
    const body = `${header}${main}${design.footer ? design.footer(ctx) : footerHtml(ctx)}${bar}${design.chrome?.(ctx, altHref) ?? ''}${unavailable ? '' : inquiryDialog(lang, data.name)}${lightbox}`;
    const script = unavailable ? undefined : INQUIRY_SCRIPT({ send: t.send, sending: t.sending, badPhone: t.badPhone, failed: t.failed, page: `property:${slug}`, propertySlug: slug, endpoint: `${basePath}/inquiry` });
    const jsonld = { '@context': 'https://schema.org', '@type': 'RealEstateListing', name: p.title, url: canonical, ...(p.photos[0] ? { image: p.photos.slice(0, 5).map((x) => x.url) } : {}),
      offeredBy: { '@type': 'RealEstateAgent', name: data.name, url: origin, ...(ctx.contact.phone ? { telephone: ctx.contact.phone } : {}) } };
    return html(webFrame({ lang, title, description, canonical, alt: altHref, image: p.photos[0]?.url ?? null, robots: sample ? 'noindex' : 'index', theme: config.theme, body,
      bodyClass: bar ? 'has-bar' : undefined, script, jsonld, design, fontBase: `${basePath}/_hemlo/fonts` }), 200);
  }

  /** The owner's live preview of their site as it is now, published or not (the dashboard draws it in a frame). */
  r.get('/_hemlo/preview', async (c) => {
    const a = actor(c, 'website', 'manage');
    const [row] = await withOrg(d.db, a.organizationId, (tx) => tx.select().from(webSite).where(eq(webSite.organizationId, a.organizationId)));
    if (!row) return html(messagePage('ar', null, 'notFound', null), 404, 'no-store');
    const page = String(c.req.query('page') ?? '').toLowerCase();
    return serve(c, /^[a-z0-9-]{0,80}$/.test(page) ? page : '', {}, { ...row, publishedSnapshot: null });
  });

  /** The site's typefaces, from its own address (fonts.generated.ts). */
  const fontBytes = new Map<string, Uint8Array>();
  r.get('/_hemlo/fonts/:file', (c) => {
    const name = c.req.param('file'), b64 = WEB_FONTS[name];
    if (!b64) return c.text('Not found', 404);
    let bytes = fontBytes.get(name);
    if (!bytes) { bytes = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0)); fontBytes.set(name, bytes); }
    return new Response(bytes as unknown as BodyInit, { headers: { 'content-type': 'font/woff2', 'cache-control': 'public, max-age=31536000, immutable', 'access-control-allow-origin': '*' } });
  });

  r.get('/robots.txt', async (c) => {
    const sub = subOf(c), site = await siteRow(sub), origin = originOf(c, sub);
    const live = site?.status === 'published' && (await addonEntitlement(d.db, site.organizationId, 'website')).active;
    const body = live ? `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n` : 'User-agent: *\nDisallow: /\n';
    return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
  });
  r.get('/sitemap.xml', async (c) => {
    const sub = subOf(c), site = await siteRow(sub), origin = originOf(c, sub);
    if (!site || site.status !== 'published' || !(await addonEntitlement(d.db, site.organizationId, 'website')).active) return new Response('', { status: 404, headers: { 'content-type': 'application/xml' } });
    const adapter = websiteAdapterFor(site.vertical);
    if (!adapter) return new Response('', { status: 404, headers: { 'content-type': 'application/xml' } });
    const [pages, properties] = await withOrg(d.db, site.organizationId, async (tx) => Promise.all([
      tx.select({ slug: webPage.slug, seo: webPage.seo }).from(webPage).where(eq(webPage.organizationId, site.organizationId)).orderBy(asc(webPage.sort)),
      adapter.sitemapSlugs(tx),
    ]));
    const slugs = [...pages.filter((p) => !p.seo?.noindex).map((p) => p.slug), ...(pages.some((p) => p.slug === 'properties') ? [] : ['properties']), ...properties.map((p) => `properties/${p}`)];
    const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
    const urls = slugs.map((slug) => `  <url><loc>${xml(`${origin}/${slug}`)}</loc></url>`).join('\n');
    return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`, { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=30, s-maxage=30' } });
  });

  r.get('/properties', (c) => serve(c, 'properties', listingFilters(c)));
  r.get('/properties/:slug', (c) => serveProperty(c, c.req.param('slug').toLowerCase()));
  r.get('/', (c) => serve(c, ''));
  r.get('/:slug', (c) => serve(c, c.req.param('slug').toLowerCase()));

  /** A visitor's inquiry: name, phone, a note. Becomes (or updates) a lead in the business's own book. */
  r.post('/inquiry', async (c) => {
    const sub = subOf(c);
    if (sub === SAMPLE_SUB) return c.json({ ok: true }, 201); // the sample shows the flow; nothing is stored
    const site = await siteRow(sub);
    if (!site || site.status !== 'published') return c.json({ error: 'NOT_FOUND' }, 404);
    if (!(await addonEntitlement(d.db, site.organizationId, 'website')).active) return c.json({ error: 'NOT_FOUND' }, 404);
    const b = await c.req.json<Record<string, any>>().catch(() => ({} as Record<string, any>));
    if (b.hp) return c.json({ ok: true });
    const ip = c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const key = `web-${await hmac(d.env.AUTH_SECRET, `ip:${ip}`)}`, now = Date.now();
    const rr = (await d.db.execute(sql`insert into rate_limit (id, key, count, last_request) values (${newId()}, ${key}, 1, ${now})
      on conflict (key) do update set count = case when rate_limit.last_request < ${now - 3600_000} then 1 else rate_limit.count + 1 end,
        last_request = case when rate_limit.last_request < ${now - 3600_000} then ${now} else rate_limit.last_request end returning count`)) as any;
    const rlRows = Array.isArray(rr) ? rr : rr?.rows ?? [];
    if (Number(rlRows[0]?.count ?? 0) > 10) return c.json({ error: 'TOO_MANY' }, 429);
    const name = String(b.name ?? '').trim().slice(0, 80);
    if (!name) return c.json({ error: 'BAD_NAME' }, 400);
    const rawPhone = String(b.phone ?? '').replace(/[\s\-().]/g, '');
    const phone = normalizeIraqiPhone(String(b.phone ?? '')) ?? (/^\+[1-9]\d{7,14}$/.test(rawPhone) ? rawPhone : '');
    if (!phone) return c.json({ error: 'BAD_PHONE' }, 400);
    const email = b.email ? String(b.email).trim().slice(0, 120) : null;
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return c.json({ error: 'BAD_EMAIL' }, 400);
    const message = b.message ? String(b.message).trim().slice(0, 1000) : null;
    const adapter = websiteAdapterFor(site.vertical);
    if (!adapter) return c.json({ error: 'NOT_FOUND' }, 404);
    const page = typeof b.page === 'string' && /^(?:property:)?[a-z0-9-]{1,80}$/.test(b.page) ? b.page : 'home';
    const propertySlug = b.propertySlug == null ? undefined : String(b.propertySlug).trim().toLowerCase();
    if (propertySlug && !/^[a-z0-9](?:[a-z0-9-]{0,80}[a-z0-9])?$/.test(propertySlug)) return c.json({ error: 'BAD_PROPERTY' }, 400);
    const filed = await withOrg(d.db, site.organizationId, (tx) => adapter.createInquiry(tx, { organizationId: site.organizationId, name, phone, email, message, lang: site.lang, page, propertySlug }));
    // Hemlo Connect: the visitor hears back on WhatsApp within seconds (after this response, never slowing it)
    const answer = () => onInquiry(d, site.organizationId, filed.leadId, filed.about).catch((e) => console.error('[connect inquiry]', e instanceof Error ? e.message : e));
    if (d.later) d.later(answer); else await answer();
    return c.json({ ok: true }, 201);
  });

  return r;
}
