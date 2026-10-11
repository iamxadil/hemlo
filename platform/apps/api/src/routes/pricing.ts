// Pricing: the public price list (website and app), a business's own plan page (what it's on, how much of the plan it
// uses, ask for a plan), and Hemlo's side in the admin dashboard (edit plans, record payments, handle requests, see the
// money). Payments are taken by hand for now (cash, FIB, Zain Cash, a transfer): each one moves the paid-until date.
import { Hono, type Context } from 'hono';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { newId } from '@hemlo/core';
import { withOrg, withSystem, type Database } from '@hemlo/db';
import { hemloPlan, hemloPayment, hemloPlanRequest, hemloSubscription, hemloAddon, hemloAddonRequest, hemloAddonEntitlement, hemloAddonPayment, type PlanLimits } from '@hemlo/db/schema';
import type { StaffPermission } from '@hemlo/core';
import { audit } from '@hemlo/auth/audit';
import { HttpError, requireOrgUser } from '../principal';
import { actor, bad, text } from './sys-common';
import { isDemoOrg } from './demo';
import { plansOf, forgetPlans, stateOf, subscriptionOf, forgetSubscription, EDITIONS, GRACE_DAYS, type Plan } from '../subscription';
import { addonEntitlement, addonOffer, addonsActive, requireAddonOffer } from '../addons';

/** Tiers of one product: the higher one replaces the lower (asking for Starter while on Pro makes no sense). */
const REPLACES: Record<string, string[]> = { 'connect-pro': ['connect'], 'web-connect': ['website', 'connect', 'connect-pro'] };
const higherOf = (code: string) => Object.keys(REPLACES).filter((k) => REPLACES[k].includes(code));
import type { AppEnv, Deps } from '../types';

const rowsOf = (r: any): any[] => (Array.isArray(r) ? r : r?.rows ?? []);
const METHODS = ['cash', 'fib', 'zaincash', 'transfer', 'other'] as const;
const LIMIT_KEYS = ['users', 'devices', 'dentists', 'members', 'ai'] as const;
const publicPlan = (p: Plan) => ({ id: p.id, edition: p.edition, code: p.code, name: p.name, tagline: p.tagline, priceMonth: p.priceMonth, priceYear: p.priceYear, limits: p.limits, popular: p.popular });

/** How much of its plan a business uses now: staff accounts, shared tills, dentists, active gym members. One query. */
export async function usageOf(tx: Database, org: string) {
  const [u] = rowsOf(await tx.execute(sql`select
    (select count(*)::int from member where organization_id = ${org}) as users,
    (select count(*)::int from counter_device where organization_id = ${org} and revoked_at is null and expires_at > now()) as devices,
    (select count(*)::int from dent_dentist where organization_id = ${org} and active) as dentists,
    (select count(distinct ms.member_id)::int from gym_membership ms where ms.organization_id = ${org} and ms.status = 'active'
      and ms.starts_on <= current_date and ms.ends_on >= current_date) as members`));
  return { users: u.users, devices: u.devices, dentists: u.dentists, members: u.members } as Required<Omit<PlanLimits, 'ai'>>;
}
const overOf = (limits: PlanLimits, usage: Record<string, number>) => LIMIT_KEYS.filter((k) => k !== 'ai' && limits[k] != null && usage[k] > limits[k]!);

// ---------------- the public price list ----------------
export function publicPlanRoutes(d: Deps) {
  const r = new Hono<AppEnv>();
  r.get('/', async (c) => {
    const edition = c.req.query('edition');
    const plans = (await plansOf(d.db)).filter((p) => p.public && p.active && (!edition || p.edition === edition));
    c.header('cache-control', 'public, max-age=300');
    return c.json({ plans: plans.map(publicPlan), trialDays: 30, graceDays: GRACE_DAYS });
  });
  r.get('/addons', async (c) => {
    const edition = c.req.query('edition');
    const rows = await withSystem(d.db, (tx) => tx.select().from(hemloAddon).where(and(eq(hemloAddon.public, true), eq(hemloAddon.active, true))));
    c.header('cache-control', 'public, max-age=300');
    return c.json({ addons: rows.filter((x) => !edition || x.compatibleEditions.includes(edition)).map((x) => ({
      id: x.id, code: x.code, name: x.name, description: x.description, compatibleEditions: x.compatibleEditions,
      priceMonth: x.priceMonth, priceYear: x.priceYear, configured: x.priceMonth != null && x.priceYear != null,
    })) });
  });
  return r;
}

