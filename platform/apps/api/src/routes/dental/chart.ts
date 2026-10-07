// The dental chart (what's on each tooth: existing, planned, done), treatment plans with alternatives and quotes,
// and payment schedules for long treatments (braces, implants).
import { Hono } from 'hono';
import { and, asc, desc, eq, inArray, isNull, ne, sql } from 'drizzle-orm';
import { newId } from '@hemlo/core';
import type { Database } from '@hemlo/db';
import { dentFinding, dentPlan, dentPlanItem, dentProcedure, dentInstallment } from '@hemlo/db/schema';
import { HttpError } from '../../principal';
import { actor, bad, text, type Actor } from '../sys-common';
import { inClinic, patientOf, logAccess, tooth, surfaces, FINDINGS, CURRENCIES, settingsOf, toIqd, dateOnly } from './common';
import type { AppEnv, Deps } from '../../types';

const FSTATUS = ['existing', 'planned', 'done'] as const;
const PSTATUS = ['proposed', 'accepted', 'in_progress', 'completed', 'declined'] as const;

/** A plan with its items, and what it comes to in IQD today. */
async function planView(tx: Database, org: string, plans: (typeof dentPlan.$inferSelect)[]) {
  if (!plans.length) return [];
  const rate = (await settingsOf(tx, org)).usdRate;
  const items = await tx.select().from(dentPlanItem).where(inArray(dentPlanItem.planId, plans.map((p) => p.id))).orderBy(asc(dentPlanItem.phase), asc(dentPlanItem.sort));
  const inst = await tx.select().from(dentInstallment).where(inArray(dentInstallment.planId, plans.map((p) => p.id))).orderBy(asc(dentInstallment.dueDate));
  return plans.map((p) => {
    const mine = items.filter((i) => i.planId === p.id && i.status !== 'canceled');
    const iqd = mine.reduce((s, i) => s + toIqd(i.currency, i.price, rate), 0);
    const usd = mine.filter((i) => i.currency === 'USD').reduce((s, i) => s + i.price, 0);
    return { ...p, items: items.filter((i) => i.planId === p.id), installments: inst.filter((i) => i.planId === p.id),
      totals: { iqd, usd, net: Math.max(0, iqd - p.discount), done: mine.filter((i) => i.status === 'done').length, count: mine.length, rate } };
  });
}

async function itemFrom(tx: Database, b: any) {
  let proc: typeof dentProcedure.$inferSelect | null = null;
  if (b.procedureId) { [proc] = await tx.select().from(dentProcedure).where(eq(dentProcedure.id, String(b.procedureId))); if (!proc) bad('BAD_PROCEDURE'); }
  const currency = b.currency !== undefined ? (CURRENCIES.includes(b.currency) ? b.currency : bad('BAD_CURRENCY')) : proc?.currency ?? 'IQD';
  const price = b.price !== undefined && b.price !== null ? (Number.isInteger(Number(b.price)) && Number(b.price) >= 0 ? Number(b.price) : bad('BAD_PRICE')) : proc?.price ?? bad('BAD_PRICE');
  return { proc, procedureId: proc?.id ?? null, name: text(b.name ?? proc?.name, 120, 'BAD_NAME', true)!, tooth: tooth(b.tooth), surfaces: surfaces(b.surfaces),
    phase: Number.isInteger(Number(b.phase)) && Number(b.phase) > 0 ? Number(b.phase) : 1, currency, price };
}

