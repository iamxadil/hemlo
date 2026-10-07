// Patients: the file (profile, medical history and its alerts), search, the timeline, recalls, and who opened the file.
import { Hono } from 'hono';
import { and, desc, eq, gt, inArray, isNull, ne, sql } from 'drizzle-orm';
import { newId, normalizeIraqiPhone } from '@hemlo/core';
import { sysCustomer, sysLedger, sysSale, dentPatient, dentAppointment, dentVisit, dentVisitItem, dentPlan, dentRx, dentLabOrder, dentAccessLog, dentDentist, dentInstallment, dentConsent, user } from '@hemlo/db/schema';
import { HttpError } from '../../principal';
import { actor, may, bad, text } from '../sys-common';
import { nextNumber } from '../systems-ops';
import { inClinic, patientOf, alertsFrom, cleanMedical, logAccess, dateOnly } from './common';
import type { AppEnv, Deps } from '../../types';

const rowsOf = (r: any): any[] => (Array.isArray(r) ? r : r?.rows ?? []);

function profileInput(b: any) {
  const p: Partial<typeof dentPatient.$inferInsert> = {}, c: Partial<typeof sysCustomer.$inferInsert> = {};
  if (b.name !== undefined) c.name = text(b.name, 100, 'BAD_NAME', true)!;
  if (b.phone !== undefined) c.phone = b.phone ? normalizeIraqiPhone(String(b.phone)) ?? bad('BAD_PHONE') : null;
  if (b.gender !== undefined) p.gender = b.gender == null || b.gender === '' ? null : ['f', 'm'].includes(b.gender) ? b.gender : bad('BAD_GENDER');
  if (b.birthDate !== undefined) p.birthDate = dateOnly(b.birthDate, 'BAD_BIRTH_DATE');
  for (const k of ['address', 'occupation', 'referral', 'guardian'] as const) if (b[k] !== undefined) p[k] = text(b[k], 200, 'BAD_TEXT');
  if (b.notes !== undefined) p.notes = text(b.notes, 2000, 'BAD_TEXT');
  if (b.recallDue !== undefined) p.recallDue = dateOnly(b.recallDue);
  if (b.medical !== undefined) { p.medical = cleanMedical(b.medical); p.alerts = alertsFrom(p.medical); }
  return { p, c };
}
const card = (x: { p: typeof dentPatient.$inferSelect; c: typeof sysCustomer.$inferSelect }) => ({
  id: x.p.customerId, fileNo: x.p.fileNo, name: x.c.name, phone: x.c.phone, balance: x.c.balance, gender: x.p.gender, birthDate: x.p.birthDate,
  alerts: x.p.alerts, recallDue: x.p.recallDue, createdAt: x.p.createdAt,
});

