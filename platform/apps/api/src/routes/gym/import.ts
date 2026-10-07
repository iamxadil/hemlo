// Import members from a spreadsheet (a register, another program's export): who they are, and the membership they have
// now (its plan, when it ends, visits left), plus what they owe. A phone (or member number) already in the gym updates
// that member; a membership already recorded with the same end is not added twice. Nothing is billed: these were paid
// before Hemlo. A handful of statements, whatever the size of the sheet.
import { Hono } from 'hono';
import { sql } from 'drizzle-orm';
import { newId } from '@hemlo/core';
import { sysCustomer, sysLedger, sysSequence, gymMember, gymMembership, gymPlan } from '@hemlo/db/schema';
import { audit } from '@hemlo/auth/audit';
import { actor, bad, text } from '../sys-common';
import { eachRow, phoneOf, nameOf, openingOf, genderOf, dateOf, onePerPhone, customersByPhone, openingLine, insertBatches, type RowError } from '../import-common';
import { inGym, rowsOf, ymd, addDays, addMonths, newCardCode } from './common';
import type { AppEnv, Deps } from '../../types';

const norm = (s: unknown) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

export function gymImportRoutes(d: Deps) {
  const r = new Hono<AppEnv>();

  r.post('/members/import', async (c) => {
    const a = actor(c, 'members', 'create');
    const b = await c.req.json<{ rows?: unknown; planName?: string }>();
    const fallbackName = text(b.planName, 80, 'BAD_NAME') ?? 'Membership';
    const { ok, errors } = eachRow(b.rows, (x) => {
      const v = {
        name: nameOf(x.name), phone: phoneOf(x.phone), balance: openingOf(x.balance), gender: genderOf(x.gender), birthDate: dateOf(x.birthDate, 'BAD_BIRTH_DATE'),
        memberNo: x.memberNo == null || x.memberNo === '' ? null : Number.isInteger(Number(x.memberNo)) && Number(x.memberNo) > 0 && Number(x.memberNo) < 10_000_000 ? Number(x.memberNo) : bad('BAD_MEMBER_NO'),
        plan: text(x.plan == null ? x.plan : String(x.plan), 80, 'BAD_PLAN'), startsOn: dateOf(x.startsOn), endsOn: dateOf(x.endsOn),
        visitsLeft: x.visitsLeft == null || x.visitsLeft === '' ? null : Number.isInteger(Number(x.visitsLeft)) && Number(x.visitsLeft) >= 0 && Number(x.visitsLeft) <= 1000 ? Number(x.visitsLeft) : bad('BAD_VISITS'),
        notes: text(x.notes == null ? x.notes : String(x.notes), 2000, 'BAD_TEXT'),
      };
      if (v.startsOn && !v.endsOn) bad('NO_END_DATE');
      if (v.startsOn && v.endsOn && v.startsOn > v.endsOn) bad('BAD_DATE');
      return v;
    });
    const rows = onePerPhone(ok, errors);
    const result = await inGym(d, a, async (tx) => {
      const known = await customersByPhone(tx, rows.map((x) => x.v.phone).filter(Boolean) as string[]);
      const members = rowsOf(await tx.execute(sql`select m.customer_id as id, m.member_no as no, cu.balance from gym_member m join sys_customer cu on cu.id = m.customer_id`));
      const balanceOf = new Map<string, number>(members.map((m) => [m.id, Number(m.balance)]));
      const byNo = new Map<number, string>(members.map((m) => [Number(m.no), m.id]));
      const hasProfile = new Set(members.map((m) => m.id as string));
      const plans = await tx.select().from(gymPlan);
      const planOf = (name: string | null) => (name ? plans.find((p) => norm(p.name) === norm(name)) : undefined);
      const current = rowsOf(await tx.execute(sql`select member_id, category, ends_on from gym_membership where status <> 'canceled'`));
      const already = new Set(current.map((m) => `${m.member_id}|${m.category}|${ymd(m.ends_on)}`));
      let next = Math.max(0, ...members.map((m) => Number(m.no)), Number(rowsOf(await tx.execute(sql`select value from sys_sequence where name = 'member'`))[0]?.value ?? 0));
      const errs: RowError[] = [];
      const custIns: any[] = [], memIns: any[] = [], custUpd: any[] = [], memUpd: any[] = [], msIns: any[] = [], lines: any[] = [];
      for (const { i, v } of rows) {
        // the same person: by phone first, then by the member number in the sheet
        const old = v.phone ? known.get(v.phone) : undefined;
        const byNumber = !old && v.memberNo != null ? byNo.get(v.memberNo) : undefined;
        const id = old?.id ?? byNumber ?? newId();
        const exists = hasProfile.has(id);
        if (exists) {
          custUpd.push({ id, name: v.name, phone: v.phone, balance: v.balance });
          memUpd.push({ id, gender: v.gender, birth_date: v.birthDate, notes: v.notes });
        } else {
          let no = v.memberNo;
          if (no != null && byNo.has(no)) { errs.push({ row: i, code: 'MEMBER_NO_TAKEN' }); continue; }
          no ??= ++next;
          next = Math.max(next, no); byNo.set(no, id); hasProfile.add(id);
          if (old) custUpd.push({ id, name: v.name, phone: v.phone, balance: v.balance });
          else custIns.push({ id, organizationId: a.organizationId, name: v.name, phone: v.phone, balance: v.balance ?? 0 });
          memIns.push({ customerId: id, organizationId: a.organizationId, memberNo: no, cardCode: newCardCode(), gender: v.gender, birthDate: v.birthDate, notes: v.notes });
        }
        const from = old?.balance ?? balanceOf.get(id) ?? 0;
        if (v.balance != null && v.balance !== from) lines.push(openingLine(a.organizationId, id, from, v.balance, a.userId));
        // their membership now (paid before Hemlo, so no sale)
        if (v.endsOn) {
          const p = planOf(v.plan);
          const category = p?.category ?? 'gym';
          if (already.has(`${id}|${category}|${v.endsOn}`)) continue;
          already.add(`${id}|${category}|${v.endsOn}`);
          const startsOn = v.startsOn ?? (p ? (p.unit === 'day' ? addDays(v.endsOn, -(p.duration - 1)) : addMonths(addDays(v.endsOn, 1), -p.duration)) : addDays(v.endsOn, -29));
          const visits = v.visitsLeft ?? p?.visits ?? null;
          msIns.push({ id: newId(), organizationId: a.organizationId, memberId: id, planId: p?.id ?? null, name: p?.name ?? v.plan ?? fallbackName, category,
            startsOn: startsOn <= v.endsOn ? startsOn : v.endsOn, endsOn: v.endsOn, visits, visitsUsed: 0, price: 0, freezeDays: p?.freezeDays ?? 0, note: 'import', createdBy: a.userId });
        }
      }
      errors.push(...errs);
      await insertBatches(custIns, (x) => tx.insert(sysCustomer).values(x));
      await insertBatches(memIns, (x) => tx.insert(gymMember).values(x));
      if (custUpd.length) await tx.execute(sql`update sys_customer c set name = x.name, phone = coalesce(x.phone, c.phone), balance = coalesce(x.balance, c.balance), updated_at = now()
        from json_to_recordset(${JSON.stringify(custUpd)}::json) as x(id text, name text, phone text, balance int) where c.id = x.id`);
      if (memUpd.length) await tx.execute(sql`update gym_member m set gender = coalesce(x.gender, m.gender), birth_date = coalesce(x.birth_date, m.birth_date), notes = coalesce(x.notes, m.notes), updated_at = now()
        from json_to_recordset(${JSON.stringify(memUpd)}::json) as x(id text, gender text, birth_date date, notes text) where m.customer_id = x.id`);
      await insertBatches(msIns, (x) => tx.insert(gymMembership).values(x));
      await insertBatches(lines, (x) => tx.insert(sysLedger).values(x));
      await tx.insert(sysSequence).values({ organizationId: a.organizationId, name: 'member', value: next })
        .onConflictDoUpdate({ target: [sysSequence.organizationId, sysSequence.name], set: { value: sql`greatest(${sysSequence.value}, ${next})` } });
      return { created: memIns.length, updated: memUpd.length, memberships: msIns.length };
    });
    await audit(d.db, { kind: 'gym.members_imported', organizationId: a.organizationId, userId: a.userId, detail: { ...result, skipped: errors.length } });
    return c.json({ ...result, errors: errors.sort((x, y) => x.row - y.row) });
  });

  return r;
}
