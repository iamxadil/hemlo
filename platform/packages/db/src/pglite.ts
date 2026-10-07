// Local development and tests: a real Postgres compiled to WebAssembly, in memory or in a folder.
// After migrating, the connection switches to an ordinary role, so row-level security applies exactly as in production
// (superusers skip it).
// All times are UTC: Better Auth's columns are "timestamp" (no zone), so the zone must never vary.
process.env.TZ = 'UTC';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import * as schema from './schema';
import type { Database } from './index';

const migrationsFolder = fileURLToPath(new URL('../migrations', import.meta.url));

export async function createPgliteDb(dataDir?: string): Promise<{ db: Database; client: PGlite }> {
  if (dataDir) mkdirSync(dataDir, { recursive: true });
  const client = new PGlite(dataDir);
  const db = drizzle(client, { schema }) as unknown as Database;
  await migrate(db as any, { migrationsFolder });
  await client.exec(`
    DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hemlo_app') THEN CREATE ROLE hemlo_app NOSUPERUSER NOLOGIN; END IF; END $$;
    GRANT USAGE ON SCHEMA public TO hemlo_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO hemlo_app;
    SET TIME ZONE 'UTC';
    SET ROLE hemlo_app;`);
  return { db, client };
}
