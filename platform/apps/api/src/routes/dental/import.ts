// Import patients from a spreadsheet (the old card box, another program's export): name, phone, file number, gender,
// birth date, address, job, how they found the clinic, notes, and what they owe. A phone already in the clinic updates
// that patient; a file number from the sheet is kept when it's free, otherwise the next number is given.
import { Hono } from 'hono';
import { sql } from 'drizzle-orm';
import { newId } from '@hemlo/core';
import { sysCustomer, sysLedger, sysSequence, dentPatient } from '@hemlo/db/schema';
import { audit } from '@hemlo/auth/audit';
import { actor, bad, text } from '../sys-common';
import { eachRow, phoneOf, nameOf, openingOf, genderOf, dateOf, onePerPhone, customersByPhone, openingLine, insertBatches, type RowError } from '../import-common';
import { inClinic } from './common';
import type { AppEnv, Deps } from '../../types';

const rowsOf = (r: any): any[] => (Array.isArray(r) ? r : r?.rows ?? []);
const t200 = (v: unknown) => text(v == null ? v : String(v), 200, 'BAD_TEXT');

export function dentalImportRoutes(d: Deps) {
  const r = new Hono<AppEnv>();

  r.post('/patients/import', async (c) => {
    const a = actor(c, 'patients', 'create');
    const { ok, errors } = eachRow((await c.req.json<{ rows?: unknown }>()).rows, (x) => ({
      name: nameOf(x.name), phone: phoneOf(x.phone), balance: openingOf(x.balance), gender: genderOf(x.gender), birthDate: dateOf(x.birthDate, 'BAD_BIRTH_DATE'),
      fileNo: x.fileNo == null || x.fileNo === '' ? null : Number.isInteger(Number(x.fileNo)) && Number(x.fileNo) > 0 && Number(x.fileNo) < 10_000_000 ? Number(x.fileNo) : bad('BAD_FILE_NO'),
      address: t200(x.address), occupation: t200(x.occupation), referral: t200(x.referral), notes: text(x.notes == null ? x.notes : String(x.notes), 2000, 'BAD_TEXT'),
    }));
    const rows = onePerPhone(ok, errors);
    const result = await inClinic(d, a, async (tx) => {
      const known = await customersByPhone(tx, rows.map((x) => x.v.phone).filter(Boolean) as string[]);
      const files = rowsOf(await tx.execute(sql`select p.customer_id as id, p.file_no as no from dent_patient p`));
      const taken = new Map<number, string>(files.map((f) => [Number(f.no), f.id]));
      const hasProfile = new Set(files.map((f) => f.id as string));
      let next = Math.max(0, ...files.map((f) => Number(f.no)), Number(rowsOf(await tx.execute(sql`select value from sys_sequence where name = 'patient'`))[0]?.value ?? 0));
      const errs: RowError[] = [];
      const custIns: any[] = [], patIns: any[] = [], custUpd: any[] = [], patUpd: any[] = [], lines: any[] = [];
      for (const { i, v } of rows) {
        const old = v.phone ? known.get(v.phone) : undefined;
        const id = old?.id ?? newId();
        if (old && hasProfile.has(old.id)) {
          custUpd.push({ id, name: v.name, balance: v.balance });
          patUpd.push({ id, gender: v.gender, birth_date: v.birthDate, address: v.address, occupation: v.occupation, referral: v.referral, notes: v.notes });
        } else {
          let no = v.fileNo;
          if (no != null && taken.has(no)) { errs.push({ row: i, code: 'FILE_NO_TAKEN' }); continue; }
          no ??= ++next;
          next = Math.max(next, no); taken.set(no, id);
          if (old) custUpd.push({ id, name: v.name, balance: v.balance });
          else custIns.push({ id, organizationId: a.organizationId, name: v.name, phone: v.phone, balance: v.balance ?? 0 });
          patIns.push({ customerId: id, organizationId: a.organizationId, fileNo: no, gender: v.gender, birthDate: v.birthDate, address: v.address, occupation: v.occupation, referral: v.referral, notes: v.notes });
        }
        const from = old?.balance ?? 0;
        if (v.balance != null && v.balance !== from) lines.push(openingLine(a.organizationId, id, from, v.balance, a.userId));
      }
      errors.push(...errs);
      await insertBatches(custIns, (x) => tx.insert(sysCustomer).values(x));
      await insertBatches(patIns, (x) => tx.insert(dentPatient).values(x));
      if (custUpd.length) await tx.execute(sql`update sys_customer c set name = x.name, balance = coalesce(x.balance, c.balance), updated_at = now()
        from json_to_recordset(${JSON.stringify(custUpd)}::json) as x(id text, name text, balance int) where c.id = x.id`);
      if (patUpd.length) await tx.execute(sql`update dent_patient p set gender = coalesce(x.gender, p.gender), birth_date = coalesce(x.birth_date, p.birth_date),
          address = coalesce(x.address, p.address), occupation = coalesce(x.occupation, p.occupation), referral = coalesce(x.referral, p.referral), notes = coalesce(x.notes, p.notes), updated_at = now()
        from json_to_recordset(${JSON.stringify(patUpd)}::json) as x(id text, gender text, birth_date date, address text, occupation text, referral text, notes text) where p.customer_id = x.id`);
      await insertBatches(lines, (x) => tx.insert(sysLedger).values(x));
      // the next new patient continues after the highest file number
      await tx.insert(sysSequence).values({ organizationId: a.organizationId, name: 'patient', value: next })
        .onConflictDoUpdate({ target: [sysSequence.organizationId, sysSequence.name], set: { value: sql`greatest(${sysSequence.value}, ${next})` } });
      return { created: patIns.length, updated: patUpd.length };
    });
    await audit(d.db, { kind: 'dental.patients_imported', organizationId: a.organizationId, userId: a.userId, detail: { ...result, skipped: errors.length } });
    return c.json({ ...result, errors: errors.sort((x, y) => x.row - y.row) });
  });

  return r;
}
