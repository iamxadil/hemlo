// The shared Website renderer depends on this narrow vertical boundary. Adapters return explicit public DTOs;
// database rows, tenant IDs, internal notes and private relationships never cross into the renderer.
import { and, desc, eq, gte, ilike, inArray, isNotNull, isNull, lte, or, sql, type SQL } from 'drizzle-orm';
import { newId } from '@hemlo/core';
import type { Database } from '@hemlo/db';
import { reLead, reLeadProperty, reProperty } from '@hemlo/db/schema';
import type { Deps } from '../../types';
import { HttpError } from '../../principal';
import { withCovers, PUBLIC_STATUSES } from '../realestate/properties';
import { activity, coverFirst, photosOf, priceText } from '../realestate/common';
import type { Lang } from './theme';

export type WebsiteListing = {
  slug: string; title: string; area: string | null; city: string | null; type: string; purpose: string; status: string;
  price: string; bedrooms: number | null; bathrooms: number | null; size: number | null; cover: string | null; href: string;
  /** listed in the last two weeks */
  fresh: boolean;
};
export type WebsiteInquiry = { organizationId: string; name: string; phone: string; email: string | null; message: string | null; lang: string; page?: string; propertySlug?: string };
export type WebsiteListingFilter = { q?: string; purpose?: string; type?: string; city?: string; area?: string; place?: string; currency?: string; min?: number; max?: number; sort?: 'new' | 'price-asc' | 'price-desc'; limit?: number };
export type WebsiteProperty = {
  slug: string; title: string; type: string; purpose: string; status: string; price: string; currency: string; negotiable: boolean;
  city: string | null; area: string | null; size: number | null; land: number | null; bedrooms: number | null; bathrooms: number | null;
  floors: number | null; parking: number | null; yearBuilt: number | null; furnished: string | null; condition: string | null;
  features: string[]; description: { ar?: string; en?: string }; video: string | null; map: { lat: number; lng: number } | null;
  photos: { url: string; caption: string | null }[];
};

export interface WebsiteAdapter {
  edition: string;
  sections: readonly string[];
  /** Fields and source tables that the adapter is permitted to publish. */
  publicProjection: readonly string[];
  /** Source mutations that change a rendered page; the API uses the shared short cache policy. */
  refreshOn: readonly string[];
  load(tx: Database, deps: Deps, organizationId: string, lang: Lang, origin: string, filter?: WebsiteListingFilter): Promise<{ listings: WebsiteListing[] }>;
  loadProperty(tx: Database, deps: Deps, organizationId: string, lang: Lang, slug: string): Promise<WebsiteProperty | null>;
  sitemapSlugs(tx: Database): Promise<string[]>;
  /** Files the inquiry; says who it came from and what about, so Connect can answer on WhatsApp. */
  createInquiry(tx: Database, input: WebsiteInquiry): Promise<{ leadId: string; about: string | null }>;
}

