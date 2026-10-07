// What a business pays for: its edition, its plan (hemlo_plan: price and size limits), trial or paid (hemlo_subscription).
// No row = free (the first shops, from before pricing). The rules, in one place:
//  - a new business gets a 30-day trial with the edition's biggest public plan, so it sees everything;
//  - a paid plan runs until paid_until, then 7 days of grace (everything works, with a reminder);
//  - after that it's "ended": the business can still open and export everything, but can't add or change anything until
//    Hemlo activates it. Medical and business records are never held hostage, and the ask is clear.
// Every plan has every feature; plans differ by size (staff accounts, shared tills, dentists, gym members, AI tasks).
import type { Context, Next } from 'hono';
import { asc, eq } from 'drizzle-orm';
import { withSystem, type Database } from '@hemlo/db';
import { hemloSubscription, hemloPlan, type PlanLimits } from '@hemlo/db/schema';
import { HttpError } from './principal';
import type { AppEnv } from './types';

export const TRIAL_DAYS = 30;
export const GRACE_DAYS = 7;
export const EDITIONS = ['store', 'dental', 'gym', 'realestate'] as const;
export type Plan = typeof hemloPlan.$inferSelect;
export type SubState = {
  edition: string; status: 'free' | 'trial' | 'active' | 'grace' | 'ended'; seats: number;
  trialEndsAt: Date | null; paidUntil: Date | null; daysLeft: number | null;
  planId: string | null; plan: { id: string; code: string; name: Plan['name'] } | null; billing: string; price: number | null; limits: PlanLimits;
};

// ---- the price list (changes rarely: kept for a minute per isolate) ----
let plansCache: { at: number; plans: Plan[] } | null = null;
export const forgetPlans = () => { plansCache = null; };
export async function plansOf(db: Database): Promise<Plan[]> {
  if (plansCache && Date.now() - plansCache.at < 60_000) return plansCache.plans;
  const plans = await withSystem(db, (tx) => tx.select().from(hemloPlan).orderBy(asc(hemloPlan.edition), asc(hemloPlan.sort)));
  plansCache = { at: Date.now(), plans };
  return plans;
}
/** A trial tries the edition's biggest public plan. */
export const trialPlanOf = (plans: Plan[], edition: string) => plans.filter((p) => p.edition === edition && p.public && p.active).sort((a, b) => b.priceMonth - a.priceMonth)[0] ?? null;

export function stateOf(row: typeof hemloSubscription.$inferSelect | null | undefined, plans: Plan[] = []): SubState {
  const none = { planId: null, plan: null, billing: 'month', price: null, limits: {} as PlanLimits };
  if (!row) return { edition: 'store', status: 'free', seats: 0, trialEndsAt: null, paidUntil: null, daysLeft: null, ...none };
  const now = Date.now();
  const days = (d: Date | null) => (d ? Math.max(0, Math.ceil((+d - now) / 86400_000)) : null);
  let status: SubState['status'];
  if (row.status === 'free') status = 'free';
  else if (row.status === 'active') status = !row.paidUntil || +row.paidUntil > now ? 'active' : +row.paidUntil + GRACE_DAYS * 86400_000 > now ? 'grace' : 'ended';
  else if (row.status === 'trial') status = row.trialEndsAt && +row.trialEndsAt > now ? 'trial' : 'ended';
  else status = 'ended';
  const plan = (row.planId ? plans.find((p) => p.id === row.planId) : null) ?? (status === 'trial' ? trialPlanOf(plans, row.edition) : null);
  return {
    edition: row.edition, status, seats: row.seats, trialEndsAt: row.trialEndsAt, paidUntil: row.paidUntil,
    daysLeft: status === 'trial' ? days(row.trialEndsAt) : status === 'active' ? days(row.paidUntil) : status === 'grace' ? days(new Date(+row.paidUntil! + GRACE_DAYS * 86400_000)) : null,
    planId: row.planId ?? null, plan: plan ? { id: plan.id, code: plan.code, name: plan.name } : null, billing: row.billing ?? 'month', price: row.price ?? null,
    limits: status === 'free' ? {} : plan?.limits ?? {},
  };
}

// A short per-isolate memory, so checking doesn't cost a query on every request (Hemlo's changes show within a minute).
const cache = new Map<string, { at: number; state: SubState }>();
export const forgetSubscription = (org: string) => cache.delete(org);
export async function subscriptionOf(db: Database, org: string): Promise<SubState> {
  const hit = cache.get(org);
  if (hit && Date.now() - hit.at < 60_000) return hit.state;
  const [[row], plans] = await Promise.all([withSystem(db, (tx) => tx.select().from(hemloSubscription).where(eq(hemloSubscription.organizationId, org))), plansOf(db)]);
  const state = stateOf(row, plans);
  cache.set(org, { at: Date.now(), state });
  if (cache.size > 5000) cache.clear();
  return state;
}

/** Guard for a business's app routes: reading is always allowed; changing needs a live trial or plan. */
export async function subscriptionGuard(c: Context<AppEnv>, next: Next) {
  const p = c.get('principal');
  if (p?.organizationId && !['GET', 'HEAD', 'OPTIONS'].includes(c.req.method)) {
    const s = await subscriptionOf(c.get('deps').db, p.organizationId);
    if (s.status === 'ended') throw new HttpError(402, !s.paidUntil ? 'TRIAL_ENDED' : 'SUBSCRIPTION_ENDED');
  }
  await next();
}

/** A hard limit (staff accounts, shared tills, dentists): adding one more than the plan allows asks for a bigger plan.
 *  Never used for what happens at the counter or the door: a sale or a check-in is never blocked by a plan. */
export async function withinLimit(db: Database, org: string, key: keyof PlanLimits, count: number) {
  const s = await subscriptionOf(db, org);
  const max = s.limits[key];
  if (max != null && count >= max) throw new HttpError(402, `PLAN_LIMIT_${key.toUpperCase()}`);
}
