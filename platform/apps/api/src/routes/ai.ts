// /v1/sys/ai: Hemlo's AI features for a business. Every call is checked against the business's monthly allowance, a
// daily cap, the owner's on/off switch, and (on the paid engine) Hemlo's monthly budget; every call is recorded.
import { Hono } from 'hono';
import { isNull } from 'drizzle-orm';
import { withOrg } from '@hemlo/db';
import { sysProduct, sysSettings, sysSupplier } from '@hemlo/db/schema';
import { HttpError } from '../principal';
import { actor, type Actor } from './sys-common';
import { subscriptionOf } from '../subscription';
import { audit } from '@hemlo/auth/audit';
import { AiError, type Engine } from '../ai/engine';
import { allowanceOf, snapshot, overBudget, record, DAILY_CAP, DEFAULT_BUDGET_USD } from '../ai/meter';
import { readInvoice, sampleRead, toDraft, type Catalogue } from '../ai/invoice';
import { planQuestion, answer, TOOLS, PERIODS, type Plan } from '../ai/ask';
import type { AppEnv, Deps } from '../types';

const MAX_IMAGE = 2_500_000; // characters of data URL (~1.8 MB of photo; the app sends ~200 KB)

export function aiRoutes(d: Deps) {
  const r = new Hono<AppEnv>();
  const engine = (): Engine | undefined => d.ai;

  const status = async (a: Actor) => {
    const [snap, sub] = await Promise.all([snapshot(d.db, a.organizationId), subscriptionOf(d.db, a.organizationId)]); // the subscription is remembered per server
    return { demo: snap.demo, off: snap.off, used: snap.month, today: snap.day, allowance: allowanceOf(sub, snap.demo), available: engine()?.name ?? null };
  };
  /** May this business run one more AI action now? Throws the reason it can't. */
  const gate = async (a: Actor) => {
    const s = await status(a);
    if (s.off) throw new HttpError(403, 'AI_OFF');
    if (!engine()) throw new HttpError(503, 'AI_UNAVAILABLE');
    if (s.used >= s.allowance) throw new HttpError(429, 'AI_LIMIT');
    if (s.today >= DAILY_CAP) throw new HttpError(429, 'AI_DAILY_LIMIT');
    if (engine()!.name === 'claude' && await overBudget(d.db, Number(d.env.AI_BUDGET_USD) || DEFAULT_BUDGET_USD)) throw new HttpError(503, 'AI_BUSY');
    return s;
  };
  /** Run one AI call: timed, recorded (worked or not), and failures turned into one clear error. */
  const run = async <T,>(a: Actor, feature: string, fn: (e: Engine) => Promise<{ model: string; inputTokens: number; outputTokens: number; costMicros: number } & T>) => {
    const e = engine()!, t0 = Date.now();
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
  r.get('/', async (c) => c.json(await status(actor(c, 'reports', 'read'))));

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
      return c.json({ draft: toDraft(sampleRead(catalogue), catalogue, suppliers), engine: 'sample', ...(await status(a)) });
    }
    if (typeof b.image !== 'string' || !/^data:image\/(jpeg|png|webp);base64,/.test(b.image)) throw new HttpError(400, 'BAD_IMAGE');
    if (b.image.length > MAX_IMAGE) throw new HttpError(413, 'IMAGE_TOO_BIG');
    const st = await gate(a);
    const out = await run(a, 'invoice', (e) => readInvoice(e, b.image!, catalogue, suppliers));
    await audit(d.db, { kind: 'ai.invoice_read', organizationId: a.organizationId, userId: a.userId, detail: { lines: out.data.lines?.length ?? 0, engine: d.ai!.name } });
    return c.json({ draft: toDraft(out.data, catalogue, suppliers), engine: d.ai!.name, ...st, used: st.used + 1, today: st.today + 1 }); // no second status query
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
      st = await gate(a);
      const out = await run(a, 'ask', (e) => planQuestion(e, question));
      st = { ...st, used: st.used + 1, today: st.today + 1 };
      plan = { tool: TOOLS.includes(out.data.tool) ? out.data.tool : 'unknown', period: PERIODS.includes(out.data.period) ? out.data.period : 'today', name: String(out.data.name ?? '').slice(0, 80) };
    }
    const [ans, s2] = await Promise.all([answer(d.db, a.organizationId, plan), st ?? status(a)]);
    return c.json({ answer: ans, ...s2 });
  });

  return r;
}
