// The public side of Hemlo Real Estate, served at hemlohq.com/p/{slug} (a listing), /c/{token} (a collection) and
// /r/{token} (an owner's report) through the website's Worker. No sign-in, no cookies. Each page reads ONLY the columns
// meant to be public (never the address, the owner, the lowest price, the notes). Drafts and archived listings don't
// exist here; reserved and sold ones say so honestly (and aren't indexed). A viewing request from a page becomes a
// lead (or updates the one with that phone) and a viewing to schedule, and the agency hears about it at once.
import { Hono, type Context } from 'hono';
import { and, desc, eq, inArray, ne, sql } from 'drizzle-orm';
import { hmac, newId } from '@hemlo/core';
import { withOrg, withSystem, type Database } from '@hemlo/db';
import { reProperty, reMedia, reLead, reLeadProperty, reViewing, reCollection, reCollectionItem, reReport, reOffer, reDeal, reStat, reAgent, organization, sysSettings } from '@hemlo/db/schema';
import { fileUrl } from '../../files';
import { rowsOf, phone as cleanPhone, str, activity, notice, settingsOf, photosOf, coverFirst, today, featureName, typeName, SITE, priceText } from './common';
import { PUBLIC_STATUSES } from './properties';
import { esc, attr, T, fill, priceHtml, icon, frame, SCRIPT, type Lang } from './page';
import type { AppEnv, Deps } from '../../types';

const BOTS = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|slack|discord|twitter|linkedin|embed|curl|wget|python|headless/i;
const STAT_COLS = { view: 'views', wa: 'wa', call: 'calls', share: 'shares', qr: 'qr', request: 'requests', favorite: 'favorites' } as const;
type StatKind = keyof typeof STAT_COLS;

/** +1 to today's count for a listing (and its running total). */
export async function bump(tx: Database, org: string, propertyId: string, kind: StatKind) {
  const col = STAT_COLS[kind];
  await tx.execute(sql`insert into re_stat (organization_id, property_id, day, ${sql.identifier(col)}) values (${org}, ${propertyId}, ${today()}, 1)
    on conflict (property_id, day) do update set ${sql.identifier(col)} = re_stat.${sql.identifier(col)} + 1`);
  await tx.execute(sql`update re_property set stats = jsonb_set(stats, ${'{' + col + '}'}, to_jsonb(coalesce((stats->>${col})::int, 0) + 1)) where id = ${propertyId}`);
}

const langOf = (c: Context, fallback: Lang = 'ar'): Lang => (c.req.query('lang') === 'en' ? 'en' : c.req.query('lang') === 'ar' ? 'ar' : fallback);
const html = (c: Context, body: string, status = 200, cache = 'public, max-age=60, s-maxage=60') => new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': cache, 'x-content-type-options': 'nosniff', 'referrer-policy': 'strict-origin-when-cross-origin' } });

/** The agency's public face: name, logo, phone, WhatsApp. */
async function agencyOf(d: Deps, tx: Database, org: string) {
  const [o] = await tx.select({ name: organization.name }).from(organization).where(eq(organization.id, org));
  const [ss] = await tx.select({ logoId: sysSettings.logoId }).from(sysSettings).where(eq(sysSettings.organizationId, org));
  const s = await settingsOf(tx, org);
  return { name: o?.name ?? 'Hemlo', logo: await fileUrl(d.env, org, ss?.logoId), phone: s.phone, whatsapp: s.whatsapp ?? s.phone, about: s.about, settings: s };
}
async function agentOf(d: Deps, tx: Database, org: string, memberId: string | null) {
  if (!memberId) return null;
  const [a] = await tx.select().from(reAgent).where(eq(reAgent.memberId, memberId));
  const [u] = a ? [] : rowsOf(await tx.execute(sql`select u.name from member m join "user" u on u.id = m.user_id where m.id = ${memberId}`));
  if (!a && !u) return null;
  return { name: a?.name ?? u.name, title: a?.title ?? null, phone: a?.phone ?? null, whatsapp: a?.whatsapp ?? a?.phone ?? null, photo: a?.photoId ? await fileUrl(d.env, org, a.photoId) : null, active: a?.active ?? true };
}
const initials = (n: string) => { const w = (n || '·').trim().split(/\s+/); return /[؀-ۿ]/.test(w[0]) ? w[0][0] : w.slice(0, 2).map((x) => x[0]).join('').toUpperCase(); };
const wa = (num: string | null | undefined, text: string) => (num ? `https://wa.me/${num.replace(/\D/g, '')}?text=${encodeURIComponent(text)}` : null);
const tel = (num: string | null | undefined) => (num ? `tel:${num.replace(/[^\d+]/g, '')}` : null);
const paras = (s: string) => s.split(/\n{2,}|\r\n\r\n/).map((p) => `<p>${esc(p.trim()).replace(/\n/g, '<br>')}</p>`).join('');

