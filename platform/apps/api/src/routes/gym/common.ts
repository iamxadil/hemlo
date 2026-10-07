// Shared by the gym routes: the gym's day (Baghdad), dates, a membership's state, the health alerts, and the member card.
import { eq, sql } from 'drizzle-orm';
import { withOrg, type Database } from '@hemlo/db';
import { gymSettings, gymMember, sysCustomer, type GymHours } from '@hemlo/db/schema';
import { HttpError } from '../../principal';
import { bad, type Actor } from '../sys-common';
import { fileUrl } from '../../files';
import type { Deps } from '../../types';

export const inGym = <T>(d: Deps, a: Actor, fn: (tx: Database) => Promise<T>) => withOrg(d.db, a.organizationId, fn);
export const rowsOf = (r: any): any[] => (Array.isArray(r) ? r : r?.rows ?? []);

// ---- days: Iraq is UTC+3 all year; a membership's dates are Baghdad calendar days ----
const DAY = 86400_000;
export const today = (now = Date.now()) => new Date(now + 3 * 3600_000).toISOString().slice(0, 10);
export const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
export const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY);
/** The same day n months later (31 Jan + 1 month = 28 Feb), as Postgres counts it. */
export function addMonths(date: string, n: number) {
  const [y, m, d] = date.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), Math.min(d, last))).toISOString().slice(0, 10);
}
/** The last day a plan bought on `start` is good for (inclusive). */
export const endOf = (start: string, duration: number, unit: string) => addDays(unit === 'day' ? addDays(start, duration) : addMonths(start, duration), -1);
export const dateOnly = (v: unknown, code = 'BAD_DATE') => {
  if (v == null || v === '') return null;
  const s = String(v);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) ? s : bad(code);
};
export const int = (v: unknown, min: number, max: number, code: string) => { const n = Number(v); return Number.isInteger(n) && n >= min && n <= max ? n : bad(code); };
export const hhmmRe = /^([01]\d|2[0-3]):[0-5]\d$/;
/** Now in Baghdad as day-of-week ('0' = Sunday) and 'HH:MM'. */
export function clock(now = Date.now()) {
  const t = new Date(now + 3 * 3600_000);
  return { dow: String(t.getUTCDay()), hm: t.toISOString().slice(11, 16) };
}

export const CATEGORIES = ['gym', 'pt', 'class', 'other'] as const;
/** Which memberships open the door: the gym itself first, then a classes pass, then personal training. */
export const DOOR_ORDER = ['gym', 'class', 'pt'];
export const GOALS = ['lose', 'build', 'fit', 'strength', 'rehab', 'sport'] as const;

export type MsRow = { id: string; name: string; category: string; startsOn: string; endsOn: string; visits: number | null; visitsUsed: number; status: string;
  frozenFrom: string | null; freezeDays: number; frozenDays: number; trainerId: string | null; price: number };
/** What a membership is today: running, paused, not started, used up, or over (and how much is left). */
export function stateOf(m: MsRow, day = today(), graceDays = 0) {
  const visitsLeft = m.visits == null ? null : Math.max(0, m.visits - m.visitsUsed);
  const daysLeft = daysBetween(day, m.endsOn) + 1; // the last day counts
  let state: 'active' | 'frozen' | 'future' | 'used' | 'grace' | 'ended' | 'canceled';
  if (m.status === 'canceled') state = 'canceled';
  else if (m.status === 'frozen') state = 'frozen';
  else if (m.startsOn > day) state = 'future';
  else if (m.endsOn < day) state = daysBetween(m.endsOn, day) <= graceDays ? 'grace' : 'ended';
  else if (visitsLeft === 0) state = 'used';
  else state = 'active';
  return { state, daysLeft: Math.max(0, daysLeft), visitsLeft };
}

