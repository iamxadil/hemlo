// The usage tracker (admin.hemlohq.com → Usage): how every shop is using Hemlo, and how close the platform is to its
// plan limits. Shop numbers come from our own database (as the system, across businesses; demo shops excluded).
// The plan meters use read-only keys when they're set (Neon for compute hours, Cloudflare for requests), else they say so.
import { sql } from 'drizzle-orm';
import { withSystem } from '@hemlo/db';
import { maskIraqiPhone } from '@hemlo/core';
import { MAX_ACTIVE } from './demo';
import { stateOf, plansOf, type Plan } from '../subscription';
import type { Deps } from '../types';

const rowsOf = (r: any): any[] => (Array.isArray(r) ? r : r?.rows ?? []);
const MB = 1024 * 1024;
// measured on the live database (2026-09-30), indexes included: what a row of each kind costs on disk
const BYTES = { sale: 440, line: 290, move: 300, ledger: 300, product: 550, customer: 300, other: 300 };
/** Baghdad midnight today, as SQL. */
const TODAY = sql`(date_trunc('day', now() at time zone 'Asia/Baghdad') at time zone 'Asia/Baghdad')`;

export async function collectUsage(d: Deps, opts: { contact: boolean }) {
  const env = d.env;
  const limits = {
    dbBytes: Number(env.LIMIT_DB_MB ?? 512) * MB,
    cuHours: Number(env.LIMIT_CU_HOURS ?? 100),
    requestsDay: Number(env.LIMIT_REQUESTS_DAY ?? 100_000),
    demos: MAX_ACTIVE,
  };

  const plans = await plansOf(d.db);
  const [local, neon, cloudflare] = await Promise.all([
    withSystem(d.db, async (tx) => {
      const q = async (x: ReturnType<typeof sql>) => rowsOf(await tx.execute(x));
      const REAL = sql`select id from organization where coalesce(metadata, '') not like '%"demo":true%'`;
      const [shops, sales, spark, series, counts, seen, db, demos, subs] = await Promise.all([
        q(sql`select o.id, o.name, o.metadata, o.created_at,
            (select u.name from member m join "user" u on u.id = m.user_id where m.organization_id = o.id and m.role like '%owner%' order by m.created_at limit 1) as owner,
            (select u.phone_number from member m join "user" u on u.id = m.user_id where m.organization_id = o.id and m.role like '%owner%' order by m.created_at limit 1) as owner_phone,
            (select count(*)::int from member m where m.organization_id = o.id) as members
          from organization o where o.id in (${REAL})`),
        q(sql`select organization_id as org,
            count(*) filter (where voided_at is null and created_at >= ${TODAY})::int as today,
            coalesce(sum(total) filter (where voided_at is null and created_at >= ${TODAY}), 0)::bigint as rev_today,
            count(*) filter (where voided_at is null and created_at >= now() - interval '7 days')::int as d7,
            count(*) filter (where voided_at is null and created_at >= now() - interval '14 days' and created_at < now() - interval '7 days')::int as p7,
            count(*) filter (where voided_at is null and created_at >= now() - interval '30 days')::int as d30,
            coalesce(sum(total) filter (where voided_at is null and created_at >= now() - interval '30 days'), 0)::bigint as rev30,
            count(*)::int as all_sales, max(created_at) as last_sale
          from sys_sale where organization_id in (${REAL}) group by 1`),
        q(sql`select organization_id as org, to_char(created_at at time zone 'Asia/Baghdad', 'YYYY-MM-DD') as day, count(*)::int as n
          from sys_sale where voided_at is null and created_at >= now() - interval '15 days' and organization_id in (${REAL}) group by 1, 2`),
        q(sql`select to_char(created_at at time zone 'Asia/Baghdad', 'YYYY-MM-DD') as day, count(*)::int as sales, count(distinct organization_id)::int as shops,
            coalesce(sum(total), 0)::bigint as revenue
          from sys_sale where voided_at is null and created_at >= now() - interval '31 days' and organization_id in (${REAL}) group by 1`),
        q(sql`select o.id as org,
            (select count(*)::int from sys_product p where p.organization_id = o.id) as products,
            (select count(*)::int from sys_customer c where c.organization_id = o.id) as customers,
            (select count(*)::int from sys_sale_line l where l.organization_id = o.id) as lines,
            (select count(*)::int from sys_stock_move m where m.organization_id = o.id) as moves,
            (select count(*)::int from sys_ledger g where g.organization_id = o.id) as ledger,
            (select count(*)::int from counter_device c where c.organization_id = o.id and c.revoked_at is null and c.expires_at > now()) as devices,
            (select max(c.last_seen_at) from counter_device c where c.organization_id = o.id) as device_seen
          from organization o where o.id in (${REAL})`),
        q(sql`select m.organization_id as org, max(s.updated_at) as seen from member m join "session" s on s.user_id = m.user_id
          where m.organization_id in (${REAL}) group by 1`),
        q(sql`select pg_database_size(current_database())::bigint as bytes`),
        q(sql`select count(*)::int as active, count(*) filter (where created_at > now() - interval '24 hours')::int as today
          from organization where coalesce(metadata, '') like '%"demo":true%'`),
        q(sql`select s.*, (select count(*)::int from dent_dentist x where x.organization_id = s.organization_id and x.active) as dentists from hemlo_subscription s`),
      ]);
      return { shops, sales, spark, series, counts, seen, db: Number(db[0]?.bytes ?? 0), demos: demos[0] ?? { active: 0, today: 0 }, subs };
    }),
    neonUsage(env),
    cloudflareRequests(env),
  ]);

  // ---- every shop ----
  const days = (n: number) => Array.from({ length: n }, (_, i) => new Date(Date.now() + 3 * 3600_000 - (n - 1 - i) * 86400_000).toISOString().slice(0, 10));
  const d14 = days(14), d30 = days(30);
  const now = Date.now();
  const shops = local.shops.map((o) => {
    let meta: any = {}; try { meta = typeof o.metadata === 'string' ? JSON.parse(o.metadata) : o.metadata ?? {}; } catch {}
    const s = local.sales.find((x) => x.org === o.id) ?? { today: 0, rev_today: 0, d7: 0, p7: 0, d30: 0, rev30: 0, all_sales: 0, last_sale: null };
    const c = local.counts.find((x) => x.org === o.id) ?? {};
    const lastSale = s.last_sale ? new Date(s.last_sale) : null;
    const seenAt = [local.seen.find((x) => x.org === o.id)?.seen, c.device_seen].filter(Boolean).map((x) => new Date(x).getTime());
    const quietDays = lastSale ? (now - lastSale.getTime()) / 86400_000 : null;
    const status = !lastSale ? 'new' : quietDays! < 1 ? 'active' : quietDays! < 7 ? 'quiet' : 'asleep';
    const bytes = s.all_sales * BYTES.sale + (c.lines ?? 0) * BYTES.line + (c.moves ?? 0) * BYTES.move + (c.ledger ?? 0) * BYTES.ledger
      + (c.products ?? 0) * BYTES.product + (c.customers ?? 0) * BYTES.customer;
    return {
      id: o.id, name: o.name, kind: meta?.kind ?? null, city: meta?.city ?? null, createdAt: o.created_at,
      owner: o.owner ?? null, ownerPhone: opts.contact ? o.owner_phone ?? null : maskIraqiPhone(o.owner_phone ?? null), masked: !opts.contact,
      status, lastSaleAt: lastSale, lastSeenAt: seenAt.length ? new Date(Math.max(...seenAt)) : null,
      today: s.today, revenueToday: Number(s.rev_today), week: s.d7, prevWeek: s.p7, month: s.d30, revenueMonth: Number(s.rev30), allSales: s.all_sales,
      products: c.products ?? 0, customers: c.customers ?? 0, devices: c.devices ?? 0, members: o.members,
      bytes, spark: d14.map((day) => local.spark.find((x) => x.org === o.id && x.day === day)?.n ?? 0),
      subscription: subOf(local.subs.find((x) => x.organization_id === o.id), plans),
    };
  }).sort((a, b) => ORDER[a.status] - ORDER[b.status] || b.week - a.week || +new Date(b.createdAt) - +new Date(a.createdAt));

  const series = d30.map((day) => { const r = local.series.find((x) => x.day === day); return { day, sales: r?.sales ?? 0, shops: r?.shops ?? 0, revenue: Number(r?.revenue ?? 0) }; });
  const shopBytes = shops.reduce((t, s) => t + s.bytes, 0);
  return {
    at: new Date().toISOString(),
    platform: {
      database: { bytes: local.db, limit: limits.dbBytes, shopBytes, demoBytes: local.demos.active * 0.45 * MB },
      compute: neon ? { ...neon, limit: limits.cuHours } : null,
      requests: cloudflare ? { ...cloudflare, limit: limits.requestsDay } : null,
      demos: { active: local.demos.active, today: local.demos.today, limit: limits.demos },
      connected: { neon: !!neon, cloudflare: !!cloudflare },
    },
    totals: {
      shops: shops.length, activeToday: shops.filter((s) => s.today > 0).length, active7: shops.filter((s) => s.week > 0).length,
      salesToday: shops.reduce((t, s) => t + s.today, 0), revenueToday: shops.reduce((t, s) => t + s.revenueToday, 0),
      sales30: series.reduce((t, x) => t + x.sales, 0), revenue30: series.reduce((t, x) => t + x.revenue, 0),
      byStatus: Object.fromEntries(['active', 'quiet', 'asleep', 'new'].map((k) => [k, shops.filter((s) => s.status === k).length])),
    },
    series, shops,
  };
}
const ORDER: Record<string, number> = { active: 0, quiet: 1, asleep: 2, new: 3 };
/** The plan as the dashboard shows it (raw row → state + what was agreed). */
function subOf(x: any, plans: Plan[]) {
  if (!x) return { ...stateOf(null), priceNote: null, note: null, dentists: 0, raw: null };
  const row = { organizationId: x.organization_id, edition: x.edition, status: x.status, plan: x.plan, seats: x.seats, trialEndsAt: x.trial_ends_at ? new Date(x.trial_ends_at) : null,
    paidUntil: x.paid_until ? new Date(x.paid_until) : null, priceNote: x.price_note, note: x.note, updatedBy: x.updated_by, createdAt: new Date(x.created_at), updatedAt: new Date(x.updated_at),
    planId: x.plan_id, billing: x.billing, price: x.price };
  return { ...stateOf(row as any, plans), priceNote: x.price_note, note: x.note, dentists: x.dentists, raw: x.status };
}

