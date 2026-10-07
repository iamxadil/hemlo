// A shop starts itself, like a dental clinic: a 30-day free trial, one per person; after it, records stay readable but
// nothing can be changed until Hemlo activates the shop.
import { describe, it, expect, beforeAll } from 'vitest';
import { setup, Browser, signInEmail } from './helpers';

let t: Awaited<ReturnType<typeof setup>>;
let owner: Browser, shopId: string;

beforeAll(async () => {
  t = await setup({ BUSINESS_CREATION: undefined }); // the real rule: nobody creates businesses freely
  owner = new Browser(t.app);
  await signInEmail(owner, 'grocer@example.com');
});

describe('a shop’s free trial', () => {
  it('starts in one step: the shop, the owner, 30 days of everything', async () => {
    const r = await owner.post('/v1/store/start', { name: 'Al-Amal Market', city: 'Basra', shopKind: 'grocery' });
    expect(r.status).toBe(201);
    shopId = r.json.organizationId;
    await owner.post('/v1/auth/organization/set-active', { organizationId: shopId });
    const me = (await owner.get('/v1/sys/me')).json;
    expect(me.business).toMatchObject({ name: 'Al-Amal Market', kind: 'store', city: 'Basra' });
    expect(me.role).toBe('owner');
    expect(me.subscription).toMatchObject({ edition: 'store', status: 'trial', daysLeft: 30 });
    expect((await owner.post('/v1/sys/products', { name: 'Pepsi 330ml', price: 500 })).status).toBe(201);
  });

  it('one free trial per person', async () => {
    expect((await owner.post('/v1/store/start', { name: 'Second Shop' })).json.error).toBe('TRIAL_USED');
    expect((await owner.post('/v1/store/start', { name: 'x' })).json.error).toBeTruthy();
  });

  it('when it ends, everything stays readable, and nothing can be changed until activated', async () => {
    await t.client.transaction(async (tx: any) => {
      await tx.query("select set_config('app.system', 'on', true)");
      await tx.query(`update hemlo_subscription set trial_ends_at = now() - interval '1 minute' where organization_id = $1`, [shopId]);
    });
    const { forgetSubscription } = await import('../apps/api/src/subscription');
    forgetSubscription(shopId);
    expect((await owner.get('/v1/sys/products')).status).toBe(200);
    expect((await owner.post('/v1/sys/products', { name: 'Tea', price: 1000 })).json.error).toBe('TRIAL_ENDED');
  });

  it('needs a Hemlo account', async () => {
    expect((await new Browser(t.app).post('/v1/store/start', { name: 'Nobody’s Shop' })).status).toBe(401);
  });
});
