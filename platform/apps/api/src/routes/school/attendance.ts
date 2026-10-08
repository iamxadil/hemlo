// Attendance: a class's roll call for a day (everyone in the class, with today's mark if taken), saved in one statement
// (only students enrolled in that class are written), and the morning picture (Today): which classes have taken it,
// who is absent (with their guardian's number), money in and money late. A teacher can fix the last 7 days; the office
// (students.update) can fix any day this year.
import { Hono } from 'hono';
import { sql } from 'drizzle-orm';
import { SCH_MARKS } from '@hemlo/db/schema';
import { HttpError } from '../../principal';
import { actor, bad, may } from '../sys-common';
import { inSch, currentYear, schoolOf, moneyOf, rowsOf, dateOnly, today } from './common';
import type { AppEnv, Deps } from '../../types';

const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400_000);

export function schAttendanceRoutes(d: Deps) {
  const r = new Hono<AppEnv>();

  /** A class's roll for a day. */
  r.get('/attendance', async (c) => {
    const a = actor(c, 'attendance', 'read');
    const classId = c.req.query('classId') ?? '', day = dateOnly(c.req.query('day')) ?? today();
    if (!classId) bad('BAD_CLASS');
    const out = await inSch(d, a, async (tx) => {
      const year = await currentYear(tx, a.organizationId);
      const students = rowsOf(await tx.execute(sql`select s.id, s.name, s.number, s.gender, s.photo_id as "photoId", s.health, a.status, a.note, a.at
        from sch_enrollment e join sch_student s on s.id = e.student_id
        left join sch_attendance a on a.student_id = s.id and a.day = ${day}
        where e.organization_id = ${a.organizationId} and e.class_id = ${classId} and e.year_id = ${year.id} and e.status = 'enrolled' and s.status = 'active'
        order by s.name`));
      return { day, classId, taken: students.some((x) => x.status), students };
    });
    return c.json(out);
  });

  /** Save a class's roll call. Marks for students who aren't in the class are ignored. */
  r.put('/attendance', async (c) => {
    const a = actor(c, 'attendance', 'take');
    const b = await c.req.json<{ classId?: string; day?: string; marks?: { studentId: string; status: string; note?: string }[] }>().catch(() => ({} as any));
    const day = dateOnly(b.day) ?? today(), now = today();
    if (day > now) bad('FUTURE_DAY');
    if (daysBetween(day, now) > 7 && !may(a.principal, 'students', 'update')) throw new HttpError(403, 'TOO_OLD');
    if (!b.classId || !Array.isArray(b.marks) || !b.marks.length || b.marks.length > 300) bad('BAD_MARKS');
    const marks = b.marks!.map((m: { studentId: string; status: string; note?: string }) => ({ s: String(m.studentId), st: SCH_MARKS.includes(m.status as any) ? m.status : bad('BAD_MARK'), n: typeof m.note === 'string' ? m.note.trim().slice(0, 120) || null : null }));
    const saved = await inSch(d, a, async (tx) => {
      const year = await currentYear(tx, a.organizationId);
      if (day < year.startsOn) bad('BEFORE_YEAR');
      const res = await tx.execute(sql`insert into sch_attendance (student_id, day, organization_id, class_id, status, note, user_id, at)
        select m.s, ${day}::date, ${a.organizationId}, ${b.classId}, m.st, m.n, ${a.userId}, now()
        from json_to_recordset(${JSON.stringify(marks)}::json) as m(s text, st text, n text)
        join sch_enrollment e on e.student_id = m.s and e.class_id = ${b.classId} and e.year_id = ${year.id} and e.organization_id = ${a.organizationId}
        on conflict (student_id, day) do update set status = excluded.status, note = excluded.note, class_id = excluded.class_id, user_id = excluded.user_id, at = now()
        returning student_id`);
      return rowsOf(res).length;
    });
    return c.json({ saved });
  });

  /** The morning: attendance class by class, today's absentees, and money (what came in, what is late, what falls due). */
  r.get('/today', async (c) => {
    const a = actor(c, 'students', 'read');
    const seeMoney = may(a.principal, 'fees', 'read');
    const out = await inSch(d, a, async (tx) => {
      const day = today(), org = a.organizationId;
      const week = new Date(Date.parse(`${day}T12:00:00Z`) + 7 * 86400_000).toISOString().slice(0, 10);
      const dayStart = new Date(Date.parse(`${day}T00:00:00Z`) - 3 * 3600_000).toISOString(), monthStart = new Date(Date.parse(`${day.slice(0, 7)}-01T00:00:00Z`) - 3 * 3600_000).toISOString();
      // ONE statement (each round trip to the database costs more than the work): the year, classes, absentees, money
      const [row] = rowsOf(await tx.execute(sql`with st as (select s.kind, y.id, y.name, y.starts_on as "startsOn", y.ends_on as "endsOn"
            from sch_settings s left join sch_year y on y.id = s.current_year_id where s.organization_id = ${org}),
          cls as (select c.id, c.name, g.name as "gradeName", c.teacher_member_id as "teacherMemberId", u.name as "teacherName",
              count(s.id)::int as students, count(at.student_id)::int as marked,
              count(at.student_id) filter (where at.status = 'absent')::int as absent, count(at.student_id) filter (where at.status = 'late')::int as late, g.sort as gsort
            from sch_class c join sch_grade g on g.id = c.grade_id
            left join member m on m.id = c.teacher_member_id left join "user" u on u.id = m.user_id
            left join sch_enrollment e on e.class_id = c.id and e.status = 'enrolled'
            left join sch_student s on s.id = e.student_id and s.status = 'active'
            left join sch_attendance at on at.student_id = s.id and at.day = ${day}
            where c.organization_id = ${org} and c.year_id = (select id from st)
            group by c.id, g.sort, g.name, u.name),
          ab as (select s.id, s.name, s.number, at.status, at.note, c.name as "className", g.name as "gradeName", gu.name as "guardianName", gu.phone as "guardianPhone",
              (select count(*)::int from sch_attendance x where x.student_id = s.id and x.status = 'absent' and x.day > ${day}::date - 30) as "absent30", g.sort as gsort
            from sch_attendance at join sch_student s on s.id = at.student_id
            join sch_class c on c.id = at.class_id join sch_grade g on g.id = c.grade_id
            left join lateral (select gu.* from sch_student_guardian sg join sch_guardian gu on gu.id = sg.guardian_id where sg.student_id = s.id order by sg.primary desc limit 1) gu on true
            where at.organization_id = ${org} and at.day = ${day} and at.status in ('absent', 'late') limit 200)
          ${seeMoney ? sql`, m as (${moneyOf(org, day, null)})` : sql``}
        select (select row_to_json(st) from st) as school,
          (select coalesce(json_agg(cls order by gsort, name), '[]'::json) from cls) as classes,
          (select coalesce(json_agg(ab order by status, gsort, "className", name), '[]'::json) from ab) as absent
          ${seeMoney ? sql`,
          (select coalesce(sum(amount), 0) from sch_payment where organization_id = ${org} and not void and at >= ${dayStart})::bigint as m_today,
          (select coalesce(sum(amount), 0) from sch_payment where organization_id = ${org} and not void and at >= ${monthStart})::bigint as m_month,
          (select coalesce(sum(overdue), 0) from m join sch_student s on s.id = m.student_id and s.status = 'active')::bigint as m_late,
          (select count(*)::int from m join sch_student s on s.id = m.student_id and s.status = 'active' where m.overdue > 0) as m_late_n,
          (select coalesce(sum(amount), 0) from sch_charge where organization_id = ${org} and due_on > ${day} and due_on <= ${week} and amount > 0)::bigint as m_week` : sql``}`));
      const parse = (v: unknown) => (typeof v === 'string' ? JSON.parse(v) : v);
      const st = parse(row?.school) as any;
      if (!st) throw new HttpError(404, 'NOT_A_SCHOOL');
      if (!st.id) throw new HttpError(409, 'NO_YEAR');
      const school = { kind: st.kind as string }, year = { id: st.id, name: st.name, startsOn: String(st.startsOn).slice(0, 10), endsOn: String(st.endsOn).slice(0, 10) };
      const classes = (parse(row.classes) as any[]).map(({ gsort, ...x }) => x), absent = (parse(row.absent) as any[]).map(({ gsort, ...x }) => x);
      const money = seeMoney ? { today: row.m_today, month: row.m_month, late: row.m_late, late_n: row.m_late_n, week_due: row.m_week } : null;
      const students = classes.reduce((s, x) => s + x.students, 0), marked = classes.reduce((s, x) => s + x.marked, 0);
      const n = (x: unknown) => Number(x ?? 0);
      return {
        day, year, school: { kind: school.kind },
        attendance: { students, marked, absent: classes.reduce((s, x) => s + x.absent, 0), late: classes.reduce((s, x) => s + x.late, 0), classesDone: classes.filter((x) => x.students && x.marked >= x.students).length, classes: classes.length },
        classes, absent,
        money: money ? { today: n(money.today), month: n(money.month), late: n(money.late), lateCount: n(money.late_n), weekDue: n(money.week_due) } : null,
      };
    });
    return c.json(out);
  });

  return r;
}
