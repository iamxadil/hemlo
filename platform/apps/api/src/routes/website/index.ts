// Hemlo Systems · The Website add-on's dashboard API (/v1/web):
// whether the site is on, what it draws from (the edition), its look and words, its addresses, and its pages.
// Hemlo stays the source of truth: a website renders the business's own data, it never copies it. Only the site's
// design and its own words are stored here — as structured sections, never free HTML. Publishing is a switch.
import { Hono } from 'hono';
import { and, asc, eq } from 'drizzle-orm';
import { newId, normalizeIraqiPhone } from '@hemlo/core';
import { withOrg, withSystem } from '@hemlo/db';
import { webSite, webPage, WEB_PAGE_KINDS, organization, hemloAddonRequest, type WebSection, type WebSettings, type WebTheme } from '@hemlo/db/schema';
import { HttpError } from '../../principal';
import { actor, bad, text, type Actor } from '../sys-common';
import { subscriptionOf } from '../../subscription';
import { addonEntitlement, requireAddon } from '../../addons';
import { settingsOf } from '../realestate/common';
import type { AppEnv, Deps } from '../../types';

export const WEB_THEMES = ['classic', 'modern', 'minimal', 'bold'] as const;
export const WEB_SECTION_TYPES = ['hero', 'about', 'products', 'listings', 'services', 'gallery', 'team', 'faq', 'hours', 'testimonials', 'contact', 'cta'] as const;
const RESERVED_SUBDOMAINS = ['www', 'api', 'app', 'admin', 'account', 'studio', 'mail', 'ftp', 'cdn', 'static', 'assets', 'demo', 'test', 'systems', 'tools', 'business', 'sample'];
const WEBSITE_DOMAIN = 'hemlohq.com';

type Two = { ar?: string; en?: string };
const two = (v: unknown, max = 2000): Two => {
  const o = (v && typeof v === 'object' ? v : {}) as any;
  const ar = text(o.ar, max, 'BAD_TEXT') ?? undefined, en = text(o.en, max, 'BAD_TEXT') ?? undefined;
  return { ...(ar ? { ar } : {}), ...(en ? { en } : {}) };
};
const phone = (v: unknown): string | null => {
  if (v == null || v === '') return null;
  const s = String(v), iq = normalizeIraqiPhone(s);
  if (iq) return iq;
  const intl = s.replace(/[\s\-().]/g, '');
  return /^\+[1-9]\d{7,14}$/.test(intl) ? intl : bad('BAD_PHONE');
};
const email = (v: unknown): string | null => { const s = text(v, 120, 'BAD_EMAIL'); return s && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s) ? bad('BAD_EMAIL') : s; };
const url = (v: unknown): string | null => { const s = text(v, 300, 'BAD_URL'); return s && !/^https?:\/\/[^\s]+$/i.test(s) ? bad('BAD_URL') : s; };

