// The admin dashboard's costs and margins. The team enters what things cost Hemlo (the dollar rate, WhatsApp's rates per
// country and category, each business's share of the running costs, a monthly ceiling for images and video), and the
// margin report puts this month's revenue from each business next to what it cost: AI text, AI images and video, WhatsApp
// messages, and the running-costs share. A cost that isn't entered is reported as unknown, never as zero.
import { Hono, type Context } from 'hono';
import { sql } from 'drizzle-orm';
import { withSystem } from '@hemlo/db';
import { hemloSetting, type CostSettings } from '@hemlo/db/schema';
import type { StaffPermission } from '@hemlo/core';
import { audit } from '@hemlo/auth/audit';
import { HttpError } from '../principal';
import { costsOf, forgetCosts } from '../costs';
import { baghdadStarts } from '../ai/meter';
import type { AppEnv, Deps } from '../types';

const rowsOf = (r: any): any[] => (Array.isArray(r) ? r : r?.rows ?? []);
const need = (c: Context<AppEnv>, perm: StaffPermission) => {
  const s = c.get('staff');
  if (!s || !s.permissions.includes(perm)) throw new HttpError(403, 'NO_PERMISSION', perm);
  return s;
};
const num = (v: unknown, max: number) => (v == null || v === '' ? null : Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= max ? Number(v) : (() => { throw new HttpError(400, 'BAD_COST'); })());

export function adminCostRoutes(d: Deps) {
  const r = new Hono<AppEnv>();

  r.get('/costs', async (c) => {
    need(c, 'usage.view');
    return c.json({ costs: await costsOf(d.db) });
  });

  r.put('/costs', async (c) => {
    const s = need(c, 'billing.manage');
    const b = await c.req.json<CostSettings>().catch(() => ({} as CostSettings));
    const rates: CostSettings['waRates'] = {};
    for (const [country, v] of Object.entries(b.waRates ?? {})) {
      if (!/^(IQ|other|[A-Z]{2})$/.test(country)) throw new HttpError(400, 'BAD_COUNTRY');
      rates[country] = { marketing: num(v?.marketing, 100_000) ?? 0, utility: num(v?.utility, 100_000) ?? 0, service: num(v?.service, 100_000) ?? 0 };
    }
    const value: CostSettings = { usdIqd: num(b.usdIqd, 100_000), infraIqd: num(b.infraIqd, 100_000_000), mediaBudgetUsd: num(b.mediaBudgetUsd, 100_000),
      marginTarget: num(b.marginTarget, 99) ?? 15, waRates: Object.keys(rates).length ? rates : (await costsOf(d.db)).waRates };
    await withSystem(d.db, (tx) => tx.insert(hemloSetting).values({ key: 'costs', value: value as Record<string, unknown>, updatedBy: s.userId, updatedAt: new Date() })
      .onConflictDoUpdate({ target: hemloSetting.key, set: { value: value as Record<string, unknown>, updatedBy: s.userId, updatedAt: new Date() } }));
    forgetCosts();
    await audit(d.db, { kind: 'admin.costs_changed', userId: s.userId, detail: value as Record<string, unknown> });
    return c.json({ costs: value });
  });

  /** This month, per business: what it pays (its plan and add-ons, a month's worth) against what it cost Hemlo. */
  r.get('/margins', async (c) => {
    need(c, 'usage.view');
    const costs = await costsOf(d.db);
    const { month } = baghdadStarts();
    const from = month.toISOString();
    const rows = rowsOf(await withSystem(d.db, (tx) => tx.execute(sql`with
      plan as (select s.organization_id as org, s.status, s.edition,
          case when s.status in ('active', 'grace') then coalesce(s.price, case when s.billing = 'year' then p.price_year else p.price_month end, 0) / case when s.billing = 'year' then 12.0 else 1 end else 0 end as iqd
        from hemlo_subscription s left join hemlo_plan p on p.id = s.plan_id),
      addons as (select e.organization_id as org, sum(e.price / case when e.billing = 'year' then 12.0 else 1 end) as iqd, string_agg(a.code, ', ' order by a.sort) as codes
        from hemlo_addon_entitlement e join hemlo_addon a on a.id = e.addon_id where e.status = 'active' and (e.paid_until is null or e.paid_until > now()) group by 1),
      ai as (select organization_id as org, coalesce(sum(cost_micros) filter (where kind = 'text'), 0)::bigint as text_micros,
          coalesce(sum(cost_micros) filter (where kind <> 'text'), 0)::bigint as media_micros, count(*)::int as calls
        from ai_usage where created_at >= ${from} group by 1),
      wa as (select organization_id as org, coalesce(sum(cost_iqd), 0)::int as iqd, count(*) filter (where direction = 'out')::int as sent
        from connect_message where created_at >= ${from} group by 1)
      select o.id, o.name, plan.status, plan.edition, coalesce(plan.iqd, 0)::float as plan_iqd, coalesce(addons.iqd, 0)::float as addons_iqd, addons.codes,
        coalesce(ai.text_micros, 0) as text_micros, coalesce(ai.media_micros, 0) as media_micros, coalesce(ai.calls, 0) as calls, coalesce(wa.iqd, 0) as wa_iqd, coalesce(wa.sent, 0) as wa_sent
      from organization o left join plan on plan.org = o.id left join addons on addons.org = o.id left join ai on ai.org = o.id left join wa on wa.org = o.id
      where coalesce(o.metadata, '') not like '%"demo":true%' and (plan.org is not null or addons.org is not null or ai.org is not null or wa.org is not null)
      order by coalesce(addons.iqd, 0) + coalesce(plan.iqd, 0) desc, o.name limit 300`)));
    const rate = costs.usdIqd && costs.usdIqd > 0 ? costs.usdIqd : null, infra = costs.infraIqd ?? null, target = costs.marginTarget ?? 15;
    const businesses = rows.map((x) => {
      const revenue = Math.round(Number(x.plan_iqd) + Number(x.addons_iqd));
      const ai = rate == null ? null : Math.round((Number(x.text_micros) / 1e6) * rate), media = rate == null ? null : Math.round((Number(x.media_micros) / 1e6) * rate);
      const aiUnknown = rate == null && Number(x.text_micros) + Number(x.media_micros) > 0;
      const cost = (ai ?? 0) + (media ?? 0) + Number(x.wa_iqd) + (infra ?? 0);
      const margin = revenue > 0 ? Math.round(((revenue - cost) / revenue) * 1000) / 10 : null;
      return { id: x.id, name: x.name, status: x.status ?? 'free', edition: x.edition, addons: x.codes ?? '', revenue, costs: { ai, media, whatsapp: Number(x.wa_iqd), infra },
        aiCalls: Number(x.calls), sent: Number(x.wa_sent), margin, below: margin != null && margin < target, unknown: [aiUnknown && 'usdIqd', infra == null && 'infraIqd'].filter(Boolean) };
    });
    return c.json({ month: from, target, missing: [rate == null && 'usdIqd', infra == null && 'infraIqd'].filter(Boolean), businesses });
  });

  return r;
}
