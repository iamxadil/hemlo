// Real Estate data: what the API returns, the agency's set-up every screen shares, and small helpers (prices in their
// own currency, Baghdad dates, WhatsApp links, "3 days ago").
import { useQuery } from '@tanstack/react-query';
import { api, remembered } from '../lib/api';
import { useApp } from '../lib/app';
import type { Lang } from '../lib/i18n';

export type Two = { ar: string; en: string };
export interface Settings { phone: string | null; whatsapp: string | null; email: string | null; address: string | null; about: { ar?: string; en?: string } | null; currency: 'USD' | 'IQD'; city: string | null;
  shareTemplate: { ar?: string; en?: string } | null; usdRate: number; defaultCommission: number; autoMatch: boolean; waApi: { status: string; requestedAt?: string } | null }
export interface TeamMember { id: string; role: string; name: string; image: string | null; phone: string | null; whatsapp: string | null; title: string | null; branchId: string | null; agentShare: number | null; active: boolean }
export interface Setup { settings: Settings; team: TeamMember[]; branches: { id: string; name: string; city: string | null; phone: string | null; active: boolean }[]; types: Record<string, Two>; features: Record<string, Two>; shareDefault: Two }

export interface Card {
  id: string; ref: number; slug: string; title: string; titleEn: string | null; type: string; purpose: 'sale' | 'rent'; status: string; publishedAt: string | null; price: number | null; currency: 'USD' | 'IQD';
  rentPeriod: string | null; negotiable: boolean; city: string | null; area: string | null; lat: number | null; lng: number | null; size: number | null; land: number | null; bedrooms: number | null; bathrooms: number | null;
  features: string[]; agentId: string | null; ownerId: string | null; coverId: string | null; stats: Record<string, number>; updatedAt: string; statusAt: string; createdAt: string; cover: string | null;
}
export interface Property extends Omit<Card, 'cover'> {
  address: string | null; showExact: boolean; floors: number | null; parking: number | null; yearBuilt: number | null; furnished: string | null; condition: string | null; description: { ar?: string; en?: string };
  notes: string | null; ownerMin?: number | null; branchId: string | null; video: string | null;
}
export interface Photo { id: string; url: string; width: number | null; height: number | null; caption: string | null }
export interface Lead {
  id: string; name: string; phone: string | null; whatsapp: string | null; email: string | null; lang: string; purpose: 'sale' | 'rent'; source: string; status: string; agentId: string | null;
  budgetMin: number | null; budgetMax: number | null; currency: 'USD' | 'IQD'; types: string[]; areas: string[]; city: string | null; bedrooms: number | null; bathrooms: number | null; sizeMin: number | null; sizeMax: number | null;
  must: string[]; notes: string | null; consent: boolean; lastContactAt: string | null; nextFollowAt: string | null; createdAt: string; updatedAt: string; archivedAt: string | null;
}
export interface Owner { id: string; name: string; phone: string | null; whatsapp: string | null; email: string | null; lang: string; notes: string | null; commission: { kind: 'percent' | 'fixed'; value: number; note?: string } | null; agentId: string | null; createdAt: string; listings?: number; live?: number }
export type Reason = { key: string; fit: 'yes' | 'near' | 'no' };
export interface Viewing { id: string; propertyId: string; leadId: string | null; agentId: string | null; startsAt: string | null; minutes: number; status: string; source: string; preferred: string | null; notes: string | null; outcome: string | null; feedback: string | null; createdAt: string;
  property?: { id: string; ref: number; title: string; titleEn?: string | null; area: string | null; city?: string | null; slug?: string; address?: string | null; lat?: number | null; lng?: number | null; cover?: string | null; status?: string };
  lead?: { id: string; name: string; phone: string | null; whatsapp: string | null; lang?: string } | null }
export interface Followup { id: string; leadId: string | null; propertyId: string | null; dealId: string | null; agentId: string | null; kind: string; note: string | null; dueAt: string; doneAt: string | null; when?: 'overdue' | 'today' | 'upcoming';
  lead?: { id: string; name: string; phone: string | null; whatsapp: string | null; status?: string } | null; property?: { id: string; ref: number; title: string } | null }