export function dentalChartRoutes(d: Deps) {
  const r = new Hono<AppEnv>();

  // ---------------- the chart ----------------
  r.get('/patients/:id/chart', async (c) => {
    const a = actor(c, 'clinical', 'read');
    const id = c.req.param('id');
    const out = await inClinic(d, a, async (tx) => {
      await patientOf(tx, id);
      await logAccess(tx, a, id, 'chart');
      const all = await tx.select().from(dentFinding).where(eq(dentFinding.patientId, id)).orderBy(desc(dentFinding.createdAt)).limit(2000);
      return { findings: all.filter((f) => !f.removedAt), history: all };
    });
    return c.json(out);
  });

  /** Record findings on one or several teeth at once (e.g. "missing" on 18, 28, 38, 48). */
  r.post('/patients/:id/findings', async (c) => {
    const a = actor(c, 'clinical', 'write');
    const b = await c.req.json<any>();
    const teeth = (Array.isArray(b.teeth) ? b.teeth : [b.tooth]).map((t: unknown) => tooth(t, true)) as number[];
    if (!teeth.length || teeth.length > 52) bad('BAD_TOOTH');
    const kind = FINDINGS.includes(b.kind) ? b.kind : bad('BAD_KIND');
    const status = FSTATUS.includes(b.status ?? 'existing') ? (b.status ?? 'existing') : bad('BAD_STATUS');
    const rows = await inClinic(d, a, async (tx) => {
      await patientOf(tx, c.req.param('id'));
      return tx.insert(dentFinding).values(teeth.map((t) => ({ id: newId(), organizationId: a.organizationId, patientId: c.req.param('id'), tooth: t, surfaces: surfaces(b.surfaces),
        kind, status, note: text(b.note, 300, 'BAD_TEXT'), createdBy: a.userId }))).returning();
    });
    return c.json({ findings: rows }, 201);
  });

  r.patch('/findings/:id', async (c) => {
    const a = actor(c, 'clinical', 'write');
    const b = await c.req.json<any>();
    const set: Partial<typeof dentFinding.$inferInsert> = {};
    if (b.status !== undefined) set.status = FSTATUS.includes(b.status) ? b.status : bad('BAD_STATUS');
    if (b.surfaces !== undefined) set.surfaces = surfaces(b.surfaces);
    if (b.note !== undefined) set.note = text(b.note, 300, 'BAD_TEXT');
    const [row] = await inClinic(d, a, (tx) => tx.update(dentFinding).set(set).where(and(eq(dentFinding.id, c.req.param('id')), isNull(dentFinding.removedAt))).returning());
    if (!row) throw new HttpError(404, 'NOT_FOUND');
    return c.json({ finding: row });
  });

  /** Taken off the chart (kept in the history). */
  r.delete('/findings/:id', async (c) => {
    const a = actor(c, 'clinical', 'write');
    const [row] = await inClinic(d, a, (tx) => tx.update(dentFinding).set({ removedAt: new Date() }).where(and(eq(dentFinding.id, c.req.param('id')), isNull(dentFinding.removedAt))).returning());
    if (!row) throw new HttpError(404, 'NOT_FOUND');
    return c.json({ ok: true });
  });

  // ---------------- treatment plans ----------------
  r.get('/patients/:id/plans', async (c) => {
    const a = actor(c, 'patients', 'read');
    const plans = await inClinic(d, a, async (tx) => planView(tx, a.organizationId, await tx.select().from(dentPlan).where(eq(dentPlan.patientId, c.req.param('id'))).orderBy(desc(dentPlan.createdAt))));
    return c.json({ plans });
  });

  /** A plan: procedures on teeth, priced from the list (IQD or USD). Each item on a tooth shows as "planned" on the chart. */
  r.post('/plans', async (c) => {
    const a = actor(c, 'clinical', 'write');
    const b = await c.req.json<any>();
    if (!Array.isArray(b.items) || !b.items.length || b.items.length > 100) bad('EMPTY_PLAN');
    const out = await inClinic(d, a, async (tx) => {
      const patientId = String(b.patientId ?? '');
      await patientOf(tx, patientId);
      const [plan] = await tx.insert(dentPlan).values({ id: newId(), organizationId: a.organizationId, patientId, title: text(b.title, 120, 'BAD_TITLE', true)!,
        kind: ['general', 'ortho', 'implant'].includes(b.kind) ? b.kind : 'general', optionGroup: text(b.optionGroup, 40, 'BAD_TEXT'),
        discount: Number.isInteger(Number(b.discount ?? 0)) && Number(b.discount ?? 0) >= 0 ? Number(b.discount ?? 0) : bad('BAD_DISCOUNT'),
        note: text(b.note, 1000, 'BAD_TEXT'), dentistId: b.dentistId || null, createdBy: a.userId }).returning();
      await addItems(tx, a, plan, b.items);
      return (await planView(tx, a.organizationId, [plan]))[0];
    });
    return c.json({ plan: out }, 201);
  });

  /** Accept (the other options in its group are declined), decline, rename, discount. */
  r.patch('/plans/:id', async (c) => {
    const a = actor(c, 'patients', 'update');
    const b = await c.req.json<any>();
    const out = await inClinic(d, a, async (tx) => {
      const [cur] = await tx.select().from(dentPlan).where(eq(dentPlan.id, c.req.param('id')));
      if (!cur) throw new HttpError(404, 'NOT_FOUND');
      const set: Partial<typeof dentPlan.$inferInsert> = {};
      if (b.title !== undefined) set.title = text(b.title, 120, 'BAD_TITLE', true)!;
      if (b.note !== undefined) set.note = text(b.note, 1000, 'BAD_TEXT');
      if (b.discount !== undefined) set.discount = Number.isInteger(Number(b.discount)) && Number(b.discount) >= 0 ? Number(b.discount) : bad('BAD_DISCOUNT');
      if (b.status !== undefined) {
        if (!PSTATUS.includes(b.status)) bad('BAD_STATUS');
        set.status = b.status; set.decidedAt = new Date();
        if (b.status === 'accepted' && cur.optionGroup) {
          const others = await tx.update(dentPlan).set({ status: 'declined', decidedAt: new Date() })
            .where(and(eq(dentPlan.patientId, cur.patientId), eq(dentPlan.optionGroup, cur.optionGroup), ne(dentPlan.id, cur.id), inArray(dentPlan.status, ['proposed']))).returning({ id: dentPlan.id });
          if (others.length) await dropPlanned(tx, others.map((o) => o.id));
        }
        if (b.status === 'declined') await dropPlanned(tx, [cur.id]);
      }
      const [row] = await tx.update(dentPlan).set(set).where(eq(dentPlan.id, cur.id)).returning();
      return (await planView(tx, a.organizationId, [row]))[0];
    });
    return c.json({ plan: out });
  });

  r.post('/plans/:id/items', async (c) => {
    const a = actor(c, 'clinical', 'write');
    const b = await c.req.json<any>();
    const out = await inClinic(d, a, async (tx) => {
      const [plan] = await tx.select().from(dentPlan).where(eq(dentPlan.id, c.req.param('id')));
      if (!plan) throw new HttpError(404, 'NOT_FOUND');
      await addItems(tx, a, plan, Array.isArray(b.items) ? b.items : [b]);
      return (await planView(tx, a.organizationId, [plan]))[0];
    });
    return c.json({ plan: out }, 201);
  });

  r.patch('/plan-items/:id', async (c) => {
    const a = actor(c, 'clinical', 'write');
    const b = await c.req.json<any>();
    const out = await inClinic(d, a, async (tx) => {
      const [cur] = await tx.select().from(dentPlanItem).where(eq(dentPlanItem.id, c.req.param('id')));
      if (!cur) throw new HttpError(404, 'NOT_FOUND');
      const set: Partial<typeof dentPlanItem.$inferInsert> = {};
      if (b.price !== undefined) set.price = Number.isInteger(Number(b.price)) && Number(b.price) >= 0 ? Number(b.price) : bad('BAD_PRICE');
      if (b.currency !== undefined) set.currency = CURRENCIES.includes(b.currency) ? b.currency : bad('BAD_CURRENCY');
      if (b.phase !== undefined) set.phase = Number.isInteger(Number(b.phase)) && Number(b.phase) > 0 ? Number(b.phase) : bad('BAD_PHASE');
      if (b.status !== undefined) {
        if (!['planned', 'canceled'].includes(b.status)) bad('BAD_STATUS'); // "done" only comes from a visit
        if (cur.status === 'done') throw new HttpError(409, 'ALREADY_DONE');
        set.status = b.status;
        if (b.status === 'canceled') await tx.update(dentFinding).set({ removedAt: new Date() }).where(and(eq(dentFinding.planItemId, cur.id), eq(dentFinding.status, 'planned'), isNull(dentFinding.removedAt)));
      }
      await tx.update(dentPlanItem).set(set).where(eq(dentPlanItem.id, cur.id));
      const [plan] = await tx.select().from(dentPlan).where(eq(dentPlan.id, cur.planId));
      return (await planView(tx, a.organizationId, [plan]))[0];
    });
    return c.json({ plan: out });
  });

  /** A payment schedule: an optional first payment, then equal monthly amounts (IQD, rounded to 250). Replaces unpaid ones. */
  r.post('/plans/:id/installments', async (c) => {
    const a = actor(c, 'sales', 'create');
    const b = await c.req.json<{ months?: number; firstDue?: string; downPayment?: number; total?: number }>();
    const months = Number(b.months);
    if (!Number.isInteger(months) || months < 1 || months > 60) bad('BAD_MONTHS');
    const first = dateOnly(b.firstDue) ?? new Date().toISOString().slice(0, 10);
    const out = await inClinic(d, a, async (tx) => {
      const [plan] = await tx.select().from(dentPlan).where(eq(dentPlan.id, c.req.param('id')));
      if (!plan) throw new HttpError(404, 'NOT_FOUND');
      const [view] = await planView(tx, a.organizationId, [plan]);
      const total = b.total != null ? Number(b.total) : view.totals.net;
      const down = Math.max(0, Math.min(total, Number(b.downPayment ?? 0) || 0));
      if (!Number.isInteger(total) || total <= 0) bad('BAD_TOTAL');
      await tx.delete(dentInstallment).where(and(eq(dentInstallment.planId, plan.id), isNull(dentInstallment.paidAt)));
      const each = Math.floor((total - down) / months / 250) * 250, last = total - down - each * (months - 1);
      const start = new Date(first + 'T00:00:00Z');
      const rows = [
        ...(down ? [{ dueDate: first, amount: down, note: 'down payment' }] : []),
        ...Array.from({ length: months }, (_, i) => {
          const dt = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i + (down ? 1 : 0), start.getUTCDate()));
          return { dueDate: dt.toISOString().slice(0, 10), amount: i === months - 1 ? last : each, note: null as string | null };
        }),
      ];
      await tx.insert(dentInstallment).values(rows.map((x) => ({ id: newId(), organizationId: a.organizationId, patientId: plan.patientId, planId: plan.id, ...x })));
      return (await planView(tx, a.organizationId, [plan]))[0];
    });
    return c.json({ plan: out }, 201);
  });

  return r;
}

