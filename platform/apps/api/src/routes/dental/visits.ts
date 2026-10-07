// Visits: the notes, what was done (tooth by tooth), and the bill. The bill is an ordinary sale on the patient's account
// (sys_sale), so the cash drawer, receipts, FIB, the debt book and the reports all work as they do in a shop.
// Notes can be edited for a day by the dentist who wrote them; after that, corrections are added below, never erased.
import { Hono } from 'hono';
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { newId } from '@hemlo/core';
import type { Database } from '@hemlo/db';
import { sysSale, sysSaleLine, sysLedger, sysCustomer, dentVisit, dentVisitItem, dentProcedure, dentPlanItem, dentPlan, dentFinding, dentAppointment, dentPatient, dentRx, dentDentist } from '@hemlo/db/schema';
import { HttpError } from '../../principal';
import { actor, may, bad, text, iqd, openShiftId } from '../sys-common';
import { nextNumber } from '../systems-ops';
import { inClinic, patientOf, logAccess, tooth, surfaces, CURRENCIES, settingsOf, toIqd, myDentist } from './common';
import type { AppEnv, Deps } from '../../types';

const EDIT_HOURS = 24;
const RECALL_CATEGORIES = ['perio', 'preventive', 'diagnostic'];

export function dentalVisitRoutes(d: Deps) {
  const r = new Hono<AppEnv>();

  r.get('/patients/:id/visits', async (c) => {
    const a = actor(c, 'patients', 'read');
    const clinical = may(a.principal, 'clinical', 'read');
    const id = c.req.param('id');
    const out = await inClinic(d, a, async (tx) => {
      await patientOf(tx, id);
      if (clinical) await logAccess(tx, a, id, 'notes');
      const visits = await tx.select().from(dentVisit).where(eq(dentVisit.patientId, id)).orderBy(desc(dentVisit.at)).limit(300);
      const items = visits.length ? await tx.select().from(dentVisitItem).where(inArray(dentVisitItem.visitId, visits.map((v) => v.id))) : [];
      const sales = visits.some((v) => v.saleId) ? await tx.select().from(sysSale).where(inArray(sysSale.id, visits.map((v) => v.saleId!).filter(Boolean))) : [];
      const rx = clinical ? await tx.select().from(dentRx).where(eq(dentRx.patientId, id)).orderBy(desc(dentRx.createdAt)) : [];
      return visits.map((v) => {
        const s = sales.find((x) => x.id === v.saleId);
        return { id: v.id, at: v.at, dentistId: v.dentistId, appointmentId: v.appointmentId, createdBy: v.createdBy,
          ...(clinical ? { complaint: v.complaint, notes: v.notes, anesthesia: v.anesthesia, amendments: v.amendments, rx: rx.filter((x) => x.visitId === v.id) } : {}),
          items: items.filter((i) => i.visitId === v.id), sale: s ? { id: s.id, number: s.number, total: s.total, paid: s.paid, due: s.due, discount: s.discount, method: s.method, voidedAt: s.voidedAt } : null };
      });
    });
    return c.json({ visits: out });
  });

  /**
   * Record a visit and bill it. items: [{ procedureId?, name?, tooth?, surfaces?, price?, currency?, planItemId?, labCost? }].
   * payment: { paid, method } — what the patient pays now (the rest goes on their account).
   */
  r.post('/visits', async (c) => {
    const a = actor(c, 'clinical', 'write');
    const b = await c.req.json<any>();
    const items = Array.isArray(b.items) ? b.items : [];
    if (items.length > 50) bad('TOO_MANY_ITEMS');
    const discount = iqd(b.discount ?? 0, 'BAD_DISCOUNT')!;
    const paidIn = iqd(b.paid ?? 0, 'BAD_PAID')!;
    const method = ['cash', 'card', 'fib'].includes(b.method) ? b.method : 'cash';
    const out = await inClinic(d, a, async (tx) => {
      const patientId = String(b.patientId ?? '');
      const pat = await patientOf(tx, patientId);
      const s = await settingsOf(tx, a.organizationId);
      const me = await myDentist(tx, a);
      const dentistId = b.dentistId || me?.id || null;
      if (b.dentistId) { const [x] = await tx.select({ id: dentDentist.id }).from(dentDentist).where(eq(dentDentist.id, b.dentistId)); if (!x) bad('BAD_DENTIST'); }

      // price every item: from the plan, or the price list, or as typed; USD at today's rate
      const planItems = await tx.select().from(dentPlanItem).where(inArray(dentPlanItem.id, items.map((i: any) => i.planItemId).filter(Boolean).concat(['-'])));
      const procs = await tx.select().from(dentProcedure).where(inArray(dentProcedure.id, [...items.map((i: any) => i.procedureId), ...planItems.map((x) => x.procedureId)].filter(Boolean).concat(['-'])));
      const lines = items.map((i: any) => {
        const pi = i.planItemId ? planItems.find((x) => x.id === i.planItemId) ?? bad('BAD_PLAN_ITEM') : null;
        if (pi?.status === 'done') throw new HttpError(409, 'ALREADY_DONE');
        const proc = procs.find((x) => x.id === (i.procedureId ?? pi?.procedureId)) ?? (i.procedureId ? bad('BAD_PROCEDURE') : null);
        const currency = i.currency ?? pi?.currency ?? proc?.currency ?? 'IQD';
        if (!CURRENCIES.includes(currency)) bad('BAD_CURRENCY');
        const price = i.price != null ? (Number.isInteger(Number(i.price)) && Number(i.price) >= 0 ? Number(i.price) : bad('BAD_PRICE')) : pi?.price ?? proc?.price ?? 0;
        return { proc, pi, name: text(i.name ?? pi?.name ?? proc?.name, 120, 'BAD_NAME', true)!, tooth: tooth(i.tooth ?? pi?.tooth), surfaces: surfaces(i.surfaces ?? pi?.surfaces),
          currency, priceOriginal: price, amount: toIqd(currency, price, s.usdRate), labCost: iqd(i.labCost ?? 0, 'BAD_COST')! };
      });
      const subtotal = lines.reduce((t: number, l: any) => t + l.amount, 0);
      if (discount > subtotal) bad('BAD_DISCOUNT');
      const total = subtotal - discount;
      const paid = Math.min(paidIn, total), due = total - paid;

      // the bill (when anything was charged)
      let sale: typeof sysSale.$inferSelect | null = null;
      if (lines.length) {
        [sale] = await tx.insert(sysSale).values({ id: newId(), organizationId: a.organizationId, number: await nextNumber(tx, a.organizationId, 'sale'),
          userId: a.userId, deviceId: a.deviceId, customerId: patientId, subtotal, discount, total, paid, due,
          method: due === 0 ? method : paid > 0 ? 'mixed' : 'credit', cost: lines.reduce((t: number, l: any) => t + l.labCost, 0),
          note: 'dental', shiftId: paid > 0 && method === 'cash' ? await openShiftId(tx, a.deviceId) : null }).returning();
        await tx.insert(sysSaleLine).values(lines.map((l: any) => ({ id: newId(), organizationId: a.organizationId, saleId: sale!.id, productId: null,
          name: l.tooth ? `${l.name} · ${l.tooth}${l.surfaces ? ' ' + l.surfaces : ''}` : l.name, qty: 1, price: l.amount, total: l.amount, cost: l.labCost })));
        if (due > 0) {
          const [cu] = await tx.update(sysCustomer).set({ balance: sql`${sysCustomer.balance} + ${due}`, updatedAt: new Date() }).where(eq(sysCustomer.id, patientId)).returning();
          await tx.insert(sysLedger).values({ id: newId(), organizationId: a.organizationId, customerId: patientId, kind: 'sale', amount: due, balance: cu.balance, saleId: sale.id, userId: a.userId });
        }
      }

      const [visit] = await tx.insert(dentVisit).values({ id: newId(), organizationId: a.organizationId, patientId, appointmentId: b.appointmentId || null, dentistId,
        complaint: text(b.complaint, 500, 'BAD_TEXT'), notes: text(b.notes, 5000, 'BAD_TEXT'), anesthesia: text(b.anesthesia, 200, 'BAD_TEXT'), saleId: sale?.id ?? null, createdBy: a.userId }).returning();
      const vitems = lines.length ? await tx.insert(dentVisitItem).values(lines.map((l: any) => ({ id: newId(), organizationId: a.organizationId, visitId: visit.id, procedureId: l.proc?.id ?? null,
        name: l.name, tooth: l.tooth, surfaces: l.surfaces, currency: l.currency, priceOriginal: l.priceOriginal, usdRate: l.currency === 'USD' ? s.usdRate : null, amount: l.amount,
        dentistId, planItemId: l.pi?.id ?? null, labCost: l.labCost }))).returning() : [];

      // the chart and the plan catch up: planned → done, or a new "done" mark
      for (const l of lines as any[]) {
        if (l.pi) await tx.update(dentPlanItem).set({ status: 'done', visitId: visit.id }).where(eq(dentPlanItem.id, l.pi.id));
        const mark = l.proc?.mark;
        if (!l.tooth || !mark) continue;
        const moved = l.pi ? await tx.update(dentFinding).set({ status: 'done', visitId: visit.id }).where(and(eq(dentFinding.planItemId, l.pi.id), isNull(dentFinding.removedAt))).returning({ id: dentFinding.id }) : [];
        if (!moved.length) await tx.insert(dentFinding).values({ id: newId(), organizationId: a.organizationId, patientId, tooth: l.tooth, surfaces: l.surfaces, kind: mark, status: 'done', visitId: visit.id, createdBy: a.userId });
        if (mark === 'filling' || mark === 'rct' || mark === 'crown' || mark === 'missing' || mark === 'implant') // a treated cavity is no longer a cavity
          await tx.update(dentFinding).set({ removedAt: new Date() }).where(and(eq(dentFinding.patientId, patientId), eq(dentFinding.tooth, l.tooth), eq(dentFinding.kind, 'caries'), isNull(dentFinding.removedAt)));
      }
      const planIds = [...new Set((lines as any[]).filter((l) => l.pi).map((l) => l.pi.planId))];
      for (const pid of planIds) {
        const left = await tx.select({ id: dentPlanItem.id }).from(dentPlanItem).where(and(eq(dentPlanItem.planId, pid), eq(dentPlanItem.status, 'planned')));
        await tx.update(dentPlan).set({ status: left.length ? 'in_progress' : 'completed' }).where(eq(dentPlan.id, pid));
      }
      if (b.appointmentId) await tx.update(dentAppointment).set({ status: 'done', finishedAt: new Date() }).where(eq(dentAppointment.id, b.appointmentId));
      if ((lines as any[]).some((l) => RECALL_CATEGORIES.includes(l.proc?.category)) && s.recallMonths > 0) {
        const due6 = new Date(); due6.setMonth(due6.getMonth() + s.recallMonths);
        await tx.update(dentPatient).set({ recallDue: due6.toISOString().slice(0, 10), updatedAt: new Date() }).where(eq(dentPatient.customerId, patientId));
      }
      const [customer] = await tx.select().from(sysCustomer).where(eq(sysCustomer.id, patientId));
      return { visit, items: vitems, sale, customer, patient: { id: patientId, fileNo: pat.p.fileNo, name: pat.c.name } };
    });
    if (b.appointmentId) d.screens?.changed(a.organizationId);
    return c.json(out, 201);
  });

  /** Notes: editable for a day by whoever wrote them; after that, a correction is added below with who and when. */
  r.patch('/visits/:id', async (c) => {
    const a = actor(c, 'clinical', 'write');
    const b = await c.req.json<{ notes?: string; complaint?: string; anesthesia?: string; amendment?: string }>();
    const out = await inClinic(d, a, async (tx) => {
      const [v] = await tx.select().from(dentVisit).where(eq(dentVisit.id, c.req.param('id')));
      if (!v) throw new HttpError(404, 'NOT_FOUND');
      const open = Date.now() - +v.at < EDIT_HOURS * 3600_000 && v.createdBy === a.userId;
      if (b.amendment !== undefined || !open) {
        const t = text(b.amendment ?? b.notes, 2000, 'BAD_TEXT', true)!;
        const [row] = await tx.update(dentVisit).set({ amendments: [...v.amendments, { at: new Date().toISOString(), by: a.userId, text: t }] }).where(eq(dentVisit.id, v.id)).returning();
        return row;
      }
      const set: Partial<typeof dentVisit.$inferInsert> = {};
      if (b.notes !== undefined) set.notes = text(b.notes, 5000, 'BAD_TEXT');
      if (b.complaint !== undefined) set.complaint = text(b.complaint, 500, 'BAD_TEXT');
      if (b.anesthesia !== undefined) set.anesthesia = text(b.anesthesia, 200, 'BAD_TEXT');
      const [row] = await tx.update(dentVisit).set(set).where(eq(dentVisit.id, v.id)).returning();
      return row;
    });
    return c.json({ visit: out });
  });

  // ---------------- prescriptions ----------------
  r.post('/rx', async (c) => {
    const a = actor(c, 'clinical', 'write');
    const b = await c.req.json<any>();
    if (!Array.isArray(b.items) || !b.items.length || b.items.length > 12) bad('EMPTY_RX');
    const items = b.items.map((i: any) => ({ drug: text(i.drug, 120, 'BAD_DRUG', true)!, dose: text(i.dose, 60, 'BAD_TEXT') ?? undefined, how: text(i.how, 160, 'BAD_TEXT') ?? undefined,
      days: i.days == null || i.days === '' ? undefined : Number.isInteger(Number(i.days)) && Number(i.days) > 0 && Number(i.days) <= 90 ? Number(i.days) : bad('BAD_DAYS'), note: text(i.note, 160, 'BAD_TEXT') ?? undefined }));
    const [row] = await inClinic(d, a, async (tx) => {
      await patientOf(tx, String(b.patientId ?? ''));
      const me = await myDentist(tx, a);
      return tx.insert(dentRx).values({ id: newId(), organizationId: a.organizationId, patientId: b.patientId, visitId: b.visitId || null, dentistId: b.dentistId || me?.id || null,
        items, note: text(b.note, 300, 'BAD_TEXT'), createdBy: a.userId }).returning();
    });
    return c.json({ rx: row }, 201);
  });

  r.get('/patients/:id/rx', async (c) => {
    const a = actor(c, 'clinical', 'read');
    const rows = await inClinic(d, a, (tx) => tx.select().from(dentRx).where(eq(dentRx.patientId, c.req.param('id'))).orderBy(desc(dentRx.createdAt)).limit(200));
    return c.json({ rx: rows });
  });

  return r;
}
