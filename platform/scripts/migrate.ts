// Apply database migrations to Postgres (Neon). Run: DATABASE_URL=postgres://… npx tsx scripts/migrate.ts
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

const url = process.env.DATABASE_URL;
if (!url) { console.error('Set DATABASE_URL'); process.exit(1); }
const client = postgres(url, { max: 1, connection: { TimeZone: 'UTC' } });
await migrate(drizzle(client), { migrationsFolder: 'packages/db/migrations' });
await client.end();
console.log('Migrations applied.');
