// Early access → approval → private link → account + business. And the gate: no approval, no business.
import { describe, it, expect, beforeAll } from 'vitest';
import { outbox } from '@hemlo/notify';
import { setup, Browser, signInEmail, createOrg } from './helpers';

let t: Awaited<ReturnType<typeof setup>>;
let staff: Browser;
beforeAll(async () => {
  t = await setup({ BUSINESS_CREATION: undefined });
  staff = new Browser(t.app);
  await signInEmail(staff, 'founder@hemlohq.com');
  await t.client.query(`update "user" set role = 'admin' where email = 'founder@hemlohq.com'`);
  await signInEmail(staff, 'founder@hemlohq.com'); // a fresh session carries the new role
});

describe('the gate', () => {
  it('a normal account cannot create a business, and says so in /v1/me', async () => {
    const b = new Browser(t.app);
    await signInEmail(b, 'random@example.com');
    expect((await b.get('/v1/me')).json.canCreateBusiness).toBe(false);
    await expect(createOrg(b, 'Nope')).rejects.toThrow();
  });
  it('staff can', async () => {
    expect((await staff.get('/v1/me')).json.canCreateBusiness).toBe(true);
    await createOrg(staff, 'Hemlo HQ');
  });
});

describe('admin API', () => {
  it('is for staff only', async () => {
    const b = new Browser(t.app);
    await signInEmail(b, 'nosy@example.com');
    expect((await b.get('/v1/admin/overview')).json.error).toBe('NOT_STAFF');
    expect((await new Browser(t.app).get('/v1/admin/overview')).status).toBe(401);
  });

  it('request → approve → link → sign in → business created, owner, activated', async () => {
    const visitor = new Browser(t.app);
    expect((await visitor.post('/v1/early-access', { name: 'Sara Ali', phone: '0770 999 0001', email: 'sara@shop.iq', business: 'Sara Phones', kind: 'phone-repair', city: 'Baghdad', locale: 'en' })).status).toBe(201);

    const list = (await staff.get('/v1/admin/early-access?status=new')).json.requests;
    const req = list.find((x: any) => x.business === 'Sara Phones');
    expect(req).toBeTruthy();
    expect(req).not.toHaveProperty('tokenHash');

    await staff.req('PATCH', `/v1/admin/early-access/${req.id}`, { status: 'contacted', adminNote: 'Called, keen' });
    const ap = await staff.post(`/v1/admin/early-access/${req.id}/approve`);
    expect(ap.status).toBe(200);
    expect(ap.json.url).toMatch(/\/en\/welcome\/\?t=/);
    expect(ap.json.whatsappUrl).toMatch(/^https:\/\/wa\.me\/9647709990001\?text=/);
    expect(ap.json.emailed).toBe(true);
    expect([...outbox].reverse().find((m) => m.kind === 'access-granted')?.to).toBe('sara@shop.iq');

    const token = new URL(ap.json.url).searchParams.get('t')!;
    const guest = new Browser(t.app);
    expect((await guest.get(`/v1/early-access/claim/${encodeURIComponent(token)}`)).json).toMatchObject({ status: 'open', name: 'Sara', business: 'Sara Phones' });

    const sara = new Browser(t.app);
    await signInEmail(sara, 'sara-any@example.com'); // any sign-in method: the private link is the grant
    const claim = await sara.post(`/v1/early-access/claim/${encodeURIComponent(token)}`);
    expect(claim.status).toBe(201);
    const me = (await sara.get('/v1/me')).json;
    expect(me.canCreateBusiness).toBe(true);
    expect(me.organizations).toEqual([expect.objectContaining({ name: 'Sara Phones', role: 'owner' })]);
    expect(me.activeOrganizationId).toBe(claim.json.organizationId);
    expect(me.user.name).toBe('Sara Ali'); // taken from the request

    // one use only
    expect((await new Browser(t.app).get(`/v1/early-access/claim/${encodeURIComponent(token)}`)).json.status).toBe('used');
    const again = new Browser(t.app);
    await signInEmail(again, 'thief@example.com');
    expect((await again.post(`/v1/early-access/claim/${encodeURIComponent(token)}`)).json.error).toBe('LINK_USED');

    const ov = (await staff.get('/v1/admin/overview')).json;
    expect(ov.requests.activated).toBe(1);
    expect(ov.series.requests).toHaveLength(30);
    expect((await staff.get('/v1/admin/businesses')).json.businesses.find((b: any) => b.name === 'Sara Phones')).toMatchObject({ owner: 'Sara Ali', kind: 'phone-repair', city: 'Baghdad', members: 1 });
    expect((await staff.get('/v1/admin/users?q=sara')).json.users.length).toBeGreaterThan(0);
  });

  it('declining kills an issued link', async () => {
    const v = new Browser(t.app);
    await v.post('/v1/early-access', { name: 'Omar', phone: '0770 999 0002', business: 'Omar Cafe', kind: 'cafe-restaurant' });
    const req = (await staff.get('/v1/admin/early-access')).json.requests.find((x: any) => x.business === 'Omar Cafe');
    const ap = await staff.post(`/v1/admin/early-access/${req.id}/approve`);
    await staff.req('PATCH', `/v1/admin/early-access/${req.id}`, { status: 'declined' });
    const token = new URL(ap.json.url).searchParams.get('t')!;
    expect((await v.get(`/v1/early-access/claim/${encodeURIComponent(token)}`)).json.status).toBe('invalid');
  });
});