// ---------------- a business's own plan ----------------
export function billingRoutes(d: Deps) {
  const r = new Hono<AppEnv>();

  /** The plan page in the app: what we're on, how much we use, the plans we can move to, our payments and requests. */
  r.get('/', async (c) => {
    const a = actor(c, 'stock', 'read');
    const owner = (() => { try { actor(c, 'billing', 'manage'); return true; } catch { return false; } })();
    const sub = await subscriptionOf(d.db, a.organizationId);
    const [plans, out] = await Promise.all([plansOf(d.db), withOrg(d.db, a.organizationId, async (tx) => ({
      usage: await usageOf(tx, a.organizationId),
      payments: owner ? await tx.select().from(hemloPayment).where(eq(hemloPayment.organizationId, a.organizationId)).orderBy(desc(hemloPayment.createdAt)).limit(24) : [],
      request: (await tx.select().from(hemloPlanRequest).where(and(eq(hemloPlanRequest.organizationId, a.organizationId), eq(hemloPlanRequest.status, 'new'))).orderBy(desc(hemloPlanRequest.createdAt)).limit(1))[0] ?? null,
    }))]);
    const edition = sub.status === 'free' ? (c.req.query('edition') ?? 'store') : sub.edition;
    return c.json({ subscription: sub, owner, usage: out.usage, over: overOf(sub.limits, out.usage), payments: out.payments, request: out.request,
      plans: plans.filter((p) => p.edition === edition && p.public && p.active).map(publicPlan) });
  });

  /** Add-on offers and this workspace's pending requests/confirmed entitlements. */
  r.get('/addons', async (c) => {
    const a = actor(c, 'stock', 'read');
    const sub = await subscriptionOf(d.db, a.organizationId);
    const rows = await withSystem(d.db, (tx) => tx.select().from(hemloAddon).where(and(eq(hemloAddon.public, true), eq(hemloAddon.active, true))));
    const compatible = rows.filter((x) => x.compatibleEditions.includes(sub.edition));
    const [states, out] = await Promise.all([addonsActive(d.db, a.organizationId, compatible.map((x) => x.code)), withOrg(d.db, a.organizationId, async (tx) => ({
      requests: await tx.select().from(hemloAddonRequest).where(eq(hemloAddonRequest.organizationId, a.organizationId)).orderBy(desc(hemloAddonRequest.createdAt)).limit(12),
      payments: await tx.select().from(hemloAddonPayment).where(eq(hemloAddonPayment.organizationId, a.organizationId)).orderBy(desc(hemloAddonPayment.createdAt)).limit(24),
    }))]);
    return c.json({ edition: sub.edition, coreStatus: sub.status, owner: (() => { try { actor(c, 'billing', 'manage'); return true; } catch { return false; } })(),
      addons: compatible.map((x) => ({ id: x.id, code: x.code, name: x.name, description: x.description, priceMonth: x.priceMonth, priceYear: x.priceYear, configured: x.priceMonth != null && x.priceYear != null,
        entitlement: states[x.code]?.entitlement ? { ...states[x.code].entitlement, active: states[x.code].active } : null })), requests: out.requests, payments: out.payments });
  });

  /** Request manual activation; the catalog price is snapshotted server-side and the add-on remains inactive. */
  r.post('/addons/:code/request', async (c) => {
    const p = requireOrgUser(c);
    const a = actor(c, 'billing', 'manage');
    if (await isDemoOrg(d, a.organizationId)) throw new HttpError(403, 'NOT_IN_DEMO');
    const { offer, subscription } = await requireAddonOffer(d.db, a.organizationId, c.req.param('code'));
    const b = await c.req.json<{ billing?: string; message?: string }>().catch(() => ({} as any));
    const billing = b.billing === 'year' ? 'year' : b.billing === undefined || b.billing === 'month' ? 'month' : bad('BAD_BILLING');
    const price = billing === 'year' ? offer.priceYear : offer.priceMonth;
    if (price == null) throw new HttpError(409, 'ADDON_PRICE_UNCONFIGURED');
    const pending = await withOrg(d.db, a.organizationId, (tx) => tx.select({ id: hemloAddonRequest.id }).from(hemloAddonRequest)
      .where(and(eq(hemloAddonRequest.organizationId, a.organizationId), eq(hemloAddonRequest.addonId, offer.id), eq(hemloAddonRequest.status, 'new'))).limit(1));
    if (pending.length) throw new HttpError(409, 'ADDON_REQUEST_PENDING');
    const current = await addonEntitlement(d.db, a.organizationId, offer.code);
    if (current.active) throw new HttpError(409, 'ADDON_ALREADY_ACTIVE');
    for (const up of higherOf(offer.code)) if ((await addonEntitlement(d.db, a.organizationId, up)).active) throw new HttpError(409, 'ADDON_ALREADY_ACTIVE');
    const [request] = await withOrg(d.db, a.organizationId, (tx) => tx.insert(hemloAddonRequest).values({ id: newId(), organizationId: a.organizationId, addonId: offer.id,
      edition: subscription.edition, action: 'activate', billing, price, message: text(b.message, 500, 'BAD_TEXT'), userId: p.userId }).returning());
    await audit(d.db, { kind: 'billing.addon_requested', userId: p.userId, organizationId: a.organizationId, detail: { addonId: offer.id, billing, price } });
    return c.json({ request, entitlement: null, status: 'pending' }, 201);
  });

  /** Request cancellation through the existing manual support/billing process. */
  r.post('/addons/:code/cancel-request', async (c) => {
    const p = requireOrgUser(c), a = actor(c, 'billing', 'manage');
    const offer = await addonOffer(d.db, c.req.param('code'));
    if (!offer || !offer.active) throw new HttpError(403, 'ADDON_UNAVAILABLE');
    const subscription = await subscriptionOf(d.db, a.organizationId);
    if (!offer.compatibleEditions.includes(subscription.edition)) throw new HttpError(403, 'ADDON_UNAVAILABLE');
    const [entitlement] = await withOrg(d.db, a.organizationId, (tx) => tx.select().from(hemloAddonEntitlement)
      .where(and(eq(hemloAddonEntitlement.organizationId, a.organizationId), eq(hemloAddonEntitlement.addonId, offer.id))));
    if (!entitlement || entitlement.status !== 'active' || (entitlement.paidUntil && entitlement.paidUntil <= new Date())) throw new HttpError(409, 'ADDON_NOT_ACTIVE');
    const pending = await withOrg(d.db, a.organizationId, (tx) => tx.select({ id: hemloAddonRequest.id }).from(hemloAddonRequest)
      .where(and(eq(hemloAddonRequest.organizationId, a.organizationId), eq(hemloAddonRequest.addonId, offer.id), eq(hemloAddonRequest.status, 'new'))).limit(1));
    if (pending.length) throw new HttpError(409, 'ADDON_REQUEST_PENDING');
    const [request] = await withOrg(d.db, a.organizationId, (tx) => tx.insert(hemloAddonRequest).values({ id: newId(), organizationId: a.organizationId,
      addonId: offer.id, edition: subscription.edition, action: 'cancel', billing: entitlement.billing, price: null, userId: p.userId }).returning());
    await audit(d.db, { kind: 'billing.addon_cancel_requested', userId: p.userId, organizationId: a.organizationId, detail: { addonId: offer.id } });
    return c.json({ request, status: 'pending' }, 201);
  });

  /** Ask for a plan (or Enterprise: planId null). Hemlo's team calls back, takes the payment and activates it. */
  r.post('/request', async (c) => {
    const p = requireOrgUser(c);
    const a = actor(c, 'billing', 'manage');
    if (await isDemoOrg(d, a.organizationId)) throw new HttpError(403, 'NOT_IN_DEMO');
    const b = await c.req.json<{ planId?: string | null; billing?: string; message?: string }>().catch(() => ({} as any));
    const sub = await subscriptionOf(d.db, a.organizationId);
    if (b.planId) { const plan = (await plansOf(d.db)).find((x) => x.id === b.planId && x.active); if (!plan || (sub.status !== 'free' && plan.edition !== sub.edition)) bad('BAD_PLAN'); }
    const billing = b.billing === 'year' ? 'year' : 'month';
    const row = await withOrg(d.db, a.organizationId, async (tx) => {
      // one open request at a time: asking again changes it
      await tx.update(hemloPlanRequest).set({ status: 'dismissed', handledAt: new Date() }).where(and(eq(hemloPlanRequest.organizationId, a.organizationId), eq(hemloPlanRequest.status, 'new')));
      const [x] = await tx.insert(hemloPlanRequest).values({ id: newId(), organizationId: a.organizationId, planId: b.planId || null, billing, message: text(b.message, 500, 'BAD_TEXT'), userId: p.userId }).returning();
      return x;
    });
    await audit(d.db, { kind: 'billing.plan_requested', userId: p.userId, organizationId: a.organizationId, detail: { planId: row.planId, billing } });
    return c.json({ request: row }, 201);
  });
  return r;
}

