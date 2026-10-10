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
import { websiteAdapterFor, type WebsiteListingFilter } from './adapters';
import { addonEntitlement } from '../../addons';
import { W, pick, webFrame, waHref, telHref, moneyIqd, sectionHeading, inquiryDialog, INQUIRY_SCRIPT, esc, attr, icon, fill, type Lang } from './theme';
import type { AppEnv, Deps } from '../../types';

const RESERVED = new Set(['www', 'api', 'app', 'admin', 'account', 'studio', 'mail', 'ftp', 'cdn', 'static', 'assets', 'demo', 'test', 'systems', 'tools']);
type Two = { ar?: string; en?: string };
type Ctx = {
  d: Deps; org: string; site: any; lang: Lang; origin: string; t: (typeof W)[Lang];
  basePath: string;
  pageSlug: string; filters: WebsiteListingFilter;
  logo: string | null; name: string; tagline: string;
  contact: { phone: string | null; whatsapp: string | null; email: string | null; address: string | null; mapUrl: string | null };
  products: { id: string; name: string; category: string | null; price: number; image: string | null }[];
  listings: { slug: string; title: string; area: string | null; price: string; status: string; cover: string | null; href: string }[];
};

const initials = (n: string) => { const w = (n || '·').trim().split(/\s+/); return /[\u0600-\u06ff]/.test(w[0]) ? w[0][0] : w.slice(0, 2).map((x) => x[0]).join('').toUpperCase(); };
const paras = (s: string) => s.split(/\n{2,}|\r\n\r\n/).map((p) => `<p>${esc(p.trim()).replace(/\n/g, '<br>')}</p>`).join('');
const strOf = (v: any, lang: Lang): string => { if (v == null) return ''; if (typeof v === 'string') return v; return pick(v as Two, lang); };
const itemsOf = (sec: WebSection): any[] => (Array.isArray((sec as any).items) ? (sec as any).items : []);
const field = (sec: WebSection, key: string, lang: Lang) => strOf((sec as any)[key], lang);

/** The buttons a page offers, from the site's contact details and its CTA switches. */
function ctaRow(ctx: Ctx, what: string) {
  const t = ctx.t, cta = ctx.site.settings?.cta ?? {}, out: string[] = [];
  const wa = cta.whatsapp !== false && ctx.contact.whatsapp ? waHref(ctx.contact.whatsapp, fill(t.waHello, { what, url: ctx.origin + '/' })) : null;
  if (wa) out.push(`<a class="btn wa" href="${attr(wa)}" rel="noopener">${icon('wa')}${t.whatsapp}</a>`);
  const tel = cta.phone !== false ? telHref(ctx.contact.phone) : null;
  if (tel) out.push(`<a class="btn" href="${attr(tel)}">${icon('call')}${t.call}</a>`);
  if (cta.inquiry !== false) out.push(`<button class="btn accent" type="button" data-inquire>${t.inquire}</button>`);
  return out.length ? `<div class="wcta">${out.join('')}</div>` : '';
}
const askBtn = (ctx: Ctx, what: string) => {
  const wa = ctx.contact.whatsapp ? waHref(ctx.contact.whatsapp, fill(ctx.t.waHello, { what, url: ctx.origin + '/' })) : null;
  return wa ? `<a class="btn wa sm" href="${attr(wa)}" rel="noopener">${icon('wa')}${ctx.t.ask}</a>` : '';
};

