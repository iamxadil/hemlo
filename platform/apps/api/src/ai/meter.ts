// What a business may spend on AI, and what it has spent. Plans include a monthly allowance of "AI actions" (one invoice
// read or one question = one action); a ready-made demo sample or a preset question is free. Two guards above that: a
// daily cap per business, and a Hemlo-wide monthly budget for the paid engine (it stops before the bill surprises anyone).
import { sql } from 'drizzle-orm';
import { newId } from '@hemlo/core';
import { withOrg, withSystem, type Database } from '@hemlo/db';
import { aiUsage } from '@hemlo/db/schema';
import type { SubState } from '../subscription';

export const ALLOWANCE = { free: 20, trial: 50, store: 150, perDentist: 150, demo: 5 } as const;
export const DAILY_CAP = 60;                      // per business per day, whatever the plan (stops a runaway loop)
export const DEFAULT_BUDGET_USD = 30;              // Hemlo-wide per month on the paid engine (env AI_BUDGET_USD)

/** The month's allowance for this business. */
export function allowanceOf(sub: SubState, demo: boolean) {
  if (demo) return ALLOWANCE.demo;
  if (sub.status === 'ended') return 0;
  if (sub.status === 'free') return ALLOWANCE.free;
  return sub.limits.ai ?? (sub.status === 'trial' ? ALLOWANCE.trial : sub.edition === 'dental' ? ALLOWANCE.perDentist * Math.max(1, sub.seats) : ALLOWANCE.store);
}

/** Midnight at the start of this month (and of today) in Baghdad (UTC+3, no daylight saving), as UTC instants. */
export function baghdadStarts(now = new Date()) {
  const b = new Date(now.getTime() + 3 * 3600_000);
  return {
    month: new Date(Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), 1) - 3 * 3600_000),
    day: new Date(Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate()) - 3 * 3600_000),
  };
}

const rowsOf = (r: any): any[] => (Array.isArray(r) ? r : r?.rows ?? []);

/** Everything the AI screens need about a business, in ONE query: is it a demo, is AI switched off, actions used this
 *  month and today. (Asked on every AI screen and call, so it stays one round trip.) */
export async function snapshot(db: Database, org: string) {
  const { month, day } = baghdadStarts();
  const [r] = rowsOf(await withOrg(db, org, (tx) => tx.execute(sql`select coalesce(o.metadata, '') like '%"demo":true%' as demo, coalesce(s.ai_off, false) as off, o.metadata as meta,
      (select count(*) filter (where counted and ok) from ai_usage u where u.organization_id = o.id and u.created_at >= ${month.toISOString()})::int as month,
      (select count(*) filter (where counted and created_at >= ${day.toISOString()}) from ai_usage u where u.organization_id = o.id and u.created_at >= ${month.toISOString()})::int as day
    from organization o left join sys_settings s on s.organization_id = o.id where o.id = ${org}`)));
  let kind: string | null = null;
  try { kind = JSON.parse(String(r?.meta ?? '{}'))?.kind ?? null; } catch { kind = null; }
  return { demo: !!r?.demo, off: !!r?.off, month: Number(r?.month ?? 0), day: Number(r?.day ?? 0), kind };
}

/** Has Hemlo spent its monthly budget on the paid engine? (only asked when the paid engine is in use) */
export async function overBudget(db: Database, budgetUsd: number) {
  const { month } = baghdadStarts();
  const [r] = rowsOf(await withSystem(db, (tx) => tx.execute(sql`select coalesce(sum(cost_micros), 0)::bigint as micros from ai_usage where created_at >= ${month.toISOString()} and kind = 'text'`)));
  return Number(r?.micros ?? 0) >= budgetUsd * 1_000_000;
}

/** Images and video have their own Hemlo-wide monthly ceiling (they cost far more per call than text). */
export async function mediaOverBudget(db: Database, budgetUsd: number | null | undefined) {
  if (!budgetUsd || budgetUsd <= 0) return true; // no ceiling entered: nothing paid is generated
  const { month } = baghdadStarts();
  const [r] = rowsOf(await withSystem(db, (tx) => tx.execute(sql`select coalesce(sum(cost_micros), 0)::bigint as micros from ai_usage where created_at >= ${month.toISOString()} and kind in ('image', 'video')`)));
  return Number(r?.micros ?? 0) >= budgetUsd * 1_000_000;
}

export async function record(db: Database, org: string, row: { userId: string | null; feature: string; engine: string; model?: string | null; inputTokens?: number; outputTokens?: number; costMicros?: number; ms: number; ok: boolean; counted?: boolean; kind?: 'text' | 'image' | 'video'; units?: number }) {
  await withOrg(db, org, (tx) => tx.insert(aiUsage).values({
    id: newId(), organizationId: org, userId: row.userId, feature: row.feature, engine: row.engine, model: row.model ?? null,
    inputTokens: row.inputTokens ?? 0, outputTokens: row.outputTokens ?? 0, costMicros: row.costMicros ?? 0, ms: row.ms, ok: row.ok, counted: row.counted ?? true, kind: row.kind ?? 'text', units: row.units ?? 1,
  }));
}