export interface Offer { id: string; dealId: string; kind: string; amount: number | null; note: string | null; at: string }
export interface Deal { id: string; propertyId: string; leadId: string | null; ownerId: string | null; agentId: string | null; purpose: string; stage: string; asking: number | null; agreed: number | null; currency: 'USD' | 'IQD';
  commissionKind: string; commissionValue: number | null; agentShare: number | null; commission: { total: number; agent: number } | null; closedAt: string | null; lostReason: string | null; notes: string | null; updatedAt: string; createdAt: string;
  property?: Card; lead?: { id: string; name: string; phone?: string | null; whatsapp?: string | null } | null; lastOffer?: { kind: string; amount: number | null; at: string } | null; offers?: Offer[]; paid?: number | null }
export interface Activity { id: string; kind: string; propertyId: string | null; leadId: string | null; ownerId: string | null; dealId: string | null; userId: string | null; detail: Record<string, any>; at: string }
export interface Share { url: string; qr: string; text: Two }

export function useSetup() {
  const { sys } = useApp();
  return useQuery<Setup>({ queryKey: ['re-setup'], queryFn: () => remembered(`re-setup.${sys.business.id}`, () => api('/v1/re/setup')), staleTime: 120_000 });
}

export const fmt = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ''));
const nf = new Intl.NumberFormat('en-US');
/** $185,000 · 450,000,000 د.ع · $750 / month */
export function price(n: number | null | undefined, currency: string, lang: Lang, period?: string | null, short = false) {
  if (n == null) return lang === 'en' ? 'On request' : 'عند الطلب';
  const v = short && n >= 1_000_000 ? `${+(n / 1_000_000).toFixed(n % 1_000_000 ? 2 : 0)}M` : short && n >= 10_000 ? `${Math.round(n / 1000)}k` : nf.format(n);
  const base = currency === 'USD' ? `$${v}` : `${v} ${lang === 'en' ? 'IQD' : 'د.ع'}`;
  return period ? `${base} / ${lang === 'en' ? (period === 'year' ? 'yr' : 'mo') : period === 'year' ? 'سنة' : 'شهر'}` : base;
}
export const titleOf = (p: { title: string; titleEn?: string | null }, lang: Lang) => (lang === 'en' && p.titleEn) || p.title;
export const waLink = (phone: string | null | undefined, text = '') => (phone ? `https://wa.me/${phone.replace(/\D/g, '')}${text ? `?text=${encodeURIComponent(text)}` : ''}` : null);
export const telLink = (phone: string | null | undefined) => (phone ? `tel:${phone.replace(/[^\d+]/g, '')}` : null);
export const localPhone = (p?: string | null) => (p ? p.replace(/^\+964(\d{3})(\d{3})(\d{4})$/, '0$1 $2 $3') : '');
/** "3 days ago", "in 2 days", "today" (Baghdad days). */
export function ago(d: string | Date | null | undefined, r: { common: Record<string, string> }) {
  if (!d) return '';
  const ms = Date.now() - +new Date(d), m = Math.round(ms / 60_000);
  if (m >= 0 && m < 60) return m < 1 ? r.common.now : fmt(r.common.agoMin, { n: m });
  if (m >= 0 && m < 24 * 60) return fmt(r.common.agoH, { n: Math.round(m / 60) });
  const days = Math.round(ms / 86400_000);
  return days > 0 ? fmt(r.common.agoD, { n: days }) : fmt(r.common.inD, { n: -days });
}
export const isToday = (d: string | null | undefined) => !!d && new Date(+new Date(d) + 3 * 3600_000).toISOString().slice(0, 10) === new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10);
/** A local datetime-input value (Baghdad) ↔ an ISO instant. */
export const toLocalInput = (d: string | Date) => new Date(+new Date(d) + 3 * 3600_000).toISOString().slice(0, 16);
export const fromLocalInput = (v: string) => new Date(`${v}:00+03:00`).toISOString();
/** The tone of a property status, everywhere. */
export const statusTone = (s: string) => (s === 'available' ? 'ok' : s === 'negotiating' ? 'warn' : s === 'reserved' ? 'info' : s === 'sold' || s === 'rented' ? 'ink' : 'idle');
export const stageTone = (s: string) => (s === 'closed' ? 'ok' : s === 'lost' ? 'idle' : s === 'reserved' ? 'info' : s === 'offer' || s === 'negotiation' ? 'warn' : 'accent');
/** Who's who on the team, by member id. */
export function useTeam() { const s = useSetup(); return (id: string | null | undefined) => s.data?.team.find((m) => m.id === id) ?? null; }
