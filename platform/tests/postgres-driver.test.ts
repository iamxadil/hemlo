// The production driver (postgres.js under Drizzle) must send a Date in a raw sql`` query as ISO text: PGlite, which the
// other tests use, accepts either, so this is checked on the driver itself (no database needed).
import { describe, it, expect } from 'vitest';
import { createPostgresDb } from '@hemlo/db/postgres';

describe('the production database driver', () => {
  it('sends dates in raw queries as ISO text', () => {
    const client = (createPostgresDb('postgres://u:p@localhost:1/db', 1) as any).$client;
    const at = new Date('2026-10-01T09:30:00.000Z');
    for (const type of ['1184', '1114', '1082']) expect(client.options.serializers[type](at)).toBe('2026-10-01T09:30:00.000Z');
    expect(client.options.serializers['1184']('2026-10-01 09:30:00')).toBe('2026-10-01 09:30:00'); // what Drizzle already made text stays as is
  });
});
