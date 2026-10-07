// Shared by the Real Estate routes: who sees which leads, input checks, words in both languages (types, features),
// prices, the activity timeline, notices, photos' links, and the WhatsApp message that goes with a listing.
import { and, eq, inArray, isNull, or, sql, type SQL } from 'drizzle-orm';
import { newId, normalizeIraqiPhone } from '@hemlo/core';
import { withOrg, type Database } from '@hemlo/db';
import { reActivity, reNotice, reSettings, reMedia, reLead, RE_TYPES, RE_STATUSES, RE_SOURCES } from '@hemlo/db/schema';
import { HttpError } from '../../principal';
import { bad, may, type Actor } from '../sys-common';
import { fileUrl } from '../../files';
import type { Deps } from '../../types';

export { RE_TYPES, RE_STATUSES, RE_SOURCES };
export const inRe = <T>(d: Deps, a: Actor, fn: (tx: Database) => Promise<T>) => withOrg(d.db, a.organizationId, fn);
export const rowsOf = (r: any): any[] => (Array.isArray(r) ? r : r?.rows ?? []);
export const SITE = (d: Deps) => d.env.PUBLIC_SITE_URL ?? 'https://hemlohq.com';

// ---------- input ----------
export const CURRENCIES = ['USD', 'IQD'] as const;
export const MAX_PRICE = 1_000_000_000_000; // a trillion: well past any Iraqi property in dinars
export const amount = (v: unknown, code = 'BAD_PRICE', allowNull = true): number | null => {
  if (v == null || v === '') return allowNull ? null : bad(code);
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 && n <= MAX_PRICE ? n : bad(code);
};
export const intIn = (v: unknown, min: number, max: number, code: string): number | null => {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : bad(code);
};
export const oneOf = <T extends string>(v: unknown, list: readonly T[], code: string, fallback?: T): T => (list.includes(v as T) ? (v as T) : fallback !== undefined && (v == null || v === '') ? fallback : bad(code));
export const words = (v: unknown, maxItems: number, maxLen: number, code: string): string[] => {
  if (v == null) return [];
  if (!Array.isArray(v) || v.length > maxItems) bad(code);
  return [...new Set((v as unknown[]).map((x) => (typeof x === 'string' ? x.trim() : bad(code))).filter(Boolean).map((x) => (x.length > maxLen ? bad(code) : x)))];
};
export const str = (v: unknown, max: number, code: string, required = false): string | null => {
  if (v == null || v === '') return required ? bad(code) : null;
  if (typeof v !== 'string') bad(code);
  const s = (v as string).trim();
  if (required && !s) bad(code);
  return s.length > max ? bad(code) : s || null;
};
/** Iraqi numbers become +964…; a foreign number (+…) is kept as typed. */
export const phone = (v: unknown, code = 'BAD_PHONE'): string | null => {
  if (v == null || v === '') return null;
  const s = String(v);
  const iq = normalizeIraqiPhone(s);
  if (iq) return iq;
  const intl = s.replace(/[\s\-().]/g, '');
  return /^\+[1-9]\d{7,14}$/.test(intl) ? intl : bad(code);
};
export const dateOnly = (v: unknown, code = 'BAD_DATE') => {
  if (v == null || v === '') return null;
  const s = String(v);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) ? s : bad(code);
};
export const when = (v: unknown, code = 'BAD_DATE'): Date | null => {
  if (v == null || v === '') return null;
  const t = new Date(String(v));
  return Number.isNaN(t.getTime()) ? bad(code) : t;
};
export const latLng = (lat: unknown, lng: unknown) => {
  if ((lat == null || lat === '') && (lng == null || lng === '')) return { lat: null, lng: null };
  const a = Number(lat), b = Number(lng);
  return Number.isFinite(a) && Number.isFinite(b) && a >= -90 && a <= 90 && b >= -180 && b <= 180 ? { lat: a, lng: b } : bad('BAD_LOCATION');
};

/** Baghdad's calendar day (UTC+3 all year). */
export const today = (now = Date.now()) => new Date(now + 3 * 3600_000).toISOString().slice(0, 10);
/** Midnight in Baghdad, n days from today, as an instant. */
export const dayStart = (n = 0, now = Date.now()) => { const b = new Date(now + 3 * 3600_000); return new Date(Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate() + n) - 3 * 3600_000); };

// ---------- unguessable public names ----------
const ALPHA = 'abcdefghjkmnpqrstuvwxyz23456789';
export const token = (n = 10) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (x) => ALPHA[x % ALPHA.length]).join('');
/** hemlohq.com/p/villa-k7m2qx: the kind of property, then six letters nobody guesses. */
export const newSlug = (type: string) => `${RE_TYPES.includes(type as any) ? type : 'property'}-${token(6)}`;

