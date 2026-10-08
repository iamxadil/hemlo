// Fees: the year's fee plans (instalments by date), applying a plan to a grade or class, one-off charges and discounts,
// payments with the school's running receipt numbers (a mistake is voided, never deleted), and the overview the
// accountant opens every morning: what was collected, what is late and by whom, what falls due next.
import { Hono } from 'hono';
import { and, eq, sql } from 'drizzle-orm';
import { newId } from '@hemlo/core';
import { audit } from '@hemlo/auth/audit';
import { schFeePlan, schCharge, schPayment, schStudent, schClass, SCH_CHARGE_KINDS, SCH_METHODS, type SchInstallment } from '@hemlo/db/schema';
import { HttpError } from '../../principal';
import { actor, bad } from '../sys-common';
import { nextNumber } from '../systems-ops';
import { applyPlans } from './students';
import { inSch, currentYear, moneyOf, dinars, rowsOf, str, oneOf, dateOnly, today } from './common';
import type { AppEnv, Deps } from '../../types';

const installmentsIn = (v: unknown): SchInstallment[] => {
  if (!Array.isArray(v) || !v.length || v.length > 12) bad('BAD_INSTALLMENTS');
  const out = (v as Record<string, unknown>[]).map((x) => ({ label: str(x?.label, 40, 'BAD_INSTALLMENTS', true)!, dueOn: dateOnly(x?.dueOn) ?? bad('BAD_INSTALLMENTS'), amount: dinars(x?.amount, 'BAD_INSTALLMENTS') }));
  if (new Set(out.map((x) => x.label)).size !== out.length) bad('DUPLICATE_LABEL');
  return out.sort((a, b) => a.dueOn.localeCompare(b.dueOn));
};

