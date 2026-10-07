// Memberships: selling one (a renewal starts the day after the current one ends), paying for it (an ordinary sale on the
// member's account, so the drawer, receipts and the debt book work as in a shop), pausing it while someone travels,
// cancelling, correcting dates, and personal-training sessions.
import { Hono } from 'hono';
import { and, desc, eq, ne, sql } from 'drizzle-orm';
import { newId } from '@hemlo/core';
import { sysSale, sysSaleLine, sysLedger, sysCustomer, gymMembership, gymPlan, gymCheckin, gymTrainer, gymMember } from '@hemlo/db/schema';
import { audit } from '@hemlo/auth/audit';
import { HttpError } from '../../principal';
import { actor, may, bad, text, iqd, openShiftId } from '../sys-common';
import { nextNumber } from '../systems-ops';
import { inGym, rowsOf, ymd, today, addDays, daysBetween, endOf, dateOnly, int, memberOf, stateOf, CATEGORIES, type MsRow } from './common';
import type { AppEnv, Deps } from '../../types';

const msOf = async (tx: any, id: string) => {
  const [m] = await tx.select().from(gymMembership).where(eq(gymMembership.id, id));
  if (!m) throw new HttpError(404, 'NOT_FOUND');
  return m as typeof gymMembership.$inferSelect;
};

