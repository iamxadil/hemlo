// "Ask your shop": a question in Arabic, English or Kurdish becomes ONE of a fixed set of read-only questions
// (sales for a period, best sellers, who owes…). The AI only picks the question and its period; the numbers come from
// our own queries, inside the business's own data (row-level security), and the app words the answer itself. So an
// answer can't contain a made-up number, and the AI can never run a query of its own.
import { sql } from 'drizzle-orm';
import { withOrg, type Database } from '@hemlo/db';
import type { Engine, JsonSchema } from './engine';
import { norm, likeness } from './invoice';

export const TOOLS = ['summary', 'top_products', 'slow_products', 'debtors', 'low_stock', 'product', 'suppliers_owed', 'unknown'] as const;
export const PERIODS = ['today', 'yesterday', 'last_7_days', 'this_month', 'last_month', 'last_30_days'] as const;
export type Plan = { tool: (typeof TOOLS)[number]; period: (typeof PERIODS)[number]; name: string };

export const PLAN_SCHEMA: JsonSchema = {
  type: 'object', additionalProperties: false, required: ['tool', 'period', 'name'],
  properties: { tool: { type: 'string', enum: [...TOOLS] }, period: { type: 'string', enum: [...PERIODS] }, name: { type: 'string' } },
};

const SYSTEM = `You route a shop owner's question (Iraqi Arabic dialect, Arabic, English or Kurdish) to ONE report. Reply with JSON only.
Reports ("tool"):
- summary: sales, profit, number of receipts, discounts, debt payments collected, expenses (e.g. "شكد بعت اليوم؟", "شكد ربحت هالأسبوع؟", "how were sales yesterday")
- top_products: best sellers (e.g. "شنو أكثر شي انباع؟")
- slow_products: items in stock that didn't sell (e.g. "شنو ما انباع هالشهر؟")
- debtors: customers who owe money, most first (e.g. "منو عليه دين؟", "منو أكثر واحد عليه فلوس؟")
- low_stock: what is running out (e.g. "شنو خالص أو قرب يخلص؟")
- product: one product's stock, price and recent sales; put the product's name in "name" (e.g. "شكد باقي بيبسي؟")
- suppliers_owed: what the shop owes its suppliers (e.g. "شكد علينا للمورّدين؟")
- unknown: anything else (not about this shop's numbers)
"period": today, yesterday, last_7_days ("هالأسبوع", "this week"), this_month ("هالشهر"), last_month ("الشهر الماضي"), last_30_days. Default today; for slow_products default this_month.
"name": the product name for "product", otherwise "".`;

export async function planQuestion(engine: Engine, question: string) {
  return engine.json<Plan>({ system: SYSTEM, text: question.slice(0, 400), schema: PLAN_SCHEMA, maxTokens: 200 });
}

/** A period's bounds, in Baghdad time (UTC+3). */
export function periodBounds(p: Plan['period'], now = new Date()) {
  const H = 3600_000, D = 24 * H, b = new Date(now.getTime() + 3 * H);
  const day = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate()) - 3 * H;
  const month = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), 1) - 3 * H;
  const r: Record<Plan['period'], [number, number]> = {
    today: [day, now.getTime()], yesterday: [day - D, day], last_7_days: [day - 6 * D, now.getTime()],
    this_month: [month, now.getTime()], last_month: [Date.UTC(b.getUTCFullYear(), b.getUTCMonth() - 1, 1) - 3 * H, month], last_30_days: [day - 29 * D, now.getTime()],
  };
  const [from, to] = r[p] ?? r.today;
  return { from: new Date(from).toISOString(), to: new Date(to).toISOString() };
}

const rowsOf = (r: any): any[] => (Array.isArray(r) ? r : r?.rows ?? []);
const n = (v: unknown) => Number(v ?? 0);