export const realEstateWebsiteAdapter: WebsiteAdapter = {
  edition: 'realestate',
  sections: ['listings'],
  publicProjection: ['re_property.slug', 'title', 'title_en', 'city', 'area', 'type', 'purpose', 'status', 'published_at', 'price', 'currency', 'rent_period', 'bedrooms', 'bathrooms', 'size', 'cover_id', 're_media.file_id', 're_media.url'],
  refreshOn: ['re_property.public_fields', 're_property.status', 're_property.published_at', 're_media'],
  async load(tx, deps, organizationId, lang, origin, filter = {}) {
    const where: SQL[] = [isNotNull(reProperty.publishedAt), inArray(reProperty.status, PUBLIC_STATUSES)];
    if (filter.purpose) where.push(eq(reProperty.purpose, filter.purpose));
    if (filter.type) where.push(eq(reProperty.type, filter.type));
    if (filter.city) where.push(ilike(reProperty.city, `%${filter.city}%`));
    if (filter.area) where.push(ilike(reProperty.area, `%${filter.area}%`));
    if (filter.place) where.push(or(ilike(reProperty.area, `%${filter.place}%`), ilike(reProperty.city, `%${filter.place}%`))!);
    if (filter.q) {
      const term = `%${filter.q.replace(/[%_]/g, '')}%`;
      where.push(or(ilike(reProperty.title, term), ilike(reProperty.titleEn, term), ilike(reProperty.area, term), ilike(reProperty.city, term))!);
    }
    if (filter.currency) where.push(eq(reProperty.currency, filter.currency));
    if (filter.min != null) where.push(gte(reProperty.price, filter.min));
    if (filter.max != null) where.push(lte(reProperty.price, filter.max));
    const rows = await tx.select({
      id: reProperty.id, slug: reProperty.slug, title: reProperty.title, titleEn: reProperty.titleEn, city: reProperty.city, area: reProperty.area,
      type: reProperty.type, purpose: reProperty.purpose, status: reProperty.status, publishedAt: reProperty.publishedAt, price: reProperty.price,
      currency: reProperty.currency, rentPeriod: reProperty.rentPeriod, bedrooms: reProperty.bedrooms, bathrooms: reProperty.bathrooms,
      size: reProperty.size, coverId: reProperty.coverId,
    }).from(reProperty).where(and(...where))
      .orderBy(...(filter.sort === 'price-asc' ? [sql`${reProperty.price} asc nulls last`] : filter.sort === 'price-desc' ? [sql`${reProperty.price} desc nulls last`] : []), desc(reProperty.publishedAt))
      .limit(Math.min(filter.limit ?? 36, 60));
    const cards = await withCovers(deps, tx, organizationId, rows);
    return { listings: cards.map((p) => ({
      slug: p.slug, title: lang === 'en' && p.titleEn ? p.titleEn : p.title, area: p.area, city: p.city, type: p.type, purpose: p.purpose, status: p.status,
      price: priceText(p.price == null ? null : Number(p.price), p.currency, lang, p.purpose === 'rent' ? p.rentPeriod : null),
      bedrooms: p.bedrooms, bathrooms: p.bathrooms, size: p.size, cover: p.cover ?? null, href: `${origin}/properties/${encodeURIComponent(p.slug)}`,
      fresh: !!p.publishedAt && Date.now() - +p.publishedAt < 14 * 86400_000,
    })) };
  },
  async loadProperty(tx, deps, organizationId, lang, slug) {
    const [p] = await tx.select({
      id: reProperty.id, slug: reProperty.slug, title: reProperty.title, titleEn: reProperty.titleEn, type: reProperty.type, purpose: reProperty.purpose,
      status: reProperty.status, publishedAt: reProperty.publishedAt, price: reProperty.price, currency: reProperty.currency, rentPeriod: reProperty.rentPeriod,
      negotiable: reProperty.negotiable, city: reProperty.city, area: reProperty.area, showExact: reProperty.showExact, lat: reProperty.lat, lng: reProperty.lng,
      size: reProperty.size, land: reProperty.land, bedrooms: reProperty.bedrooms, bathrooms: reProperty.bathrooms, floors: reProperty.floors, parking: reProperty.parking,
      yearBuilt: reProperty.yearBuilt, furnished: reProperty.furnished, condition: reProperty.condition, features: reProperty.features,
      description: reProperty.description, video: reProperty.video, coverId: reProperty.coverId,
    }).from(reProperty).where(and(eq(reProperty.slug, slug), isNotNull(reProperty.publishedAt), inArray(reProperty.status, PUBLIC_STATUSES))).limit(1);
    if (!p) return null;
    const photos = await photosOf(deps, tx, organizationId, [p.id]);
    const ordered = coverFirst(photos[p.id], p.coverId);
    return {
      slug: p.slug, title: lang === 'en' && p.titleEn ? p.titleEn : p.title, type: p.type, purpose: p.purpose, status: p.status,
      price: priceText(p.price == null ? null : Number(p.price), p.currency, lang, p.purpose === 'rent' ? p.rentPeriod : null), currency: p.currency, negotiable: p.negotiable,
      city: p.city, area: p.area, size: p.size, land: p.land, bedrooms: p.bedrooms, bathrooms: p.bathrooms, floors: p.floors, parking: p.parking,
      yearBuilt: p.yearBuilt, furnished: p.furnished, condition: p.condition, features: p.features ?? [], description: p.description ?? {}, video: p.video,
      map: p.showExact && p.lat != null && p.lng != null ? { lat: p.lat, lng: p.lng } : null,
      photos: ordered.map((x) => ({ url: x.url, caption: x.caption })),
    };
  },
  async sitemapSlugs(tx) {
    const rows = await tx.select({ slug: reProperty.slug }).from(reProperty)
      .where(and(isNotNull(reProperty.publishedAt), inArray(reProperty.status, PUBLIC_STATUSES))).orderBy(reProperty.slug).limit(50_000);
    return rows.map((x) => x.slug);
  },
  async createInquiry(tx, input) {
    const [property] = input.propertySlug ? await tx.select({ id: reProperty.id, title: reProperty.title, titleEn: reProperty.titleEn, purpose: reProperty.purpose, type: reProperty.type, area: reProperty.area, city: reProperty.city })
      .from(reProperty).where(and(eq(reProperty.organizationId, input.organizationId), eq(reProperty.slug, input.propertySlug), isNotNull(reProperty.publishedAt), inArray(reProperty.status, PUBLIC_STATUSES))).limit(1) : [];
    if (input.propertySlug && !property) throw new HttpError(404, 'PROPERTY_UNAVAILABLE');
    const [lead] = await tx.select({ id: reLead.id, notes: reLead.notes, status: reLead.status }).from(reLead)
      .where(and(eq(reLead.organizationId, input.organizationId), eq(reLead.phone, input.phone), isNull(reLead.archivedAt))).limit(1);
    const now = new Date();
    let leadId: string;
    if (!lead) {
      const types = property ? [property.type] : [], areas = property?.area ? [property.area] : [], city = property?.city ?? null;
      const [created] = await tx.insert(reLead).values({ id: newId(), organizationId: input.organizationId, name: input.name, phone: input.phone, whatsapp: input.phone,
        email: input.email, lang: input.lang, source: 'website', purpose: property?.purpose ?? 'sale', types, areas, city, notes: input.message, lastContactAt: now }).returning({ id: reLead.id });
      leadId = created.id;
    } else {
      leadId = lead.id;
      await tx.update(reLead).set({ lastContactAt: now, updatedAt: now, status: lead.status === 'lost' ? 'active' : lead.status,
        notes: input.message ? [lead.notes, input.message].filter(Boolean).join('\n').slice(0, 2000) : lead.notes }).where(eq(reLead.id, lead.id));
    }
    const propertyId = property?.id ?? null;
    if (propertyId) {
      await tx.insert(reLeadProperty).values({ id: newId(), organizationId: input.organizationId, leadId, propertyId, status: 'opened', opens: 1, lastOpenAt: now }).onConflictDoNothing();
    }
    await activity(tx, input.organizationId, 'lead.inquiry', { leadId, ...(propertyId ? { propertyId } : {}) }, { source: 'website', page: input.page ?? 'home' });
    return { leadId, about: property ? (input.lang === 'en' ? property.titleEn || property.title : property.title) : null };
  },
};

const adapters: Readonly<Record<string, WebsiteAdapter>> = { realestate: realEstateWebsiteAdapter };
export const websiteAdapterFor = (edition: string): WebsiteAdapter | null => adapters[edition] ?? null;
