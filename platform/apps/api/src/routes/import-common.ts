// Shared by the spreadsheet imports (customers, patients, gym members): each row is checked on its own (a bad row is
// skipped and reported with its reason, never half-saved), people are matched by phone so importing the same sheet
// twice updates instead of duplicating, and an opening debt becomes one "adjust" line in the debt book.
import { inArray } from 'drizzle-orm';
import { newId, normalizeIraqiPhone } from '@hemlo/core';
import type { Database } from '@hemlo/db';
import { sysCustomer } from '@hemlo/db/schema';
import { HttpError } from '../principal';
import { bad, text, MAX_IQD } from './sys-common';

export const MAX_IMPORT = 2000;
export type RowError = { row: number; code: string };

/** Run a check per row; collect what failed (row = its index in the request). */
export function eachRow<T>(rows: unknown, check: (raw: any) => T) {
  if (!Array.isArray(rows) || !rows.length || rows.length > MAX_IMPORT) bad('BAD_IMPORT');
  const ok: { i: number; v: T }[] = [], errors: RowError[] = [];
  (rows as any[]).forEach((raw, i) => {
    try { ok.push({ i, v: check(raw ?? {}) }); } catch (e) { errors.push({ row: i, code: e instanceof HttpError ? e.code : 'BAD_ROW' }); }
  });
  return { ok, errors };
}

export const phoneOf = (v: unknown) => (v == null || v === '' ? null : normalizeIraqiPhone(String(v)) ?? bad('BAD_PHONE'));
export const nameOf = (v: unknown) => text(v == null ? v : String(v), 100, 'BAD_NAME', true)!;
/** A debt (or credit, negative) carried over from the old notebook. */
export const openingOf = (v: unknown) => {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isInteger(n) && Math.abs(n) <= MAX_IQD ? n : bad('BAD_BALANCE');
};
const GENDER: Record<string, 'm' | 'f'> = { m: 'm', male: 'm', man: 'm', ذكر: 'm', رجل: 'm', نێر: 'm', پیاو: 'm', f: 'f', female: 'f', woman: 'f', أنثى: 'f', انثى: 'f', امرأة: 'f', مێ: 'f', ئافرەت: 'f' };
export const genderOf = (v: unknown) => (v == null || v === '' ? null : GENDER[String(v).trim().toLowerCase()] ?? bad('BAD_GENDER'));
export const dateOf = (v: unknown, code = 'BAD_DATE') => {
  if (v == null || v === '') return null;
  const s = String(v).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) ? s : bad(code);
};

/** The same phone twice in one sheet: keep the first. */
export function onePerPhone<T extends { phone: string | null }>(ok: { i: number; v: T }[], errors: RowError[]) {
  const seen = new Set<string>();
  return ok.filter((x) => { const p = x.v.phone; if (!p) return true; if (seen.has(p)) { errors.push({ row: x.i, code: 'DUPLICATE_PHONE' }); return false; } seen.add(p); return true; });
}

/** Customers already in this business with these phones (to update rather than duplicate). */
export async function customersByPhone(tx: Database, phones: string[]) {
  const list = phones.length ? await tx.select().from(sysCustomer).where(inArray(sysCustomer.phone, phones)) : [];
  return new Map(list.filter((c) => !c.archivedAt).map((c) => [c.phone!, c]));
}

/** The debt-book line that sets a customer's balance to what the old notebook said. */
export const openingLine = (org: string, customerId: string, from: number, to: number, userId: string | null) =>
  ({ id: newId(), organizationId: org, customerId, kind: 'adjust', amount: to - from, balance: to, note: 'import', userId });

export async function insertBatches<T>(rows: T[], insert: (chunk: T[]) => Promise<unknown>, size = 250) {
  for (let k = 0; k < rows.length; k += size) await insert(rows.slice(k, k + size));
}
