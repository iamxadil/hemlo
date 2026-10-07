// Database access. One Postgres; business tables are protected by row-level security:
// queries for a business run inside withOrg(), which sets app.org_id for that transaction only.
import { sql } from 'drizzle-orm';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import * as schema from './schema';

export { schema };
export type Database = PgDatabase<any, typeof schema>;

/** Run fn with row-level security scoped to one organization. */
export function withOrg<T>(db: Database, organizationId: string, fn: (tx: Database) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.org_id', ${organizationId}, true), set_config('app.system', 'off', true)`);
    return fn(tx as unknown as Database);
  });
}

/** Run fn as the system (auth internals: token lookups, audit writes). Never with user-supplied org ids. */
export function withSystem<T>(db: Database, fn: (tx: Database) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.system', 'on', true)`);
    return fn(tx as unknown as Database);
  });
}
