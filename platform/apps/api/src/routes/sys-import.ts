// Import customers (the debt book) from a spreadsheet: name, phone, what they owe from the old notebook, a note.
// A phone already in the shop updates that customer; anyone else is added. Three statements, whatever the size.
import { Hono } from 'hono';
import { sql } from 'drizzle-orm';
import { newId } from '@hemlo/core';
import { withOrg } from '@hemlo/db';
import { sysCustomer, sysLedger } from '@hemlo/db/schema';
import { audit } from '@hemlo/auth/audit';
import { actor, text } from './sys-common';
import { eachRow, phoneOf, nameOf, openingOf, onePerPhone, customersByPhone, openingLine, insertBatches } from './import-common';
import type { AppEnv, Deps } from '../types';

export function sysImportRoutes(d: Deps) {
  const r = new Hono<AppEnv>();

  r.post('/customers/import', async (c) => {
    const a = actor(c, 'customers', 'create');
    const { ok, errors } = eachRow((await c.req.json<{ rows?: unknown }>()).rows, (x) => ({
      name: nameOf(x.name), phone: phoneOf(x.phone), balance: openingOf(x.balance), note: text(x.note == null ? x.note : String(x.note), 300, 'BAD_NOTE'),
    }));
    const rows = onePerPhone(ok, errors);
    const result = await withOrg(d.db, a.organizationId, async (tx) => {
      const known = await customersByPhone(tx, rows.map((x) => x.v.phone).filter(Boolean) as string[]);
      const inserts: (typeof sysCustomer.$inferInsert)[] = [], updates: { id: string; name: string; note: string | null; balance: number | null }[] = [], lines: any[] = [];
      for (const { v } of rows) {
        const old = v.phone ? known.get(v.phone) : undefined;
        if (old) {
          updates.push({ id: old.id, name: v.name, note: v.note, balance: v.balance });
          if (v.balance != null && v.balance !== old.balance) lines.push(openingLine(a.organizationId, old.id, old.balance, v.balance, a.userId));
        } else {
          const id = newId();
          inserts.push({ id, organizationId: a.organizationId, name: v.name, phone: v.phone, note: v.note, balance: v.balance ?? 0 });
          if (v.balance) lines.push(openingLine(a.organizationId, id, 0, v.balance, a.userId));
        }
      }
      await insertBatches(inserts, (x) => tx.insert(sysCustomer).values(x));
      if (updates.length) await tx.execute(sql`update sys_customer c set name = x.name, note = coalesce(x.note, c.note), balance = coalesce(x.balance, c.balance), updated_at = now()
        from json_to_recordset(${JSON.stringify(updates)}::json) as x(id text, name text, note text, balance int) where c.id = x.id`);
      await insertBatches(lines, (x) => tx.insert(sysLedger).values(x));
      return { created: inserts.length, updated: updates.length };
    });
    await audit(d.db, { kind: 'sys.customers_imported', organizationId: a.organizationId, userId: a.userId, detail: { ...result, skipped: errors.length } });
    return c.json({ ...result, errors: errors.sort((x, y) => x.row - y.row) });
  });

  return r;
}
