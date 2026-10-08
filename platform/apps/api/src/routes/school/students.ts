// Students: the list (search, class, money at a glance — one query for a page), admitting a student (guardian found by
// phone, so brothers and sisters share one parent and one link; enrolled in a class; the year's fee plan applied), the
// student's file (guardians, class, every charge and payment, attendance), and bringing a whole class in at once.
import { Hono } from 'hono';
import { and, eq, sql } from 'drizzle-orm';
import { newId } from '@hemlo/core';
import type { Database } from '@hemlo/db';
import { schStudent, schGuardian, schStudentGuardian, schEnrollment, schClass, SCH_RELATIONS } from '@hemlo/db/schema';
import { HttpError } from '../../principal';
import { actor, bad, type Actor } from '../sys-common';
import { nextNumber } from '../systems-ops';
import { inSch, currentYear, moneyOf, rowsOf, str, phone, oneOf, dateOnly, today, token } from './common';
import type { AppEnv, Deps } from '../../types';

/** The year's active fee plans that apply to a grade, written as the student's charges (once: re-applying adds nothing). */
export async function applyPlans(tx: Database, org: string, yearId: string, studentIds: string[], gradeId: string, userId: string | null, onlyPlan?: string) {
  if (!studentIds.length) return 0;
  const res = await tx.execute(sql`insert into sch_charge (id, organization_id, student_id, year_id, plan_id, kind, label, amount, due_on, user_id)
    select md5(random()::text || s.id || p.id || i.label), ${org}, s.id, ${yearId}, p.id, 'tuition', i.label, i.amount, i."dueOn"::date, ${userId}
    from sch_fee_plan p
    cross join lateral jsonb_to_recordset(p.installments) as i(label text, "dueOn" text, amount bigint)
    cross join (select json_array_elements_text(${JSON.stringify(studentIds)}::json) as id) s
    where p.organization_id = ${org} and p.year_id = ${yearId} and p.active and (p.grade_id is null or p.grade_id = ${gradeId}) ${onlyPlan ? sql`and p.id = ${onlyPlan}` : sql``}
    on conflict do nothing returning id`);
  return rowsOf(res).length;
}

type GuardianIn = { name: string; relation: string; phone: string | null };
const guardianIn = (g: unknown): GuardianIn | null => {
  if (!g || typeof g !== 'object') return null;
  const x = g as Record<string, unknown>;
  const name = str(x.name, 80, 'BAD_GUARDIAN');
  const ph = phone(x.phone);
  if (!name && !ph) return null;
  return { name: name ?? '—', relation: oneOf(x.relation, SCH_RELATIONS, 'BAD_RELATION', 'father'), phone: ph };
};

/** A guardian by phone in this school (siblings share one), or a new one. */
async function guardianFor(tx: Database, org: string, g: GuardianIn) {
  if (g.phone) {
    const [found] = await tx.select().from(schGuardian).where(and(eq(schGuardian.organizationId, org), eq(schGuardian.phone, g.phone))).limit(1);
    if (found) return found.id;
  }
  const id = newId();
  await tx.insert(schGuardian).values({ id, organizationId: org, name: g.name, relation: g.relation, phone: g.phone, whatsapp: g.phone, token: token(16) });
  return id;
}

/** Admit one student: number, guardian, enrolment in a class this year, the fee plan. Returns the new id. */
export async function admit(tx: Database, a: Actor, input: { name: string; gender: string | null; birthDate: string | null; classId: string; guardian: GuardianIn | null; health?: string | null; notes?: string | null; plans?: boolean }) {
  const year = await currentYear(tx, a.organizationId);
  const [cls] = await tx.select().from(schClass).where(and(eq(schClass.id, input.classId), eq(schClass.organizationId, a.organizationId)));
  if (!cls || cls.yearId !== year.id) bad('BAD_CLASS');
  const id = newId(), number = await nextNumber(tx, a.organizationId, 'sch_student'), day = today();
  await tx.insert(schStudent).values({ id, organizationId: a.organizationId, number, name: input.name, gender: input.gender, birthDate: input.birthDate, health: input.health ?? null, notes: input.notes ?? null, joinedOn: day });
  if (input.guardian) {
    const gid = await guardianFor(tx, a.organizationId, input.guardian);
    await tx.insert(schStudentGuardian).values({ studentId: id, guardianId: gid, organizationId: a.organizationId, primary: true });
  }
  await tx.insert(schEnrollment).values({ id: newId(), organizationId: a.organizationId, studentId: id, yearId: year.id, classId: cls!.id, enrolledOn: day });
  if (input.plans !== false) await applyPlans(tx, a.organizationId, year.id, [id], cls!.gradeId, a.userId);
  return id;
}