function topBar(agency: { name: string; logo: string | null }, lang: Lang, altHref: string | null) {
  return `<header class="top"><div class="wrap"><span class="brand">${agency.logo ? `<img src="${attr(agency.logo)}" alt="">` : `<span class="mono">${esc(initials(agency.name))}</span>`}<span>${esc(agency.name)}</span></span><span class="sp"></span>
${altHref ? `<a class="chip-btn" href="${attr(altHref)}" hreflang="${lang === 'ar' ? 'en' : 'ar'}" lang="${lang === 'ar' ? 'en' : 'ar'}">${T[lang].switchLang}</a>` : ''}
<button class="chip-btn noprint" data-share aria-label="${T[lang].share}">${icon('share', 'ic')}<span>${T[lang].share}</span></button></div></header>`;
}
const foot = (lang: Lang, agency: string) => `<footer><div class="wrap"><span>${esc(T[lang].listedBy)} ${esc(agency)}</span><a href="https://hemlohq.com/${lang === 'en' ? 'en/' : ''}realestate/" rel="noopener">${T[lang].powered}</a></div></footer>`;
function card(p: any, lang: Lang, href: string, cover: string | null, opts: { fav?: boolean; favOn?: boolean } = {}) {
  const t = T[lang], title = (lang === 'en' && p.titleEn) || p.title;
  const st = p.status === 'reserved' ? `<span class="status reserved st">${t.reserved}</span>` : p.status === 'sold' || p.status === 'rented' ? `<span class="status sold st">${t[p.status as 'sold']}</span>` : '';
  return `<a class="pc" href="${attr(href)}"><div class="ph">${cover ? `<img src="${attr(cover)}" alt="" loading="lazy" decoding="async">` : ''}</div>${st}
${opts.fav ? `<button class="fav${opts.favOn ? ' on' : ''}" data-fav="${attr(p.id)}" aria-pressed="${opts.favOn ? 'true' : 'false'}" aria-label="${t.save}">${icon('heart')}</button>` : ''}
<div class="bd"><div class="pr">${priceHtml(p.price == null ? null : Number(p.price), p.currency, lang, p.purpose === 'rent' ? p.rentPeriod : null)}</div><div class="tt">${esc(title)}</div>
<div class="mt">${p.area ? `<span>${esc(p.area)}</span>` : ''}${p.size ? `<span>${p.size} ${t.m2}</span>` : ''}${p.bedrooms ? `<span>${p.bedrooms} ${t.bedrooms}</span>` : ''}</div></div></a>`;
}
function requestSheet(lang: Lang, who: string) {
  const t = T[lang];
  return `<div class="sheet" id="req" role="dialog" aria-modal="true" aria-labelledby="req-t"><div class="scrim" data-x></div><div class="box">
<div class="form"><h3 id="req-t">${t.formTitle}</h3><p>${esc(fill(t.formSub, { who }))}</p>
<form novalidate><label class="f">${t.name}<input class="in" name="name" autocomplete="name" required maxlength="80"></label>
<label class="f">${t.phone}<input class="in" name="phone" type="tel" inputmode="tel" autocomplete="tel" dir="ltr" required maxlength="20" placeholder="07xx xxx xxxx"></label>
<div class="f" style="display:grid;gap:6px;margin-top:14px;font-size:14px;color:var(--ink2)">${t.when}<div class="whens">${t.whens.map((w) => `<button type="button" aria-pressed="false">${w}</button>`).join('')}</div></div>
<label class="f">${t.message}<textarea class="in" name="message" maxlength="500"></textarea></label>
<input name="website" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px" aria-hidden="true">
<div class="err" role="alert"></div><div class="stack"><button class="btn dark" type="submit">${t.send}</button><button class="btn" type="button" data-x>${t.close}</button></div></form></div>
<div class="done" hidden><div class="ok">${icon('check', 'ic')}</div><h3>${t.sent}</h3><p>${esc(fill(t.sentSub, { who }))}</p><div class="stack"><button class="btn" type="button" data-x>${t.close}</button></div></div>
</div></div>`;
}
function gone(lang: Lang, agency?: { name: string; whatsapp: string | null; logo: string | null }) {
  const t = T[lang];
  return frame({ lang, title: t.gone, description: t.goneSub, robots: 'noindex', body: `${agency ? topBar(agency, lang, null) : ''}<main class="gone"><div><h1>${t.gone}</h1><p>${t.goneSub}</p>
${agency?.whatsapp ? `<a class="btn wa" style="max-width:320px;margin:0 auto" href="${attr(wa(agency.whatsapp, '')!)}">${icon('wa')}${t.whatsapp}</a>` : `<a class="btn" style="max-width:320px;margin:0 auto" href="https://hemlohq.com">hemlohq.com</a>`}</div></main>` });
}

/** A rough throttle for the public forms: per address per hour, kept in the shared rate_limit table. */
async function allowed(d: Deps, c: Context, what: string, max: number) {
  const ip = c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const key = `re-${what}:${await hmac(d.env.AUTH_SECRET, `ip:${ip}`)}`, now = Date.now();
  const [r] = rowsOf(await d.db.execute(sql`insert into rate_limit (id, key, count, last_request) values (${newId()}, ${key}, 1, ${now})
    on conflict (key) do update set count = case when rate_limit.last_request < ${now - 3600_000} then 1 else rate_limit.count + 1 end,
      last_request = case when rate_limit.last_request < ${now - 3600_000} then ${now} else rate_limit.last_request end returning count`));
  return Number(r?.count ?? 0) <= max;
}

