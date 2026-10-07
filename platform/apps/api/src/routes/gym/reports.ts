// The owner's numbers for a period: money (memberships and the shop), members won and kept, how busy the gym is by hour,
// what sells, and what each coach earned from personal training. Few queries, all aggregated in Postgres.
import { Hono } from 'hono';
import { sql } from 'drizzle-orm';
import { actor, dateParam } from '../sys-common';
import { inGym, rowsOf, ymd, today } from './common';
import type { AppEnv, Deps } from '../../types';

export function gymReportRoutes(d: Deps) {
  const r = new Hono<AppEnv>();

  r.get('/reports', async (c) => {
    const a = actor(c, 'reports', 'read');
    const to = dateParam(c.req.query('to'), new Date());
    const from = dateParam(c.req.query('from'), new Date(+to - 30 * 86400_000));
    const fromDay = ymd(new Date(+from + 3 * 3600_000))!, toDay = ymd(new Date(+to + 3 * 3600_000 - 1))!;
    const out = await inGym(d, a, async (tx) => {
      const [money] = rowsOf(await tx.execute(sql`select
        coalesce(sum(total - returned) filter (where note = 'gym'), 0)::int as memberships,
        coalesce(sum(total - returned) filter (where coalesce(note, '') <> 'gym'), 0)::int as shop,
        coalesce(sum(cost) filter (where coalesce(note, '') <> 'gym'), 0)::int as shop_cost,
        coalesce(sum(paid), 0)::int as paid_at_sale
        from sys_sale where created_at >= ${from} and created_at < ${to} and voided_at is null`));
      const [extra] = rowsOf(await tx.execute(sql`select
        (select coalesce(-sum(amount), 0)::int from sys_ledger where at >= ${from} and at < ${to} and kind = 'payment') as debt_paid,
        (select coalesce(sum(amount), 0)::int from sys_expense where at >= ${from} and at < ${to}) as expenses,
        (select count(*)::int from gym_member where created_at >= ${from} and created_at < ${to}) as new_members,
        (select count(*)::int from gym_checkin where at >= ${from} and at < ${to} and result <> 'denied' and via <> 'pt') as visits,
        (select count(distinct member_id)::int from gym_checkin where at >= ${from} and at < ${to} and result <> 'denied') as visitors,
        (select count(*)::int from gym_checkin where at >= ${from} and at < ${to} and result = 'denied') as turned_back,
        (select count(distinct ms.member_id)::int from gym_membership ms join sys_customer cu on cu.id = ms.member_id where cu.archived_at is null and ms.status = 'active'
          and ms.category <> 'other' and ms.starts_on <= ${today()} and ms.ends_on >= ${today()}) as active_now`));
      // renewals: of the memberships that ended in the period, how many were followed by another of the same kind
      const [ret] = rowsOf(await tx.execute(sql`select count(*)::int as ended,
        count(*) filter (where exists (select 1 from gym_membership n where n.member_id = ms.member_id and n.category = ms.category and n.status <> 'canceled'
          and n.id <> ms.id and n.starts_on > ms.starts_on and n.starts_on <= ms.ends_on + 30))::int as renewed
        from gym_membership ms where ms.status <> 'canceled' and ms.category in ('gym', 'class', 'pt') and ms.ends_on between ${fromDay} and ${toDay}
          and ms.ends_on < ${today()}`));
      const days = rowsOf(await tx.execute(sql`select to_char(created_at at time zone 'Asia/Baghdad', 'YYYY-MM-DD') as day,
          coalesce(sum(total - returned) filter (where note = 'gym'), 0)::int as memberships, coalesce(sum(total - returned) filter (where coalesce(note, '') <> 'gym'), 0)::int as shop
        from sys_sale where created_at >= ${from} and created_at < ${to} and voided_at is null group by 1 order by 1`));
      const visitsByDay = rowsOf(await tx.execute(sql`select to_char(at at time zone 'Asia/Baghdad', 'YYYY-MM-DD') as day, count(*)::int as n
        from gym_checkin where at >= ${from} and at < ${to} and result <> 'denied' and via <> 'pt' group by 1 order by 1`));
      // how busy: day of week × hour (Baghdad)
      const heat = rowsOf(await tx.execute(sql`select extract(dow from (at at time zone 'Asia/Baghdad'))::int as dow, extract(hour from (at at time zone 'Asia/Baghdad'))::int as h, count(*)::int as n
        from gym_checkin where at >= ${from} and at < ${to} and result <> 'denied' and via <> 'pt' group by 1, 2`));
      const plans = rowsOf(await tx.execute(sql`select name, category, count(*)::int as n, coalesce(sum(price), 0)::int as total
        from gym_membership where created_at >= ${from} and created_at < ${to} and status <> 'canceled' group by name, category order by total desc limit 20`));
      // personal training: sessions done per coach, and their share (each session is worth the package's price ÷ its sessions)
      const coaches = rowsOf(await tx.execute(sql`select t.id, t.name, t.color, t.pt_share, count(ci.id)::int as sessions,
          coalesce(sum(ms.price::numeric / nullif(ms.visits, 0)), 0)::int as value,
          coalesce(sum(ms.price::numeric / nullif(ms.visits, 0) * t.pt_share / 100), 0)::int as share
        from gym_trainer t left join gym_checkin ci on ci.trainer_id = t.id and ci.via = 'pt' and ci.at >= ${from} and ci.at < ${to}
          left join gym_membership ms on ms.id = ci.membership_id
        group by t.id order by sessions desc`));
      const people = rowsOf(await tx.execute(sql`select coalesce(m.gender, '-') as gender, count(*)::int as n from gym_member m join sys_customer cu on cu.id = m.customer_id
        where cu.archived_at is null group by 1`));
      return { money, extra, ret, days, visitsByDay, heat, plans, coaches, people };
    });
    const { money, extra, ret } = out;
    return c.json({
      from, to,
      money: { memberships: money.memberships, shop: money.shop, shopProfit: money.shop - money.shop_cost, collected: money.paid_at_sale + extra.debt_paid, expenses: extra.expenses },
      members: { new: extra.new_members, activeNow: extra.active_now, visits: extra.visits, visitors: extra.visitors, turnedBack: extra.turned_back, ended: ret.ended, renewed: ret.renewed },
      days: out.days, visitsByDay: out.visitsByDay, heat: out.heat, plans: out.plans, coaches: out.coaches, people: out.people,
    });
  });

  return r;
}