function sectionHtml(ctx: Ctx, sec: WebSection): string {
  const t = ctx.t, lang = ctx.lang, heading = sectionHeading(sec.type, sec.title as Two, lang);
  const block = (inner: string) => (inner ? `<section class="wsec"><div class="wwrap"><h2>${esc(heading)}</h2>${inner}</div></section>` : '');
  switch (sec.type) {
    case 'hero': {
      const title = pick((sec as any).title as Two, lang) || ctx.name;
      const text = field(sec, 'text', lang) || ctx.tagline;
      return `<section class="hero"><div class="wwrap"><h1>${esc(title)}</h1>${text ? `<p>${esc(text)}</p>` : ''}${ctaRow(ctx, title)}</div></section>`;
    }
    case 'about': {
      const body = field(sec, 'text', lang) || field(sec, 'body', lang) || pick(ctx.site.about, lang);
      return body ? block(`<div class="wmuted">${paras(body)}</div>`) : '';
    }
    case 'products': {
      if (!ctx.products.length) return '';
      const cards = ctx.products.map((p) => `<article class="wcard">${p.image ? `<div class="ph"><img src="${attr(p.image)}" alt="" loading="lazy" decoding="async"></div>` : ''}
<div class="bd"><div class="tt">${esc(p.name)}</div>${p.category ? `<div class="mt"><span>${esc(p.category)}</span></div>` : ''}<div class="pr num" dir="ltr">${moneyIqd(p.price, lang)}</div>${askBtn(ctx, p.name)}</div></article>`).join('');
      return block(`<div class="wgrid">${cards}</div>`);
    }
    case 'listings': {
      const search = ctx.pageSlug === 'properties' ? listingSearch(ctx) : '';
      if (!ctx.listings.length) return ctx.pageSlug === 'properties' ? block(`${search}<p class="wempty">${ctx.lang === 'ar' ? 'لا توجد عقارات تطابق بحثك.' : 'No properties match your search.'}</p>`) : '';
      const cards = ctx.listings.map((l) => `<article class="wcard">${l.cover ? `<div class="ph"><img src="${attr(l.cover)}" alt="" loading="lazy" decoding="async"></div>` : ''}
<div class="bd"><span class="wstatus">${esc(ctx.lang === 'ar' ? ({ available: 'متاح', reserved: 'محجوز', negotiating: 'قيد التفاوض', sold: 'مباع', rented: 'مؤجّر' } as Record<string, string>)[l.status] ?? l.status : ({ available: 'Available', reserved: 'Reserved', negotiating: 'Negotiating', sold: 'Sold', rented: 'Rented' } as Record<string, string>)[l.status] ?? l.status)}</span><div class="tt">${esc(l.title)}</div>${l.area ? `<div class="mt"><span>${esc(l.area)}</span></div>` : ''}<div class="pr num" dir="ltr">${l.price}</div>
<div class="wrow" style="margin-top:auto"><a class="btn sm" href="${attr(l.href)}">${t.viewAll}</a>${askBtn(ctx, l.title)}</div></div></article>`).join('');
      return block(`${search}<div class="wgrid">${cards}</div>`);
    }
    case 'services': {
      const items = itemsOf(sec).map((it) => `<article class="wcard"><div class="bd"><div class="tt">${esc(strOf(it.title ?? it.name, lang))}</div>${strOf(it.text ?? it.desc, lang) ? `<div class="mt">${esc(strOf(it.text ?? it.desc, lang))}</div>` : ''}</div></article>`).join('');
      return items ? block(`<div class="wgrid">${items}</div>`) : '';
    }
    case 'gallery': {
      const imgs = (Array.isArray((sec as any).images) ? (sec as any).images : []).map((x: any) => (typeof x === 'string' ? x : x?.url)).filter((x: any) => typeof x === 'string' && /^https?:\/\//.test(x));
      return imgs.length ? block(`<div class="wgal">${imgs.map((u: string) => `<img src="${attr(u)}" alt="" loading="lazy" decoding="async">`).join('')}</div>`) : '';
    }
    case 'team': {
      const members = itemsOf(sec).map((m) => `<div class="wmember"><span class="av">${m.photo ? `<img src="${attr(m.photo)}" alt="">` : esc(initials(strOf(m.name, lang)))}</span><b>${esc(strOf(m.name, lang))}</b>${strOf(m.title ?? m.role, lang) ? `<small>${esc(strOf(m.title ?? m.role, lang))}</small>` : ''}</div>`).join('');
      return members ? block(`<div class="wteam">${members}</div>`) : '';
    }
    case 'faq': {
      const qs = itemsOf(sec).map((q) => { const a = strOf(q.a ?? q.answer ?? q.text, lang); return `<details><summary>${esc(strOf(q.q ?? q.title, lang))}</summary>${a ? `<p>${esc(a)}</p>` : ''}</details>`; }).join('');
      return qs ? block(`<div class="wfaq">${qs}</div>`) : '';
    }
    case 'hours': {
      const rows = itemsOf(sec).map((h) => `<li><span>${esc(strOf(h.day, lang))}</span><span dir="ltr">${esc(strOf(h.time, lang))}</span></li>`).join('');
      return rows ? block(`<ul class="whours">${rows}</ul>`) : '';
    }
    case 'testimonials': {
      const qs = itemsOf(sec).map((q) => `<blockquote class="wquote"><p>${esc(strOf(q.quote ?? q.text, lang))}</p>${strOf(q.author ?? q.name, lang) ? `<small>${esc(strOf(q.author ?? q.name, lang))}</small>` : ''}</blockquote>`).join('');
      return qs ? block(`<div class="wgrid">${qs}</div>`) : '';
    }
    case 'contact': {
      const c = ctx.contact, links: string[] = [];
      if (c.whatsapp) links.push(`<a class="btn wa sm" href="${attr(waHref(c.whatsapp, fill(t.waHello, { what: ctx.name, url: ctx.origin + '/' }))!)}" rel="noopener">${icon('wa')}${t.whatsapp}</a>`);
      if (c.phone) links.push(`<a class="btn sm" href="${attr(telHref(c.phone)!)}">${icon('call')}${t.call}</a>`);
      if (c.email) links.push(`<a class="btn sm" href="mailto:${attr(c.email)}">${esc(c.email)}</a>`);
      links.push(`<button class="btn accent sm" type="button" data-inquire>${t.inquire}</button>`);
      const addr = c.address ? `<p class="wmuted" style="margin-top:14px">${icon('pin')} ${esc(c.address)}</p>` : '';
      return block(`<div class="wcontact">${links.join('')}</div>${addr}`);
    }
    case 'cta': {
      const text = field(sec, 'text', lang) || pick(ctx.site.tagline, lang);
      return `<section class="wsec"><div class="wwrap" style="text-align:center"><h2>${esc(heading)}</h2>${text ? `<p class="wmuted" style="margin:0 auto 6px">${esc(text)}</p>` : ''}${ctaRow(ctx, heading)}</div></section>`;
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
  return `<form class="wsearch" method="get" action="${attr(ctx.basePath)}/properties"><input type="hidden" name="lang" value="${ctx.lang}">${field('q', ar ? 'بحث' : 'Search', f.q ?? '')}${purpose}${type}${field('city', ar ? 'المدينة' : 'City', f.city ?? '')}${field('area', ar ? 'المنطقة' : 'Area', f.area ?? '')}${currency}${field('min', ar ? 'السعر من' : 'Min price', f.min ?? '', '', 'number')}${field('max', ar ? 'السعر إلى' : 'Max price', f.max ?? '', '', 'number')}<div class="wsearch-actions"><button class="btn accent" type="submit">${ar ? 'عرض العقارات' : 'Show properties'}</button><a class="btn" href="${attr(ctx.basePath)}/properties?lang=${ctx.lang}">${ar ? 'مسح' : 'Clear'}</a></div></form>`;
}

export function webPublicRoutes(d: Deps) {
  const r = new Hono<AppEnv>();

  const subOf = (c: Context) => {
    const h = c.req.header('x-hemlo-site');
    if (h) return h.toLowerCase().trim();
    const host = (c.req.header('host') ?? '').toLowerCase().split(':')[0];
    const INFRA = ['api', 'www', 'account', 'admin', 'system', 'studio', 'tools', 'demo'];
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
    const purpose = ['sale', 'rent'].includes(c.req.query('purpose') ?? '') ? c.req.query('purpose') : undefined;
    const type = (RE_TYPES as readonly string[]).includes(c.req.query('type') ?? '') ? c.req.query('type') : undefined;
    const currency = ['USD', 'IQD'].includes(c.req.query('currency') ?? '') ? c.req.query('currency') : undefined;
    const minRaw = (c.req.query('min') ?? '').trim(), maxRaw = (c.req.query('max') ?? '').trim();
    const min = minRaw ? Number(minRaw) : undefined, max = maxRaw ? Number(maxRaw) : undefined;
    const validMin = min == null || (Number.isSafeInteger(min) && min >= 0 && min <= 2_000_000_000);
    const validMax = max == null || (Number.isSafeInteger(max) && max >= 0 && max <= 2_000_000_000);
    const priceRange = currency && (min != null || max != null) && validMin && validMax && (min == null || max == null || min <= max)
      ? { ...(min == null ? {} : { min }), ...(max == null ? {} : { max }) } : {};
    return { ...(q ? { q } : {}), ...(city ? { city } : {}), ...(area ? { area } : {}), ...(purpose ? { purpose } : {}), ...(type ? { type } : {}), ...(currency ? { currency } : {}), ...priceRange };
  };

  async function serve(c: Context, slug: string, filters: WebsiteListingFilter = {}) {
    const sub = subOf(c);
    if (!sub || RESERVED.has(sub) || !/^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/.test(sub)) return html(messagePage('ar', null, 'notFound', null), 404, 'no-store');
    const site = await siteRow(sub);
    const config = (site?.publishedSnapshot ?? site)!;
    const lang: Lang = c.req.query('lang') === 'en' ? 'en' : c.req.query('lang') === 'ar' ? 'ar' : config?.lang === 'en' ? 'en' : 'ar';
    if (!site) return html(messagePage(lang, null, 'notFound', null), 404, 'no-store');
    const adapter = websiteAdapterFor(site.vertical);
    if (!adapter) return html(messagePage(lang, null, 'notFound', null), 404, 'no-store');
    if (!(await addonEntitlement(d.db, site.organizationId, 'website')).active) return html(messagePage(lang, null, 'notFound', null), 404, 'no-store');
    const origin = originOf(c, sub);
    if (site.status !== 'published') {
      const wa = site.settings?.contact?.whatsapp ?? site.settings?.contact?.phone ?? null;
      return html(messagePage(lang, site.theme, 'notReady', wa), 200, 'no-store');
    }
    const t = W[lang];
    const built = await withOrg(d.db, site.organizationId, async (tx) => {
      const pages = site.publishedSnapshot?.pages ?? await tx.select().from(webPage).where(and(eq(webPage.organizationId, site.organizationId), eq(webPage.websiteId, site.id))).orderBy(asc(webPage.sort), asc(webPage.createdAt));
      let page: any = slug === '' ? pages.find((p) => p.slug === '') : pages.find((p) => p.slug === slug);
      if (!page && slug === 'properties') page = { id: 'public-properties', slug, kind: 'listings', title: { ar: 'عقاراتنا', en: 'Our properties' }, sections: [{ id: 'public-listings', type: 'listings', title: { ar: 'العقارات', en: 'Properties' } }], seo: {} };
      if (!page) return null;
      const [o] = await tx.select({ name: organization.name }).from(organization).where(eq(organization.id, site.organizationId));
      const [ss] = await tx.select({ logoId: sysSettings.logoId }).from(sysSettings).where(eq(sysSettings.organizationId, site.organizationId));
      let logo = (await fileUrl(d.env, site.organizationId, config.logoId)) ?? (ss?.logoId ? await fileUrl(d.env, site.organizationId, ss.logoId) : null);
      const cs = config.settings?.contact ?? {};
      const contact = { phone: cs.phone ?? null, whatsapp: cs.whatsapp ?? null, email: cs.email ?? null, address: cs.address ?? null, mapUrl: cs.mapUrl ?? null };
      if (site.vertical === 'realestate') { const s = await settingsOf(tx, site.organizationId); contact.phone ??= s.phone; contact.whatsapp ??= s.whatsapp ?? s.phone; contact.email ??= s.email; contact.address ??= s.address; }
      const types = new Set((page.sections ?? []).map((s: any) => s.type));
      const content = adapter.sections.some((section) => types.has(section)) ? await adapter.load(tx, d, site.organizationId, lang, origin, slug === 'properties' ? filters : {}) : { listings: [] };
      return { pages, page, name: pick(config.name, lang) || o?.name || 'Hemlo', tagline: pick(config.tagline, lang), about: config.about, logo, contact, products: [], listings: content.listings };
    });
    if (!built) return html(messagePage(lang, site.theme, 'notFound', site.settings?.contact?.whatsapp ?? null), 404, 'no-store');

    const publishedSite = { ...site, ...config };
    const basePath = new URL(origin).pathname.replace(/\/$/, '');
    const ctx: Ctx = { d, org: site.organizationId, site: publishedSite, lang, origin, t, basePath, pageSlug: slug, filters, logo: built.logo, name: built.name, tagline: built.tagline, contact: built.contact, products: built.products, listings: built.listings };
    const navPages = built.pages.slice(0, 5);
    const nav = navPages.map((p: any) => `<a href="${attr(basePath)}/${p.slug}">${esc(pick(p.title, lang) || p.slug || t.hero)}</a>`).join('')
      + (adapter.sections.includes('listings') && !built.pages.some((p: any) => p.slug === 'properties') ? `<a href="${attr(basePath)}/properties">${lang === 'ar' ? 'العقارات' : 'Properties'}</a>` : '');
    const other: Lang = lang === 'ar' ? 'en' : 'ar';
    const altHref = `${origin}/${slug}${other === 'en' ? '?lang=en' : ''}`;
    const header = `<header class="wtop"><div class="wwrap">
<a class="wbrand" href="${attr(basePath)}/">${built.logo ? `<img src="${attr(built.logo)}" alt="">` : `<span class="mono">${esc(initials(built.name))}</span>`}<span>${esc(built.name)}</span></a>
<nav class="wnav">${nav}</nav>
<a class="wchip" href="${attr(altHref)}" hreflang="${other}" lang="${other}">${lang === 'ar' ? 'English' : 'العربية'}</a>
</div></header>`;
    const addr = built.contact.address ? `<span>${esc(built.contact.address)}</span>` : '';
    const footer = `<footer class="wfoot"><div class="wwrap"><span>© ${esc(built.name)} ${addr}</span><a href="https://hemlohq.com/${lang === 'en' ? 'en/' : ''}systems/" rel="noopener">${t.powered}</a></div></footer>`;
    const content = (built.page.sections ?? []).map((sec: any) => sectionHtml(ctx, sec)).join('');
    const body = `${header}<main>${content}</main>${footer}${inquiryDialog(lang, built.name)}`;
    const script = INQUIRY_SCRIPT({ send: t.send, sending: t.sending, badPhone: t.badPhone, failed: t.failed, page: slug || 'home', endpoint: `${basePath}/inquiry` });

    const seo = built.page.seo ?? {};
    const title = pick(seo.title as Two, lang) || `${pick(built.page.title as Two, lang) || built.name} · ${built.name}`;
    const description = (pick(seo.description as Two, lang) || built.tagline || pick(built.about, lang) || built.name).slice(0, 300);
    const canonical = `${origin}/${slug}`;
    const jsonld: any[] = [{ '@context': 'https://schema.org', '@type': 'Organization', name: built.name, url: origin }];
    if (built.contact.phone) jsonld[0].telephone = built.contact.phone;
    if (built.logo) jsonld[0].logo = built.logo;
    if (built.contact.address) jsonld[0].address = { '@type': 'PostalAddress', streetAddress: built.contact.address, addressCountry: 'IQ' };
    const robots = seo.noindex || (slug === 'properties' && Object.keys(filters).length > 0) ? 'noindex' : 'index';
    return html(webFrame({ lang, title, description, canonical, alt: altHref, image: built.listings[0]?.cover ?? null, robots, theme: config.theme, body, script, jsonld }), 200);
  }

  async function serveProperty(c: Context, slug: string) {
    const sub = subOf(c);
    if (!sub || RESERVED.has(sub) || !/^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/.test(sub)) return html(messagePage('ar', null, 'notFound', null), 404, 'no-store');
    const site = await siteRow(sub);
    const config = (site?.publishedSnapshot ?? site)!;
    const lang: Lang = c.req.query('lang') === 'en' ? 'en' : c.req.query('lang') === 'ar' ? 'ar' : config?.lang === 'en' ? 'en' : 'ar';
    if (!site || site.status !== 'published' || !(await addonEntitlement(d.db, site.organizationId, 'website')).active) return html(messagePage(lang, site?.theme, 'notFound', null), 404, 'no-store');
    const adapter = websiteAdapterFor(site.vertical);
    if (!adapter) return html(messagePage(lang, site.theme, 'notFound', null), 404, 'no-store');
    const data = await withOrg(d.db, site.organizationId, async (tx) => {
      const property = await adapter.loadProperty(tx, d, site.organizationId, lang, slug);
      const [org] = await tx.select({ name: organization.name }).from(organization).where(eq(organization.id, site.organizationId));
      const [settings] = await tx.select({ logoId: sysSettings.logoId }).from(sysSettings).where(eq(sysSettings.organizationId, site.organizationId));
      const logo = (await fileUrl(d.env, site.organizationId, config.logoId)) ?? (settings?.logoId ? await fileUrl(d.env, site.organizationId, settings.logoId) : null);
      const cs = config.settings?.contact ?? {};
      const contact = { phone: cs.phone ?? null, whatsapp: cs.whatsapp ?? null,
        email: cs.email ?? null, address: cs.address ?? null, mapUrl: cs.mapUrl ?? null };
      if (site.vertical === 'realestate') { const s = await settingsOf(tx, site.organizationId); contact.phone ??= s.phone; contact.whatsapp ??= s.whatsapp ?? s.phone; contact.email ??= s.email; contact.address ??= s.address; }
      return { property, name: pick(config.name, lang) || org?.name || 'Hemlo', logo, contact };
    });
    if (!data.property) return html(messagePage(lang, site.theme, 'notFound', null), 404, 'no-store');
    const p = data.property, origin = originOf(c, sub), title = `${p.title} · ${data.name}`;
    const canonical = `${origin}/properties/${encodeURIComponent(slug)}`;
    const description = [p.price, [p.area, p.city].filter(Boolean).join(' · '), p.size ? `${p.size} m²` : '', p.description[lang]?.slice(0, 120)].filter(Boolean).join(' · ').slice(0, 300);
    const publishedSite = { ...site, ...config };
    const basePath = new URL(origin).pathname.replace(/\/$/, '');
    const t = W[lang], ctx: Ctx = { d, org: site.organizationId, site: publishedSite, lang, origin, t, basePath, pageSlug: `property:${slug}`, filters: {},
      logo: data.logo, name: data.name, tagline: pick(config.tagline, lang), contact: data.contact, products: [], listings: [] };
    const other: Lang = lang === 'ar' ? 'en' : 'ar', altHref = `${canonical}${other === 'en' ? '?lang=en' : ''}`;
    const pages = site.publishedSnapshot?.pages ? site.publishedSnapshot.pages.slice(0, 5) : await withOrg(d.db, site.organizationId, (tx) => tx.select({ slug: webPage.slug, title: webPage.title }).from(webPage)
      .where(and(eq(webPage.organizationId, site.organizationId), eq(webPage.websiteId, site.id))).orderBy(asc(webPage.sort)).limit(5));
    const nav = pages.map((x) => `<a href="${attr(basePath)}/${x.slug}">${esc(pick(x.title, lang) || x.slug || t.hero)}</a>`).join('') + `<a href="${attr(basePath)}/properties">${lang === 'ar' ? 'العقارات' : 'Properties'}</a>`;
    const header = `<header class="wtop"><div class="wwrap"><a class="wbrand" href="${attr(basePath)}/">${data.logo ? `<img src="${attr(data.logo)}" alt="">` : `<span class="mono">${esc(initials(data.name))}</span>`}<span>${esc(data.name)}</span></a><nav class="wnav">${nav}</nav><a class="wchip" href="${attr(altHref)}" hreflang="${other}" lang="${other}">${lang === 'ar' ? 'English' : 'العربية'}</a></div></header>`;
    const photoHtml = p.photos.length ? `<div class="wphotos">${p.photos.slice(0, 5).map((x, i) => `<img src="${attr(x.url)}" alt="${attr(x.caption ?? p.title)}" ${i ? 'loading="lazy"' : 'fetchpriority="high"'} decoding="async">`).join('')}</div>` : '';
    const fact = (label: string, value: string | number | null) => value == null || value === '' ? '' : `<div><small>${esc(label)}</small><b>${esc(String(value))}</b></div>`;
    const statusLabels: Record<string, string> = lang === 'ar' ? { available: 'متاح', reserved: 'محجوز', negotiating: 'قيد التفاوض', sold: 'مباع', rented: 'مؤجّر' }
      : { available: 'Available', reserved: 'Reserved', negotiating: 'Negotiating', sold: 'Sold', rented: 'Rented' };
    const unavailable = ['sold', 'rented'].includes(p.status);
    const details = `<main class="wdetail"><div class="wwrap"><a class="sub" href="${attr(basePath)}/properties">${lang === 'ar' ? '← جميع العقارات' : '← All properties'}</a><span class="wstatus">${esc(statusLabels[p.status] ?? p.status)}</span><h1>${esc(p.title)}</h1><p class="wmuted">${esc([p.area, p.city].filter(Boolean).join(' · '))}</p><div class="pr num" dir="ltr">${esc(p.price)}</div>${p.negotiable && !unavailable ? `<p class="wmuted">${lang === 'ar' ? 'قابل للتفاوض' : 'Negotiable'}</p>` : ''}${photoHtml}
      <div class="wfacts">${fact(lang === 'ar' ? 'النوع' : 'Type', typeName(p.type, lang))}${fact(lang === 'ar' ? 'الغرض' : 'Purpose', p.purpose === 'rent' ? (lang === 'ar' ? 'إيجار' : 'Rent') : (lang === 'ar' ? 'بيع' : 'Sale'))}${fact(lang === 'ar' ? 'المساحة' : 'Area', p.size ? `${p.size} m²` : null)}${fact(lang === 'ar' ? 'الأرض' : 'Land', p.land ? `${p.land} m²` : null)}${fact(lang === 'ar' ? 'غرف النوم' : 'Bedrooms', p.bedrooms)}${fact(lang === 'ar' ? 'الحمامات' : 'Bathrooms', p.bathrooms)}${fact(lang === 'ar' ? 'الطوابق' : 'Floors', p.floors)}${fact(lang === 'ar' ? 'موقف السيارات' : 'Parking', p.parking)}${fact(lang === 'ar' ? 'سنة البناء' : 'Year built', p.yearBuilt)}</div>
      ${p.description[lang] ? `<section class="wsec"><h2>${lang === 'ar' ? 'عن العقار' : 'About this property'}</h2><div class="wmuted">${paras(p.description[lang]!)}</div></section>` : ''}${p.features.length ? `<section class="wsec"><h2>${lang === 'ar' ? 'المميزات' : 'Features'}</h2><ul class="wfeatures">${p.features.map((f) => `<li>${esc(featureName(f, lang))}</li>`).join('')}</ul></section>` : ''}
      ${p.map ? `<p><a class="btn sm" href="https://www.openstreetmap.org/?mlat=${p.map.lat}&mlon=${p.map.lng}#map=16/${p.map.lat}/${p.map.lng}" rel="noopener" target="_blank">${lang === 'ar' ? 'عرض الموقع على الخريطة' : 'View location on map'}</a></p>` : ''}${p.video && /^https:\/\//.test(p.video) ? `<p><a class="btn sm" href="${attr(p.video)}" rel="noopener" target="_blank">${lang === 'ar' ? 'شاهد الفيديو' : 'Watch the video'}</a></p>` : ''}
      ${unavailable ? `<p class="wempty">${lang === 'ar' ? 'هذا العقار غير متاح حالياً.' : 'This property is no longer available.'}</p>` : ctaRow(ctx, p.title)}</div></main>`;
    const footer = `<footer class="wfoot"><div class="wwrap"><span>© ${esc(data.name)} ${data.contact.address ? esc(data.contact.address) : ''}</span><a href="https://hemlohq.com/systems/" rel="noopener">${t.powered}</a></div></footer>`;
    const body = `${header}${details}${footer}${unavailable ? '' : inquiryDialog(lang, data.name)}`;
    const script = unavailable ? undefined : INQUIRY_SCRIPT({ send: t.send, sending: t.sending, badPhone: t.badPhone, failed: t.failed, page: `property:${slug}`, propertySlug: slug, endpoint: `${basePath}/inquiry` });
    return html(webFrame({ lang, title, description, canonical, alt: altHref, image: p.photos[0]?.url ?? null, robots: 'index', theme: config.theme, body, script,
      jsonld: { '@context': 'https://schema.org', '@type': 'Organization', name: data.name, url: origin } }), 200);
  }

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
    const sub = subOf(c), site = await siteRow(sub);
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
    const page = typeof b.page === 'string' && /^[a-z0-9-]{1,40}$/.test(b.page) ? b.page : 'home';
    const propertySlug = b.propertySlug == null ? undefined : String(b.propertySlug).trim().toLowerCase();
    if (propertySlug && !/^[a-z0-9](?:[a-z0-9-]{0,80}[a-z0-9])?$/.test(propertySlug)) return c.json({ error: 'BAD_PROPERTY' }, 400);
    await withOrg(d.db, site.organizationId, (tx) => adapter.createInquiry(tx, { organizationId: site.organizationId, name, phone, email, message, lang: site.lang, page, propertySlug }));
    return c.json({ ok: true }, 201);
  });

  return r;
}