const themeIn = (v: unknown): WebTheme => {
  const t = (v && typeof v === 'object' ? v : {}) as any, out: WebTheme = {};
  if ((WEB_THEMES as readonly string[]).includes(t.preset)) out.preset = t.preset;
  if (typeof t.accent === 'string' && /^#[0-9a-fA-F]{6}$/.test(t.accent)) out.accent = t.accent.toLowerCase();
  if (['sm', 'md', 'lg'].includes(t.radius)) out.radius = t.radius;
  if (['system', 'serif', 'sans'].includes(t.font)) out.font = t.font;
  if (t.dark !== undefined) out.dark = !!t.dark;
  return out;
};
const nn = (x: string | null) => x ?? undefined;
const settingsIn = (v: unknown): WebSettings => {
  const s = (v && typeof v === 'object' ? v : {}) as any, out: WebSettings = {};
  if (s.contact && typeof s.contact === 'object') out.contact = { phone: nn(phone(s.contact.phone)), whatsapp: nn(phone(s.contact.whatsapp)), email: nn(email(s.contact.email)), address: nn(text(s.contact.address, 200, 'BAD_TEXT')), mapUrl: nn(url(s.contact.mapUrl)) };
  if (s.social && typeof s.social === 'object') out.social = { instagram: nn(text(s.social.instagram, 80, 'BAD_TEXT')), facebook: nn(text(s.social.facebook, 80, 'BAD_TEXT')), tiktok: nn(text(s.social.tiktok, 80, 'BAD_TEXT')), youtube: nn(text(s.social.youtube, 80, 'BAD_TEXT')), x: nn(text(s.social.x, 80, 'BAD_TEXT')) };
  if (Array.isArray(s.nav)) out.nav = s.nav.slice(0, 8).map((n: any) => ({ label: two(n?.label, 40), href: text(n?.href, 300, 'BAD_URL') ?? '/' }));
  if (s.footer !== undefined) out.footer = two(s.footer, 400);
  if (s.cta && typeof s.cta === 'object') out.cta = { whatsapp: !!s.cta.whatsapp, phone: !!s.cta.phone, inquiry: !!s.cta.inquiry };
  return out;
};
/** Sections: a bounded, typed list. Only known section types; strings clipped; nothing unbounded is stored. */
const sectionsIn = (v: unknown): WebSection[] => {
  if (v == null) return [];
  if (!Array.isArray(v) || v.length > 40) bad('BAD_SECTIONS');
  const clean = (v as any[]).map((s) => {
    if (!s || typeof s !== 'object' || !(WEB_SECTION_TYPES as readonly string[]).includes(s.type)) bad('BAD_SECTIONS');
    const out: Record<string, unknown> = { type: s.type };
    for (const k of Object.keys(s)) {
      if (k === 'type') continue;
      const val = s[k];
      if (typeof val === 'string') out[k] = val.slice(0, 2000);
      else if (typeof val === 'boolean' || typeof val === 'number') out[k] = val;
      else if (val && typeof val === 'object' && JSON.stringify(val).length <= 4000) out[k] = val;
    }
    out.id = typeof out.id === 'string' && /^[\w-]{1,40}$/.test(out.id as string) ? out.id : newId();
    return out as WebSection;
  });
  if (JSON.stringify(clean).length > 200_000) bad('BAD_SECTIONS');
  return clean;
};
const slugIn = (v: unknown): string => {
  if (v == null || v === '') return '';
  const s = String(v).trim().toLowerCase();
  return /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/.test(s) ? s : bad('BAD_SLUG');
};
const kindIn = (v: unknown): string => ((WEB_PAGE_KINDS as readonly string[]).includes(v as string) ? (v as string) : 'custom');
const subdomainIn = (v: unknown): string => {
  const s = String(v ?? '').trim().toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])?$/.test(s) || RESERVED_SUBDOMAINS.includes(s)) bad('BAD_SUBDOMAIN');
  return s;
};
// Customer sites use their own Hemlo subdomain; the wildcard Worker dispatches reserved Hemlo app hosts to their Workers.
const siteUrl = (subdomain: string | null, _base: string) => {
  if (!subdomain) return null;
  return `https://${subdomain}.${WEBSITE_DOMAIN}`;
};

/** The starter site for a new business: a home page that leads with what they sell, plus about and contact.
 *  The hero carries no words of its own: it shows the site's name and tagline, so it follows them when they change. */
function starterPages(vertical: string, _name: Two) {
  const aboutTitle = { ar: 'من نحن', en: 'About us' }, contactTitle = { ar: 'تواصل معنا', en: 'Contact' };
  const lead = vertical === 'realestate' ? { type: 'listings', title: { ar: 'عقاراتنا', en: 'Our properties' } }
    : vertical === 'store' ? { type: 'products', title: { ar: 'منتجاتنا', en: 'Our products' } }
    : { type: 'services', title: { ar: 'خدماتنا', en: 'Our services' } };
  return [
    { slug: '', kind: 'home', title: { ar: 'الرئيسية', en: 'Home' }, sort: 0, sections: [{ id: newId(), type: 'hero' }, { id: newId(), ...lead }, { id: newId(), type: 'about', title: aboutTitle }, { id: newId(), type: 'contact', title: contactTitle }] },
    { slug: 'about', kind: 'about', title: aboutTitle, sort: 1, sections: [{ id: newId(), type: 'about', title: aboutTitle }] },
    { slug: 'contact', kind: 'contact', title: contactTitle, sort: 2, sections: [{ id: newId(), type: 'contact', title: contactTitle }] },
  ];
}

const isConflict = (e: any, index: string) => new RegExp(index).test(String(e?.message ?? '') + String(e?.cause?.message ?? '') + String(e?.constraint_name ?? e?.cause?.constraint_name ?? ''));

