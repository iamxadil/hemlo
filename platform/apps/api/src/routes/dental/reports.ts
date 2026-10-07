// Today at the clinic, and the reports: money by dentist (with each dentist's share), by procedure, collections,
// balances, the schedule's no-shows, how many plans patients accept, and where new patients come from.
import { Hono } from 'hono';
import { sql } from 'drizzle-orm';
import { dentDentist } from '@hemlo/db/schema';
import { actor, dateParam } from '../sys-common';
import { inClinic } from './common';
import type { AppEnv, Deps } from '../../types';

const rowsOf = (r: any): any[] => (Array.isArray(r) ? r : r?.rows ?? []);
const TODAY = sql`(date_trunc('day', now() at time zone 'Asia/Baghdad') at time zone 'Asia/Baghdad')`;

type Charge = { patient: string; saleId: string; dentistId: string | null; at: number; amount: number; left: number };
type Alloc = { dentistId: string | null; amount: number; at: number };

/**
 * Who brought in what: each payment is traced to the work it paid for. A payment made at a visit pays that visit first;
 * later payments pay the oldest unpaid work first. Returns every allocation with the payment's date and the dentist.
 */
export function allocate(charges: Charge[], salePaid: { saleId: string; amount: number; at: number }[], payments: { patient: string; amount: number; at: number }[]): Alloc[] {
  const out: Alloc[] = [];
  const take = (c: Charge, amount: number, at: number) => { const x = Math.min(c.left, amount); if (x > 0) { c.left -= x; out.push({ dentistId: c.dentistId, amount: x, at }); } return x; };
  for (const p of salePaid) {
    let rest = p.amount;
    for (const c of charges.filter((x) => x.saleId === p.saleId)) rest -= take(c, rest, p.at);
  }
  const byPatient = new Map<string, Charge[]>();
  for (const c of [...charges].sort((a, b) => a.at - b.at)) (byPatient.get(c.patient) ?? byPatient.set(c.patient, []).get(c.patient)!).push(c);
  for (const p of [...payments].sort((a, b) => a.at - b.at)) {
    let rest = p.amount;
    for (const c of byPatient.get(p.patient) ?? []) { if (rest <= 0) break; rest -= take(c, rest, p.at); }
  }
  return out;
}

