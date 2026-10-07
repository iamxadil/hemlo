// The schedule: appointments per dentist and chair, no double-booking, the day's flow (booked → confirmed → arrived →
// in the chair → done, or no-show), WhatsApp reminders, and the waiting-room queue.
import { Hono } from 'hono';
import { and, asc, eq, gt, gte, inArray, lt, ne, notInArray, or, sql } from 'drizzle-orm';
import { newId } from '@hemlo/core';
import { dentAppointment, dentDentist, dentChair, dentPatient, sysCustomer } from '@hemlo/db/schema';
import { organization } from '@hemlo/db/schema';
import { HttpError } from '../../principal';
import { actor, bad, text, type Actor } from '../sys-common';
import { inClinic, instant, settingsOf } from './common';
import type { Database } from '@hemlo/db';
import type { AppEnv, Deps } from '../../types';

const STATUSES = ['booked', 'confirmed', 'arrived', 'seated', 'done', 'no_show', 'canceled'] as const;
const INACTIVE = ['no_show', 'canceled'];
const STAMP: Record<string, keyof typeof dentAppointment.$inferInsert> = { arrived: 'arrivedAt', seated: 'seatedAt', done: 'finishedAt' };

/** Another appointment in the same chair, or with the same dentist, at an overlapping time. */
async function clash(tx: Database, x: { id?: string; startsAt: Date; endsAt: Date; chairId: string | null; dentistId: string | null }) {
  if (!x.chairId && !x.dentistId) return null;
  const same = [x.chairId ? eq(dentAppointment.chairId, x.chairId) : undefined, x.dentistId ? eq(dentAppointment.dentistId, x.dentistId) : undefined].filter(Boolean) as any[];
  const [row] = await tx.select({ id: dentAppointment.id, startsAt: dentAppointment.startsAt, endsAt: dentAppointment.endsAt }).from(dentAppointment)
    .where(and(or(...same), lt(dentAppointment.startsAt, x.endsAt), gt(dentAppointment.endsAt, x.startsAt), notInArray(dentAppointment.status, INACTIVE), x.id ? ne(dentAppointment.id, x.id) : undefined)).limit(1);
  return row ?? null;
}

async function withNames(tx: Database, rows: (typeof dentAppointment.$inferSelect)[]) {
  const ids = [...new Set(rows.map((x) => x.patientId))];
  const people = ids.length ? await tx.select({ id: dentPatient.customerId, fileNo: dentPatient.fileNo, alerts: dentPatient.alerts, name: sysCustomer.name, phone: sysCustomer.phone, balance: sysCustomer.balance })
    .from(dentPatient).innerJoin(sysCustomer, eq(sysCustomer.id, dentPatient.customerId)).where(inArray(dentPatient.customerId, ids)) : [];
  return rows.map((x) => ({ ...x, patient: people.find((p) => p.id === x.patientId) ?? null }));
}