const studentInput = (b: Record<string, unknown>) => ({
  name: str(b.name, 80, 'BAD_NAME', true)!,
  gender: b.gender == null || b.gender === '' ? null : oneOf(b.gender, ['m', 'f'] as const, 'BAD_GENDER'),
  birthDate: dateOnly(b.birthDate),
  classId: String(b.classId ?? ''),
  guardian: guardianIn(b.guardian),
  health: str(b.health, 300, 'BAD_HEALTH'),
  notes: str(b.notes, 500, 'BAD_NOTES'),
  plans: b.applyPlans !== false,
});

export function schStudentRoutes(d: Deps) {
  const r = new Hono<AppEnv>();

  /** A page of students: their class, primary guardian, and money (balance, overdue). Filter by class, status, search. */
  r.get('/students', async (c) => {
    const a = actor(c, 'students', 'read');
    const q = (c.req.query('q') ?? '').trim().slice(0, 60), classId = c.req.query('classId') ?? '', status = c.req.query('status') ?? 'active';
    const owing = c.req.query('owing') === '1';
    const limit = Math.min(Number(c.req.query('limit')) || 60, 200), offset = Math.max(Number(c.req.query('offset')) || 0, 0);
    const out = await inSch(d, a, async (tx) => {
      const year = await currentYear(tx, a.organizationId), day = today(), org = a.organizationId;
      const digits = q.replace(/\D/g, '');
      const like = `%${q.toLowerCase()}%`;
      const rows = rowsOf(await tx.execute(sql`with base as (
          select s.id, s.number, s.name, s.gender, s.status, s.photo_id as "photoId", e.class_id as "classId", c.name as "className", g.name as "gradeName", g.sort as gsort
          from sch_student s
          left join sch_enrollment e on e.student_id = s.id and e.year_id = ${year.id}
          left join sch_class c on c.id = e.class_id left join sch_grade g on g.id = c.grade_id
          where s.organization_id = ${org} ${status === 'all' ? sql`` : sql`and s.status = ${status}`}
            ${classId ? sql`and e.class_id = ${classId}` : sql``}
            ${q ? sql`and (lower(s.name) like ${like} or s.number::text = ${q} ${digits.length >= 4 ? sql`or exists (select 1 from sch_student_guardian sg join sch_guardian gu on gu.id = sg.guardian_id where sg.student_id = s.id and gu.phone like ${'%' + digits.slice(-9) + '%'})` : sql``})` : sql``}),
        money as (${moneyOf(org, day, null)}),
        listed as (select b.*, m.balance, m.overdue, m.next_due as "nextDue" from base b left join money m on m.student_id = b.id
          ${owing ? sql`where m.overdue > 0` : sql``}
          order by ${owing ? sql`m.overdue desc,` : sql``} b.gsort nulls last, b."className", b.name limit ${limit} offset ${offset})
        select l.*, gu.name as "guardianName", gu.phone as "guardianPhone", gu.relation as "guardianRelation",
          (select count(*)::int from base) as total
        from listed l
        left join lateral (select gu.* from sch_student_guardian sg join sch_guardian gu on gu.id = sg.guardian_id where sg.student_id = l.id order by sg.primary desc limit 1) gu on true`));
      return { total: rows[0]?.total ?? 0, students: rows.map(({ total, gsort, ...x }) => ({ ...x, balance: Number(x.balance ?? 0), overdue: Number(x.overdue ?? 0) })) };
    });
    return c.json(out);
  });

  /** Admit a student. */
  r.post('/students', async (c) => {
    const a = actor(c, 'students', 'create');
    const b = await c.req.json<Record<string, unknown>>().catch(() => ({} as Record<string, unknown>));
    const input = studentInput(b);
    const id = await inSch(d, a, (tx) => admit(tx, a, input));
    return c.json({ id }, 201);
  });

  /** Bring a class in at once (a list typed or read from a register): up to 300 rows, one transaction. */
  r.post('/students/import', async (c) => {
    const a = actor(c, 'students', 'create');
    const b = await c.req.json<{ classId?: string; rows?: Record<string, unknown>[] }>().catch(() => ({} as any));
    if (!Array.isArray(b.rows) || !b.rows.length || b.rows.length > 300) bad('BAD_ROWS');
    const rows = b.rows!.map((x: Record<string, unknown>) => ({ ...studentInput({ ...x, classId: b.classId }), guardian: guardianIn({ name: x.guardianName, relation: x.relation, phone: x.phone }) }));
    const ids = await inSch(d, a, async (tx) => { const out: string[] = []; for (const x of rows) out.push(await admit(tx, a, x)); return out; });
    return c.json({ added: ids.length }, 201);
  });

  /** The student's file: who they are, their guardians (and brothers and sisters here), class, money, attendance. */
  r.get('/students/:id', async (c) => {
    const a = actor(c, 'students', 'read');
    const id = c.req.param('id'), org = a.organizationId;
    const out = await inSch(d, a, async (tx) => {
      const [s] = await tx.select().from(schStudent).where(and(eq(schStudent.id, id), eq(schStudent.organizationId, org)));
      if (!s) throw new HttpError(404, 'NOT_FOUND');
      const year = await currentYear(tx, org), day = today();
      const since = new Date(Date.now() + 3 * 3600_000 - 120 * 86400_000).toISOString().slice(0, 10);
      const [enrol, guardians, siblings, charges, payments, attendance, [money]] = await Promise.all([
        tx.execute(sql`select e.class_id as "classId", c.name as "className", g.id as "gradeId", g.name as "gradeName", e.enrolled_on as "enrolledOn"
          from sch_enrollment e join sch_class c on c.id = e.class_id join sch_grade g on g.id = c.grade_id where e.student_id = ${id} and e.year_id = ${year.id}`),
        tx.execute(sql`select gu.id, gu.name, gu.relation, gu.phone, gu.whatsapp, gu.token, sg.primary from sch_student_guardian sg join sch_guardian gu on gu.id = sg.guardian_id
          where sg.student_id = ${id} order by sg.primary desc, gu.created_at`),
        tx.execute(sql`select distinct s2.id, s2.name, s2.number from sch_student_guardian a1 join sch_student_guardian a2 on a2.guardian_id = a1.guardian_id and a2.student_id <> a1.student_id
          join sch_student s2 on s2.id = a2.student_id where a1.student_id = ${id} and s2.status = 'active'`),
        tx.execute(sql`select id, kind, label, amount, due_on as "dueOn", plan_id as "planId", created_at as "createdAt" from sch_charge where organization_id = ${org} and student_id = ${id} order by due_on, created_at`),
        tx.execute(sql`select id, number, amount, method, payer, note, void, at from sch_payment where organization_id = ${org} and student_id = ${id} order by at desc limit 200`),
        tx.execute(sql`select day, status, note from sch_attendance where organization_id = ${org} and student_id = ${id} and day >= ${since} order by day desc`),
        tx.execute(moneyOf(org, day, [id])).then(rowsOf),
      ]);
      const att = rowsOf(attendance).map((x) => ({ ...x, day: String(x.day).slice(0, 10) }));
      const counts = { present: 0, absent: 0, late: 0, excused: 0 } as Record<string, number>;
      for (const x of att) counts[x.status] = (counts[x.status] ?? 0) + 1;
      return {
        student: s, enrollment: rowsOf(enrol)[0] ?? null, guardians: rowsOf(guardians), siblings: rowsOf(siblings),
        charges: rowsOf(charges).map((x) => ({ ...x, amount: Number(x.amount), dueOn: String(x.dueOn).slice(0, 10) })),
        payments: rowsOf(payments).map((x) => ({ ...x, amount: Number(x.amount) })),
        money: { charged: Number(money?.charged ?? 0), paid: Number(money?.paid ?? 0), balance: Number(money?.balance ?? 0), overdue: Number(money?.overdue ?? 0), nextDue: money?.next_due ? String(money.next_due).slice(0, 10) : null },
        attendance: { days: att, counts },
      };
    });
    return c.json(out);
  });

  r.patch('/students/:id', async (c) => {
    const a = actor(c, 'students', 'update');
    const b = await c.req.json<Record<string, unknown>>().catch(() => ({} as Record<string, unknown>));
    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (b.name !== undefined) set.name = str(b.name, 80, 'BAD_NAME', true);
    if (b.gender !== undefined) set.gender = b.gender == null || b.gender === '' ? null : oneOf(b.gender, ['m', 'f'] as const, 'BAD_GENDER');
    if (b.birthDate !== undefined) set.birthDate = dateOnly(b.birthDate);
    if (b.phone !== undefined) set.phone = phone(b.phone);
    if (b.health !== undefined) set.health = str(b.health, 300, 'BAD_HEALTH');
    if (b.notes !== undefined) set.notes = str(b.notes, 500, 'BAD_NOTES');
    if (b.status !== undefined) set.status = oneOf(b.status, ['active', 'left', 'graduated'] as const, 'BAD_STATUS');
    const [row] = await inSch(d, a, (tx) => tx.update(schStudent).set(set).where(and(eq(schStudent.id, c.req.param('id')), eq(schStudent.organizationId, a.organizationId))).returning());
    if (!row) throw new HttpError(404, 'NOT_FOUND');
    return c.json({ student: row });
  });

  /** Move to another class this year (the fee plan of a new grade is added; what was charged stays). */
  r.post('/students/:id/move', async (c) => {
    const a = actor(c, 'students', 'update');
    const b = await c.req.json<{ classId?: string }>().catch(() => ({} as { classId?: string }));
    await inSch(d, a, async (tx) => {
      const year = await currentYear(tx, a.organizationId);
      const [cls] = await tx.select().from(schClass).where(and(eq(schClass.id, String(b.classId ?? '')), eq(schClass.organizationId, a.organizationId)));
      if (!cls || cls.yearId !== year.id) bad('BAD_CLASS');
      const id = c.req.param('id');
      await tx.insert(schEnrollment).values({ id: newId(), organizationId: a.organizationId, studentId: id, yearId: year.id, classId: cls!.id, enrolledOn: today() })
        .onConflictDoUpdate({ target: [schEnrollment.studentId, schEnrollment.yearId], set: { classId: cls!.id, status: 'enrolled' } });
      await applyPlans(tx, a.organizationId, year.id, [id], cls!.gradeId, a.userId);
    });
    return c.json({ ok: true });
  });

  /** Add a guardian (a second parent), or link one who is already here by phone. */
  r.post('/students/:id/guardians', async (c) => {
    const a = actor(c, 'students', 'update');
    const g = guardianIn(await c.req.json().catch(() => null)) ?? bad('BAD_GUARDIAN');
    const id = c.req.param('id');
    const gid = await inSch(d, a, async (tx) => {
      const [s] = await tx.select({ id: schStudent.id }).from(schStudent).where(and(eq(schStudent.id, id), eq(schStudent.organizationId, a.organizationId)));
      if (!s) throw new HttpError(404, 'NOT_FOUND');
      const gid = await guardianFor(tx, a.organizationId, g);
      const [first] = rowsOf(await tx.execute(sql`select 1 from sch_student_guardian where student_id = ${id} limit 1`));
      await tx.insert(schStudentGuardian).values({ studentId: id, guardianId: gid, organizationId: a.organizationId, primary: !first }).onConflictDoNothing();
      return gid;
    });
    return c.json({ id: gid }, 201);
  });
  r.patch('/guardians/:id', async (c) => {
    const a = actor(c, 'students', 'update');
    const b = await c.req.json<Record<string, unknown>>().catch(() => ({} as Record<string, unknown>));
    const set: Record<string, unknown> = {};
    if (b.name !== undefined) set.name = str(b.name, 80, 'BAD_NAME', true);
    if (b.relation !== undefined) set.relation = oneOf(b.relation, SCH_RELATIONS, 'BAD_RELATION');
    if (b.phone !== undefined) { set.phone = phone(b.phone); set.whatsapp = set.phone; }
    if (b.newLink) set.token = token(16); // the old link stops working
    const [row] = await inSch(d, a, (tx) => tx.update(schGuardian).set(set).where(and(eq(schGuardian.id, c.req.param('id')), eq(schGuardian.organizationId, a.organizationId))).returning());
    if (!row) throw new HttpError(404, 'NOT_FOUND');
    return c.json({ guardian: row });
  });

  return r;
}