export function gymMembershipRoutes(d: Deps) {
  const r = new Hono<AppEnv>();

  /**
   * Sell a membership: { memberId, planId, startsOn?, price?, discount?, paid, method, trainerId? }.
   * Without startsOn, a renewal begins the day after the member's current one of the same kind ends (no day is lost);
   * a new member begins today. What isn't paid now goes on the member's account.
   */
  r.post('/memberships', async (c) => {
    const a = actor(c, 'memberships', 'sell');
    const b = await c.req.json<any>();
    const discount = iqd(b.discount ?? 0, 'BAD_DISCOUNT')!;
    const paidIn = iqd(b.paid ?? 0, 'BAD_PAID')!;
    const method = ['cash', 'card', 'fib'].includes(b.method) ? b.method : 'cash';
    const out = await inGym(d, a, async (tx) => {
      const memberId = String(b.memberId ?? '');
      const mem = await memberOf(tx, memberId);
      const [plan] = await tx.select().from(gymPlan).where(eq(gymPlan.id, String(b.planId ?? '')));
      if (!plan) bad('BAD_PLAN');
      // a different price than the list needs the manager (a discount doesn't)
      const listPrice = plan.price;
      const price = b.price != null && b.price !== '' && Number(b.price) !== listPrice ? (may(a.principal, 'memberships', 'manage') ? iqd(b.price, 'BAD_PRICE')! : bad('PRICE_LOCKED')) : listPrice;
      if (discount > price) bad('BAD_DISCOUNT');
      const total = price - discount, paid = Math.min(paidIn, total), due = total - paid;
      const day = today();
      let startsOn = dateOnly(b.startsOn);
      if (!startsOn) {
        const [cur] = await tx.select({ endsOn: gymMembership.endsOn }).from(gymMembership)
          .where(and(eq(gymMembership.memberId, memberId), eq(gymMembership.category, plan.category), ne(gymMembership.status, 'canceled'), sql`${gymMembership.endsOn} >= ${day}`))
          .orderBy(desc(gymMembership.endsOn)).limit(1);
        startsOn = cur ? addDays(cur.endsOn, 1) : day;
      }
      if (startsOn < addDays(day, -60) || startsOn > addDays(day, 365)) bad('BAD_DATE');
      const endsOn = endOf(startsOn, plan.duration, plan.unit);
      let trainerId: string | null = b.trainerId || (plan.category === 'pt' ? mem.m.trainerId : null) || null;
      if (trainerId) { const [t] = await tx.select({ id: gymTrainer.id }).from(gymTrainer).where(eq(gymTrainer.id, trainerId)); if (!t) bad('BAD_TRAINER'); }

      let sale: typeof sysSale.$inferSelect | null = null;
      if (total > 0 || paid > 0) {
        [sale] = await tx.insert(sysSale).values({ id: newId(), organizationId: a.organizationId, number: await nextNumber(tx, a.organizationId, 'sale'),
          userId: a.userId, deviceId: a.deviceId, customerId: memberId, subtotal: price, discount, total, paid, due,
          method: due === 0 ? method : paid > 0 ? 'mixed' : 'credit', cost: 0, note: 'gym',
          shiftId: paid > 0 && method === 'cash' ? await openShiftId(tx, a.deviceId) : null }).returning();
        await tx.insert(sysSaleLine).values({ id: newId(), organizationId: a.organizationId, saleId: sale.id, productId: null,
          name: `${plan.name} · ${startsOn} → ${endsOn}`, qty: 1, price, total: price, cost: 0 });
        if (due > 0) {
          const [cu] = await tx.update(sysCustomer).set({ balance: sql`${sysCustomer.balance} + ${due}`, updatedAt: new Date() }).where(eq(sysCustomer.id, memberId)).returning();
          await tx.insert(sysLedger).values({ id: newId(), organizationId: a.organizationId, customerId: memberId, kind: 'sale', amount: due, balance: cu.balance, saleId: sale.id, userId: a.userId });
        }
      }
      const [ms] = await tx.insert(gymMembership).values({ id: newId(), organizationId: a.organizationId, memberId, planId: plan.id, name: plan.name, category: plan.category,
        startsOn, endsOn, visits: plan.visits, price: total, discount, saleId: sale?.id ?? null, trainerId, freezeDays: plan.freezeDays,
        note: text(b.note, 300, 'BAD_TEXT'), createdBy: a.userId }).returning();
      if (trainerId && plan.category === 'pt' && !mem.m.trainerId) await tx.update(gymMember).set({ trainerId, updatedAt: new Date() }).where(eq(gymMember.customerId, memberId));
      const [customer] = await tx.select().from(sysCustomer).where(eq(sysCustomer.id, memberId));
      return { membership: { ...ms, ...stateOf(ms as unknown as MsRow) }, sale, customer: { id: customer.id, name: customer.name, phone: customer.phone, balance: customer.balance } };
    });
    return c.json(out, 201);
  });

  /** Pause: someone travels or is ill. The days paused are added to the end when it resumes. */
  r.post('/memberships/:id/freeze', async (c) => {
    const a = actor(c, 'memberships', 'sell');
    const out = await inGym(d, a, async (tx) => {
      const m = await msOf(tx, c.req.param('id'));
      const s = stateOf(m as unknown as MsRow);
      if (s.state !== 'active' && s.state !== 'future') throw new HttpError(409, 'CANT_FREEZE');
      if (m.frozenDays >= m.freezeDays && !may(a.principal, 'memberships', 'manage')) throw new HttpError(409, 'NO_FREEZE_LEFT');
      const [row] = await tx.update(gymMembership).set({ status: 'frozen', frozenFrom: today() }).where(eq(gymMembership.id, m.id)).returning();
      return row;
    });
    return c.json({ membership: { ...out, ...stateOf(out as unknown as MsRow) } });
  });

  /** Resume: the end moves later by the days it was paused (up to what the plan allows, unless a manager says more). */
  r.post('/memberships/:id/unfreeze', async (c) => {
    const a = actor(c, 'memberships', 'sell');
    const out = await inGym(d, a, async (tx) => {
      const m = await msOf(tx, c.req.param('id'));
      if (m.status !== 'frozen' || !m.frozenFrom) throw new HttpError(409, 'NOT_FROZEN');
      const paused = Math.max(0, daysBetween(m.frozenFrom, today()));
      const allowed = may(a.principal, 'memberships', 'manage') ? paused : Math.min(paused, Math.max(0, m.freezeDays - m.frozenDays));
      const [row] = await tx.update(gymMembership).set({ status: 'active', frozenFrom: null, frozenDays: m.frozenDays + allowed, endsOn: addDays(m.endsOn, allowed) })
        .where(eq(gymMembership.id, m.id)).returning();
      return { row, paused, added: allowed };
    });
    return c.json({ membership: { ...out.row, ...stateOf(out.row as unknown as MsRow) }, paused: out.paused, added: out.added });
  });

  /** Cancel (a mistake, or a member who left). The money stays as it was: a refund is a return on its sale. */
  r.post('/memberships/:id/cancel', async (c) => {
    const a = actor(c, 'memberships', 'manage');
    const reason = text((await c.req.json<any>().catch(() => ({}))).reason, 200, 'BAD_TEXT');
    const row = await inGym(d, a, async (tx) => {
      const m = await msOf(tx, c.req.param('id'));
      if (m.status === 'canceled') throw new HttpError(409, 'ALREADY_CANCELED');
      const [x] = await tx.update(gymMembership).set({ status: 'canceled', canceledAt: new Date(), note: reason ?? m.note }).where(eq(gymMembership.id, m.id)).returning();
      return x;
    });
    await audit(d.db, { kind: 'gym.membership_canceled', organizationId: a.organizationId, userId: a.userId, detail: { id: row.id, name: row.name, reason } });
    return c.json({ membership: row });
  });

  /** Correct a membership: its dates, visits used, coach, note (managers). */
  r.patch('/memberships/:id', async (c) => {
    const a = actor(c, 'memberships', 'manage');
    const b = await c.req.json<any>();
    const set: Partial<typeof gymMembership.$inferInsert> = {};
    if (b.startsOn !== undefined) set.startsOn = dateOnly(b.startsOn) ?? bad('BAD_DATE');
    if (b.endsOn !== undefined) set.endsOn = dateOnly(b.endsOn) ?? bad('BAD_DATE');
    if (b.visits !== undefined) set.visits = b.visits == null || b.visits === '' ? null : int(b.visits, 1, 1000, 'BAD_VISITS');
    if (b.visitsUsed !== undefined) set.visitsUsed = int(b.visitsUsed, 0, 1000, 'BAD_VISITS');
    if (b.trainerId !== undefined) set.trainerId = b.trainerId || null;
    if (b.note !== undefined) set.note = text(b.note, 300, 'BAD_TEXT');
    if (b.category !== undefined) set.category = CATEGORIES.includes(b.category) ? b.category : bad('BAD_CATEGORY');
    const row = await inGym(d, a, async (tx) => {
      const m = await msOf(tx, c.req.param('id'));
      if ((set.startsOn ?? m.startsOn) > (set.endsOn ?? m.endsOn)) bad('BAD_DATE');
      const [x] = await tx.update(gymMembership).set(set).where(eq(gymMembership.id, m.id)).returning();
      return x;
    });
    return c.json({ membership: { ...row, ...stateOf(row as unknown as MsRow) } });
  });

  /** A personal-training session done: one of the package's sessions is used, and it counts for the coach. */
  r.post('/memberships/:id/session', async (c) => {
    const a = actor(c, 'training', 'write');
    const b = await c.req.json<any>().catch(() => ({}));
    const out = await inGym(d, a, async (tx) => {
      const m = await msOf(tx, c.req.param('id'));
      const s = stateOf(m as unknown as MsRow);
      if (s.state !== 'active') throw new HttpError(409, s.state === 'used' ? 'NO_VISITS_LEFT' : s.state === 'frozen' ? 'FROZEN' : 'NOT_ACTIVE');
      const trainerId = b.trainerId || m.trainerId;
      const [row] = await tx.update(gymMembership).set({ visitsUsed: sql`${gymMembership.visitsUsed} + 1` }).where(eq(gymMembership.id, m.id)).returning();
      const [ci] = await tx.insert(gymCheckin).values({ id: newId(), organizationId: a.organizationId, memberId: m.memberId, membershipId: m.id, via: 'pt', result: 'ok', counted: true, trainerId, userId: a.userId }).returning();
      return { membership: { ...row, ...stateOf(row as unknown as MsRow) }, session: ci };
    });
    return c.json(out, 201);
  });

  /** Undo a session or a check-in made by mistake (the visit goes back on the membership). */
  r.delete('/checkins/:id', async (c) => {
    const a = actor(c, 'checkin', 'create');
    await inGym(d, a, async (tx) => {
      const [ci] = await tx.select().from(gymCheckin).where(eq(gymCheckin.id, c.req.param('id')));
      if (!ci) throw new HttpError(404, 'NOT_FOUND');
      if (Date.now() - +ci.at > 12 * 3600_000 && !may(a.principal, 'memberships', 'manage')) throw new HttpError(409, 'TOO_LATE');
      if (ci.counted && ci.membershipId) await tx.update(gymMembership).set({ visitsUsed: sql`greatest(0, ${gymMembership.visitsUsed} - 1)` }).where(eq(gymMembership.id, ci.membershipId));
      await tx.delete(gymCheckin).where(eq(gymCheckin.id, ci.id));
    });
    d.screens?.changed(`gym:${a.organizationId}`);
    return c.json({ ok: true });
  });

  /** Memberships ending soon or lately ended and not renewed: the renewals list (with WhatsApp). */
  r.get('/renewals', async (c) => {
    const a = actor(c, 'members', 'read');
    const day = today();
    const rows = await inGym(d, a, async (tx) => rowsOf(await tx.execute(sql`select ms.id, ms.member_id, ms.name, ms.ends_on, ms.visits, ms.visits_used, cu.name as member, cu.phone, cu.balance, m.member_no, m.gender
      from gym_membership ms join sys_customer cu on cu.id = ms.member_id join gym_member m on m.customer_id = ms.member_id
      where ms.status = 'active' and ms.category in ('gym', 'class', 'pt') and cu.archived_at is null
        and ms.ends_on between ${addDays(day, -14)} and ${addDays(day, 7)}
        and not exists (select 1 from gym_membership n where n.member_id = ms.member_id and n.category = ms.category and n.status <> 'canceled' and n.ends_on > ms.ends_on)
      order by ms.ends_on limit 200`)));
    const list = rows.map((x) => ({ id: x.id, memberId: x.member_id, name: x.name, endsOn: ymd(x.ends_on), visits: x.visits, visitsUsed: x.visits_used,
      member: x.member, phone: x.phone, balance: x.balance, memberNo: x.member_no, gender: x.gender }));
    return c.json({ renewals: list });
  });

  return r;
}

