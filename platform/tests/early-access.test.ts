import { describe, it, expect, beforeAll } from 'vitest';
import { outbox } from '@hemlo/notify';
import { setup, Browser, signInEmail } from './helpers';

let t: Awaited<ReturnType<typeof setup>>;
beforeAll(async () => { t = await setup(); });

describe('early access', () => {
  it('stores a request and tells Hemlo by email', async () => {
    const b = new Browser(t.app);
    const r = await b.post('/v1/early-access', { name: 'علي', phone: '0770 555 1234', business: 'ورشة النور', kind: 'phone-repair', city: 'بغداد', locale: 'ar' });
    expect(r.status).toBe(201);
    const mail = [...outbox].reverse().find((m) => m.kind === 'early-access');
    expect(mail?.to).toBe('hello@hemlohq.com');
    expect(mail?.html).toContain('wa.me/9647705551234');
    const rows = await t.client.query(`select name, phone_number from early_access`);
    expect(rows.rows).toContainEqual({ name: 'علي', phone_number: '+9647705551234' });
  });
  it('rejects bad input, ignores bots, and limits each IP', async () => {
    const b = new Browser(t.app);
    expect((await b.post('/v1/early-access', { name: 'x', phone: '12345', business: 'y', kind: 'store' })).json.error).toBe('INVALID_PHONE');
    expect((await b.post('/v1/early-access', { name: 'x', phone: '07701112222', business: 'y', kind: 'spaceship' })).json.error).toBe('MISSING_FIELDS');
    const before = (await t.client.query<{ n: number }>(`select count(*)::int n from early_access`)).rows[0].n;
    expect((await b.post('/v1/early-access', { name: 'bot', phone: '07701112222', business: 'y', kind: 'store', website: 'http://spam' })).status).toBe(200);
    expect((await t.client.query<{ n: number }>(`select count(*)::int n from early_access`)).rows[0].n).toBe(before);
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) statuses.push((await b.post('/v1/early-access', { name: 'n' + i, phone: `0771000000${i}`, business: 'b', kind: 'store' })).status);
    expect(statuses.at(-1)).toBe(429);
  });
  it('the list is for Hemlo staff only', async () => {
    const b = new Browser(t.app);
    await signInEmail(b, 'someone@example.com');
    expect((await b.get('/v1/admin/early-access')).json.error).toBe('NOT_STAFF');
  });
});

describe('signed-in flag for the public sites', () => {
  it('appears on sign-in and disappears on sign-out', async () => {
    const b = new Browser(t.app);
    await signInEmail(b, 'flag@example.com');
    expect(b.jar.get('hemlo.hint')).toBe('1');
    await b.post('/v1/auth/sign-out');
    expect(b.jar.has('hemlo.hint')).toBe(false);
  });
});
