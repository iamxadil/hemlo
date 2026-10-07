// Shared by the dental routes: teeth, surfaces, money in two currencies, the medical alerts, and the access log.
import { and, eq } from 'drizzle-orm';
import { newId } from '@hemlo/core';
import { withOrg, type Database } from '@hemlo/db';
import { dentAccessLog, dentDentist, dentPatient, dentSettings, sysCustomer } from '@hemlo/db/schema';
import { HttpError } from '../../principal';
import { bad, type Actor } from '../sys-common';
import type { Deps } from '../../types';

export const inClinic = <T>(d: Deps, a: Actor, fn: (tx: Database) => Promise<T>) => withOrg(d.db, a.organizationId, fn);

/** FDI tooth numbers: 11–18 … 41–48 (permanent), 51–55 … 81–85 (primary). */
const range = (q: number, n: number) => Array.from({ length: n }, (_, i) => q * 10 + i + 1);
export const PERMANENT = [1, 2, 3, 4].flatMap((q) => range(q, 8));
export const PRIMARY = [5, 6, 7, 8].flatMap((q) => range(q, 5));
const TEETH = new Set([...PERMANENT, ...PRIMARY]);
export const tooth = (v: unknown, required = false) => {
  if (v == null || v === '') return required ? bad('BAD_TOOTH') : null;
  const n = Number(v);
  return TEETH.has(n) ? n : bad('BAD_TOOTH');
};
/** Surfaces as a clean string in a fixed order: M O D B L I (I = incisal). */
export const surfaces = (v: unknown) => {
  if (v == null || v === '') return null;
  const s = String(v).toUpperCase().replace(/[^MODBLI]/g, '');
  if (!s) bad('BAD_SURFACES');
  return 'MODBLI'.split('').filter((c) => s.includes(c)).join('');
};
export const FINDINGS = ['caries', 'filling', 'crown', 'rct', 'missing', 'implant', 'bridge', 'veneer', 'sealant', 'fracture', 'extraction', 'pulpotomy', 'post', 'impacted', 'mobility', 'watch'] as const;
export const CURRENCIES = ['IQD', 'USD'] as const;

/** What a price is in dinars today. USD at the clinic's rate, rounded to 250 IQD (the smallest note in use). */
export const toIqd = (currency: string, price: number, rate: number) => (currency === 'USD' ? Math.round((price * rate) / 250) * 250 : price);

export async function settingsOf(tx: Database, org: string) {
  const [s] = await tx.select().from(dentSettings).where(eq(dentSettings.organizationId, org));
  return s ?? { organizationId: org, usdRate: 1450, slotMinutes: 15, hours: null, recallMonths: 6, rxHeader: null, reminderText: null, screenKey: null as string | null, updatedAt: new Date() };
}

/** Medical history answers → the alerts that every screen shows in red. */
const ALERT_KEYS = ['anticoagulants', 'bleeding', 'heart', 'diabetes', 'hypertension', 'pregnant', 'hepatitis', 'hiv', 'epilepsy', 'asthma', 'kidney', 'bisphosphonates', 'radiotherapy'] as const;
export function alertsFrom(m: Record<string, any>): string[] {
  const out: string[] = [];
  for (const k of ['penicillin', 'latex', 'anesthetic', 'nsaids'] as const) if (m?.allergies?.[k]) out.push(`allergy_${k}`);
  if (typeof m?.allergies?.other === 'string' && m.allergies.other.trim()) out.push('allergy_other');
  for (const k of ALERT_KEYS) if (m?.[k]) out.push(k);
  return out;
}
/** Keep only the medical form's known shape (booleans and short texts). */
export function cleanMedical(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== 'object') return {};
  const m = v as Record<string, any>, out: Record<string, unknown> = {};
  for (const k of [...ALERT_KEYS, 'breastfeeding', 'smoker', 'thyroid', 'surgeryRecent']) if (m[k] != null) out[k] = !!m[k];
  if (m.allergies && typeof m.allergies === 'object') {
    out.allergies = Object.fromEntries(['penicillin', 'latex', 'anesthetic', 'nsaids'].map((k) => [k, !!m.allergies[k]]));
    if (typeof m.allergies.other === 'string') (out.allergies as any).other = m.allergies.other.slice(0, 200);
  }
  for (const k of ['medications', 'conditions', 'notes']) if (typeof m[k] === 'string') out[k] = m[k].slice(0, 1000);
  if (m.bloodType && /^(A|B|AB|O)[+-]$/.test(String(m.bloodType))) out.bloodType = m.bloodType;
  return out;
}

/** A patient (the clinical profile and the customer record), or 404. */
export async function patientOf(tx: Database, id: string) {
  const [row] = await tx.select({ p: dentPatient, c: sysCustomer }).from(dentPatient).innerJoin(sysCustomer, eq(sysCustomer.id, dentPatient.customerId)).where(eq(dentPatient.customerId, id));
  if (!row) throw new HttpError(404, 'PATIENT_NOT_FOUND');
  return row;
}

/** Medical records are watched: who opened what, and when. */
export const logAccess = (tx: Database, a: Actor, patientId: string, action: string) =>
  tx.insert(dentAccessLog).values({ id: newId(), organizationId: a.organizationId, patientId, userId: a.userId, action });

/** The dentist record of the person acting, if they are one. */
export async function myDentist(tx: Database, a: Actor) {
  const memberId = a.principal.kind === 'user' || a.principal.kind === 'counter' ? a.principal.memberId : null;
  if (!memberId) return null;
  const [row] = await tx.select().from(dentDentist).where(and(eq(dentDentist.memberId, memberId), eq(dentDentist.active, true)));
  return row ?? null;
}

export const dayMs = 86400_000;
export const dateOnly = (v: unknown, code = 'BAD_DATE') => {
  if (v == null || v === '') return null;
  const s = String(v);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(s).getTime()) ? s : bad(code);
};
export const instant = (v: unknown, code = 'BAD_TIME') => { const t = new Date(String(v)); return v && !Number.isNaN(t.getTime()) ? t : bad(code); };
