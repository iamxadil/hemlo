// The usage tracker: every real shop's activity (demo shops left out), the platform against its limits, and who may see it.
import { describe, it, expect, beforeAll } from 'vitest';
import { STAFF_ROLES } from '@hemlo/core';
import { setup, Browser, signInEmail, createOrg } from './helpers';

let t: Awaited<ReturnType<typeof setup>>;
let founder: Browser;

beforeAll(async () => {
  t = await setup({ BUSINESS_CREATION: 'open' } as any);
  founder = new Browser(t.app);
  await signInEmail(founder, 'founder@hemlohq.com');
  await t.client.query(`update "user" set role = 'admin' where email = 'founder@hemlohq.com'`);
  await signInEmail(founder, 'founder@hemlohq.com');

  // a shop that sells today, a shop that has never sold, and a demo shop
  const busy = new Browser(t.app);
  await signInEmail(busy, 'busy@shop.iq');
  await createOrg(busy, 'Al-Khair Market');
  const p = await busy.post('/v1/sys/products', { name: 'Pepsi', price: 500, stock: 100 });
  for (let i = 0; i < 3; i++) await busy.post('/v1/sys/sales', { lines: [{ productId: p.json.product.id, qty: 2 }] });
  const fresh = new Browser(t.app);
  await signInEmail(fresh, 'fresh@shop.iq');
  await createOrg(fresh, 'Noor Pharmacy');
  await new Browser(t.app).post('/v1/demo/start', { lang: 'en' });
});

describe('usage', () => {
  it('shows each real shop: status, today, the week, and a 14-day line', async () => {
    const u = (await founder.get('/v1/admin/usage')).json;
    expect(u.shops.map((s: any) => s.name)).toEqual(['Al-Khair Market', 'Noor Pharmacy']); // active first; demo shops never listed
    const busy = u.shops[0];
    expect(busy).toMatchObject({ status: 'active', today: 3, revenueToday: 3000, week: 3, month: 3, products: 1, members: 1 });
    expect(busy.spark).toHaveLength(14);
    expect(busy.spark[13]).toBe(3);
    expect(busy.bytes).toBeGreaterThan(0);
    expect(u.shops[1]).toMatchObject({ status: 'new', today: 0, lastSaleAt: null });
    expect(u.totals).toMatchObject({ shops: 2, activeToday: 1, salesToday: 3, revenueToday: 3000, byStatus: { active: 1, quiet: 0, asleep: 0, new: 1 } });
    expect(u.series).toHaveLength(30);
    expect(u.series[29]).toMatchObject({ sales: 3, shops: 1, revenue: 3000 });
  });

  it('measures the platform against its plan limits (live meters only when their keys are set)', async () => {
    const u = (await founder.get('/v1/admin/usage')).json;
    expect(u.platform.database.bytes).toBeGreaterThan(0);
    expect(u.platform.database.limit).toBe(512 * 1024 * 1024);
    expect(u.platform.demos).toMatchObject({ active: 1, today: 1, limit: 150 });
    expect(u.platform.compute).toBeNull();
    expect(u.platform.requests).toBeNull();
    expect(u.platform.connected).toEqual({ neon: false, cloudflare: false });
  });

  it('needs the usage permission; contact details stay masked without people.contact', async () => {
    const invite = async (email: string, permissions: readonly string[]) => {
      const inv = await founder.post('/v1/admin/team/invites', { email, permissions });
      const b = new Browser(t.app);
      await signInEmail(b, email);
      await b.post(`/v1/team-invites/${encodeURIComponent(new URL(inv.json.url.replace('#/join?', 'join?')).searchParams.get('t')!)}`);
      return b;
    };
    const onboarding = await invite('onboard@hemlohq.com', STAFF_ROLES.onboarding);
    expect((await onboarding.get('/v1/admin/usage')).json.error).toBe('NO_PERMISSION');
    const analyst = await invite('analyst@hemlohq.com', STAFF_ROLES.analyst);
    const shop = (await analyst.get('/v1/admin/usage')).json.shops[0];
    expect(shop.masked).toBe(true);
    expect(shop.ownerPhone ?? '').not.toMatch(/\d{7}/);
  });
});
