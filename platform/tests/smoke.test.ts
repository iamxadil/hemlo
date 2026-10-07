import { describe, it, expect, beforeAll } from 'vitest';
import { setup, Browser, signInEmail } from './helpers';

let t: Awaited<ReturnType<typeof setup>>;
beforeAll(async () => { t = await setup(); });

describe('smoke', () => {
  it('health + config', async () => {
    const b = new Browser(t.app);
    expect((await b.get('/v1/health')).json).toEqual({ ok: true });
    expect((await b.get('/v1/config')).json.phone).toBe(true);
  });
  it('email sign-in', async () => {
    const b = new Browser(t.app);
    await signInEmail(b, 'owner@example.com');
    const me = await b.get('/v1/me');
    expect(me.status).toBe(200);
    expect(me.json.user.email).toBe('owner@example.com');
  });
});
