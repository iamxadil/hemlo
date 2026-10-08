// The guardian's private page (no sign-in): reached by the unguessable link the school sends on WhatsApp. For each of
// their children at this school: class, the last 30 days of attendance, what is owed and the next instalment, the last
// receipt. Read-only, and only these columns. A new link (from the student's file) stops the old one.
import { Hono } from 'hono';
import { sql } from 'drizzle-orm';
import { withOrg, withSystem } from '@hemlo/db';
import { HttpError } from '../../principal';
import { moneyOf, rowsOf, today } from './common';
import type { AppEnv, Deps } from '../../types';

export function schPublicRoutes(d: Deps) {
  const r = new Hono<AppEnv>();

  r.get('/family/:token', async (c) => {
    const tok = c.req.param('token');
    if (!/^[a-z0-9]{12,32}$/.test(tok)) throw new HttpError(404, 'NOT_FOUND');
    const [g] = await withSystem(d.db, async (tx) => rowsOf(await tx.execute(sql`select id, organization_id as org, name from sch_guardian where token = ${tok}`)));
    if (!g) throw new HttpError(404, 'NOT_FOUND');
    const out = await withOrg(d.db, g.org, async (tx) => {
      const day = today(), since = new Date(Date.parse(`${day}T12:00:00Z`) - 30 * 86400_000).toISOString().slice(0, 10);
      const [school] = rowsOf(await tx.execute(sql`select o.name, s.phone, s.whatsapp, s.current_year_id as year from organization o join sch_settings s on s.organization_id = o.id where o.id = ${g.org}`));
      const kids = rowsOf(await tx.execute(sql`select s.id, s.name, c.name as "className", gr.name as "gradeName"
        from sch_student_guardian sg join sch_student s on s.id = sg.student_id and s.status = 'active'
        left join sch_enrollment e on e.student_id = s.id and e.year_id = ${school?.year ?? ''} left join sch_class c on c.id = e.class_id left join sch_grade gr on gr.id = c.grade_id
        where sg.guardian_id = ${g.id} order by s.name`));
      const ids = kids.map((k) => k.id as string);
      if (!ids.length) return { guardian: g.name, school, children: [] };
      const [money, att, last] = await Promise.all([
        tx.execute(moneyOf(g.org, day, ids)).then(rowsOf),
        tx.execute(sql`select student_id, day, status from sch_attendance where organization_id = ${g.org} and day > ${since}
          and student_id in (select json_array_elements_text(${JSON.stringify(ids)}::json)) order by day desc`).then(rowsOf),
        tx.execute(sql`select distinct on (student_id) student_id, number, amount, at from sch_payment where organization_id = ${g.org} and not void
          and student_id in (select json_array_elements_text(${JSON.stringify(ids)}::json)) order by student_id, at desc`).then(rowsOf),
      ]);
      const nextDue = rowsOf(await tx.execute(sql`select distinct on (student_id) student_id, due_on, amount from sch_charge where organization_id = ${g.org} and due_on > ${day} and amount > 0
        and student_id in (select json_array_elements_text(${JSON.stringify(ids)}::json)) order by student_id, due_on`));
      return {
        guardian: g.name,
        school: { name: school?.name, phone: school?.phone, whatsapp: school?.whatsapp },
        children: kids.map((k) => {
          const m = money.find((x) => x.student_id === k.id), days = att.filter((x) => x.student_id === k.id).map((x) => ({ day: String(x.day).slice(0, 10), status: x.status }));
          const nd = nextDue.find((x) => x.student_id === k.id), lp = last.find((x) => x.student_id === k.id);
          return {
            name: k.name, className: k.className, gradeName: k.gradeName,
            attendance: { days, absent: days.filter((x) => x.status === 'absent').length, late: days.filter((x) => x.status === 'late').length, present: days.filter((x) => x.status === 'present').length },
            money: { balance: Number(m?.balance ?? 0), overdue: Number(m?.overdue ?? 0), next: nd ? { dueOn: String(nd.due_on).slice(0, 10), amount: Number(nd.amount) } : null,
              last: lp ? { number: lp.number, amount: Number(lp.amount), at: lp.at } : null },
          };
        }),
      };
    });
    c.header('cache-control', 'private, no-store');
    return c.json(out);
  });

  return r;
}