// ---------- who sees which leads ----------
/** An agent without leads:read-all sees their own leads and the unassigned ones; managers and the desk see all. */
export function leadScope(a: Actor): SQL | undefined {
  if (may(a.principal, 'leads', 'read-all')) return undefined;
  const mine = (a.principal as any).memberId as string | null;
  return mine ? or(eq(reLead.agentId, mine), isNull(reLead.agentId)) : isNull(reLead.agentId);
}
export const memberOf = (a: Actor) => ((a.principal as any).memberId as string | null) ?? null;
/** One lead this person may open, or 404 (an agent never learns another agent's lead exists). */
export async function leadOf(tx: Database, a: Actor, id: string) {
  const [l] = await tx.select().from(reLead).where(and(eq(reLead.id, id), leadScope(a)));
  if (!l) throw new HttpError(404, 'LEAD_NOT_FOUND');
  return l;
}

// ---------- the timeline and notices ----------
type Refs = { propertyId?: string | null; leadId?: string | null; ownerId?: string | null; dealId?: string | null };
export async function activity(tx: Database, org: string, kind: string, refs: Refs, detail: Record<string, unknown> = {}, userId: string | null = null) {
  await tx.insert(reActivity).values({ id: newId(), organizationId: org, kind, userId, detail, propertyId: refs.propertyId ?? null, leadId: refs.leadId ?? null, ownerId: refs.ownerId ?? null, dealId: refs.dealId ?? null });
}
export async function notice(tx: Database, org: string, kind: string, refs: Refs & { viewingId?: string | null; agentId?: string | null }, detail: Record<string, unknown> = {}) {
  await tx.insert(reNotice).values({ id: newId(), organizationId: org, kind, detail, agentId: refs.agentId ?? null, propertyId: refs.propertyId ?? null, leadId: refs.leadId ?? null, dealId: refs.dealId ?? null, viewingId: refs.viewingId ?? null });
}

export async function settingsOf(tx: Database, org: string) {
  const [s] = await tx.select().from(reSettings).where(eq(reSettings.organizationId, org));
  return s ?? { organizationId: org, phone: null, whatsapp: null, email: null, address: null, about: null, currency: 'USD', city: null, shareTemplate: null, usdRate: 1450, defaultCommission: 200, autoMatch: false, waApi: null, updatedAt: new Date() };
}

// ---------- photos ----------
export type Photo = { id: string; url: string; width: number | null; height: number | null; caption: string | null };
export async function photoUrl(d: Deps, org: string, m: { fileId: string | null; url: string | null }) {
  return m.url ?? (await fileUrl(d.env, org, m.fileId)) ?? '';
}
/** Every listing's photos (in order), by listing. */
export async function photosOf(d: Deps, tx: Database, org: string, propertyIds: string[], { onlyFirst = false } = {}) {
  const out: Record<string, Photo[]> = {};
  if (!propertyIds.length) return out;
  const rows = await tx.select().from(reMedia).where(inArray(reMedia.propertyId, propertyIds)).orderBy(reMedia.propertyId, reMedia.sort);
  for (const m of rows) {
    const list = (out[m.propertyId] ??= []);
    if (onlyFirst && list.length) continue;
    list.push({ id: m.id, url: await photoUrl(d, org, m), width: m.width, height: m.height, caption: m.caption });
  }
  return out;
}
/** The cover first (the listing's chosen one), then the rest in order. */
export const coverFirst = (list: Photo[] = [], coverId: string | null) => {
  const i = coverId ? list.findIndex((p) => p.id === coverId) : -1;
  return i > 0 ? [list[i], ...list.slice(0, i), ...list.slice(i + 1)] : list;
};