export function schFeeRoutes(d: Deps) {
  const r = new Hono<AppEnv>();

  // ---------- fee plans ----------
  r.post('/fees/plans', async (c) => {
    const a = actor(c, 'fees', 'manage');
    const b = await c.req.json<Record<string, unknown>>().catch(() => ({} as Record<string, unknown>));
    const name = str(b.name, 60, 'BAD_NAME', true)!, installments = installmentsIn(b.installments);
    const out = await inSch(d, a, async (tx) => {
      const year = await currentYear(tx, a.organizationId);
      let gradeId: string | null = null;
      if (b.gradeId) {
        const [g] = rowsOf(await tx.execute(sql`select id from sch_grade where id = ${String(b.gradeId)} and organization_id = ${a.organizationId}`));
        if (!g) bad('BAD_GRADE');
        gradeId = g.id;
      }
      const id = newId();
      await tx.insert(schFeePlan).values({ id, organizationId: a.organizationId, yearId: year.id, gradeId, name, installments, total: installments.reduce((s, x) => s + x.amount, 0) });
      // everyone already enrolled in that grade (or every grade) gets it now
      const students = rowsOf(await tx.execute(sql`select e.student_id as id, c.grade_id as "gradeId" from sch_enrollment e join sch_class c on c.id = e.class_id join sch_student s on s.id = e.student_id
        where e.organization_id = ${a.organizationId} and e.year_id = ${year.id} and e.status = 'enrolled' and s.status = 'active' ${gradeId ? sql`and c.grade_id = ${gradeId}` : sql``}`));
      let charged = 0;
      if (b.applyNow !== false) {
        const byGrade = new Map<string, string[]>();
        for (const s of students) byGrade.set(s.gradeId, [...(byGrade.get(s.gradeId) ?? []), s.id]);
        for (const [g, ids] of byGrade) charged += await applyPlans(tx, a.organizationId, year.id, ids, g, a.userId, id);
      }
      return { id, charged };
    });
    await audit(d.db, { kind: 'sch.fee_plan_added', userId: a.userId, organizationId: a.organizationId, detail: { name, charged: out.charged } });
    return c.json(out, 201);
  });

  /** Rename or retire a plan. Its instalments can't change once charged (what a family was told stays true). */
  r.patch('/fees/plans/:id', async (c) => {
    const a = actor(c, 'fees', 'manage');
    const b = await c.req.json<Record<string, unknown>>().catch(() => ({} as Record<string, unknown>));
    const set: Record<string, unknown> = {};
    if (b.name !== undefined) set.name = str(b.name, 60, 'BAD_NAME', true);
    if (b.active !== undefined) set.active = !!b.active;
    const row = await inSch(d, a, async (tx) => {
      if (b.installments !== undefined) {
        const [used] = rowsOf(await tx.execute(sql`select 1 from sch_charge where organization_id = ${a.organizationId} and plan_id = ${c.req.param('id')} limit 1`));
        if (used) throw new HttpError(409, 'PLAN_IN_USE');
        set.installments = installmentsIn(b.installments);
        set.total = (set.installments as SchInstallment[]).reduce((s, x) => s + x.amount, 0);
      }
      if (!Object.keys(set).length) bad('NOTHING');
      const [row] = await tx.update(schFeePlan).set(set).where(and(eq(schFeePlan.id, c.req.param('id')), eq(schFeePlan.organizationId, a.organizationId))).returning();
      return row;
    });
    if (!row) throw new HttpError(404, 'NOT_FOUND');
    return c.json({ plan: row });
  });

  // ---------- a student's charges ----------
  /** A one-off charge (books, uniform, transport) or a discount (a sibling discount, a waiver: written as negative). */
  r.post('/students/:id/charges', async (c) => {
    const a = actor(c, 'fees', 'manage');
    const b = await c.req.json<Record<string, unknown>>().catch(() => ({} as Record<string, unknown>));
    const kind = oneOf(b.kind, SCH_CHARGE_KINDS, 'BAD_KIND', 'other'), amount = dinars(b.amount);
    const label = str(b.label, 60, 'BAD_LABEL', true)!, dueOn = dateOnly(b.dueOn) ?? today();
    const id = await inSch(d, a, async (tx) => {
      const year = await currentYear(tx, a.organizationId);
      const [s] = await tx.select({ id: schStudent.id }).from(schStudent).where(and(eq(schStudent.id, c.req.param('id')), eq(schStudent.organizationId, a.organizationId)));
      if (!s) throw new HttpError(404, 'NOT_FOUND');
      const id = newId();
      await tx.insert(schCharge).values({ id, organizationId: a.organizationId, studentId: s.id, yearId: year.id, kind, label, amount: kind === 'discount' ? -amount : amount, dueOn, userId: a.userId });
      return id;
    });
    return c.json({ id }, 201);
  });
  r.delete('/charges/:id', async (c) => {
    const a = actor(c, 'fees', 'manage');
    const [row] = await inSch(d, a, (tx) => tx.delete(schCharge).where(and(eq(schCharge.id, c.req.param('id')), eq(schCharge.organizationId, a.organizationId))).returning());
    if (!row) throw new HttpError(404, 'NOT_FOUND');
    await audit(d.db, { kind: 'sch.charge_removed', userId: a.userId, organizationId: a.organizationId, detail: { student: row.studentId, label: row.label, amount: row.amount } });
    return c.json({ ok: true });
  });

  // ---------- payments ----------
  /** Take a payment: the next receipt number, and the family's balance after it. */
  r.post('/students/:id/payments', async (c) => {
    const a = actor(c, 'fees', 'collect');
    const b = await c.req.json<Record<string, unknown>>().catch(() => ({} as Record<string, unknown>));
    const amount = dinars(b.amount), method = oneOf(b.method, SCH_METHODS, 'BAD_METHOD', 'cash');
    const payer = str(b.payer, 80, 'BAD_PAYER'), note = str(b.note, 200, 'BAD_NOTE');
    const out = await inSch(d, a, async (tx) => {
      const [s] = await tx.select({ id: schStudent.id, name: schStudent.name, number: schStudent.number }).from(schStudent).where(and(eq(schStudent.id, c.req.param('id')), eq(schStudent.organizationId, a.organizationId)));
      if (!s) throw new HttpError(404, 'NOT_FOUND');
      const number = await nextNumber(tx, a.organizationId, 'sch_receipt');
      const [p] = await tx.insert(schPayment).values({ id: newId(), organizationId: a.organizationId, studentId: s.id, number, amount, method, payer, note, userId: a.userId }).returning();
      const [m] = rowsOf(await tx.execute(moneyOf(a.organizationId, today(), [s.id])));
      return { payment: { ...p, amount: Number(p.amount) }, student: s, balance: Number(m?.balance ?? 0), overdue: Number(m?.overdue ?? 0) };
    });
    return c.json(out, 201);
  });
  r.post('/payments/:id/void', async (c) => {
    const a = actor(c, 'fees', 'manage');
    const b = await c.req.json<{ reason?: string }>().catch(() => ({} as { reason?: string }));
    const reason = str(b.reason, 200, 'BAD_REASON');
    const [row] = await inSch(d, a, (tx) => tx.update(schPayment).set({ void: true, note: reason ? `✕ ${reason}` : sql`${schPayment.note}` as any })
      .where(and(eq(schPayment.id, c.req.param('id')), eq(schPayment.organizationId, a.organizationId), eq(schPayment.void, false))).returning());
    if (!row) throw new HttpError(404, 'NOT_FOUND');
    await audit(d.db, { kind: 'sch.payment_voided', userId: a.userId, organizationId: a.organizationId, detail: { number: row.number, amount: row.amount, reason } });
    return c.json({ ok: true });
  });

  /** Receipts, newest first (the day's cash count, the month's). */
  r.get('/payments', async (c) => {
    const a = actor(c, 'fees', 'read');
    const days = Math.min(Math.max(Number(c.req.query('days')) || 30, 1), 400);
    const from = new Date(Date.now() - days * 86400_000);
    const rows = await inSch(d, a, async (tx) => rowsOf(await tx.execute(sql`select p.id, p.number, p.amount, p.method, p.payer, p.note, p.void, p.at, s.id as "studentId", s.name as "studentName", s.number as "studentNumber"
      from sch_payment p join sch_student s on s.id = p.student_id where p.organization_id = ${a.organizationId} and p.at >= ${from.toISOString()} order by p.at desc limit 500`)));
    return c.json({ payments: rows.map((x) => ({ ...x, amount: Number(x.amount) })) });
  });

  /** The accountant's morning: collected (today, this month, this year), late (who, how much), falling due soon. One query. */
  r.get('/fees/overview', async (c) => {
    const a = actor(c, 'fees', 'read');
    const out = await inSch(d, a, async (tx) => {
      const year = await currentYear(tx, a.organizationId), day = today(), org = a.organizationId;
      const soon = new Date(Date.parse(`${day}T12:00:00Z`) + 14 * 86400_000).toISOString().slice(0, 10);
      const month = `${day.slice(0, 7)}-01`;
      const dayStart = new Date(Date.parse(`${day}T00:00:00Z`) - 3 * 3600_000).toISOString(), monthStart = new Date(Date.parse(`${month}T00:00:00Z`) - 3 * 3600_000).toISOString();
      const [[tot], late, due] = await Promise.all([
        tx.execute(sql`select
            (select coalesce(sum(amount), 0) from sch_charge where organization_id = ${org} and year_id = ${year.id})::bigint as expected,
            (select coalesce(sum(amount), 0) from sch_charge where organization_id = ${org} and year_id = ${year.id} and due_on <= ${day})::bigint as due,
            (select coalesce(sum(amount), 0) from sch_payment where organization_id = ${org} and not void and at >= ${year.startsOn})::bigint as collected,
            (select coalesce(sum(amount), 0) from sch_payment where organization_id = ${org} and not void and at >= ${monthStart})::bigint as month,
            (select coalesce(sum(amount), 0) from sch_payment where organization_id = ${org} and not void and at >= ${dayStart})::bigint as today,
            (select count(*)::int from sch_payment where organization_id = ${org} and not void and at >= ${dayStart}) as today_n`).then(rowsOf),
        tx.execute(sql`with m as (${moneyOf(org, day, null)})
          select s.id, s.name, s.number, m.overdue, m.balance, c.name as "className", g.name as "gradeName", gu.name as "guardianName", gu.phone as "guardianPhone",
            (select max(at) from sch_payment p where p.student_id = s.id and not p.void) as "lastPaid"
          from m join sch_student s on s.id = m.student_id and s.status = 'active'
          left join sch_enrollment e on e.student_id = s.id and e.year_id = ${year.id} left join sch_class c on c.id = e.class_id left join sch_grade g on g.id = c.grade_id
          left join lateral (select gu.* from sch_student_guardian sg join sch_guardian gu on gu.id = sg.guardian_id where sg.student_id = s.id order by sg.primary desc limit 1) gu on true
          where m.overdue > 0 order by m.overdue desc limit 200`).then(rowsOf),
        tx.execute(sql`with m as (${moneyOf(org, day, null)}),
            upcoming as (select student_id, min(due_on) as due_on, sum(amount) as amount from sch_charge where organization_id = ${org} and due_on > ${day} and due_on <= ${soon} and amount > 0 group by student_id)
          select s.id, s.name, s.number, u.due_on as "dueOn", least(u.amount, m.balance)::bigint as amount, c.name as "className", gu.phone as "guardianPhone", gu.name as "guardianName"
          from upcoming u join m on m.student_id = u.student_id join sch_student s on s.id = u.student_id and s.status = 'active'
          left join sch_enrollment e on e.student_id = s.id and e.year_id = ${year.id} left join sch_class c on c.id = e.class_id
          left join lateral (select gu.* from sch_student_guardian sg join sch_guardian gu on gu.id = sg.guardian_id where sg.student_id = s.id order by sg.primary desc limit 1) gu on true
          where m.balance > 0 order by u.due_on, s.name limit 200`).then(rowsOf),
      ]);
      const n = (x: unknown) => Number(x ?? 0);
      return {
        totals: { expected: n(tot.expected), due: n(tot.due), collected: n(tot.collected), month: n(tot.month), today: n(tot.today), todayCount: n(tot.today_n),
          late: late.reduce((s, x) => s + n(x.overdue), 0), lateCount: late.length },
        late: late.map((x) => ({ ...x, overdue: n(x.overdue), balance: n(x.balance) })),
        upcoming: due.map((x) => ({ ...x, amount: n(x.amount), dueOn: String(x.dueOn).slice(0, 10) })),
      };
    });
    return c.json(out);
  });

  return r;
}
