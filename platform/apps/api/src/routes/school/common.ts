// Shared by the School routes: the school's context (its current year), input checks, the Iraqi academic calendar,
// default grades for each kind of school, and the one query every money screen leans on (a student's balance).
import { eq, sql } from 'drizzle-orm';
import { withOrg, type Database } from '@hemlo/db';
import { schSettings, schYear } from '@hemlo/db/schema';
import { HttpError } from '../../principal';
import type { Actor } from '../sys-common';
import type { Deps } from '../../types';

export { str, phone, dateOnly, oneOf, intIn, today, token, rowsOf } from '../realestate/common';
import { rowsOf } from '../realestate/common';

export const inSch = <T>(d: Deps, a: Actor, fn: (tx: Database) => Promise<T>) => withOrg(d.db, a.organizationId, fn);
export const MAX_FEE = 100_000_000; // a hundred million dinars: past any Iraqi school's yearly fee

/** A whole number of dinars, positive (0 allowed when asked). */
export const dinars = (v: unknown, code = 'BAD_AMOUNT', allowZero = false): number => {
  const n = Number(v);
  if (!Number.isInteger(n) || n > MAX_FEE || n < 0 || (!allowZero && n === 0)) throw new HttpError(400, code);
  return n;
};

/** The school's settings and its current year (every screen needs both; one round trip). */
export async function schoolOf(tx: Database, org: string) {
  const [row] = rowsOf(await tx.execute(sql`select s.*, y.id as y_id, y.name as y_name, y.starts_on as y_starts, y.ends_on as y_ends
    from sch_settings s left join sch_year y on y.id = s.current_year_id where s.organization_id = ${org}`));
  if (!row) throw new HttpError(404, 'NOT_A_SCHOOL');
  return {
    kind: row.kind as string, city: row.city as string | null, phone: row.phone as string | null, whatsapp: row.whatsapp as string | null, passMark: Number(row.pass_mark),
    absentText: row.absent_text ?? null, feeText: row.fee_text ?? null,
    year: row.y_id ? { id: row.y_id as string, name: row.y_name as string, startsOn: String(row.y_starts).slice(0, 10), endsOn: String(row.y_ends).slice(0, 10) } : null,
  };
}
export async function currentYear(tx: Database, org: string) {
  const s = await schoolOf(tx, org);
  if (!s.year) throw new HttpError(409, 'NO_YEAR');
  return s.year;
}
export async function settingsRow(tx: Database, org: string) {
  const [s] = await tx.select().from(schSettings).where(eq(schSettings.organizationId, org));
  return s;
}
export { schYear };

/** The Iraqi school year this date falls in: it starts in autumn (late September) and ends in June. */
export function academicYear(day: string) {
  const [y, m] = day.split('-').map(Number);
  const start = m >= 8 ? y : y - 1;
  return { name: `${start}–${start + 1}`, startsOn: `${start}-09-21`, endsOn: `${start + 1}-06-30`, start };
}

/** The usual three instalments of a year: at registration, after the mid-year break, and in spring. */
export const defaultInstallments = (startYear: number, total: number, lang: 'ar' | 'en') => {
  const third = Math.round(total / 3 / 1000) * 1000, last = total - 2 * third;
  const L = lang === 'ar' ? ['القسط الأول', 'القسط الثاني', 'القسط الثالث'] : ['First instalment', 'Second instalment', 'Third instalment'];
  return [
    { label: L[0], dueOn: `${startYear}-09-21`, amount: third },
    { label: L[1], dueOn: `${startYear + 1}-01-04`, amount: third },
    { label: L[2], dueOn: `${startYear + 1}-03-01`, amount: last },
  ];
};

/** Default grades for each kind of school (Iraqi naming). Each gets one section ("أ") in the first year. */
export function presetGrades(kind: string, lang: 'ar' | 'en'): { name: string; stage: string }[] {
  const ar = lang === 'ar';
  if (kind === 'kindergarten') return [{ name: ar ? 'الروضة' : 'Kindergarten', stage: 'kg' }, { name: ar ? 'التمهيدي' : 'Preparatory year', stage: 'kg' }];
  if (kind === 'institute') return [
    { name: ar ? 'الثالث المتوسط' : 'Third intermediate', stage: 'course' },
    { name: ar ? 'السادس الإعدادي · علمي' : 'Sixth preparatory · Science', stage: 'course' },
    { name: ar ? 'السادس الإعدادي · أدبي' : 'Sixth preparatory · Literary', stage: 'course' },
  ];
  const n = ar ? ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس'] : ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth'];
  return n.map((x) => ({ name: ar ? `${x} الابتدائي` : `${x} primary`, stage: 'primary' }));
}
export const firstSection = (lang: 'ar' | 'en') => (lang === 'ar' ? 'أ' : 'A');

/** SQL: each student's money for the current year and before — charged, paid, due by today, and the next instalment.
 *  `ids` limits it to some students (a page of a list, one file); null = everyone. */
export function moneyOf(org: string, day: string, ids: string[] | null) {
  const only = ids ? sql`and student_id in (select json_array_elements_text(${JSON.stringify(ids)}::json))` : sql``;
  return sql`select st.id as student_id,
      coalesce(c.charged, 0)::bigint as charged, coalesce(p.paid, 0)::bigint as paid,
      greatest(coalesce(c.due, 0) - coalesce(p.paid, 0), 0)::bigint as overdue,
      (coalesce(c.charged, 0) - coalesce(p.paid, 0))::bigint as balance,
      c.next_due, c.first_due
    from sch_student st
    left join (select student_id, sum(amount) as charged, sum(amount) filter (where due_on <= ${day}) as due,
        min(due_on) filter (where due_on > ${day} and amount > 0) as next_due, min(due_on) filter (where amount > 0) as first_due
      from sch_charge where organization_id = ${org} ${only} group by student_id) c on c.student_id = st.id
    left join (select student_id, sum(amount) as paid from sch_payment where organization_id = ${org} and not void ${only} group by student_id) p on p.student_id = st.id
    where st.organization_id = ${org} ${ids ? sql`and st.id in (select json_array_elements_text(${JSON.stringify(ids)}::json))` : sql``}`;
}

/** wa.me link for an Iraqi number (+964…). */
export const waOf = (phone: string | null | undefined) => (phone ? `https://wa.me/${phone.replace(/\D/g, '')}` : null);