export function rePublicRoutes(d: Deps) {
  const r = new Hono<AppEnv>();
  /** A published listing by its slug: which agency, and the row. Never a draft or an archive. */
  const bySlug = async (slug: string) => {
    if (!/^[a-z]+-[a-z0-9]{6}$/.test(slug)) return null;
    const [p] = await withSystem(d.db, (tx) => tx.select({ id: reProperty.id, org: reProperty.organizationId }).from(reProperty)
      .where(and(eq(reProperty.slug, slug), sql`${reProperty.publishedAt} is not null`, inArray(reProperty.status, PUBLIC_STATUSES))));
    return p ?? null;
  };

  // ---------------- a listing ----------------
  r.get('/p/:slug', async (c) => {
    const slug = c.req.param('slug');
    const hit = await bySlug(slug);
    const lang = langOf(c);
    if (!hit) {
      // it existed and isn't public any more: say so kindly, with the agency's WhatsApp if we know it
      // (a draft was never public: it simply doesn't exist here)
      const [was] = /^[a-z]+-[a-z0-9]{6}$/.test(slug) ? await withSystem(d.db, (tx) => tx.select({ org: reProperty.organizationId }).from(reProperty).where(and(eq(reProperty.slug, slug), ne(reProperty.status, 'draft')))) : [];
      const agency = was ? await withOrg(d.db, was.org, (tx) => agencyOf(d, tx, was.org)) : undefined;
      return html(c, gone(lang, agency), was ? 410 : 404, 'no-store');
    }
    const ua = c.req.header('user-agent') ?? '', human = !BOTS.test(ua), q = c.req.query();
    const page = await withOrg(d.db, hit.org, async (tx) => {
      const [p] = await tx.select().from(reProperty).where(eq(reProperty.id, hit.id));
      const [agency, agent, photos] = await Promise.all([agencyOf(d, tx, hit.org), agentOf(d, tx, hit.org, p.agentId), photosOf(d, tx, hit.org, [p.id])]);
      const similar = await tx.select().from(reProperty).where(and(ne(reProperty.id, p.id), eq(reProperty.purpose, p.purpose), eq(reProperty.type, p.type), sql`${reProperty.publishedAt} is not null`, inArray(reProperty.status, ['available', 'negotiating'])))
        .orderBy(sql`(lower(coalesce(${reProperty.area}, '')) = lower(${p.area ?? ''})) desc`, sql`abs(coalesce(${reProperty.price}, 0) - ${Number(p.price ?? 0)})`).limit(3);
      const simPhotos = await photosOf(d, tx, hit.org, similar.map((x) => x.id), { onlyFirst: true });
      if (human) {
        await bump(tx, hit.org, p.id, 'view');
        if (q.s === 'qr') await bump(tx, hit.org, p.id, 'qr');
        // opened from a link sent to a lead (?l=…): remember it, and tell the timeline (at most every half hour)
        if (q.l && /^[A-Za-z0-9_-]{6,22}$/.test(q.l)) {
          const [lp] = await tx.select().from(reLeadProperty).where(and(eq(reLeadProperty.propertyId, p.id), sql`${reLeadProperty.leadId} like ${q.l + '%'}`)).limit(1);
          if (lp) {
            const quiet = !lp.lastOpenAt || Date.now() - +lp.lastOpenAt > 30 * 60_000;
            await tx.update(reLeadProperty).set({ opens: lp.opens + 1, lastOpenAt: new Date(), status: lp.status === 'sent' ? 'opened' : lp.status }).where(eq(reLeadProperty.id, lp.id));
            if (quiet) await activity(tx, hit.org, 'lead.opened', { leadId: lp.leadId, propertyId: p.id }, { opens: lp.opens + 1 });
          }
        }
        if (q.c && /^[a-z0-9]{10}$/.test(q.c)) await tx.execute(sql`update re_collection_item set opens = opens + 1 where property_id = ${p.id} and collection_id = (select id from re_collection where token = ${q.c})`);
      }
      return { p, agency, agent, photos: coverFirst(photos[p.id], p.coverId), similar: similar.map((x) => ({ ...x, cover: simPhotos[x.id]?.[0]?.url ?? null })) };
    });
    const { p, agency, agent, photos, similar } = page;
    const t = T[lang], title = (lang === 'en' && p.titleEn) || p.title, site = SITE(d);
    const url = `${site}/p/${p.slug}`, canonical = lang === 'en' ? `${url}?lang=en` : url, altUrl = lang === 'en' ? url : `${url}?lang=en`;
    const price = p.price == null ? null : Number(p.price);
    const live = p.status === 'available' || p.status === 'negotiating', gone2 = p.status === 'sold' || p.status === 'rented';
    const desc = (p.description as any)?.[lang] || (p.description as any)?.[lang === 'ar' ? 'en' : 'ar'] || '';
    const place = [p.area, p.city].filter(Boolean).join(lang === 'ar' ? '، ' : ', ');
    const who = agent?.name ?? agency.name, waNum = agent?.whatsapp ?? agency.whatsapp, callNum = agent?.phone ?? agency.phone;
    const waText = fill(t.waHello, { title, ref: p.ref, url });
    const facts = ([['size', p.size, `${p.size} ${t.m2}`], ['land', p.land && p.land !== p.size ? p.land : null, `${p.land} ${t.m2}`], ['bedrooms', p.bedrooms, String(p.bedrooms)], ['bathrooms', p.bathrooms, String(p.bathrooms)],
      ['floors', p.floors, String(p.floors)], ['parking', p.parking, String(p.parking)], ['year', p.yearBuilt, String(p.yearBuilt)]] as const).filter((x) => x[1] != null && x[1] !== 0);
    const statusChip = p.status === 'reserved' ? `<span class="status reserved">${t.reserved}</span>` : gone2 ? `<span class="status sold">${t[p.status as 'sold']}</span>` : `<span class="status">${p.purpose === 'rent' ? t.rent : t.sale} · ${esc(typeName(p.type, lang))}</span>`;
    const gallery = photos.length ? `<div class="gal"><div class="strip">${photos.map((ph, i) => `<figure><img src="${attr(ph.url)}" alt="${attr(title)}" ${i ? 'loading="lazy"' : 'fetchpriority="high"'} decoding="async" data-open="${i}"></figure>`).join('')}</div>
<span class="count">1 / ${photos.length}</span>
<div class="mosaic${photos.length === 1 ? ' one' : photos.length === 2 ? ' two' : ''}">${photos.slice(0, photos.length >= 5 ? 5 : photos.length >= 3 ? 3 : photos.length).map((ph, i) => `<button data-open="${i}" aria-label="${attr(title)}"><img src="${attr(ph.url)}" alt="" ${i ? 'loading="lazy"' : 'fetchpriority="high"'} decoding="async"></button>`).join('')}
${photos.length > 1 ? `<button class="allbtn" data-open="0">${icon('grid')}${t.all} · ${photos.length}</button>` : ''}</div></div>
<div class="lb" role="dialog" aria-modal="true"><div class="lbt"><span>${esc(title)}</span><button data-close aria-label="${t.close}">${icon('close')}</button></div>
<div class="strip">${photos.map((ph) => `<figure><img src="${attr(ph.url)}" alt="" loading="lazy" decoding="async"></figure>`).join('')}</div>
<button class="nav p" aria-label="‹">${icon('prev')}</button><button class="nav n" aria-label="›">${icon('next')}</button></div>` : '';
    const map = p.lat != null && p.lng != null && p.showExact
      ? `<div class="map"><iframe loading="lazy" title="${attr(t.location)}" src="https://www.openstreetmap.org/export/embed.html?bbox=${p.lng - 0.006},${p.lat - 0.004},${p.lng + 0.006},${p.lat + 0.004}&layer=mapnik&marker=${p.lat},${p.lng}"></iframe></div>
<p style="margin-top:10px"><a href="https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}" rel="noopener" target="_blank">${t.openMap}</a></p>`
      : place ? `<p class="near">${icon('pin')}${esc(fill(t.nearArea, { area: place }))}</p>` : '';
    const contact = (cls: string) => `${live && waNum ? `<a class="btn wa ${cls}" href="${attr(wa(waNum, waText)!)}" data-ping="wa" rel="noopener">${icon('wa')}${t.whatsapp}</a>` : ''}
${live && callNum ? `<a class="btn ${cls}" href="${attr(tel(callNum)!)}" data-ping="call">${icon('call')}${t.call}</a>` : ''}
${live ? `<button class="btn dark ${cls}" type="button" data-req>${icon('cal')}${t.request}</button>` : waNum ? `<a class="btn wa ${cls}" href="${attr(wa(waNum, waText)!)}" data-ping="wa">${icon('wa')}${t.whatsapp}</a>` : ''}`;
    const body = `${topBar(agency, lang, altUrl)}${gallery}
<div class="wrap"><div class="main"><article>
${statusChip}<h1>${esc(title)}</h1>${place ? `<p class="place">${icon('pin')}${esc(place)}</p>` : ''}
<div class="price">${priceHtml(price, p.currency, lang, p.purpose === 'rent' ? p.rentPeriod : null)}</div>${p.negotiable && live && price != null ? `<p class="neg">${t.negotiable}</p>` : ''}
${p.status === 'reserved' ? `<p class="note">${t.reservedNote}</p>` : gone2 ? `<p class="note">${t.soldNote}</p>` : ''}
${facts.length ? `<div class="facts">${facts.map(([k, , v]) => `<div class="fact">${icon(k)}<div><b class="num">${esc(v)}</b><small>${t[k as 'size']}</small></div></div>`).join('')}</div>` : ''}
${desc ? `<section class="blk desc"><h2>${t.about}</h2>${paras(desc)}</section>` : ''}
${(p.features ?? []).length ? `<section class="blk"><h2>${t.features}</h2><ul class="feat">${(p.features ?? []).map((f) => `<li>${icon('check')}${esc(featureName(f, lang))}</li>`).join('')}</ul></section>` : ''}
<section class="blk"><h2>${t.details}</h2><dl class="tbl">
<div><dt>${t.type}</dt><dd>${esc(typeName(p.type, lang))}</dd></div><div><dt>${t.purpose}</dt><dd>${p.purpose === 'rent' ? t.rent : t.sale}</dd></div>
${p.furnished ? `<div><dt>${t.furnished}</dt><dd>${esc(t.furn[p.furnished] ?? p.furnished)}</dd></div>` : ''}${p.condition ? `<div><dt>${t.condition}</dt><dd>${esc(t.cond[p.condition] ?? p.condition)}</dd></div>` : ''}
<div><dt>${t.ref}</dt><dd class="num">#${p.ref}</dd></div></dl></section>
${map ? `<section class="blk"><h2>${t.location}</h2>${map}</section>` : ''}
${similar.length ? `<section class="blk"><h2>${t.similar}</h2><div class="cards">${similar.map((s) => card(s, lang, `/p/${s.slug}${lang === 'en' ? '?lang=en' : ''}`, s.cover)).join('')}</div></section>` : ''}
</article>
<aside class="side"><div class="card"><div class="price" style="margin:0">${priceHtml(price, p.currency, lang, p.purpose === 'rent' ? p.rentPeriod : null)}</div>
<div class="agent" style="margin-top:18px"><span class="av">${agent?.photo ? `<img src="${attr(agent.photo)}" alt="">` : esc(initials(who))}</span><span><b>${esc(who)}</b><small>${esc(agent?.title ?? agency.name)}</small></span></div>
<div class="stack">${contact('')}</div></div></aside></div></div>
<div class="bar">${contact('')}</div>
${live ? requestSheet(lang, who) : ''}${foot(lang, agency.name)}`;
    const cover = photos[0]?.url ?? null;
    const description = [priceText(price, p.currency, lang, p.purpose === 'rent' ? p.rentPeriod : null), place, p.size ? `${p.size} ${t.m2}` : '', p.bedrooms ? `${p.bedrooms} ${t.bedrooms}` : '', desc.slice(0, 120)].filter(Boolean).join(' · ');
    const jsonld = { '@context': 'https://schema.org', '@type': 'RealEstateListing', name: title, url: canonical, datePosted: p.publishedAt, image: photos.slice(0, 6).map((x) => x.url), description: desc.slice(0, 500) || undefined,
      offers: price != null ? { '@type': 'Offer', price, priceCurrency: p.currency, availability: live ? 'https://schema.org/InStock' : 'https://schema.org/SoldOut', businessFunction: p.purpose === 'rent' ? 'http://purl.org/goodrelations/v1#LeaseOut' : 'http://purl.org/goodrelations/v1#Sell' } : undefined,
      about: { '@type': p.type === 'apartment' ? 'Apartment' : p.type === 'land' ? 'Landform' : 'SingleFamilyResidence', numberOfRooms: p.bedrooms ?? undefined, floorSize: p.size ? { '@type': 'QuantitativeValue', value: p.size, unitCode: 'MTK' } : undefined,
        address: { '@type': 'PostalAddress', addressLocality: p.city ?? undefined, streetAddress: undefined, addressRegion: p.area ?? undefined, addressCountry: 'IQ' } },
      provider: { '@type': 'RealEstateAgent', name: agency.name } };
    const script = SCRIPT({ api: `/p/${p.slug}`, ctx: q.c && /^[a-z0-9]{10}$/.test(q.c) ? { c: q.c } : {}, url, title, shareText: `${title} · ${priceText(price, p.currency, lang, p.purpose === 'rent' ? p.rentPeriod : null)}`,
      t: { copied: t.copied, badPhone: t.badPhone, failed: t.failed, sending: t.sending, send: t.send, saved: t.saved } });
    return html(c, frame({ lang, title: `${title} · ${priceText(price, p.currency, lang, p.purpose === 'rent' ? p.rentPeriod : null)} · ${agency.name}`, description, canonical, alt: altUrl, image: cover,
      robots: live && !q.l ? 'index' : 'noindex', body, script, jsonld }), 200, human ? 'private, no-store' : 'public, max-age=300');
  });

  /** A tap on WhatsApp / call / share on a listing's page (counted, nothing else kept). */
  r.post('/p/:slug/event', async (c) => {
    const hit = await bySlug(c.req.param('slug'));
    if (!hit || BOTS.test(c.req.header('user-agent') ?? '')) return c.body(null, 204);
    const b = await c.req.json<{ kind?: string }>().catch(() => ({} as { kind?: string }));
    const kind = (['wa', 'call', 'share'] as const).find((k) => k === b.kind);
    if (kind) await withOrg(d.db, hit.org, (tx) => bump(tx, hit.org, hit.id, kind));
    return c.body(null, 204);
  });

  /** "Request a viewing": name, phone, when, a note. Becomes (or updates) a lead and a viewing to schedule. */
  r.post('/p/:slug/request', async (c) => {
    const hit = await bySlug(c.req.param('slug'));
    if (!hit) return c.json({ error: 'PROPERTY_NOT_FOUND' }, 404);
    const b = await c.req.json<any>().catch(() => ({}));
    if (b.hp) return c.json({ ok: true }); // the hidden field: a bot filled it in
    if (!(await allowed(d, c, 'req', 8))) return c.json({ error: 'TOO_MANY' }, 429);
    let name: string, phone: string | null, preferred: string | null, message: string | null;
    try { name = str(b.name, 80, 'BAD_NAME', true)!; phone = cleanPhone(b.phone); preferred = str(b.preferred, 60, 'BAD_TEXT'); message = str(b.message, 500, 'BAD_TEXT'); }
    catch (e: any) { return c.json({ error: e?.code ?? 'BAD_REQUEST' }, 400); }
    if (!phone) return c.json({ error: 'BAD_PHONE' }, 400);
    await withOrg(d.db, hit.org, async (tx) => {
      const [p] = await tx.select().from(reProperty).where(eq(reProperty.id, hit.id));
      if (!['available', 'negotiating'].includes(p.status)) return;
      const lang = c.req.header('accept-language')?.startsWith('en') ? 'en' : 'ar';
      let [lead] = await tx.select().from(reLead).where(and(eq(reLead.phone, phone!), sql`${reLead.archivedAt} is null`)).limit(1);
      if (!lead) {
        // their first contact: start their requirements from the home they asked about (the agent refines them)
        const price = p.price == null ? null : Number(p.price);
        [lead] = await tx.insert(reLead).values({ id: newId(), organizationId: hit.org, name, phone, whatsapp: phone, lang, purpose: p.purpose, source: 'website', agentId: p.agentId,
          types: [p.type], areas: p.area ? [p.area] : [], city: p.city, currency: p.currency, budgetMax: price ? Math.round(price * 1.1) : null, bedrooms: p.bedrooms, notes: message, lastContactAt: new Date() }).returning();
        await activity(tx, hit.org, 'lead.created', { leadId: lead.id, propertyId: p.id }, { source: 'website' });
      } else await tx.update(reLead).set({ lastContactAt: new Date(), updatedAt: new Date(), status: lead.status === 'lost' ? 'active' : lead.status }).where(eq(reLead.id, lead.id));
      const id = newId();
      await tx.insert(reViewing).values({ id, organizationId: hit.org, propertyId: p.id, leadId: lead.id, agentId: p.agentId, status: 'requested', source: 'public', preferred, notes: message });
      await tx.insert(reLeadProperty).values({ id: newId(), organizationId: hit.org, leadId: lead.id, propertyId: p.id, status: 'opened', opens: 1, lastOpenAt: new Date() })
        .onConflictDoUpdate({ target: [reLeadProperty.leadId, reLeadProperty.propertyId], set: { lastOpenAt: new Date() } });
      await activity(tx, hit.org, 'viewing.requested', { leadId: lead.id, propertyId: p.id }, { viewingId: id, preferred, message });
      await notice(tx, hit.org, 'request', { leadId: lead.id, propertyId: p.id, viewingId: id, agentId: p.agentId }, { name, ref: p.ref, title: p.title, preferred });
      await bump(tx, hit.org, p.id, 'request');
      if (b.c && /^[a-z0-9]{10}$/.test(b.c)) { const [col] = await tx.select({ leadId: reCollection.leadId }).from(reCollection).where(eq(reCollection.token, b.c)); if (col?.leadId) await activity(tx, hit.org, 'collection.request', { leadId: col.leadId, propertyId: p.id }, {}); }
    });
    return c.json({ ok: true }, 201);
  });

  // ---------------- a collection ----------------
  const byToken = async (t: string) => {
    if (!/^[a-z0-9]{10}$/.test(t)) return null;
    const [x] = await withSystem(d.db, (tx) => tx.select({ id: reCollection.id, org: reCollection.organizationId }).from(reCollection).where(and(eq(reCollection.token, t), sql`${reCollection.archivedAt} is null`)));
    return x ?? null;
  };
  r.get('/c/:token', async (c) => {
    const t0 = c.req.param('token');
    const hit = await byToken(t0);
    const lang = langOf(c);
    if (!hit) return html(c, gone(lang), 404, 'no-store');
    const human = !BOTS.test(c.req.header('user-agent') ?? '');
    const page = await withOrg(d.db, hit.org, async (tx) => {
      const [col] = await tx.select().from(reCollection).where(eq(reCollection.id, hit.id));
      const items = await tx.select({ i: reCollectionItem, p: reProperty }).from(reCollectionItem).innerJoin(reProperty, eq(reProperty.id, reCollectionItem.propertyId))
        .where(and(eq(reCollectionItem.collectionId, col.id), sql`${reProperty.publishedAt} is not null`, inArray(reProperty.status, PUBLIC_STATUSES))).orderBy(reCollectionItem.sort);
      const photos = await photosOf(d, tx, hit.org, items.map((x) => x.p.id));
      const [lead] = col.leadId ? await tx.select({ name: reLead.name, lang: reLead.lang }).from(reLead).where(eq(reLead.id, col.leadId)) : [];
      const [agency, agent] = await Promise.all([agencyOf(d, tx, hit.org), agentOf(d, tx, hit.org, col.agentId)]);
      if (human) {
        const quiet = !col.lastOpenAt || Date.now() - +col.lastOpenAt > 30 * 60_000;
        await tx.update(reCollection).set({ opens: col.opens + 1, lastOpenAt: new Date() }).where(eq(reCollection.id, col.id));
        if (quiet && col.leadId) await activity(tx, hit.org, 'collection.opened', { leadId: col.leadId }, { collectionId: col.id, title: col.title });
      }
      return { col, items: items.map((x) => ({ ...x.p, favorite: x.i.favorite, cover: coverFirst(photos[x.p.id], x.p.coverId)[0]?.url ?? null })), lead, agency, agent };
    });
    const L: Lang = c.req.query('lang') ? lang : page.lead?.lang === 'en' ? 'en' : 'ar';
    const t = T[L], who = page.agent?.name ?? page.agency.name, waNum = page.agent?.whatsapp ?? page.agency.whatsapp;
    const url = `${SITE(d)}/c/${t0}`, alt = L === 'en' ? url : `${url}?lang=en`;
    const waText = L === 'ar' ? `مرحباً، أتصفح المجموعة «${page.col.title}»\n${url}` : `Hello, I'm looking at the selection "${page.col.title}"\n${url}`;
    const body = `${topBar(page.agency, L, alt)}<div class="wrap"><section class="hero"><p class="kick">${page.lead ? esc(fill(t.selectedFor, { name: page.lead.name })) : t.selection} · ${fill(t.homes, { n: page.items.length })}</p>
<h1>${esc(page.col.title)}</h1>${page.col.note ? `<p>${esc(page.col.note)}</p><p class="kick">— ${esc(fill(t.fromAgent, { who }))}</p>` : ''}
${waNum ? `<div style="max-width:320px;margin-top:18px"><a class="btn wa" href="${attr(wa(waNum, waText)!)}" rel="noopener">${icon('wa')}${t.whatsapp}</a></div>` : ''}</section>
<div class="cards" style="padding-bottom:48px">${page.items.map((p) => card(p, L, `/p/${p.slug}?c=${t0}${L === 'en' ? '&lang=en' : ''}`, p.cover, { fav: true, favOn: p.favorite })).join('')}</div></div>${foot(L, page.agency.name)}`;
    return html(c, frame({ lang: L, title: `${page.col.title} · ${page.agency.name}`, description: fill(t.homes, { n: page.items.length }), image: page.items[0]?.cover ?? null, robots: 'noindex', body,
      script: SCRIPT({ api: `/c/${t0}`, url, title: page.col.title, shareText: page.col.title, t: { copied: t.copied, saved: t.saved, badPhone: t.badPhone, failed: t.failed, sending: t.sending, send: t.send } }) }), 200, 'private, no-store');
  });
  /** The customer hearts (or un-hearts) a home in their collection; the agent sees it on the lead. */
  r.post('/c/:token/fav', async (c) => {
    const hit = await byToken(c.req.param('token'));
    if (!hit) return c.json({ error: 'NOT_FOUND' }, 404);
    const b = await c.req.json<{ propertyId?: string; on?: boolean }>().catch(() => ({} as { propertyId?: string; on?: boolean }));
    await withOrg(d.db, hit.org, async (tx) => {
      const [it] = await tx.update(reCollectionItem).set({ favorite: !!b.on }).where(and(eq(reCollectionItem.collectionId, hit.id), eq(reCollectionItem.propertyId, String(b.propertyId ?? '')))).returning();
      if (!it) return;
      const [col] = await tx.select().from(reCollection).where(eq(reCollection.id, hit.id));
      if (b.on) await bump(tx, hit.org, it.propertyId, 'favorite');
      if (col.leadId) {
        await tx.insert(reLeadProperty).values({ id: newId(), organizationId: hit.org, leadId: col.leadId, propertyId: it.propertyId, status: b.on ? 'favorite' : 'opened' })
          .onConflictDoUpdate({ target: [reLeadProperty.leadId, reLeadProperty.propertyId], set: { status: b.on ? 'favorite' : 'opened' } });
        if (b.on) await activity(tx, hit.org, 'lead.favorite', { leadId: col.leadId, propertyId: it.propertyId }, { collectionId: col.id });
      }
    });
    return c.json({ ok: true });
  });
  r.post('/c/:token/event', async (c) => c.body(null, 204));

  // ---------------- an owner's report ----------------
  r.get('/r/:token', async (c) => {
    const tk = c.req.param('token');
    if (!/^[a-z0-9]{12}$/.test(tk)) return html(c, gone(langOf(c)), 404, 'no-store');
    const [rep] = await withSystem(d.db, (tx) => tx.select().from(reReport).where(eq(reReport.token, tk)));
    if (!rep || +rep.expiresAt < Date.now()) return html(c, gone(langOf(c)), 410, 'no-store');
    const data = await withOrg(d.db, rep.organizationId, async (tx) => {
      const [p] = await tx.select().from(reProperty).where(eq(reProperty.id, rep.propertyId));
      if (!p) return null;
      const [agency, photos, viewings, deals] = await Promise.all([
        agencyOf(d, tx, rep.organizationId), photosOf(d, tx, rep.organizationId, [p.id], { onlyFirst: true }),
        tx.select({ startsAt: reViewing.startsAt, status: reViewing.status, outcome: reViewing.outcome }).from(reViewing).where(and(eq(reViewing.propertyId, p.id), inArray(reViewing.status, ['completed', 'scheduled', 'confirmed']))).orderBy(desc(reViewing.startsAt)),
        tx.select({ id: reDeal.id }).from(reDeal).where(eq(reDeal.propertyId, p.id)),
      ]);
      const offers = deals.length ? await tx.select({ kind: reOffer.kind, amount: reOffer.amount, at: reOffer.at }).from(reOffer).where(and(inArray(reOffer.dealId, deals.map((x) => x.id)), inArray(reOffer.kind, ['offer', 'counter', 'agreed']))).orderBy(desc(reOffer.at)) : [];
      const weeks = rowsOf(await tx.execute(sql`select date_trunc('week', day::date)::date as w, sum(views)::int as views from re_stat where property_id = ${p.id} and day >= ${new Date(Date.now() - 56 * 86400_000).toISOString().slice(0, 10)} group by 1 order by 1`));
      const [contacted] = rowsOf(await tx.execute(sql`select count(distinct lead_id)::int as n from re_lead_property where property_id = ${p.id} and status <> 'dismissed'`));
      return { p, agency, cover: photos[p.id]?.[0]?.url ?? null, viewings, offers, weeks, contacted: contacted?.n ?? 0 };
    });
    if (!data) return html(c, gone(langOf(c)), 410, 'no-store');
    const { p, agency } = data;
    const L = langOf(c, 'ar'), t = T[L], s = (p.stats ?? {}) as Record<string, number>;
    const W = L === 'ar' ? { title: 'تقرير أداء العقار', since: 'معروض منذ {d} يوماً', views: 'مشاهدات الصفحة', inquiries: 'استفسارات (واتساب، اتصال، طلبات)', viewings: 'معاينات تمّت', offers: 'عروض شراء', contacted: 'مهتمون أُرسل لهم العقار',
      weekly: 'المشاهدات أسبوعياً', activity: 'آخر النشاط', viewing: 'معاينة', offer: 'عرض', counter: 'عرض مقابل', agreed: 'سعر متفق عليه', print: 'طباعة / PDF', upcoming: 'قادمة', done: 'تمّت', status: 'الحالة الآن' }
      : { title: 'Property performance', since: 'Listed {d} days ago', views: 'Page views', inquiries: 'Inquiries (WhatsApp, calls, requests)', viewings: 'Viewings done', offers: 'Offers received', contacted: 'Interested buyers it was sent to',
        weekly: 'Views per week', activity: 'Recent activity', viewing: 'Viewing', offer: 'Offer', counter: 'Counter-offer', agreed: 'Agreed price', print: 'Print / PDF', upcoming: 'upcoming', done: 'done', status: 'Status now' };
    const max = Math.max(1, ...data.weeks.map((w) => Number(w.views)));
    const days = Math.max(1, Math.round((Date.now() - +(p.publishedAt ?? p.createdAt)) / 86400_000));
    const fmtDate = (v: any) => new Intl.DateTimeFormat(L === 'ar' ? 'ar-IQ' : 'en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Baghdad' }).format(new Date(v));
    const events = [...data.viewings.map((v) => ({ at: v.startsAt, text: `${W.viewing} · ${v.status === 'completed' ? W.done : W.upcoming}` })), ...data.offers.map((o) => ({ at: o.at, text: `${W[o.kind as 'offer']} · ${priceText(o.amount == null ? null : Number(o.amount), p.currency, L)}` }))]
      .filter((x) => x.at).sort((a, b) => +new Date(b.at!) - +new Date(a.at!)).slice(0, 12);
    const statusWord = p.status === 'sold' ? t.sold : p.status === 'rented' ? t.rented : p.status === 'reserved' ? t.reserved : p.purpose === 'rent' ? t.rent : t.sale;
    const body = `${topBar(agency, L, L === 'ar' ? `?lang=en` : `?lang=ar`)}<div class="wrap" style="padding-bottom:56px"><section class="hero"><p class="kick">${W.title} · #${p.ref}</p><h1>${esc((L === 'en' && p.titleEn) || p.title)}</h1>
<p>${esc(fill(W.since, { d: days }))} · ${W.status}: <b>${esc(statusWord)}</b></p>${rep.note ? `<p class="note">${esc(rep.note)}</p>` : ''}
${data.cover ? `<img src="${attr(data.cover)}" alt="" style="width:100%;max-height:340px;object-fit:cover;border-radius:18px;margin-top:18px">` : ''}
<div class="big"><div><b class="num">${s.views ?? 0}</b><small>${W.views}</small></div><div><b class="num">${(s.wa ?? 0) + (s.calls ?? 0) + (s.requests ?? 0)}</b><small>${W.inquiries}</small></div>
<div><b class="num">${data.viewings.filter((v) => v.status === 'completed').length}</b><small>${W.viewings}</small></div><div><b class="num">${data.offers.filter((o) => o.kind === 'offer').length}</b><small>${W.offers}</small></div></div>
<p style="margin-top:14px;color:var(--ink2)">${W.contacted}: <b class="num">${data.contacted}</b></p></section>
${data.weeks.length ? `<section class="blk"><h2>${W.weekly}</h2><div class="bars">${data.weeks.map((w) => `<span style="height:${Math.round((Number(w.views) / max) * 100)}%" title="${w.views}"></span>`).join('')}</div></section>` : ''}
${events.length ? `<section class="blk"><h2>${W.activity}</h2><ul class="tl">${events.map((e) => `<li><time>${fmtDate(e.at)}</time><span>${esc(e.text)}</span></li>`).join('')}</ul></section>` : ''}
<div class="noprint" style="max-width:280px;margin-top:28px"><button class="btn" onclick="print()">${W.print}</button></div></div>${foot(L, agency.name)}`;
    return html(c, frame({ lang: L, title: `${W.title} · ${p.title} · ${agency.name}`, description: W.title, robots: 'noindex', body, script: SCRIPT({ url: `${SITE(d)}/r/${tk}`, title: W.title, shareText: W.title, t: { copied: t.copied } }) }), 200, 'private, no-store');
  });

  return r;
}