// ---------------- Hemlo's side (admin dashboard; mounted inside the admin routes, after the team check) ----------------
const need = (c: Context<AppEnv>, perm: StaffPermission) => {
  const s = c.get('staff')!;
  if (!s.permissions.includes(perm)) throw new HttpError(403, 'NO_PERMISSION', perm);
  return s;
};
const words = (v: any, code: string, required = false) => {
  if (v == null) return required ? bad(code) : null;
  const ar = text(v.ar, 120, code, required), en = text(v.en, 120, code, required), ckb = text(v.ckb, 120, code);
  return { ar: ar ?? '', en: en ?? '', ...(ckb ? { ckb } : {}) };
};
function planInput(b: any, partial = false) {
  const out: Partial<typeof hemloPlan.$inferInsert> = {};
  const money = (v: unknown, code: string) => { const n = Number(v); return Number.isInteger(n) && n >= 0 && n <= 1_000_000_000 ? n : bad(code); };
  if (!partial || b.edition !== undefined) out.edition = (EDITIONS as readonly string[]).includes(b.edition) ? b.edition : bad('BAD_EDITION');
  if (!partial || b.code !== undefined) out.code = /^[a-z][a-z0-9-]{1,30}$/.test(String(b.code)) ? String(b.code) : bad('BAD_CODE');
  if (!partial || b.name !== undefined) out.name = words(b.name, 'BAD_NAME', true)!;
  if (b.tagline !== undefined) out.tagline = words(b.tagline, 'BAD_TEXT');
  if (!partial || b.priceMonth !== undefined) out.priceMonth = money(b.priceMonth, 'BAD_PRICE');
  if (!partial || b.priceYear !== undefined) out.priceYear = money(b.priceYear ?? (b.priceMonth ?? 0) * 10, 'BAD_PRICE');
  if (b.limits !== undefined) {
    const l: PlanLimits = {};
    for (const k of LIMIT_KEYS) { const v = b.limits?.[k]; if (v != null && v !== '') l[k] = Number.isInteger(Number(v)) && Number(v) >= 0 && Number(v) <= 1_000_000 ? Number(v) : bad('BAD_LIMIT'); }
    out.limits = l;
  }
  for (const k of ['popular', 'public', 'active'] as const) if (b[k] !== undefined) out[k] = !!b[k];
  if (b.sort !== undefined) out.sort = Number.isInteger(Number(b.sort)) ? Number(b.sort) : bad('BAD_SORT');
  return out;
}
/** What a subscription brings in per month (agreed price, or the plan's list price; a year counts as a twelfth). */
const monthlyOf = (s: { billing: string; price: number | null }, plan: Plan | undefined) => {
  const per = s.price ?? (plan ? (s.billing === 'year' ? plan.priceYear : plan.priceMonth) : 0);
  return s.billing === 'year' ? Math.round(per / 12) : per;
};