/** Run the chosen report. Every query is an aggregate (small and fast), inside the business's own data. */
export async function answer(db: Database, org: string, plan: Plan) {
  const { from, to } = periodBounds(plan.period);
  const q = <T = any>(s: any) => withOrg(db, org, async (tx) => rowsOf(await tx.execute(s)) as T[]);
  switch (plan.tool) {
    case 'summary': {
      const [s] = await q(sql`select count(*)::int as receipts, coalesce(sum(total), 0)::bigint as sales, coalesce(sum(total - coalesce(cost, 0)), 0)::bigint as profit,
          coalesce(sum(discount), 0)::bigint as discounts, coalesce(sum(due), 0)::bigint as on_account,
          (select coalesce(-sum(amount), 0)::bigint from sys_ledger where kind = 'payment' and at >= ${from} and at < ${to}) as collected,
          (select coalesce(sum(amount), 0)::bigint from sys_expense where at >= ${from} and at < ${to}) as expenses
        from sys_sale where voided_at is null and created_at >= ${from} and created_at < ${to}`);
      return { tool: plan.tool, period: plan.period, data: { receipts: n(s?.receipts), sales: n(s?.sales), profit: n(s?.profit), discounts: n(s?.discounts), onAccount: n(s?.on_account), collected: n(s?.collected), expenses: n(s?.expenses) } };
    }
    case 'top_products': {
      const rows = await q(sql`select l.name, sum(coalesce(l.base_qty, l.qty))::float as qty, sum(l.total)::bigint as total from sys_sale_line l join sys_sale s on s.id = l.sale_id
        where s.voided_at is null and s.created_at >= ${from} and s.created_at < ${to} group by l.name order by sum(l.total) desc limit 5`);
      return { tool: plan.tool, period: plan.period, data: { items: rows.map((r) => ({ name: r.name, qty: n(r.qty), total: n(r.total) })) } };
    }
    case 'slow_products': {
      const rows = await q(sql`select p.name, p.stock::float as stock, (p.stock * coalesce(p.cost, 0))::bigint as value from sys_product p
        where p.archived_at is null and p.track_stock and p.stock > 0 and not exists (
          select 1 from sys_sale_line l join sys_sale s on s.id = l.sale_id where l.product_id = p.id and s.voided_at is null and s.created_at >= ${from} and s.created_at < ${to})
        order by p.stock * coalesce(p.cost, 0) desc limit 5`);
      return { tool: plan.tool, period: plan.period, data: { items: rows.map((r) => ({ name: r.name, stock: n(r.stock), value: n(r.value) })) } };
    }
    case 'debtors': {
      const rows = await q(sql`select name, balance::bigint as balance, (select count(*) from sys_customer where balance > 0 and archived_at is null)::int as people,
        (select coalesce(sum(balance), 0) from sys_customer where balance > 0 and archived_at is null)::bigint as owed
        from sys_customer where balance > 0 and archived_at is null order by balance desc limit 5`);
      return { tool: plan.tool, period: plan.period, data: { people: n(rows[0]?.people), owed: n(rows[0]?.owed), items: rows.map((r) => ({ name: r.name, balance: n(r.balance) })) } };
    }
    case 'low_stock': {
      const rows = await q(sql`select name, stock::float as stock, unit from sys_product where archived_at is null and track_stock and stock <= coalesce(low_stock, 0) order by stock limit 8`);
      return { tool: plan.tool, period: plan.period, data: { items: rows.map((r) => ({ name: r.name, stock: n(r.stock), unit: r.unit })) } };
    }
    case 'product': {
      const all = await q(sql`select id, name, stock::float as stock, unit, price, cost from sys_product where archived_at is null`);
      const wanted = norm(plan.name);
      let best: any, score = 0;
      for (const p of all) { const s = norm(p.name).includes(wanted) && wanted ? 0.9 : likeness(plan.name, p.name); if (s > score) { score = s; best = p; } }
      if (!best || score < 0.4) return { tool: plan.tool, period: plan.period, data: { found: false, asked: plan.name } };
      const { from: f30 } = periodBounds('last_30_days');
      const [sold] = await q(sql`select coalesce(sum(coalesce(l.base_qty, l.qty)), 0)::float as qty from sys_sale_line l join sys_sale s on s.id = l.sale_id
        where l.product_id = ${best.id} and s.voided_at is null and s.created_at >= ${f30}`);
      return { tool: plan.tool, period: plan.period, data: { found: true, name: best.name, stock: n(best.stock), unit: best.unit, price: n(best.price), cost: best.cost == null ? null : n(best.cost), sold30: n(sold?.qty) } };
    }
    case 'suppliers_owed': {
      const rows = await q(sql`select name, balance::bigint as balance from sys_supplier where balance > 0 and archived_at is null order by balance desc limit 5`);
      return { tool: plan.tool, period: plan.period, data: { owed: rows.reduce((s, r) => s + n(r.balance), 0), items: rows.map((r) => ({ name: r.name, balance: n(r.balance) })) } };
    }
    default:
      return { tool: 'unknown' as const, period: plan.period, data: {} };
  }
}