// ---------- words ----------
type Two = { ar: string; en: string };
export const TYPE_NAMES: Record<string, Two> = {
  apartment: { ar: 'شقة', en: 'Apartment' }, house: { ar: 'بيت', en: 'House' }, villa: { ar: 'فيلا', en: 'Villa' }, land: { ar: 'أرض', en: 'Land' },
  office: { ar: 'مكتب', en: 'Office' }, shop: { ar: 'محل', en: 'Shop' }, commercial: { ar: 'عقار تجاري', en: 'Commercial' }, building: { ar: 'بناية', en: 'Building' },
  warehouse: { ar: 'مخزن', en: 'Warehouse' }, farm: { ar: 'مزرعة', en: 'Farm' },
};
/** Features Iraqi buyers ask about (an agency may add its own words too). */
export const FEATURES: Record<string, Two> = {
  garden: { ar: 'حديقة', en: 'Garden' }, garage: { ar: 'كراج', en: 'Garage' }, pool: { ar: 'مسبح', en: 'Pool' }, elevator: { ar: 'مصعد', en: 'Elevator' },
  generator: { ar: 'خط مولدة', en: 'Generator line' }, solar: { ar: 'طاقة شمسية', en: 'Solar power' }, central_ac: { ar: 'تكييف مركزي', en: 'Central AC' },
  balcony: { ar: 'بالكونة', en: 'Balcony' }, roof: { ar: 'سطح', en: 'Roof terrace' }, basement: { ar: 'سرداب', en: 'Basement' }, security: { ar: 'حراسة', en: 'Security' },
  maid_room: { ar: 'غرفة خادمة', en: 'Maid’s room' }, kitchen: { ar: 'مطبخ مجهّز', en: 'Fitted kitchen' }, corner: { ar: 'ركن (زاوية)', en: 'Corner plot' },
  two_streets: { ar: 'على شارعين', en: 'Two streets' }, main_street: { ar: 'على شارع رئيسي', en: 'Main street' }, water_tank: { ar: 'خزانات ماء', en: 'Water tanks' },
  title_deed: { ar: 'طابو صرف', en: 'Clear title deed' }, gated: { ar: 'مجمع سكني مغلق', en: 'Gated compound' }, view: { ar: 'إطلالة', en: 'View' }, renovated: { ar: 'مجدّد', en: 'Renovated' },
};
export const featureName = (k: string, lang: 'ar' | 'en') => FEATURES[k]?.[lang] ?? k;
export const typeName = (k: string, lang: 'ar' | 'en') => TYPE_NAMES[k]?.[lang] ?? k;

/** $185,000 · 450,000,000 د.ع · on request */
export function priceText(price: number | null, currency: string, lang: 'ar' | 'en', rentPeriod?: string | null) {
  if (price == null) return lang === 'ar' ? 'السعر عند الطلب' : 'Price on request';
  const n = new Intl.NumberFormat('en-US').format(price);
  const base = currency === 'USD' ? `$${n}` : lang === 'ar' ? `${n} د.ع` : `${n} IQD`;
  const per = rentPeriod === 'month' ? (lang === 'ar' ? ' / شهرياً' : ' / month') : rentPeriod === 'year' ? (lang === 'ar' ? ' / سنوياً' : ' / year') : '';
  return base + per;
}

export type ShareFacts = { ref: number; title: string; titleEn: string | null; type: string; purpose: string; price: number | null; currency: string; rentPeriod: string | null;
  area: string | null; city: string | null; size: number | null; bedrooms: number | null; bathrooms: number | null; slug: string };
export const DEFAULT_SHARE = {
  ar: '🏠 {title}\n📍 {place}\n💰 {price}\n📐 {size}\n🛏 {bedrooms}\n\nشاهد التفاصيل والصور:\n{link}',
  en: '🏠 {title}\n📍 {place}\n💰 {price}\n📐 {size}\n🛏 {bedrooms}\n\nSee the photos and details:\n{link}',
};
/** The WhatsApp message for a listing, in the customer's language. Lines with nothing to say are left out. */
export function shareText(p: ShareFacts, lang: 'ar' | 'en', link: string, template?: { ar?: string; en?: string } | null) {
  const t = template?.[lang] || DEFAULT_SHARE[lang];
  const v: Record<string, string> = {
    title: (lang === 'en' && p.titleEn) || p.title, place: [p.area, p.city].filter(Boolean).join('، '), price: priceText(p.price, p.currency, lang, p.purpose === 'rent' ? p.rentPeriod : null),
    size: p.size ? (lang === 'ar' ? `${p.size} م²` : `${p.size} m²`) : '', bedrooms: p.bedrooms ? (lang === 'ar' ? `${p.bedrooms} غرف نوم` : `${p.bedrooms} bedrooms`) : '',
    bathrooms: p.bathrooms ? String(p.bathrooms) : '', ref: `#${p.ref}`, type: typeName(p.type, lang), link,
  };
  return t.split('\n').filter((line) => { const keys = [...line.matchAll(/\{(\w+)\}/g)].map((m) => m[1]); return !keys.length || keys.some((k) => v[k]); })
    .map((line) => line.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '')).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
export const waLink = (phoneNo: string | null | undefined, text: string) => `https://wa.me/${(phoneNo ?? '').replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;

/** One SQL condition: a text column like a query, accent- and case-insensitive enough for names and phones. */
export const like = (col: any, q: string) => sql`${col} ilike ${'%' + q.replace(/[%_\\]/g, (c) => '\\' + c) + '%'}`;