async function addItems(tx: Database, a: Actor, plan: typeof dentPlan.$inferSelect, list: any[]) {
  const res: any = await tx.execute(sql`select coalesce(max(sort), 0)::int as n from dent_plan_item where plan_id = ${plan.id}`);
  let sort = Number((Array.isArray(res) ? res : res.rows)[0]?.n ?? 0);
  for (const raw of list) {
    const it = await itemFrom(tx, raw);
    const [item] = await tx.insert(dentPlanItem).values({ id: newId(), organizationId: a.organizationId, planId: plan.id, procedureId: it.procedureId, name: it.name,
      tooth: it.tooth, surfaces: it.surfaces, phase: it.phase, currency: it.currency, price: it.price, sort: ++sort }).returning();
    if (it.tooth && it.proc?.mark) await tx.insert(dentFinding).values({ id: newId(), organizationId: a.organizationId, patientId: plan.patientId, tooth: it.tooth,
      surfaces: it.surfaces, kind: it.proc.mark, status: 'planned', planItemId: item.id, createdBy: a.userId });
  }
}
async function dropPlanned(tx: Database, planIds: string[]) {
  const items = await tx.select({ id: dentPlanItem.id }).from(dentPlanItem).where(inArray(dentPlanItem.planId, planIds));
  if (items.length) await tx.update(dentFinding).set({ removedAt: new Date() }).where(and(inArray(dentFinding.planItemId, items.map((i) => i.id)), eq(dentFinding.status, 'planned'), isNull(dentFinding.removedAt)));
}
