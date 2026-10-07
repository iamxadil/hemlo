// Lab work (crowns, bridges, dentures…): sent → in progress → received → fitted, with due dates. A dental lab is a
// supplier (kind 'lab'); when the work comes back its cost goes onto what the clinic owes that lab.
import { Hono } from 'hono';
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { newId, normalizeIraqiPhone } from '@hemlo/core';
import { dentLabOrder, dentDentist, sysSupplier, sysSupplierLedger, sysCustomer } from '@hemlo/db/schema';
import { HttpError } from '../../principal';
import { actor, bad, text, iqd } from '../sys-common';
import { inClinic, patientOf, instant, myDentist } from './common';
import type { AppEnv, Deps } from '../../types';

const STATUSES = ['sent', 'in_progress', 'received', 'fitted', 'remake', 'canceled'] as const;
const OPEN = ['sent', 'in_progress', 'received', 'remake'];

export function dentalLabRoutes(d: Deps) {
  const r = new Hono<AppEnv>();

  r.get('/labs', async (c) => {
    const a = actor(c, 'lab', 'read');
    const rows = await inClinic(d, a, (tx) => tx.select().from(sysSupplier).where(and(eq(sysSupplier.kind, 'lab'), isNull(sysSupplier.archivedAt))).orderBy(asc(sysSupplier.name)));
    return c.json({ labs: rows });
  });
  r.post('/labs', async (c) => {
    const a = actor(c, 'lab', 'manage');
    const b = await c.req.json<{ name?: string; phone?: string }>();
    const phone = b.phone ? normalizeIraqiPhone(String(b.phone)) ?? bad('BAD_PHONE') : null;
    const [row] = await inClinic(d, a, (tx) => tx.insert(sysSupplier).values({ id: newId(), organizationId: a.organizationId, name: text(b.name, 100, 'BAD_NAME', true)!, phone, kind: 'lab' }).returning());
    return c.json({ lab: row }, 201);
  });

  r.get('/lab', async (c) => {
    const a = actor(c, 'lab', 'read');
    const which = c.req.query('status') ?? 'open';
    const patientId = c.req.query('patientId');
    const rows = await inClinic(d, a, (tx) => tx.select({ o: dentLabOrder, patient: sysCustomer.name, lab: sysSupplier.name, dentist: dentDentist.name }).from(dentLabOrder)
      .innerJoin(sysCustomer, eq(sysCustomer.id, dentLabOrder.patientId)).leftJoin(sysSupplier, eq(sysSupplier.id, dentLabOrder.labId)).leftJoin(dentDentist, eq(dentDentist.id, dentLabOrder.dentistId))
      .where(and(which === 'open' ? inArray(dentLabOrder.status, OPEN) : undefined, patientId ? eq(dentLabOrder.patientId, patientId) : undefined))
      .orderBy(sql`${dentLabOrder.dueAt} nulls last`, desc(dentLabOrder.sentAt)).limit(500));
    const now = Date.now();
    return c.json({ orders: rows.map((x) => ({ ...x.o, patientName: x.patient, labName: x.lab, dentistName: x.dentist,
      overdue: !!x.o.dueAt && +x.o.dueAt < now && ['sent', 'in_progress', 'remake'].includes(x.o.status) })) });
  });

  r.post('/lab', async (c) => {
    const a = actor(c, 'lab', 'manage');
    const b = await c.req.json<any>();
    const [row] = await inClinic(d, a, async (tx) => {
      await patientOf(tx, String(b.patientId ?? ''));
      if (b.labId) { const [l] = await tx.select({ id: sysSupplier.id }).from(sysSupplier).where(eq(sysSupplier.id, b.labId)); if (!l) bad('BAD_LAB'); }
      const me = await myDentist(tx, a);
      return tx.insert(dentLabOrder).values({ id: newId(), organizationId: a.organizationId, patientId: b.patientId, labId: b.labId || null, dentistId: b.dentistId || me?.id || null,
        work: text(b.work, 120, 'BAD_WORK', true)!, teeth: text(b.teeth, 60, 'BAD_TEXT'), shade: text(b.shade, 20, 'BAD_TEXT'), material: text(b.material, 60, 'BAD_TEXT'),
        note: text(b.note, 500, 'BAD_TEXT'), cost: iqd(b.cost ?? 0, 'BAD_COST')!, dueAt: b.dueAt ? instant(b.dueAt) : null, createdBy: a.userId }).returning();
    });
    return c.json({ order: row }, 201);
  });

  /** Move it along. The first time it's received, its cost goes on the lab's account. */
  r.patch('/lab/:id', async (c) => {
    const a = actor(c, 'lab', 'manage');
    const b = await c.req.json<any>();
    const out = await inClinic(d, a, async (tx) => {
      const [cur] = await tx.select().from(dentLabOrder).where(eq(dentLabOrder.id, c.req.param('id')));
      if (!cur) throw new HttpError(404, 'NOT_FOUND');
      const set: Partial<typeof dentLabOrder.$inferInsert> = {};
      if (b.cost !== undefined) { if (cur.receivedAt) throw new HttpError(409, 'ALREADY_BILLED'); set.cost = iqd(b.cost, 'BAD_COST')!; }
      if (b.dueAt !== undefined) set.dueAt = b.dueAt ? instant(b.dueAt) : null;
      if (b.note !== undefined) set.note = text(b.note, 500, 'BAD_TEXT');
      if (b.shade !== undefined) set.shade = text(b.shade, 20, 'BAD_TEXT');
      if (b.labId !== undefined) set.labId = b.labId || null;
      if (b.status !== undefined) {
        if (!STATUSES.includes(b.status)) bad('BAD_STATUS');
        set.status = b.status;
        if (b.status === 'received' && !cur.receivedAt) {
          set.receivedAt = new Date();
          const cost = set.cost ?? cur.cost, labId = set.labId !== undefined ? set.labId : cur.labId;
          if (cost > 0 && labId) {
            const [s] = await tx.update(sysSupplier).set({ balance: sql`${sysSupplier.balance} + ${cost}`, updatedAt: new Date() }).where(eq(sysSupplier.id, labId)).returning();
            await tx.insert(sysSupplierLedger).values({ id: newId(), organizationId: a.organizationId, supplierId: labId, kind: 'purchase', amount: cost, balance: s.balance, note: `${cur.work}${cur.teeth ? ' · ' + cur.teeth : ''}`, userId: a.userId });
          }
        }
        if (b.status === 'fitted') set.fittedAt = new Date();
      }
      const [row] = await tx.update(dentLabOrder).set(set).where(eq(dentLabOrder.id, cur.id)).returning();
      return row;
    });
    return c.json({ order: out });
  });

  return r;
}
