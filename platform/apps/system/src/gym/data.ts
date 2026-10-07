// Gym data: what the API returns, the set-up every screen shares, and small helpers (Baghdad days, WhatsApp, states).
import { useQuery } from '@tanstack/react-query';
import { api, remembered } from '../lib/api';
import { useApp } from '../lib/app';

export type Hours = Record<string, { from: string; to: string; who: 'all' | 'm' | 'f' }[]>;
export interface Plan { id: string; name: string; category: 'gym' | 'pt' | 'class' | 'other'; duration: number; unit: 'day' | 'month'; visits: number | null; price: number; gender: string; freezeDays: number; color: string | null; active: boolean; sort: number }
export interface Trainer { id: string; memberId: string | null; name: string; phone: string | null; gender: string | null; specialty: string | null; color: string; ptShare: number; active: boolean }
export interface Klass { id: string; name: string; trainerId: string | null; day: number; startsAt: string; minutes: number; capacity: number | null; gender: string; color: string | null; active: boolean }
export interface GSettings { hours: Hours | null; reentryMinutes: number; graceDays: number; reminderText: string | null; selfCheckin: boolean }
export interface Setup { settings: GSettings; plans: Plan[]; trainers: Trainer[]; classes: Klass[]; members: { id: string; role: string; name: string }[] }
export interface MsSummary { id: string; name: string; category: string; startsOn: string; endsOn: string; visits: number | null; visitsUsed: number }
export interface MemberRow { id: string; memberNo: number; name: string; phone: string | null; balance: number; gender: string | null; alerts: string[]; lastVisitAt: string | null; trainerId: string | null; photoUrl: string | null; state: string; membership: MsSummary | null }
export interface Membership extends MsSummary { memberId: string; planId: string | null; price: number; discount: number; saleId: string | null; trainerId: string | null; status: string; freezeDays: number; frozenFrom: string | null; frozenDays: number; note: string | null; createdAt: string;
  state: 'active' | 'frozen' | 'future' | 'used' | 'grace' | 'ended' | 'canceled'; daysLeft: number; visitsLeft: number | null }
export interface CheckinResult {
  result: 'ok' | 'again' | 'denied' | 'override'; reason: string | null; warn: string[];
  member: { id: string; memberNo: number; name: string; phone: string | null; balance: number; gender: string | null; photoUrl: string | null; alerts: string[] };
  membership: (MsSummary & { state: string; daysLeft: number; visitsLeft: number | null; frozenFrom: string | null }) | null;
  checkin: { id: string; at: string };
}

export function useSetup() {
  const { sys } = useApp();
  return useQuery<Setup>({ queryKey: ['gym-setup'], queryFn: () => remembered(`gym-setup.${sys.business.id}`, () => api('/v1/gym/setup')), staleTime: 60_000 });
}

/** Days in Baghdad (UTC+3 all year), as 'YYYY-MM-DD'. */
export const todayISO = () => new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10);
export const addDays = (date: string, n: number) => new Date(+new Date(`${date}T12:00:00Z`) + n * 86400_000).toISOString().slice(0, 10);
export const daysBetween = (a: string, b: string) => Math.round((+new Date(`${b}T12:00:00Z`) - +new Date(`${a}T12:00:00Z`)) / 86400_000);
export const endOf = (start: string, duration: number, unit: string) => {
  if (unit === 'day') return addDays(start, duration - 1);
  const [y, m, d] = start.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1 + duration, 1)), last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  return addDays(new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), Math.min(d, last))).toISOString().slice(0, 10), -1);
};
export const hhmm = (d: string | Date) => new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Baghdad' }).format(new Date(d));
export const waLink = (phone: string | null | undefined, text?: string) => (phone ? `https://wa.me/${phone.replace(/\D/g, '')}${text ? `?text=${encodeURIComponent(text)}` : ''}` : null);
export const fmt = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ''));

/** The colour of a state, everywhere: in (green), ending (amber), out (red), paused (blue). */
export const tone = (state: string | null | undefined) =>
  state === 'active' ? 'ok' : state === 'ending' || state === 'grace' || state === 'future' ? 'warn' : state === 'frozen' ? 'info' : state === 'none' ? 'idle' : 'bad';

/** How much of a membership is left, 0..1 (time, or visits). */
export function leftOf(m: { startsOn: string; endsOn: string; visits: number | null; visitsUsed: number }, day = todayISO()) {
  if (m.visits != null) return Math.max(0, Math.min(1, (m.visits - m.visitsUsed) / m.visits));
  const total = daysBetween(m.startsOn, m.endsOn) + 1, left = daysBetween(day, m.endsOn) + 1;
  return Math.max(0, Math.min(1, left / Math.max(1, total)));
}