export function dentalScheduleRoutes(d: Deps) {
  const r = new Hono<AppEnv>();

  r.get('/appointments', async (c) => {
    const a = actor(c, 'appointments', 'read');
    const from = instant(c.req.query('from') ?? new Date(Date.now() - 86400_000).toISOString());
    const to = instant(c.req.query('to') ?? new Date(Date.now() + 7 * 86400_000).toISOString());
    if (+to - +from > 62 * 86400_000) bad('RANGE_TOO_LONG');
    const rows = await inClinic(d, a, async (tx) => withNames(tx, await tx.select().from(dentAppointment)
      .where(and(gte(dentAppointment.startsAt, from), lt(dentAppointment.startsAt, to), c.req.query('dentistId') ? eq(dentAppointment.dentistId, c.req.query('dentistId')!) : undefined,
        c.req.query('patientId') ? eq(dentAppointment.patientId, c.req.query('patientId')!) : undefined))
      .orderBy(asc(dentAppointment.startsAt))));
    return c.json({ appointments: rows });
  });

  /** Book. A clash with the same chair or dentist is refused unless `force` (a deliberate double-booking). */
  r.post('/appointments', async (c) => {
    const a = actor(c, 'appointments', 'manage');
    const b = await c.req.json<any>();
    const startsAt = instant(b.startsAt);
    const endsAt = b.endsAt ? instant(b.endsAt) : new Date(startsAt.getTime() + (Number(b.minutes) > 0 ? Number(b.minutes) : 30) * 60_000);
    if (endsAt <= startsAt || +endsAt - +startsAt > 8 * 3600_000) bad('BAD_TIME');
    const out = await inClinic(d, a, async (tx) => {
      const [p] = await tx.select({ id: dentPatient.customerId }).from(dentPatient).where(eq(dentPatient.customerId, String(b.patientId ?? '')));
      if (!p) throw new HttpError(404, 'PATIENT_NOT_FOUND');
      await refs(tx, b.dentistId, b.chairId);
      const x = { startsAt, endsAt, chairId: b.chairId ?? null, dentistId: b.dentistId ?? null };
      const hit = b.force ? null : await clash(tx, x);
      if (hit) throw new HttpError(409, 'SLOT_TAKEN');
      const [row] = await tx.insert(dentAppointment).values({ id: newId(), organizationId: a.organizationId, patientId: p.id, ...x,
        reason: text(b.reason, 120, 'BAD_TEXT'), note: text(b.note, 500, 'BAD_TEXT'), bookedBy: a.userId, status: b.status === 'arrived' ? 'arrived' : 'booked',
        arrivedAt: b.status === 'arrived' ? new Date() : null }).returning();
      return (await withNames(tx, [row]))[0];
    });
    d.screens?.changed(a.organizationId);
    return c.json({ appointment: out }, 201);
  });

  /** Move, change, or step through the day (confirmed, arrived, seated, done, no-show, canceled). */
  r.patch('/appointments/:id', async (c) => {
    const a = actor(c, 'appointments', 'manage');
    const b = await c.req.json<any>();
    const out = await inClinic(d, a, async (tx) => {
      const [cur] = await tx.select().from(dentAppointment).where(eq(dentAppointment.id, c.req.param('id')));
      if (!cur) throw new HttpError(404, 'NOT_FOUND');
      const set: Partial<typeof dentAppointment.$inferInsert> = {};
      if (b.startsAt !== undefined) set.startsAt = instant(b.startsAt);
      if (b.endsAt !== undefined) set.endsAt = instant(b.endsAt);
      else if (b.startsAt !== undefined) set.endsAt = new Date(set.startsAt!.getTime() + (+cur.endsAt - +cur.startsAt));
      if (b.dentistId !== undefined) set.dentistId = b.dentistId || null;
      if (b.chairId !== undefined) set.chairId = b.chairId || null;
      if (b.reason !== undefined) set.reason = text(b.reason, 120, 'BAD_TEXT');
      if (b.note !== undefined) set.note = text(b.note, 500, 'BAD_TEXT');
      if (b.status !== undefined) {
        if (!STATUSES.includes(b.status)) bad('BAD_STATUS');
        set.status = b.status;
        const stamp = STAMP[b.status];
        if (stamp && !(cur as any)[stamp]) (set as any)[stamp] = new Date();
      }
      await refs(tx, set.dentistId, set.chairId);
      const moved = set.startsAt || set.endsAt || set.chairId !== undefined || set.dentistId !== undefined;
      if (moved && !b.force && !INACTIVE.includes(set.status ?? cur.status)) {
        const x = { id: cur.id, startsAt: set.startsAt ?? cur.startsAt, endsAt: set.endsAt ?? cur.endsAt, chairId: set.chairId !== undefined ? set.chairId : cur.chairId, dentistId: set.dentistId !== undefined ? set.dentistId : cur.dentistId };
        if (x.endsAt <= x.startsAt) bad('BAD_TIME');
        if (await clash(tx, x)) throw new HttpError(409, 'SLOT_TAKEN');
      }
      const [row] = await tx.update(dentAppointment).set(set).where(eq(dentAppointment.id, cur.id)).returning();
      return (await withNames(tx, [row]))[0];
    });
    d.screens?.changed(a.organizationId);
    return c.json({ appointment: out });
  });

  /** A WhatsApp reminder, ready to send from the clinic's phone (and marked as reminded). */
  r.post('/appointments/:id/remind', async (c) => {
    const a = actor(c, 'appointments', 'manage');
    const asked = (await c.req.json<{ lang?: string }>().catch(() => ({} as any))).lang;
    const lang: 'ar' | 'en' | 'ckb' = asked === 'en' || asked === 'ckb' ? asked : 'ar';
    const out = await inClinic(d, a, async (tx) => {
      const [x] = await tx.select().from(dentAppointment).where(eq(dentAppointment.id, c.req.param('id')));
      if (!x) throw new HttpError(404, 'NOT_FOUND');
      const [p] = await withNames(tx, [x]);
      const [org] = await tx.select({ name: organization.name }).from(organization).where(eq(organization.id, a.organizationId));
      const [dent] = x.dentistId ? await tx.select({ name: dentDentist.name }).from(dentDentist).where(eq(dentDentist.id, x.dentistId)) : [];
      const s = await settingsOf(tx, a.organizationId);
      const when = new Date(x.startsAt);
      const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : lang === 'ckb' ? 'ckb-IQ-u-nu-latn' : 'ar-IQ-u-nu-latn', { timeZone: 'Asia/Baghdad', ...o }).format(when);
      const vars: Record<string, string> = { name: p.patient?.name ?? '', clinic: org?.name ?? '', date: fmt({ weekday: 'long', day: 'numeric', month: 'long' }), time: fmt({ hour: 'numeric', minute: '2-digit' }), dentist: dent?.name ?? '' };
      const tpl = s.reminderText || {
        ar: 'مرحباً {name}، نذكّرك بموعدك في {clinic} يوم {date} الساعة {time}{dentist_line}. للتأكيد أو التغيير ردّ على هذه الرسالة.',
        ckb: 'سڵاو {name}، بیرت دەخەینەوە بە چاوپێکەوتنەکەت لە {clinic} ڕۆژی {date} کاتژمێر {time}{dentist_line}. بۆ دڵنیاکردنەوە یان گۆڕین وەڵامی ئەم نامەیە بدەرەوە.',
        en: 'Hello {name}, a reminder of your appointment at {clinic} on {date} at {time}{dentist_line}. Reply to confirm or change it.',
      }[lang];
      const message = tpl.replace('{dentist_line}', vars.dentist ? ({ ar: ` مع د. ${vars.dentist}`, ckb: ` لەگەڵ د. ${vars.dentist}`, en: ` with Dr ${vars.dentist}` }[lang]) : '').replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
      await tx.update(dentAppointment).set({ remindedAt: new Date() }).where(eq(dentAppointment.id, x.id));
      const phone = (p.patient?.phone ?? '').replace(/\D/g, '');
      return { message, whatsappUrl: phone ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}` : null };
    });
    return c.json(out);
  });

  /** The waiting room: who has arrived, who is in the chair (a screen in the clinic polls this). */
  r.get('/queue', async (c) => {
    const a = actor(c, 'appointments', 'read');
    const rows = await inClinic(d, a, async (tx) => {
      const list = await tx.select().from(dentAppointment).where(and(inArray(dentAppointment.status, ['arrived', 'seated']), gt(dentAppointment.startsAt, new Date(Date.now() - 18 * 3600_000))))
        .orderBy(sql`${dentAppointment.arrivedAt} nulls last`, asc(dentAppointment.startsAt));
      const chairs = await tx.select({ id: dentChair.id, name: dentChair.name }).from(dentChair);
      const dentists = await tx.select({ id: dentDentist.id, name: dentDentist.name, color: dentDentist.color }).from(dentDentist);
      return (await withNames(tx, list)).map((x) => ({ id: x.id, status: x.status, arrivedAt: x.arrivedAt, seatedAt: x.seatedAt, startsAt: x.startsAt,
        name: x.patient?.name ?? '', fileNo: x.patient?.fileNo ?? null, chair: chairs.find((y) => y.id === x.chairId)?.name ?? null, dentist: dentists.find((y) => y.id === x.dentistId) ?? null }));
    });
    return c.json({ queue: rows });
  });

  return r;
}

/** A dentist and chair must be this clinic's. */
async function refs(tx: Database, dentistId: unknown, chairId: unknown) {
  if (dentistId) { const [x] = await tx.select({ id: dentDentist.id }).from(dentDentist).where(eq(dentDentist.id, String(dentistId))); if (!x) bad('BAD_DENTIST'); }
  if (chairId) { const [x] = await tx.select({ id: dentChair.id }).from(dentChair).where(eq(dentChair.id, String(chairId))); if (!x) bad('BAD_CHAIR'); }
}
export type { Actor };