export function adminPricingRoutes(d: Deps) {
  const r = new Hono<AppEnv>();

  r.get('/addons', async (c) => {
    need(c, 'usage.view');
    const addons = await withSystem(d.db, (tx) => tx.select().from(hemloAddon));
    return c.json({ addons });
  });
  r.patch('/addons/:code', async (c) => {
    const s = need(c, 'billing.manage');
    const b = await c.req.json<any>();
    const money = (v: unknown) => v == null || v === '' ? null : Number.isInteger(Number(v)) && Number(v) > 0 && Number(v) <= 1_000_000_000 ? Number(v) : bad('BAD_PRICE');
    const input: Partial<typeof hemloAddon.$inferInsert> = { updatedBy: s.userId, updatedAt: new Date() };
    if (b.name !== undefined) input.name = words(b.name, 'BAD_NAME', true)!;
    if (b.description !== undefined) input.description = words(b.description, 'BAD_TEXT') ?? { ar: '', en: '' };
    if (b.compatibleEditions !== undefined) {
      if (!Array.isArray(b.compatibleEditions) || b.compatibleEditions.some((e: unknown) => !(EDITIONS as readonly unknown[]).includes(e))) bad('BAD_EDITION');
      input.compatibleEditions = [...new Set(b.compatibleEditions as string[])];
    }
    if (b.priceMonth !== undefined) input.priceMonth = money(b.priceMonth);
    if (b.priceYear !== undefined) input.priceYear = money(b.priceYear);
    if (b.public !== undefined) input.public = !!b.public;
    if (b.active !== undefined) input.active = !!b.active;
    const [row] = await withSystem(d.db, (tx) => tx.update(hemloAddon).set(input).where(eq(hemloAddon.code, c.req.param('code'))).returning());
    if (!row) throw new HttpError(404, 'NOT_FOUND');
    await audit(d.db, { kind: 'admin.addon_updated', userId: s.userId, detail: { code: row.code, ...input } });
    return c.json({ addon: row });
  });

  r.get('/addon-requests', async (c) => {
    need(c, 'usage.view');
    const requests = await withSystem(d.db, (tx) => tx.execute(sql`select r.*, o.name as business, u.name as user_name, a.code as addon_code
      from hemlo_addon_request r join organization o on o.id = r.organization_id join hemlo_addon a on a.id = r.addon_id
      left join "user" u on u.id = r.user_id where r.status = 'new' order by r.created_at`)).then(rowsOf);
    return c.json({ requests });
  });
  r.patch('/addon-requests/:id', async (c) => {
    const s = need(c, 'billing.manage');
    const b = await c.req.json<any>();
    const request = await withSystem(d.db, async (tx) => (await tx.select().from(hemloAddonRequest).where(eq(hemloAddonRequest.id, c.req.param('id'))))[0] ?? null);
    if (!request) throw new HttpError(404, 'NOT_FOUND');
    if (request.status !== 'new') throw new HttpError(409, 'REQUEST_CLOSED');
    const offer = await addonOffer(d.db, request.addonId);
    if (!offer) throw new HttpError(409, 'ADDON_UNAVAILABLE');
    if (b.action === 'dismiss') {
      const [row] = await withSystem(d.db, (tx) => tx.update(hemloAddonRequest).set({ status: 'dismissed', handledBy: s.userId, handledAt: new Date() }).where(eq(hemloAddonRequest.id, request.id)).returning());
      await audit(d.db, { kind: 'admin.addon_request_dismissed', userId: s.userId, organizationId: request.organizationId, detail: { addonId: offer.id } });
      return c.json({ request: row, entitlement: null });
    }
    if (b.action === 'cancel') {
      if (request.action !== 'cancel') bad('BAD_ACTION');
      const [entitlement] = await withOrg(d.db, request.organizationId, (tx) => tx.update(hemloAddonEntitlement)
        .set({ status: 'canceled', updatedAt: new Date(), updatedBy: s.userId }).where(and(eq(hemloAddonEntitlement.organizationId, request.organizationId), eq(hemloAddonEntitlement.addonId, request.addonId))).returning());
      const [row] = await withOrg(d.db, request.organizationId, (tx) => tx.update(hemloAddonRequest).set({ status: 'done', handledBy: s.userId, handledAt: new Date() }).where(eq(hemloAddonRequest.id, request.id)).returning());
      await audit(d.db, { kind: 'admin.addon_canceled', userId: s.userId, organizationId: request.organizationId, detail: { addonId: offer.id } });
      return c.json({ request: row, entitlement });
    }
    if (b.action !== 'activate' || request.action !== 'activate') bad('BAD_ACTION');
    const method = (METHODS as readonly string[]).includes(b.method) ? b.method : bad('BAD_METHOD');
    const periods = Number(b.periods ?? 1);
    if (!Number.isInteger(periods) || periods < 1 || periods > 36) bad('BAD_PERIODS');
    const price = request.price;
    if (price == null || !offer.active || !offer.compatibleEditions.includes(request.edition)) throw new HttpError(409, 'ADDON_UNAVAILABLE');
    const amount = price * periods;
    if (!Number.isSafeInteger(amount) || Number(b.amount) !== amount) throw new HttpError(400, 'PAYMENT_AMOUNT_MISMATCH');
    const sub = await subscriptionOf(d.db, request.organizationId);
    if (sub.edition !== request.edition || !['trial', 'active', 'grace'].includes(sub.status)) throw new HttpError(409, 'CORE_SUBSCRIPTION_REQUIRED');
    const current = await withOrg(d.db, request.organizationId, async (tx) => (await tx.select().from(hemloAddonEntitlement)
      .where(and(eq(hemloAddonEntitlement.organizationId, request.organizationId), eq(hemloAddonEntitlement.addonId, request.addonId))))[0] ?? null);
    const now = new Date();
    const from = current?.status === 'active' && current.paidUntil && current.paidUntil > now ? current.paidUntil : now;
    const until = new Date(from);
    until.setMonth(until.getMonth() + periods * (request.billing === 'year' ? 12 : 1));
    const entitlementValues = { edition: request.edition, status: 'active', billing: request.billing, price, startsAt: current?.startsAt ?? now,
      paidUntil: until, updatedBy: s.userId, updatedAt: now };
    const [entitlement] = await withOrg(d.db, request.organizationId, async (tx) => {
      const existing = await tx.select({ id: hemloAddonEntitlement.id }).from(hemloAddonEntitlement)
        .where(and(eq(hemloAddonEntitlement.organizationId, request.organizationId), eq(hemloAddonEntitlement.addonId, request.addonId)));
      return existing.length
        ? tx.update(hemloAddonEntitlement).set(entitlementValues).where(and(eq(hemloAddonEntitlement.organizationId, request.organizationId), eq(hemloAddonEntitlement.addonId, request.addonId))).returning()
        : tx.insert(hemloAddonEntitlement).values({ id: newId(), organizationId: request.organizationId, addonId: request.addonId, ...entitlementValues }).returning();
    });
    await withOrg(d.db, request.organizationId, async (tx) => {
      await tx.insert(hemloAddonPayment).values({ id: newId(), organizationId: request.organizationId, addonId: request.addonId, amount, periods, method,
        reference: text(b.reference, 120, 'BAD_TEXT'), paidUntil: until, createdBy: s.userId });
      await tx.update(hemloAddonRequest).set({ status: 'done', handledBy: s.userId, handledAt: now }).where(eq(hemloAddonRequest.id, request.id));
    });
    // an upgrade (Connect → Connect Pro) ends the lower tier: one Connect at a time
    for (const lower of REPLACES[offer.code] ?? []) {
      const low = await addonOffer(d.db, lower);
      if (low) await withOrg(d.db, request.organizationId, (tx) => tx.update(hemloAddonEntitlement).set({ status: 'canceled', updatedAt: now, updatedBy: s.userId })
        .where(and(eq(hemloAddonEntitlement.organizationId, request.organizationId), eq(hemloAddonEntitlement.addonId, low.id))));
    }
    await audit(d.db, { kind: 'admin.addon_activated', userId: s.userId, organizationId: request.organizationId, detail: { addonId: offer.id, amount, periods, method, paidUntil: until } });
    return c.json({ request: { ...request, status: 'done' }, entitlement }, 201);
  });

  r.get('/plans', async (c) => {
    need(c, 'usage.view');
    const rows = await withSystem(d.db, async (tx) => ({
      plans: await tx.select().from(hemloPlan).orderBy(asc(hemloPlan.edition), asc(hemloPlan.sort)),
      on: rowsOf(await tx.execute(sql`select plan_id, count(*)::int as n from hemlo_subscription where plan_id is not null and status = 'active' group by 1`)),
    }));
    return c.json({ plans: rows.plans.map((p) => ({ ...p, subscribers: rows.on.find((x) => x.plan_id === p.id)?.n ?? 0 })) });
  });
  r.post('/plans', async (c) => {
    const s = need(c, 'billing.manage');
    const input = planInput(await c.req.json<any>());
    const [row] = await withSystem(d.db, (tx) => tx.insert(hemloPlan).values({ id: `plan_${input.edition}_${input.code}_${newId().slice(0, 4).toLowerCase()}`, ...input, updatedBy: s.userId } as any).returning())
      .catch((e) => { if (/hemlo_plan_code/.test(String(e?.message) + String(e?.cause?.message))) throw new HttpError(409, 'CODE_TAKEN'); throw e; });
    forgetPlans();
    await audit(d.db, { kind: 'admin.plan_created', userId: s.userId, detail: { id: row.id, edition: row.edition, priceMonth: row.priceMonth } });
    return c.json({ plan: row }, 201);
  });
  r.patch('/plans/:id', async (c) => {
    const s = need(c, 'billing.manage');
    const input = planInput(await c.req.json<any>(), true);
    delete input.edition; // a plan never moves to another edition
    const [row] = await withSystem(d.db, (tx) => tx.update(hemloPlan).set({ ...input, updatedBy: s.userId, updatedAt: new Date() }).where(eq(hemloPlan.id, c.req.param('id'))).returning());
    if (!row) throw new HttpError(404, 'NOT_FOUND');
    forgetPlans();
    await audit(d.db, { kind: 'admin.plan_updated', userId: s.userId, detail: { id: row.id, ...input } });
    return c.json({ plan: row });
  });

  /** The money: what comes in each month, who pays, trials ending, who is late, requests waiting, recent payments. */
  r.get('/billing', async (c) => {
    need(c, 'usage.view');
    const plans = await plansOf(d.db);
    const out = await withSystem(d.db, async (tx) => ({
      subs: rowsOf(await tx.execute(sql`select s.*, o.name, o.metadata from hemlo_subscription s join organization o on o.id = s.organization_id
        where coalesce(o.metadata, '') not like '%"demo":true%'`)),
      requests: rowsOf(await tx.execute(sql`select r.*, o.name as business, u.name as user_name, u.phone_number from hemlo_plan_request r join organization o on o.id = r.organization_id
        left join "user" u on u.id = r.user_id where r.status = 'new' order by r.created_at`)),
      payments: rowsOf(await tx.execute(sql`select p.*, o.name as business from hemlo_payment p join organization o on o.id = p.organization_id order by p.created_at desc limit 30`)),
      month: rowsOf(await tx.execute(sql`select coalesce(sum(amount), 0)::bigint as n from hemlo_payment where created_at >= now() - interval '30 days'`))[0],
    }));
    const subs = out.subs.map((x) => {
      const row = { ...x, organizationId: x.organization_id, planId: x.plan_id, trialEndsAt: x.trial_ends_at ? new Date(x.trial_ends_at) : null, paidUntil: x.paid_until ? new Date(x.paid_until) : null };
      const st = stateOf(row as any, plans);
      return { id: x.organization_id, name: x.name, ...st, monthly: st.status === 'active' || st.status === 'grace' ? monthlyOf(st, plans.find((p) => p.id === st.planId)) : 0 };
    });
    const soon = Date.now() + 7 * 86400_000;
    return c.json({
      mrr: subs.reduce((t, s) => t + s.monthly, 0), collected30: Number(out.month.n),
      counts: { active: subs.filter((s) => s.status === 'active').length, grace: subs.filter((s) => s.status === 'grace').length, trial: subs.filter((s) => s.status === 'trial').length,
        ended: subs.filter((s) => s.status === 'ended').length, free: subs.filter((s) => s.status === 'free').length },
      byEdition: EDITIONS.map((e) => ({ edition: e, paying: subs.filter((s) => s.edition === e && (s.status === 'active' || s.status === 'grace')).length, trial: subs.filter((s) => s.edition === e && s.status === 'trial').length,
        mrr: subs.filter((s) => s.edition === e).reduce((t, s) => t + s.monthly, 0) })),
      trialsEnding: subs.filter((s) => s.status === 'trial' && s.trialEndsAt && +s.trialEndsAt < soon).sort((a, b) => +a.trialEndsAt! - +b.trialEndsAt!),
      dueSoon: subs.filter((s) => (s.status === 'active' && s.paidUntil && +s.paidUntil < soon) || s.status === 'grace').sort((a, b) => +a.paidUntil! - +b.paidUntil!),
      requests: out.requests.map((x) => ({ id: x.id, organizationId: x.organization_id, business: x.business, planId: x.plan_id, billing: x.billing, message: x.message, user: x.user_name, phone: x.phone_number, createdAt: x.created_at })),
      payments: out.payments.map((x) => ({ id: x.id, organizationId: x.organization_id, business: x.business, amount: x.amount, months: x.months, method: x.method, reference: x.reference, createdAt: x.created_at, paidUntil: x.paid_until })),
      plans: plans.map(publicPlan),
    });
  });

  /** One business's plan: state, usage against the plan, payments, requests. */
  r.get('/subscriptions/:orgId', async (c) => {
    need(c, 'usage.view');
    const org = c.req.param('orgId');
    const plans = await plansOf(d.db);
    const out = await withSystem(d.db, async (tx) => ({
      row: (await tx.select().from(hemloSubscription).where(eq(hemloSubscription.organizationId, org)))[0] ?? null,
      usage: await usageOf(tx, org),
      payments: await tx.select().from(hemloPayment).where(eq(hemloPayment.organizationId, org)).orderBy(desc(hemloPayment.createdAt)).limit(50),
      requests: await tx.select().from(hemloPlanRequest).where(eq(hemloPlanRequest.organizationId, org)).orderBy(desc(hemloPlanRequest.createdAt)).limit(20),
    }));
    const st = stateOf(out.row, plans);
    return c.json({ subscription: { ...st, priceNote: out.row?.priceNote ?? null, note: out.row?.note ?? null }, usage: out.usage, over: overOf(st.limits, out.usage), payments: out.payments, requests: out.requests,
      plans: plans.filter((p) => p.edition === (out.row?.edition ?? st.edition)).map(publicPlan) });
  });

  /** Money received: the plan (if it changes), the months it pays for; paid-until moves on from today or from the last date. */
  r.post('/subscriptions/:orgId/payments', async (c) => {
    const s = need(c, 'billing.manage');
    const org = c.req.param('orgId');
    const b = await c.req.json<any>();
    const amount = Number(b.amount), months = Number(b.months ?? 1);
    if (!Number.isInteger(amount) || amount < 0 || amount > 1_000_000_000) bad('BAD_AMOUNT');
    if (!Number.isInteger(months) || months < 1 || months > 36) bad('BAD_MONTHS');
    const method = (METHODS as readonly string[]).includes(b.method) ? b.method : bad('BAD_METHOD');
    const plans = await plansOf(d.db);
    const out = await withSystem(d.db, async (tx) => {
      const [cur] = await tx.select().from(hemloSubscription).where(eq(hemloSubscription.organizationId, org));
      const [o] = rowsOf(await tx.execute(sql`select metadata from organization where id = ${org}`));
      if (!o) throw new HttpError(404, 'NOT_FOUND');
      let meta: any = {}; try { meta = JSON.parse(o.metadata ?? '{}'); } catch {}
      const edition = cur?.edition ?? meta.kind ?? 'store';
      const planId = b.planId ?? cur?.planId ?? null;
      if (planId && !plans.some((p) => p.id === planId && p.edition === edition)) bad('BAD_PLAN');
      const from = new Date(Math.max(Date.now(), cur?.status === 'active' && cur.paidUntil ? +cur.paidUntil : 0));
      const until = new Date(from); until.setMonth(until.getMonth() + months);
      const set = { status: 'active', paidUntil: until, planId, billing: b.billing === 'year' ? 'year' : b.billing === 'month' ? 'month' : cur?.billing ?? 'month', updatedAt: new Date(), updatedBy: s.userId,
        ...(b.price !== undefined ? { price: b.price == null || b.price === '' ? null : Number(b.price) } : {}) };
      const [sub] = cur ? await tx.update(hemloSubscription).set(set).where(eq(hemloSubscription.organizationId, org)).returning()
        : await tx.insert(hemloSubscription).values({ organizationId: org, edition, seats: 1, ...set }).returning();
      const [pay] = await tx.insert(hemloPayment).values({ id: newId(), organizationId: org, planId, amount, months, method, reference: text(b.reference, 120, 'BAD_TEXT'),
        note: text(b.note, 500, 'BAD_TEXT'), paidUntil: until, createdBy: s.userId }).returning();
      // a request for this plan is now done
      await tx.update(hemloPlanRequest).set({ status: 'done', handledBy: s.userId, handledAt: new Date() }).where(and(eq(hemloPlanRequest.organizationId, org), eq(hemloPlanRequest.status, 'new')));
      return { sub, pay };
    });
    forgetSubscription(org);
    await audit(d.db, { kind: 'admin.payment_recorded', userId: s.userId, organizationId: org, detail: { amount, months, method, planId: out.sub.planId, paidUntil: out.sub.paidUntil } });
    return c.json({ payment: out.pay, subscription: stateOf(out.sub, plans) }, 201);
  });

  r.patch('/plan-requests/:id', async (c) => {
    const s = need(c, 'billing.manage');
    const status = (await c.req.json<any>()).status;
    if (!['done', 'dismissed', 'new'].includes(status)) bad('BAD_STATUS');
    const [row] = await withSystem(d.db, (tx) => tx.update(hemloPlanRequest).set({ status, handledBy: s.userId, handledAt: new Date() }).where(eq(hemloPlanRequest.id, c.req.param('id'))).returning());
    if (!row) throw new HttpError(404, 'NOT_FOUND');
    return c.json({ request: row });
  });

  return r;
}