export function dentalPatientRoutes(d: Deps) {
  const r = new Hono<AppEnv>();

  /** Search by name, phone or file number (empty: the most recent). */
  r.get('/patients', async (c) => {
    const a = actor(c, 'patients', 'read');
    const q = (c.req.query('q') ?? '').trim();
    const digits = q.replace(/\D/g, '');
    const rows = await inClinic(d, a, async (tx) => {
      const where = !q ? undefined
        : /^\d{1,6}$/.test(q) ? sql`(${dentPatient.fileNo} = ${Number(q)} or ${sysCustomer.phone} like ${'%' + digits + '%'})`
        : digits.length >= 4 ? sql`${sysCustomer.phone} like ${'%' + digits.replace(/^0/, '') + '%'}`
        : sql`${sysCustomer.name} ilike ${'%' + q + '%'}`;
      const list = await tx.select({ p: dentPatient, c: sysCustomer }).from(dentPatient).innerJoin(sysCustomer, eq(sysCustomer.id, dentPatient.customerId))
        .where(and(isNull(sysCustomer.archivedAt), where))
        .orderBy(...(/^\d{1,6}$/.test(q) ? [sql`(${dentPatient.fileNo} = ${Number(q)}) desc`] : []), desc(dentPatient.createdAt)).limit(q ? 50 : 30); // an exact file number first
      const ids = list.map((x) => x.p.customerId);
      const next = ids.length ? await tx.select({ patientId: dentAppointment.patientId, at: sql<string>`min(${dentAppointment.startsAt})` }).from(dentAppointment)
        .where(and(inArray(dentAppointment.patientId, ids), gt(dentAppointment.startsAt, new Date()), inArray(dentAppointment.status, ['booked', 'confirmed']))).groupBy(dentAppointment.patientId) : [];
      const last = ids.length ? await tx.select({ patientId: dentVisit.patientId, at: sql<string>`max(${dentVisit.at})` }).from(dentVisit).where(inArray(dentVisit.patientId, ids)).groupBy(dentVisit.patientId) : [];
      return list.map((x) => ({ ...card(x), nextAppointment: next.find((n) => n.patientId === x.p.customerId)?.at ?? null, lastVisit: last.find((n) => n.patientId === x.p.customerId)?.at ?? null }));
    });
    return c.json({ patients: rows });
  });

  r.post('/patients', async (c) => {
    const a = actor(c, 'patients', 'create');
    const b = await c.req.json<any>();
    const { p, c: cu } = profileInput({ medical: {}, ...b });
    if (!cu.name) bad('BAD_NAME');
    const out = await inClinic(d, a, async (tx) => {
      const id = newId();
      const [customer] = await tx.insert(sysCustomer).values({ id, organizationId: a.organizationId, name: cu.name!, phone: cu.phone ?? null, note: null }).returning();
      const [patient] = await tx.insert(dentPatient).values({ customerId: id, organizationId: a.organizationId, fileNo: await nextNumber(tx, a.organizationId, 'patient'), ...p } as any).returning();
      return card({ p: patient, c: customer });
    });
    return c.json({ patient: out }, 201);
  });

  /** The file: profile, medical history, alerts, balance, what's coming. Opening it is logged. */
  r.get('/patients/:id', async (c) => {
    const a = actor(c, 'patients', 'read');
    const id = c.req.param('id');
    const out = await inClinic(d, a, async (tx) => {
      const x = await patientOf(tx, id);
      await logAccess(tx, a, id, 'open');
      const upcoming = await tx.select().from(dentAppointment).where(and(eq(dentAppointment.patientId, id), gt(dentAppointment.startsAt, new Date(Date.now() - 3600_000)), inArray(dentAppointment.status, ['booked', 'confirmed', 'arrived', 'seated'])))
        .orderBy(dentAppointment.startsAt).limit(5);
      const [counts] = rowsOf(await tx.execute(sql`select
        (select count(*)::int from dent_visit where patient_id = ${id}) as visits,
        (select count(*)::int from dent_plan where patient_id = ${id} and status in ('proposed', 'accepted', 'in_progress')) as open_plans,
        (select count(*)::int from dent_lab_order where patient_id = ${id} and status in ('sent', 'in_progress', 'received')) as open_lab,
        (select count(*)::int from dent_image where patient_id = ${id}) as images,
        (select coalesce(sum(amount), 0)::int from dent_installment where patient_id = ${id} and paid_at is null and due_date <= (now() at time zone 'Asia/Baghdad')::date) as overdue`));
      return { patient: { ...card(x), address: x.p.address, occupation: x.p.occupation, referral: x.p.referral, guardian: x.p.guardian, notes: x.p.notes, medical: x.p.medical, updatedAt: x.p.updatedAt }, upcoming, counts };
    });
    return c.json(out);
  });

  r.patch('/patients/:id', async (c) => {
    const a = actor(c, 'patients', 'update');
    const { p, c: cu } = profileInput(await c.req.json<any>());
    const id = c.req.param('id');
    const out = await inClinic(d, a, async (tx) => {
      await patientOf(tx, id);
      if (Object.keys(cu).length) await tx.update(sysCustomer).set({ ...cu, updatedAt: new Date() }).where(eq(sysCustomer.id, id));
      if (Object.keys(p).length) await tx.update(dentPatient).set({ ...p, updatedAt: new Date() }).where(eq(dentPatient.customerId, id));
      return card(await patientOf(tx, id));
    });
    return c.json({ patient: out });
  });

  /** Everything that happened, newest first. Clinical details only for those allowed to read them. */
  r.get('/patients/:id/timeline', async (c) => {
    const a = actor(c, 'patients', 'read');
    const clinical = may(a.principal, 'clinical', 'read');
    const id = c.req.param('id');
    const events = await inClinic(d, a, async (tx) => {
      await patientOf(tx, id);
      const dentists = await tx.select({ id: dentDentist.id, name: dentDentist.name }).from(dentDentist);
      const dn = (x: string | null) => dentists.find((y) => y.id === x)?.name ?? null;
      const visits = await tx.select().from(dentVisit).where(eq(dentVisit.patientId, id)).orderBy(desc(dentVisit.at)).limit(200);
      const items = visits.length ? await tx.select().from(dentVisitItem).where(inArray(dentVisitItem.visitId, visits.map((v) => v.id))) : [];
      const sales = visits.some((v) => v.saleId) ? await tx.select().from(sysSale).where(inArray(sysSale.id, visits.map((v) => v.saleId!).filter(Boolean))) : [];
      const pays = await tx.select().from(sysLedger).where(and(eq(sysLedger.customerId, id), ne(sysLedger.kind, 'sale'))).orderBy(desc(sysLedger.at)).limit(200);
      const appts = await tx.select().from(dentAppointment).where(and(eq(dentAppointment.patientId, id), inArray(dentAppointment.status, ['no_show', 'canceled']))).limit(100);
      const plans = await tx.select().from(dentPlan).where(eq(dentPlan.patientId, id));
      const rx = clinical ? await tx.select().from(dentRx).where(eq(dentRx.patientId, id)) : [];
      const lab = await tx.select().from(dentLabOrder).where(eq(dentLabOrder.patientId, id));
      const consents = await tx.select({ id: dentConsent.id, kind: dentConsent.kind, signedAt: dentConsent.signedAt, signedName: dentConsent.signedName }).from(dentConsent).where(eq(dentConsent.patientId, id));
      const ev: any[] = [];
      for (const v of visits) {
        const s = sales.find((x) => x.id === v.saleId);
        ev.push({ type: 'visit', at: v.at, id: v.id, dentist: dn(v.dentistId), items: items.filter((i) => i.visitId === v.id).map((i) => ({ name: i.name, tooth: i.tooth, surfaces: i.surfaces, amount: i.amount })),
          total: s?.total ?? 0, paid: s?.paid ?? 0, voided: !!s?.voidedAt, ...(clinical ? { complaint: v.complaint, notes: v.notes, amendments: v.amendments } : {}) });
      }
      for (const l of pays) ev.push({ type: l.kind === 'payment' ? 'payment' : l.kind, at: l.at, id: l.id, amount: -l.amount, method: l.method, note: l.note });
      for (const x of appts) ev.push({ type: x.status, at: x.startsAt, id: x.id, dentist: dn(x.dentistId) });
      for (const p of plans) ev.push({ type: 'plan', at: p.createdAt, id: p.id, title: p.title, status: p.status });
      for (const x of rx) ev.push({ type: 'rx', at: x.createdAt, id: x.id, dentist: dn(x.dentistId), items: x.items });
      for (const x of lab) ev.push({ type: 'lab', at: x.sentAt, id: x.id, work: x.work, status: x.status });
      for (const x of consents) ev.push({ type: 'consent', at: x.signedAt, id: x.id, kind: x.kind, signedName: x.signedName });
      return ev.sort((p, q) => +new Date(q.at) - +new Date(p.at));
    });
    return c.json({ events });
  });

  /** Due for a check-up (recall date passed or within two weeks) and nothing booked yet. */
  r.get('/recalls', async (c) => {
    const a = actor(c, 'patients', 'read');
    const rows = await inClinic(d, a, async (tx) => tx.select({ p: dentPatient, c: sysCustomer }).from(dentPatient).innerJoin(sysCustomer, eq(sysCustomer.id, dentPatient.customerId))
      .where(and(sql`${dentPatient.recallDue} <= (now() at time zone 'Asia/Baghdad')::date + 14`, isNull(sysCustomer.archivedAt),
        sql`not exists (select 1 from dent_appointment x where x.patient_id = ${dentPatient.customerId} and x.starts_at > now() and x.status in ('booked', 'confirmed'))`))
      .orderBy(dentPatient.recallDue).limit(300));
    return c.json({ patients: rows.map(card) });
  });

  /** Who opened this file (owners and admins). */
  r.get('/patients/:id/access', async (c) => {
    const a = actor(c, 'clinic', 'configure');
    const rows = await inClinic(d, a, (tx) => tx.select({ at: dentAccessLog.at, action: dentAccessLog.action, name: user.name }).from(dentAccessLog)
      .leftJoin(user, eq(user.id, dentAccessLog.userId)).where(eq(dentAccessLog.patientId, c.req.param('id'))).orderBy(desc(dentAccessLog.at)).limit(300));
    return c.json({ access: rows });
  });

  /** Payment schedules: what's due soon or overdue, across the clinic. */
  r.get('/installments', async (c) => {
    const a = actor(c, 'patients', 'read');
    const rows = await inClinic(d, a, (tx) => tx.select({ i: dentInstallment, name: sysCustomer.name, phone: sysCustomer.phone }).from(dentInstallment)
      .innerJoin(sysCustomer, eq(sysCustomer.id, dentInstallment.patientId)).where(and(isNull(dentInstallment.paidAt), sql`${dentInstallment.dueDate} <= (now() at time zone 'Asia/Baghdad')::date + 7`))
      .orderBy(dentInstallment.dueDate).limit(300));
    return c.json({ installments: rows.map((x) => ({ ...x.i, name: x.name, phone: x.phone })) });
  });
  r.patch('/installments/:id', async (c) => {
    const a = actor(c, 'sales', 'create');
    const b = await c.req.json<{ paid?: boolean }>();
    const [row] = await inClinic(d, a, (tx) => tx.update(dentInstallment).set({ paidAt: b.paid ? new Date() : null }).where(eq(dentInstallment.id, c.req.param('id'))).returning());
    if (!row) throw new HttpError(404, 'NOT_FOUND');
    return c.json({ installment: row });
  });

  return r;
}
