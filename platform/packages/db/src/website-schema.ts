// Hemlo Systems · The Website add-on. One optional public website per business, built from the data it already has:
// the shop's products, the agency's listings, the workshop's services. Hemlo stays the source of truth — a website
// renders business data, it never copies it. Only the design and the site's own words live here, as structured
// sections (never free HTML), and only what is published is public. Draft and private never leave the building.
import { pgTable, text, timestamp, integer, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core';

const at = (name: string) => timestamp(name, { withTimezone: true });
const org = () => text('organization_id').notNull();

export const WEB_STATUSES = ['not_enabled', 'setup', 'draft', 'published'] as const;
export const WEB_DOMAIN_STATUSES = ['none', 'pending', 'verifying', 'active', 'failed'] as const;
export const WEB_PAGE_KINDS = ['home', 'about', 'contact', 'listings', 'services', 'team', 'faq', 'custom'] as const;

/** The look, kept narrow on purpose: a theme is a preset plus a few choices, so a business cannot make an ugly site. */
export type WebTheme = { preset?: string; accent?: string; radius?: string; font?: string; dark?: boolean };
/** The site's own words for one page's search result. */
export type WebSeo = { title?: { ar?: string; en?: string }; description?: { ar?: string; en?: string }; image?: string; noindex?: boolean };
/** One structured block on a page (hero, products, listings, gallery, about, contact…). Typed, ordered, never free HTML. */
export type WebSection = { id: string; type: string; hidden?: boolean; [key: string]: unknown };
/** Nav, footer, contact and social — the parts that are the same on every page. */
export type WebSettings = {
  contact?: { phone?: string; whatsapp?: string; email?: string; address?: string; mapUrl?: string };
  social?: { instagram?: string; facebook?: string; tiktok?: string; youtube?: string; x?: string };
  nav?: { label: { ar?: string; en?: string }; href: string }[];
  footer?: { ar?: string; en?: string };
  cta?: { whatsapp?: boolean; phone?: boolean; inquiry?: boolean };
};
export type WebPublishedSnapshot = {
  lang: 'ar' | 'en'; name: { ar?: string; en?: string }; tagline: { ar?: string; en?: string }; about: { ar?: string; en?: string };
  theme: WebTheme; settings: WebSettings; logoId: string | null; faviconId: string | null;
  pages: { id: string; slug: string; kind: string; title: { ar?: string; en?: string }; sections: WebSection[]; seo: WebSeo; sort: number }[];
};

/** The business's website: whether it is on, which edition it draws from, its look, its words and its addresses. */
export const webSite = pgTable('web_site', {
  id: text('id').primaryKey(),
  organizationId: org(),
  vertical: text('vertical').notNull(),                   // the edition it draws from: store | dental | gym | realestate | school | repair
  status: text('status').notNull().default('not_enabled'), // WEB_STATUSES
  lang: text('lang').notNull().default('ar'),             // the site's default language (ar | en)
  name: jsonb('name').$type<{ ar?: string; en?: string }>().notNull().default({}),
  tagline: jsonb('tagline').$type<{ ar?: string; en?: string }>().notNull().default({}),
  about: jsonb('about').$type<{ ar?: string; en?: string }>().notNull().default({}),
  theme: jsonb('theme').$type<WebTheme>().notNull().default({}),
  settings: jsonb('settings').$type<WebSettings>().notNull().default({}),
  logoId: text('logo_id'),
  faviconId: text('favicon_id'),
  subdomain: text('subdomain'),                           // business.hemlo.site (unique across Hemlo)
  domain: text('domain'),                                 // an external domain, once verified
  domainStatus: text('domain_status').notNull().default('none'), // WEB_DOMAIN_STATUSES
  publishedAt: at('published_at'),
  publishedSnapshot: jsonb('published_snapshot').$type<WebPublishedSnapshot | null>(),
  createdBy: text('created_by'),
  createdAt: at('created_at').notNull().defaultNow(),
  updatedAt: at('updated_at').notNull().defaultNow(),
}, (t) => [
  uniqueIndex('web_site_org').on(t.organizationId),       // one website per business
  uniqueIndex('web_site_subdomain').on(t.subdomain),
  uniqueIndex('web_site_domain').on(t.domain),
]);

/** A page: its address and its sections, in order. The home page's slug is ''. */
export const webPage = pgTable('web_page', {
  id: text('id').primaryKey(),
  organizationId: org(),
  websiteId: text('website_id').notNull(),
  slug: text('slug').notNull().default(''),               // '' is the home page; 'about', 'contact', 'properties'…
  kind: text('kind').notNull().default('custom'),         // WEB_PAGE_KINDS
  title: jsonb('title').$type<{ ar?: string; en?: string }>().notNull().default({}),
  sections: jsonb('sections').$type<WebSection[]>().notNull().default([]),
  seo: jsonb('seo').$type<WebSeo>().notNull().default({}),
  sort: integer('sort').notNull().default(0),
  createdBy: text('created_by'),
  createdAt: at('created_at').notNull().defaultNow(),
  updatedAt: at('updated_at').notNull().defaultNow(),
}, (t) => [
  uniqueIndex('web_page_slug').on(t.websiteId, t.slug),
  index('web_page_site').on(t.organizationId, t.websiteId, t.sort),
]);