export function webRoutes(d: Deps) {
  const r = new Hono<AppEnv>();
  const inWeb = (a: Actor, fn: (tx: any) => Promise<any>): Promise<any> => withOrg(d.db, a.organizationId, fn);
  const websiteBaseUrl = 'https://business.hemlohq.com';

  async function orgFace(org: string) {
    const [o] = await withSystem(d.db, (tx) => tx.select({ slug: organization.slug, name: organization.name }).from(organization).where(eq(organization.id, org)));
    return o ?? null;
  }
  async function siteOf(a: Actor) {
    const [site] = await inWeb(a, (tx) => tx.select().from(webSite).where(eq(webSite.organizationId, a.organizationId)));
    return site ?? null;
  }
  async function pagesOf(a: Actor) {
    return inWeb(a, (tx) => tx.select().from(webPage).where(eq(webPage.organizationId, a.organizationId)).orderBy(asc(webPage.sort), asc(webPage.createdAt)));
  }
  async function overview(a: Actor) {
    const [vertical, face, site, pages, access] = await Promise.all([subscriptionOf(d.db, a.organizationId).then((s) => s.edition), orgFace(a.organizationId), siteOf(a), pagesOf(a), addonEntitlement(d.db, a.organizationId, 'website')]);
    const request = access.offer ? (await inWeb(a, (tx) => tx.select().from(hemloAddonRequest).where(and(eq(hemloAddonRequest.organizationId, a.organizationId), eq(hemloAddonRequest.addonId, access.offer!.id), eq(hemloAddonRequest.status, 'new'))).orderBy(asc(hemloAddonRequest.createdAt))))[0] ?? null : null;
    const suggested = face?.slug ? face.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^-|-$/g, '').slice(0, 30) : 'site';
    const snapshot = site?.publishedSnapshot;
    const currentConfig = site && { lang: site.lang, name: site.name, tagline: site.tagline, about: site.about, theme: site.theme, settings: site.settings, logoId: site.logoId, faviconId: site.faviconId };
    const publishedConfig = snapshot && { lang: snapshot.lang, name: snapshot.name, tagline: snapshot.tagline, about: snapshot.about, theme: snapshot.theme, settings: snapshot.settings, logoId: snapshot.logoId, faviconId: snapshot.faviconId };
    const pageConfig = (items: any[]) => items.map(({ id, slug, kind, title, sections, seo, sort }) => ({ id, slug, kind, title, sections, seo, sort }));
    const hasUnpublishedChanges = !!(site?.status === 'published' && snapshot && currentConfig &&
      (JSON.stringify(currentConfig) !== JSON.stringify(publishedConfig) || JSON.stringify(pageConfig(pages)) !== JSON.stringify(pageConfig(snapshot.pages))));
    return { vertical, site: site ?? null, pages, face, suggestedSubdomain: suggested || 'site', url: siteUrl(site?.subdomain ?? null, websiteBaseUrl),
      hasUnpublishedChanges,
      entitlement: access.entitlement ? { ...access.entitlement, active: access.active } : null,
      request,
      offer: access.offer ? { code: access.offer.code, name: access.offer.name, description: access.offer.description, compatible: access.offer.compatibleEditions.includes(vertical),
        priceMonth: access.offer.priceMonth, priceYear: access.offer.priceYear, configured: access.offer.priceMonth != null && access.offer.priceYear != null } : null };
  }

  /** What the dashboard shows: the site (or nothing yet), its pages, its edition, the themes and section kinds. */
  r.get('/site', async (c) => {
    const a = actor(c, 'website', 'manage');
    const out = await overview(a);
    return c.json({ ...out, themes: WEB_THEMES, pageKinds: WEB_PAGE_KINDS, sectionTypes: WEB_SECTION_TYPES });
  });

  /** Turn the website on: create it (status setup) and, the first time, seed a starter site. */
  r.post('/site/enable', async (c) => {
    const a = actor(c, 'website', 'manage');
    await requireAddon(d.db, a.organizationId, 'website');
    let site = await siteOf(a);
    if (!site) {
      const face = await orgFace(a.organizationId);
      const name = { ar: face?.name ?? '', en: face?.name ?? '' };
      const subdomain = await freeSubdomain(a, face?.slug ?? 'site');
      site = await inWeb(a, async (tx) => {
        const [row] = await tx.insert(webSite).values({ id: newId(), organizationId: a.organizationId, vertical: (await subscriptionOf(d.db, a.organizationId)).edition, status: 'setup', name, subdomain, createdBy: a.userId }).returning();
        const existing = await tx.select({ id: webPage.id }).from(webPage).where(eq(webPage.organizationId, a.organizationId));
        if (!existing.length) for (const p of starterPages(row.vertical, name)) await tx.insert(webPage).values({ id: newId(), organizationId: a.organizationId, websiteId: row.id, createdBy: a.userId, ...p } as any);
        return row;
      });
    } else if (site.status === 'not_enabled') {
      site = await inWeb(a, async (tx) => (await tx.update(webSite).set({ status: 'setup', updatedAt: new Date() }).where(eq(webSite.organizationId, a.organizationId)).returning())[0]);
    }
    return c.json({ site, pages: await pagesOf(a), url: siteUrl(site.subdomain, websiteBaseUrl) });
  });

  /** The site's identity, look and words. Setting the subdomain moves the address (checked for clashes). */
  r.put('/site', async (c) => {
    const a = actor(c, 'website', 'manage');
    await requireAddon(d.db, a.organizationId, 'website');
    if (!(await siteOf(a))) throw new HttpError(404, 'SITE_NOT_FOUND');
    const b = await c.req.json<Record<string, any>>().catch(() => ({} as Record<string, any>));
    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (b.lang !== undefined) set.lang = ['ar', 'en'].includes(b.lang) ? b.lang : bad('BAD_LANG');
    if (b.name !== undefined) set.name = two(b.name, 80);
    if (b.tagline !== undefined) set.tagline = two(b.tagline, 160);
    if (b.about !== undefined) set.about = two(b.about);
    if (b.theme !== undefined) set.theme = themeIn(b.theme);
    if (b.settings !== undefined) set.settings = settingsIn(b.settings);
    if (b.logoId !== undefined) set.logoId = b.logoId || null;
    if (b.faviconId !== undefined) set.faviconId = b.faviconId || null;
    if (b.subdomain !== undefined) set.subdomain = b.subdomain ? subdomainIn(b.subdomain) : null;
    let site;
    try {
      [site] = await inWeb(a, (tx) => tx.update(webSite).set(set as any).where(eq(webSite.organizationId, a.organizationId)).returning());
      if (!site) throw new HttpError(404, 'SITE_NOT_FOUND');
    } catch (e) { if (isConflict(e, 'web_site_subdomain')) throw new HttpError(409, 'SUBDOMAIN_TAKEN'); throw e; }
    return c.json({ site, url: siteUrl(site.subdomain, websiteBaseUrl) });
  });

  /** Publishing: the design and content go live (operational data is always current). Needs a home page. */
  r.post('/site/publish', async (c) => {
    const a = actor(c, 'website', 'manage');
    await requireAddon(d.db, a.organizationId, 'website');
    const site = await siteOf(a);
    if (!site) throw new HttpError(404, 'SITE_NOT_FOUND');
    const [row] = await inWeb(a, async (tx) => {
      const [current] = await tx.select().from(webSite).where(eq(webSite.organizationId, a.organizationId));
      if (!current) throw new HttpError(404, 'SITE_NOT_FOUND');
      const pages = await tx.select().from(webPage).where(and(eq(webPage.organizationId, a.organizationId), eq(webPage.websiteId, current.id))).orderBy(asc(webPage.sort), asc(webPage.createdAt));
      const hasHome = pages.some((p: any) => p.slug === '');
      const contact = current.settings?.contact ?? {};
      const realEstate = current.vertical === 'realestate' ? await settingsOf(tx, a.organizationId) : null;
      const hasContact = !!(contact.phone || contact.whatsapp || contact.email || realEstate?.phone || realEstate?.whatsapp || realEstate?.email);
      const hasName = !!(current.name?.ar?.trim() || current.name?.en?.trim());
      if (!hasHome) throw new HttpError(400, 'NEEDS_HOME');
      if (!hasName) throw new HttpError(400, 'NEEDS_BUSINESS_NAME');
      if (!hasContact) throw new HttpError(400, 'NEEDS_CONTACT');
      const publishedSnapshot = { lang: current.lang as 'ar' | 'en', name: current.name, tagline: current.tagline, about: current.about,
        theme: current.theme, settings: current.settings, logoId: current.logoId, faviconId: current.faviconId,
        pages: pages.map(({ id, slug, kind, title, sections, seo, sort }: any) => ({ id, slug, kind, title, sections, seo, sort })) };
      return tx.update(webSite).set({ status: 'published', publishedAt: new Date(), publishedSnapshot, updatedAt: new Date() })
        .where(eq(webSite.organizationId, a.organizationId)).returning();
    });
    return c.json({ site: row, url: siteUrl(row.subdomain, websiteBaseUrl) });
  });
  r.post('/site/unpublish', async (c) => {
    const a = actor(c, 'website', 'manage');
    await requireAddon(d.db, a.organizationId, 'website');
    const site = await siteOf(a);
    if (!site) throw new HttpError(404, 'SITE_NOT_FOUND');
    const [row] = await inWeb(a, (tx) => tx.update(webSite).set({ status: 'draft', updatedAt: new Date() }).where(eq(webSite.organizationId, a.organizationId)).returning());
    return c.json({ site: row, url: siteUrl(row.subdomain, websiteBaseUrl) });
  });

  // ---- pages ----
  const pageInput = (b: any) => {
    const out: Record<string, unknown> = {};
    if (b.slug !== undefined) out.slug = slugIn(b.slug);
    if (b.kind !== undefined) out.kind = kindIn(b.kind);
    if (b.title !== undefined) out.title = two(b.title, 120);
    if (b.sections !== undefined) out.sections = sectionsIn(b.sections);
    if (b.seo !== undefined) out.seo = { title: two(b.seo?.title, 120), description: two(b.seo?.description, 300), image: url(b.seo?.image), noindex: !!b.seo?.noindex };
    if (b.sort !== undefined) out.sort = Number.isInteger(b.sort) ? b.sort : bad('BAD_SORT');
    return out;
  };
  r.post('/pages', async (c) => {
    const a = actor(c, 'website', 'manage');
    await requireAddon(d.db, a.organizationId, 'website');
    const site = await siteOf(a);
    if (!site) throw new HttpError(404, 'SITE_NOT_FOUND');
    const b = await c.req.json<Record<string, any>>().catch(() => ({} as Record<string, any>));
    const input = pageInput(b);
    try {
      const [row] = await inWeb(a, (tx) => tx.insert(webPage).values({ id: newId(), organizationId: a.organizationId, websiteId: site.id, slug: '', kind: 'custom', title: {}, ...(input as any), createdBy: a.userId }).returning());
      return c.json({ page: row }, 201);
    } catch (e) { if (isConflict(e, 'web_page_slug')) throw new HttpError(409, 'PAGE_SLUG_TAKEN'); throw e; }
  });
  r.put('/pages/:id', async (c) => {
    const a = actor(c, 'website', 'manage');
    await requireAddon(d.db, a.organizationId, 'website');
    const id = c.req.param('id');
    const b = await c.req.json<Record<string, any>>().catch(() => ({} as Record<string, any>));
    const input = pageInput(b);
    try {
      const [row] = await inWeb(a, (tx) => tx.update(webPage).set({ ...input, updatedAt: new Date() }).where(and(eq(webPage.id, id), eq(webPage.organizationId, a.organizationId))).returning());
      if (!row) throw new HttpError(404, 'PAGE_NOT_FOUND');
      return c.json({ page: row });
    } catch (e) { if (isConflict(e, 'web_page_slug')) throw new HttpError(409, 'PAGE_SLUG_TAKEN'); throw e; }
  });
  r.delete('/pages/:id', async (c) => {
    const a = actor(c, 'website', 'manage');
    await requireAddon(d.db, a.organizationId, 'website');
    const id = c.req.param('id');
    const [row] = await inWeb(a, (tx) => tx.delete(webPage).where(and(eq(webPage.id, id), eq(webPage.organizationId, a.organizationId))).returning());
    if (!row) throw new HttpError(404, 'PAGE_NOT_FOUND');
    return c.json({ ok: true });
  });

  async function freeSubdomain(a: Actor, base: string): Promise<string> {
    const clean = base.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'site';
    const existing = await withSystem(d.db, (tx) => tx.select({ subdomain: webSite.subdomain }).from(webSite).where(eq(webSite.subdomain, clean)));
    if (!existing.length && !RESERVED_SUBDOMAINS.includes(clean)) return clean;
    return `${clean.slice(0, 25)}-${newId().slice(0, 4).toLowerCase()}`;
  }

  return r;
}
