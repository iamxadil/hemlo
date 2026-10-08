// What Hemlo brought in. The app logs every WhatsApp reminder a business sends (a membership about to end, one that
// ended, a debt); this shows what came back within a fortnight of one: a membership renewed, a member who had left back
// again, a debt paid. Said honestly, "after a reminder", not "because of Hemlo". Both routes are one statement each.
import { Hono } from 'hono';
import { sql } from 'drizzle-orm';
import { newId } from '@hemlo/core';
import { withOrg } from '@hemlo/db';
import { actor, bad } from './sys-common';
import { subscriptionOf, plansOf } from '../subscription';
import type { AppEnv, Deps } from '../types';

const KINDS = ['renewal', 'lapsed', 'debt'] as const;
const WINDOW_DAYS = 14;                                   // a renewal or payment this soon after a reminder counts
const today = () => new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10); // Baghdad
const rowsOf = (r: any): any[] => (Array.isArray(r) ? r : r?.rows ?? []);

export function impactRoutes(d: Deps) {
  const r = new Hono<AppEnv>();

  /** A reminder was sent: { customerId, kind, refId?, amount? }. Once a person per kind per day; a repeat is a no-op. */
  r.post('/reminders', async (c) => {
    const b = await c.req.json<{ customerId?: string; kind?: string; refId?: string; amount?: number }>().catch(() => ({} as Record<string, never>));
    const kind = KINDS.includes(b.kind as any) ? (b.kind as (typeof KINDS)[number]) : bad('BAD_KIND');
    const a = kind === 'debt' ? actor(c, 'customers', 'read') : actor(c, 'members', 'read');
    const customerId = typeof b.customerId === 'string' && b.customerId.length <= 40 ? b.customerId : bad('BAD_CUSTOMER');
    const refId = typeof b.refId === 'string' && b.refId.length <= 40 ? b.refId : null;
    const amount = Number.isInteger(b.amount) && b.amount! >= 0 && b.amount! < 1e12 ? b.amount! : null;
    // one statement: only for a customer of this business (row-level security), and only the first today
    await withOrg(d.db, a.organizationId, (tx) => tx.execute(sql`insert into sys_reminder (id, organization_id, customer_id, kind, ref_id, amount, sent_on, user_id)
      select ${newId()}, ${a.organizationId}, c.id, ${kind}, ${refId}, ${amount}, ${today()}, ${a.userId} from sys_customer c where c.id = ${customerId}
      on conflict (customer_id, kind, sent_on) do nothing`));
    return c.json({ ok: true });
  });

  /** What came back after the reminders of the last `days` days (30 by default), and what Hemlo costs to compare. */
  r.get('/impact', async (c) => {
    const a = actor(c, 'reports', 'read');
    const days = Math.min(120, Math.max(7, Number(c.req.query('days')) || 30));
    const from = new Date(Date.now() - days * 86400_000).toISOString();
    const [[x = {}], sub, plans] = await Promise.all([
      withOrg(d.db, a.organizationId, async (tx) => rowsOf(await tx.execute(sql`with r as (select customer_id, kind, at from sys_reminder where at >= ${from}),
        renewed as (
          select distinct on (ms.id) ms.price, r.kind from r
          join gym_membership ms on ms.member_id = r.customer_id and ms.created_at > r.at and ms.created_at <= r.at + make_interval(days => ${WINDOW_DAYS})
          where r.kind in ('renewal', 'lapsed') and ms.status <> 'canceled' and ms.price > 0 and coalesce(ms.note, '') <> 'import'
          order by ms.id, r.at desc),
        paid as (
          select distinct on (l.id) -l.amount as amount from r
          join sys_ledger l on l.customer_id = r.customer_id and l.kind = 'payment' and l.at > r.at and l.at <= r.at + make_interval(days => ${WINDOW_DAYS})
          where r.kind = 'debt'
          order by l.id, r.at desc)
        select (select count(*) from r)::int as reminders,
          (select count(*) from renewed where kind = 'renewal')::int as renewals, (select coalesce(sum(price), 0) from renewed where kind = 'renewal')::bigint as renewal_money,
          (select count(*) from renewed where kind = 'lapsed')::int as back, (select coalesce(sum(price), 0) from renewed where kind = 'lapsed')::bigint as back_money,
          (select count(*) from paid)::int as payments, (select coalesce(sum(amount), 0) from paid)::bigint as paid_money,
          (select metadata from organization where id = ${a.organizationId}) as meta`))),
      subscriptionOf(d.db, a.organizationId), plansOf(d.db), // both remembered per server: usually no query
    ]);
    // what Hemlo costs a month: the plan they pay for, else the plan most businesses of this kind choose
    // the edition: the subscription's, or (a demo, no subscription yet) the kind of business it is
    let kind: string | undefined;
    try { kind = JSON.parse(String(x.meta ?? '{}'))?.kind; } catch { kind = undefined; }
    const edition = sub.status === 'free' && kind ? (['gym', 'dental', 'realestate'].includes(kind) ? kind : 'store') : sub.edition;
    const own = plans.filter((p) => p.edition === edition && p.public && p.active);
    const price = sub.status === 'active' || sub.status === 'grace' ? sub.price ?? own.find((p) => p.id === sub.planId)?.priceMonth ?? null
      : (own.find((p) => p.popular) ?? own[0])?.priceMonth ?? null;
    const n = (v: unknown) => Number(v ?? 0);
    const total = n(x.renewal_money) + n(x.back_money) + n(x.paid_money);
    return c.json({
      days, window: WINDOW_DAYS, reminders: n(x.reminders), total, price,
      renewals: { n: n(x.renewals), money: n(x.renewal_money) }, back: { n: n(x.back), money: n(x.back_money) }, payments: { n: n(x.payments), money: n(x.paid_money) },
      trial: sub.status === 'trial' ? { daysLeft: sub.daysLeft } : null,
    });
  });

  return r;
}
