// /v1/sys/ai: Hemlo's AI features for a business. Every call is checked against the business's monthly allowance, a
// daily cap, the owner's on/off switch, and (on the paid engine) Hemlo's monthly budget; every call is recorded.
import { Hono } from 'hono';
import { eq, isNull } from 'drizzle-orm';
import { withOrg } from '@hemlo/db';
import { sysProduct, sysSettings, sysSupplier, gymPlan } from '@hemlo/db/schema';
import { HttpError } from '../principal';
import { actor, type Actor } from './sys-common';
import { subscriptionOf } from '../subscription';
import { audit } from '@hemlo/auth/audit';
import { AiError, type Engine } from '../ai/engine';
import { engineFor, editionOf } from '../ai/router';
import { allowanceOf, snapshot, overBudget, record, DAILY_CAP, DEFAULT_BUDGET_USD } from '../ai/meter';
import { readInvoice, sampleRead, toDraft, type Catalogue } from '../ai/invoice';
import { planQuestion, answer, TOOLS, PERIODS, type Plan } from '../ai/ask';
import { readRegister, sampleRows, samplePage, toRows, type GymPlanLite } from '../ai/register';
import type { AppEnv, Deps } from '../types';

const MAX_IMAGE = 2_500_000; // characters of data URL (~1.8 MB of photo; the app sends ~200 KB)