/** Neon's own meter for this billing month (needs a read-only API key). Null when not connected or unreachable. */
async function neonUsage(env: Deps['env']) {
  if (!env.NEON_API_KEY || !env.NEON_PROJECT_ID) return null;
  try {
    const r = await fetch(`https://console.neon.tech/api/v2/projects/${encodeURIComponent(env.NEON_PROJECT_ID)}`, {
      headers: { authorization: `Bearer ${env.NEON_API_KEY}`, accept: 'application/json' }, signal: AbortSignal.timeout(4000),
    });
    if (!r.ok) return null;
    const p = (await r.json() as any).project ?? {};
    return {
      cuHours: Math.round(((p.compute_time_seconds ?? 0) / 3600) * 10) / 10,
      activeHours: Math.round(((p.active_time_seconds ?? 0) / 3600) * 10) / 10,
      storageBytes: p.synthetic_storage_size ?? null,
      periodStart: p.consumption_period_start ?? null, periodEnd: p.consumption_period_end ?? null,
    };
  } catch { return null; }
}

/** Worker requests per day for the last 7 days, per Worker (needs a Cloudflare token with Account Analytics: Read). */
async function cloudflareRequests(env: Deps['env']) {
  if (!env.CF_API_TOKEN || !env.CF_ACCOUNT_ID) return null;
  const to = new Date(), from = new Date(Date.now() - 6 * 86400_000);
  const query = `query ($a: String!, $from: Date!, $to: Date!) { viewer { accounts(filter: { accountTag: $a }) {
    workersInvocationsAdaptive(limit: 5000, filter: { date_geq: $from, date_leq: $to }) { sum { requests errors } dimensions { date scriptName } } } } }`;
  try {
    const r = await fetch('https://api.cloudflare.com/client/v4/graphql', {
      method: 'POST', headers: { authorization: `Bearer ${env.CF_API_TOKEN}`, 'content-type': 'application/json' }, signal: AbortSignal.timeout(4000),
      body: JSON.stringify({ query, variables: { a: env.CF_ACCOUNT_ID, from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) } }),
    });
    if (!r.ok) return null;
    const rows: any[] = (await r.json() as any)?.data?.viewer?.accounts?.[0]?.workersInvocationsAdaptive ?? [];
    const today = to.toISOString().slice(0, 10); // Cloudflare's daily limit resets at 00:00 UTC
    const byDay: Record<string, number> = {}, byWorker: Record<string, number> = {};
    let errors = 0;
    for (const x of rows) {
      byDay[x.dimensions.date] = (byDay[x.dimensions.date] ?? 0) + x.sum.requests;
      if (x.dimensions.date === today) { byWorker[x.dimensions.scriptName] = (byWorker[x.dimensions.scriptName] ?? 0) + x.sum.requests; errors += x.sum.errors; }
    }
    return { today: byDay[today] ?? 0, errorsToday: errors, byWorker, week: Object.entries(byDay).sort().map(([day, n]) => ({ day, n })) };
  } catch { return null; }
}
