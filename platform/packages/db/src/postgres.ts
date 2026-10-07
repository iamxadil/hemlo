// Production: Postgres (Neon) through Cloudflare Hyperdrive, or any DATABASE_URL.
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema';
import type { Database } from './index';

/** `max`: connections this client may open. The Worker makes one client per request and passes 1: every new connection
 *  costs a login handshake in CPU time, and queries pipeline fine on one. */
export function createPostgresDb(url: string, max = 5): Database {
  // All times are UTC (Better Auth's columns are "timestamp" without a zone).
  const client = postgres(url, { max, prepare: false, fetch_types: false, connection: { TimeZone: 'UTC' } });
  const db = drizzle(client, { schema }) as unknown as Database;
  // Drizzle passes date values through untouched (its typed columns turn them into text first), so a Date written
  // straight into a sql`` query became "Wed Sep 30 2026 …", which Postgres refuses. Send any Date as ISO text.
  const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : v);
  for (const type of ['1184', '1114', '1082']) (client.options.serializers as Record<string, (v: unknown) => unknown>)[type] = iso;
  return db;
}