export function dentalReportRoutes(d: Deps) {
  const r = new Hono<AppEnv>();

  /** The clinic's day, at a glance. */
  r.get('/dashboard', async (c) => {
    const a = actor(c, 'appointments', 'read');
    const out = await inClinic(d, a, async (tx) => {
      const q = async (x: ReturnType<typeof sql>) => rowsOf(await tx.execute(x));
      const [appts, next, [money], [people], [lab], [inst], [recall]] = await Promise.all([
        q(sql`select status, count(*)::int as n from dent_appointment where starts_at >= ${TODAY} and starts_at < ${TODAY} + interval '1 day' group by 1`),
        q(sql`select a.id, a.patient_id, a.starts_at, a.ends_at, a.arrived_at, a.seated_at, a.finished_at, a.reminded_at, a.status, a.reason, a.dentist_id, a.chair_id, c.phone, c.balance, c.name, p.file_no, p.alerts from dent_appointment a
          join dent_patient p on p.customer_id = a.patient_id join sys_customer c on c.id = a.patient_id
          where a.starts_at >= ${TODAY} and a.starts_at < ${TODAY} + interval '1 day' and a.status not in ('canceled') order by a.starts_at limit 60`),
        q(sql`select coalesce((select sum(paid) from sys_sale where created_at >= ${TODAY} and voided_at is null), 0)::bigint
          + coalesce((select -sum(amount) from sys_ledger where kind = 'payment' and at >= ${TODAY}), 0)::bigint as collected,
          coalesce((select sum(total) from sys_sale where created_at >= ${TODAY} and voided_at is null and note = 'dental'), 0)::bigint as billed`),
        q(sql`select (select count(*)::int from dent_patient where created_at >= ${TODAY}) as new_today,
          (select coalesce(sum(c.balance), 0)::bigint from sys_customer c join dent_patient p on p.customer_id = c.id where c.balance > 0) as outstanding,
          (select count(*)::int from sys_customer c join dent_patient p on p.customer_id = c.id where c.balance > 0) as owing`),
        q(sql`select count(*) filter (where due_at < now() and status in ('sent', 'in_progress', 'remake'))::int as overdue,
          count(*) filter (where status = 'received')::int as ready from dent_lab_order`),
        q(sql`select count(*)::int as n, coalesce(sum(amount), 0)::bigint as amount from dent_installment where paid_at is null and due_date <= (now() at time zone 'Asia/Baghdad')::date`),
        q(sql`select count(*)::int as n from dent_patient p where p.recall_due <= (now() at time zone 'Asia/Baghdad')::date + 14
          and not exists (select 1 from dent_appointment x where x.patient_id = p.customer_id and x.starts_at > now() and x.status in ('booked', 'confirmed'))`),
      ]);
      return {
        appointments: Object.fromEntries(appts.map((x) => [x.status, x.n])), today: next,
        collected: Number(money.collected), billed: Number(money.billed), newPatients: people.new_today, outstanding: Number(people.outstanding), owing: people.owing,
        lab: { overdue: lab.overdue, ready: lab.ready }, installments: { due: inst.n, amount: Number(inst.amount) }, recalls: recall.n,
      };
    });
    return c.json(out);
  });

  r.get('/reports', async (c) => {
    const a = actor(c, 'reports', 'read');
    const to = dateParam(c.req.query('to'), new Date());
    const from = dateParam(c.req.query('from'), new Date(to.getTime() - 30 * 86400_000));
    const out = await inClinic(d, a, async (tx) => {
      const q = async (x: ReturnType<typeof sql>) => rowsOf(await tx.execute(x));
      const dentists = await tx.select().from(dentDentist);
      // every dental charge ever (for tracing payments), and every payment
      const items = await q(sql`select i.amount, i.dentist_id, i.name, i.lab_cost, i.procedure_id, p.category, s.id as sale_id, s.customer_id, s.created_at, s.subtotal, s.discount, s.paid
        from dent_visit_item i join dent_visit v on v.id = i.visit_id join sys_sale s on s.id = v.sale_id left join dent_procedure p on p.id = i.procedure_id where s.voided_at is null`);
      const charges: Charge[] = items.map((x) => { const net = x.subtotal ? Math.round(x.amount - (x.discount * x.amount) / x.subtotal) : 0; return { patient: x.customer_id, saleId: x.sale_id, dentistId: x.dentist_id, at: +new Date(x.created_at), amount: net, left: net }; });
      const sales = [...new Map(items.map((x) => [x.sale_id, { saleId: x.sale_id, amount: Number(x.paid), at: +new Date(x.created_at) }])).values()];
      const pays = (await q(sql`select l.customer_id, -l.amount as amount, l.at from sys_ledger l join dent_patient p on p.customer_id = l.customer_id where l.kind = 'payment'`))
        .map((x) => ({ patient: x.customer_id, amount: Number(x.amount), at: +new Date(x.at) }));
      const allocs = allocate(charges, sales, pays);
      const inRange = (t: number) => t >= +from && t < +to;
      const labs = await q(sql`select dentist_id, coalesce(sum(cost), 0)::bigint as cost from dent_lab_order where received_at >= ${from} and received_at < ${to} group by 1`);

      const byDentist = [...dentists.map((x) => x.id), null].map((id) => {
        const dn = dentists.find((x) => x.id === id);
        const billed = charges.filter((x) => x.dentistId === id && inRange(x.at)).reduce((s, x) => s + x.amount, 0);
        const collected = allocs.filter((x) => x.dentistId === id && inRange(x.at)).reduce((s, x) => s + x.amount, 0);
        const labCost = Number(labs.find((x) => x.dentist_id === id)?.cost ?? 0) + items.filter((x) => x.dentist_id === id && inRange(+new Date(x.created_at))).reduce((s, x) => s + Number(x.lab_cost), 0);
        const basis = dn?.shareBasis === 'billed' ? billed : collected;
        const share = dn?.sharePercent ? Math.round((Math.max(0, basis - (dn.labDeduct ? labCost : 0)) * dn.sharePercent) / 100) : 0;
        return { dentistId: id, name: dn?.name ?? null, sharePercent: dn?.sharePercent ?? 0, shareBasis: dn?.shareBasis ?? 'collected', labDeduct: dn?.labDeduct ?? true, billed, collected, labCost, share };
      }).filter((x) => x.billed || x.collected || x.labCost || x.dentistId);

      const period = items.filter((x) => inRange(+new Date(x.created_at)));
      const procMap = new Map<string, { name: string; category: string | null; count: number; amount: number }>();
      for (const x of period) { const k = x.name; const e = procMap.get(k) ?? { name: x.name, category: x.category, count: 0, amount: 0 }; e.count++; e.amount += Number(x.amount); procMap.set(k, e); }

      const [appts] = await q(sql`select count(*)::int as total, count(*) filter (where status = 'done')::int as done, count(*) filter (where status = 'no_show')::int as no_show,
        count(*) filter (where status = 'canceled')::int as canceled from dent_appointment where starts_at >= ${from} and starts_at < ${to}`);
      const [plans] = await q(sql`select count(*)::int as total, count(*) filter (where status in ('accepted', 'in_progress', 'completed'))::int as accepted,
        count(*) filter (where status = 'declined')::int as declined from dent_plan where created_at >= ${from} and created_at < ${to}`);
      const referral = await q(sql`select coalesce(nullif(trim(referral), ''), '—') as source, count(*)::int as n from dent_patient where created_at >= ${from} and created_at < ${to} group by 1 order by 2 desc limit 12`);
      const [counts] = await q(sql`select (select count(*)::int from dent_patient where created_at >= ${from} and created_at < ${to}) as new_patients,
        (select count(*)::int from dent_visit where at >= ${from} and at < ${to}) as visits,
        (select count(distinct patient_id)::int from dent_visit where at >= ${from} and at < ${to}) as patients_seen`);
      const debtors = await q(sql`select c.id, c.name, c.phone, c.balance, p.file_no from sys_customer c join dent_patient p on p.customer_id = c.id where c.balance > 0 order by c.balance desc limit 15`);
      const [owed] = await q(sql`select coalesce(sum(c.balance), 0)::bigint as total from sys_customer c join dent_patient p on p.customer_id = c.id where c.balance > 0`);
      const collected = sales.filter((x) => inRange(x.at)).reduce((s, x) => s + x.amount, 0) + pays.filter((x) => inRange(x.at)).reduce((s, x) => s + x.amount, 0);
      return {
        from, to, billed: charges.filter((x) => inRange(x.at)).reduce((s, x) => s + x.amount, 0), collected,
        byDentist, byProcedure: [...procMap.values()].sort((p, q2) => q2.amount - p.amount),
        appointments: { ...appts, noShowRate: appts.total ? Math.round((appts.no_show / appts.total) * 100) : 0 },
        plans: { ...plans, acceptance: plans.accepted + plans.declined ? Math.round((plans.accepted / (plans.accepted + plans.declined)) * 100) : null },
        newPatients: counts.new_patients, visits: counts.visits, patientsSeen: counts.patients_seen, referral,
        outstanding: { total: Number(owed.total), top: debtors },
      };
    });
    return c.json(out);
  });

  return r;
}