export function aiRoutes(d: Deps) {
  const r = new Hono<AppEnv>();
  /** The business's AI state, and the engine for one of its jobs (the system's first job when none is named). */
  const FIRST: Record<string, string> = { store: 'invoice', gym: 'members', realestate: 're_describe', dental: 'ask' };
  const look = async (a: Actor, feature?: string) => {
    const [snap, sub] = await Promise.all([snapshot(d.db, a.organizationId), subscriptionOf(d.db, a.organizationId)]); // the subscription is remembered per server
    const edition = editionOf(sub, snap.kind);
    const engine = await engineFor(d, edition, feature ?? FIRST[edition] ?? 'invoice');
    return { engine, s: { demo: snap.demo, off: snap.off, used: snap.month, today: snap.day, allowance: allowanceOf(sub, snap.demo), available: engine?.name ?? null } };
  };
  const status = async (a: Actor, feature?: string) => (await look(a, feature)).s;
  /** May this business run one more AI action now, for this job? Throws the reason it can't; else the engine to use. */
  const gate = async (a: Actor, feature: string) => {
    const { s, engine } = await look(a, feature);
    if (s.off) throw new HttpError(403, 'AI_OFF');
    if (!engine) throw new HttpError(503, 'AI_UNAVAILABLE');
    if (s.used >= s.allowance) throw new HttpError(429, 'AI_LIMIT');
    if (s.today >= DAILY_CAP) throw new HttpError(429, 'AI_DAILY_LIMIT');
    if (engine.paid && await overBudget(d.db, Number(d.env.AI_BUDGET_USD) || DEFAULT_BUDGET_USD)) throw new HttpError(503, 'AI_BUSY');
    return { ...s, engine };
  };
  /** Run one AI call: timed, recorded (worked or not), and failures turned into one clear error. */
  const run = async <T,>(a: Actor, feature: string, e: Engine, fn: (e: Engine) => Promise<{ model: string; inputTokens: number; outputTokens: number; costMicros: number } & T>) => {
    const t0 = Date.now();
    try {
      const out = await fn(e);
      await record(d.db, a.organizationId, { userId: a.userId, feature, engine: e.name, model: out.model, inputTokens: out.inputTokens, outputTokens: out.outputTokens, costMicros: out.costMicros, ms: Date.now() - t0, ok: true });
      return out;
    } catch (err) {
      await record(d.db, a.organizationId, { userId: a.userId, feature, engine: e.name, ms: Date.now() - t0, ok: false }).catch(() => {});
      console.error('[ai]', feature, err instanceof Error ? err.message : err);
      throw new HttpError(503, err instanceof AiError && err.message === 'REFUSED' ? 'AI_REFUSED' : 'AI_FAILED');
    }
  };

  /** What the screens need: is AI on, which engine, how much of the month's allowance is used. */
  r.get('/', async (c) => c.json(await status(actor(c, 'reports', 'read'), c.req.query('feature') || undefined)));

  /** The owner switches AI off (or on) for the business. */
  r.put('/settings', async (c) => {
    const a = actor(c, 'settings', 'update');
    const b = await c.req.json<{ off?: boolean }>().catch(() => ({} as { off?: boolean }));
    await withOrg(d.db, a.organizationId, (tx) => tx.insert(sysSettings).values({ organizationId: a.organizationId, aiOff: !!b.off })
      .onConflictDoUpdate({ target: sysSettings.organizationId, set: { aiOff: !!b.off, updatedAt: new Date() } }));
    await audit(d.db, { kind: b.off ? 'ai.turned_off' : 'ai.turned_on', organizationId: a.organizationId, userId: a.userId });
    return c.json(await status(a));
  });

  /** Read a supplier invoice from a photo → a draft purchase (nothing is saved). { image } or { sample: true }. */
  r.post('/invoice', async (c) => {
    const a = actor(c, 'purchases', 'create');
    const b = await c.req.json<{ image?: string; sample?: boolean }>().catch(() => ({} as { image?: string; sample?: boolean }));
    const [catalogue, suppliers] = await withOrg(d.db, a.organizationId, async (tx) => [
      (await tx.select({ id: sysProduct.id, name: sysProduct.name, barcode: sysProduct.barcode, packSize: sysProduct.packSize, cost: sysProduct.cost, unit: sysProduct.unit })
        .from(sysProduct).where(isNull(sysProduct.archivedAt)).orderBy(sysProduct.name)) as Catalogue,
      await tx.select({ id: sysSupplier.id, name: sysSupplier.name }).from(sysSupplier).where(isNull(sysSupplier.archivedAt)),
    ] as const);
    if (b.sample) {
      // the ready-made sample: instant, free, not counted (it's the same photo every visitor sees)
      await record(d.db, a.organizationId, { userId: a.userId, feature: 'invoice', engine: 'sample', ms: 0, ok: true, counted: false });
      return c.json({ draft: toDraft(sampleRead(catalogue), catalogue, suppliers), engine: 'sample', ...(await status(a, 'invoice')) });
    }
    if (typeof b.image !== 'string' || !/^data:image\/(jpeg|png|webp);base64,/.test(b.image)) throw new HttpError(400, 'BAD_IMAGE');
    if (b.image.length > MAX_IMAGE) throw new HttpError(413, 'IMAGE_TOO_BIG');
    const { engine, ...st } = await gate(a, 'invoice');
    const out = await run(a, 'invoice', engine, (e) => readInvoice(e, b.image!, catalogue, suppliers));
    await audit(d.db, { kind: 'ai.invoice_read', organizationId: a.organizationId, userId: a.userId, detail: { lines: out.data.lines?.length ?? 0, engine: engine.name } });
    return c.json({ draft: toDraft(out.data, catalogue, suppliers), engine: engine.name, ...st, used: st.used + 1, today: st.today + 1 }); // no second status query
  });

  /** Read a page of a gym's register from a photo → member rows to check (nothing is saved). { image } or { sample: true }. */
  r.post('/members', async (c) => {
    const a = actor(c, 'members', 'create');
    const b = await c.req.json<{ image?: string; sample?: boolean }>().catch(() => ({} as { image?: string; sample?: boolean }));
    const day = new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10); // Baghdad
    const plans = (await withOrg(d.db, a.organizationId, (tx) => tx.select({ id: gymPlan.id, name: gymPlan.name, duration: gymPlan.duration, unit: gymPlan.unit })
      .from(gymPlan).where(eq(gymPlan.active, true)).orderBy(gymPlan.sort))) as GymPlanLite[];
    if (b.sample) {
      await record(d.db, a.organizationId, { userId: a.userId, feature: 'members', engine: 'sample', ms: 0, ok: true, counted: false });
      return c.json({ rows: sampleRows(plans, day), page: samplePage(day), engine: 'sample', ...(await status(a, 'members')) });
    }
    if (typeof b.image !== 'string' || !/^data:image\/(jpeg|png|webp);base64,/.test(b.image)) throw new HttpError(400, 'BAD_IMAGE');
    if (b.image.length > MAX_IMAGE) throw new HttpError(413, 'IMAGE_TOO_BIG');
    const { engine, ...st } = await gate(a, 'members');
    const out = await run(a, 'members', engine, (e) => readRegister(e, b.image!, plans, day));
    const rows = toRows(out.data, plans, day);
    await audit(d.db, { kind: 'ai.register_read', organizationId: a.organizationId, userId: a.userId, detail: { rows: rows.length, engine: engine.name } });
    return c.json({ rows, engine: engine.name, ...st, used: st.used + 1, today: st.today + 1 });
  });

  /** Ask the shop a question. { question } (AI picks the report, one action) or { plan } (a preset question: free). */
  r.post('/ask', async (c) => {
    const a = actor(c, 'reports', 'read');
    const b = await c.req.json<{ question?: string; plan?: Partial<Plan> }>().catch(() => ({} as { question?: string; plan?: Partial<Plan> }));
    let plan: Plan, st: Awaited<ReturnType<typeof status>> | null = null;
    if (b.plan) {
      if (!TOOLS.includes(b.plan.tool as any) || !PERIODS.includes((b.plan.period ?? 'today') as any)) throw new HttpError(400, 'BAD_PLAN');
      plan = { tool: b.plan.tool as Plan['tool'], period: (b.plan.period ?? 'today') as Plan['period'], name: String(b.plan.name ?? '').slice(0, 80) };
    } else {
      const question = String(b.question ?? '').trim();
      if (question.length < 2 || question.length > 400) throw new HttpError(400, 'BAD_QUESTION');
      const { engine, ...g } = await gate(a, 'ask');
      st = g;
      const out = await run(a, 'ask', engine, (e) => planQuestion(e, question));
      st = { ...st, used: st.used + 1, today: st.today + 1 };
      plan = { tool: TOOLS.includes(out.data.tool) ? out.data.tool : 'unknown', period: PERIODS.includes(out.data.period) ? out.data.period : 'today', name: String(out.data.name ?? '').slice(0, 80) };
    }
    const [ans, s2] = await Promise.all([answer(d.db, a.organizationId, plan), st ?? status(a, 'ask')]);
    return c.json({ answer: ans, ...s2 });
  });

  return r;
}