/** Health answers → what a coach must see before training someone. */
const ALERTS = ['heart', 'hypertension', 'diabetes', 'asthma', 'epilepsy', 'injury', 'back', 'knee', 'pregnant', 'surgery'] as const;
export function cleanHealth(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== 'object') return {};
  const m = v as Record<string, any>, out: Record<string, unknown> = {};
  for (const k of ALERTS) if (m[k] != null) out[k] = !!m[k];
  for (const k of ['notes', 'medications']) if (typeof m[k] === 'string') out[k] = m[k].slice(0, 1000);
  return out;
}
export const alertsFrom = (h: Record<string, any>) => ALERTS.filter((k) => h?.[k]);

export async function gymSettingsOf(tx: Database, org: string) {
  const [s] = await tx.select().from(gymSettings).where(eq(gymSettings.organizationId, org));
  return s ?? { organizationId: org, hours: null as GymHours | null, reentryMinutes: 180, graceDays: 0, reminderText: null, doorKey: null as string | null, selfCheckin: false, updatedAt: new Date() };
}

/** Is it a time this member may train? (ladies' hours, men's hours; closed is the desk's call) */
export function hoursProblem(hours: GymHours | null | undefined, gender: string | null, now = Date.now()) {
  if (!hours || !gender) return null;
  const { dow, hm } = clock(now);
  const blocks = hours[dow];
  if (!blocks?.length) return null;
  const on = blocks.find((b) => b.from <= hm && hm < b.to);
  if (!on || on.who === 'all') return null;
  return on.who !== gender ? 'hours' : null;
}

/** A member and their customer record, or 404. */
export async function memberOf(tx: Database, id: string) {
  const [row] = await tx.select({ m: gymMember, c: sysCustomer }).from(gymMember).innerJoin(sysCustomer, eq(sysCustomer.id, gymMember.customerId)).where(eq(gymMember.customerId, id));
  if (!row) throw new HttpError(404, 'MEMBER_NOT_FOUND');
  return row;
}

/** The member card most screens show. */
export async function cardOf(d: Deps, org: string, x: { m: typeof gymMember.$inferSelect; c: typeof sysCustomer.$inferSelect }) {
  return {
    id: x.m.customerId, memberNo: x.m.memberNo, name: x.c.name, phone: x.c.phone, balance: x.c.balance, gender: x.m.gender, birthDate: x.m.birthDate,
    photoUrl: await fileUrl(d.env, org, x.m.photoId), alerts: x.m.alerts, goal: x.m.goal, trainerId: x.m.trainerId, lastVisitAt: x.m.lastVisitAt, createdAt: x.m.createdAt,
  };
}

/** A card code: 10 characters a scanner reads and nobody guesses (no 0/O, 1/I). */
const ALPHA = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
export function newCardCode() {
  const b = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(b, (x) => ALPHA[x % 32]).join('');
}
/** What a scanner gives us: the bare code, or the card's QR text ("HEMLO-GYM:CODE"). */
export const cardCodeFrom = (v: unknown) => { const s = String(v ?? '').trim().toUpperCase().replace(/^HEMLO-GYM:/, ''); return /^[2-9A-HJ-NP-Z]{10}$/.test(s) ? s : null; };

/** The current membership of each member (the one running today, or else the latest), as SQL for a lateral join. */
export const currentMs = (day: string) => sql`(select ms.id, ms.name, ms.category, ms.starts_on, ms.ends_on, ms.visits, ms.visits_used, ms.status, ms.frozen_from, ms.trainer_id
  from gym_membership ms where ms.member_id = m.customer_id and ms.status <> 'canceled' and ms.category <> 'other'
  order by (ms.starts_on <= ${day} and ms.ends_on >= ${day}) desc, (ms.category = 'gym') desc, ms.ends_on desc limit 1)`;

/** A date column from a raw query: text from Postgres, a Date from PGlite; always 'YYYY-MM-DD'. */
export const ymd = (v: unknown) => (v == null ? null : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10));
