// The Hemlo team: invitations bound to an email, roles and single permissions, masking, and nobody granting above themselves.
import { describe, it, expect, beforeAll } from 'vitest';
import { outbox } from '@hemlo/notify';
import { STAFF_ROLES } from '@hemlo/core';
import { setup, Browser, signInEmail } from './helpers';

let t: Awaited<ReturnType<typeof setup>>;
let founder: Browser;
let requestId: string;

beforeAll(async () => {
  t = await setup();
  founder = new Browser(t.app);
  await signInEmail(founder, 'founder@hemlohq.com');
  await t.client.query(`update "user" set role = 'admin' where email = 'founder@hemlohq.com'`);
  await signInEmail(founder, 'founder@hemlohq.com');
  await new Browser(t.app).post('/v1/early-access', { name: 'Ali Hassan', phone: '0770 123 4567', email: 'ali@shop.iq', business: 'Ali Phones', kind: 'phone-repair', city: 'Basra', locale: 'ar' });
  requestId = (await founder.get('/v1/admin/early-access')).json.requests[0].id;
});

/** Invite by email, then that person signs in and accepts. */
async function join(email: string, permissions: readonly string[], extra: Record<string, unknown> = {}) {
  const inv = await founder.post('/v1/admin/team/invites', { email, permissions, locale: 'en', ...extra });
  expect(inv.status).toBe(201);
  const token = new URL(inv.json.url.replace('#/join?', 'join?')).searchParams.get('t')!;
  const b = new Browser(t.app);
  await signInEmail(b, email);
  expect((await b.post(`/v1/team-invites/${encodeURIComponent(token)}`)).status).toBe(201);
  const me = (await b.get('/v1/me')).json;
  return { b, userId: me.user.id as string, token };
}

describe('invitations', () => {
  it('are emailed, show a masked address, and only the invited email can accept', async () => {
    const inv = await founder.post('/v1/admin/team/invites', { email: 'Noor@Hemlohq.com', name: 'Noor', permissions: STAFF_ROLES.onboarding, locale: 'en' });
    expect(inv.status).toBe(201);
    expect(inv.json.url).toMatch(/\/en\/#\/join\?t=/);
    expect(inv.json.invite.role).toBe('onboarding');
    expect([...outbox].reverse().find((m) => m.kind === 'team-invitation')?.to).toBe('noor@hemlohq.com');
    const token = new URL(inv.json.url.replace('#/join?', 'join?')).searchParams.get('t')!;

    const info = (await new Browser(t.app).get(`/v1/team-invites/${encodeURIComponent(token)}`)).json;
    expect(info).toMatchObject({ status: 'open', email: 'n•••@hemlohq.com', role: 'onboarding', inviter: null });

    const stranger = new Browser(t.app);
    await signInEmail(stranger, 'stranger@example.com');
    expect((await stranger.post(`/v1/team-invites/${encodeURIComponent(token)}`)).json.error).toBe('WRONG_ACCOUNT');

    const noor = new Browser(t.app);
    await signInEmail(noor, 'noor@hemlohq.com');
    expect((await noor.post(`/v1/team-invites/${encodeURIComponent(token)}`)).status).toBe(201);
    const me = (await noor.get('/v1/me')).json;
    expect(me.user.hemloStaff).toBe(true);
    expect(me.user.name).toBe('Noor');
    expect(me.staff).toMatchObject({ role: 'onboarding', founder: false, state: 'active' });
    expect((await new Browser(t.app).get(`/v1/team-invites/${encodeURIComponent(token)}`)).json.status).toBe('used');
  });

  it('someone already on the team cannot be invited again', async () => {
    expect((await founder.post('/v1/admin/team/invites', { email: 'noor@hemlohq.com', permissions: ['overview.view'] })).json.error).toBe('ALREADY_ON_TEAM');
    expect((await founder.post('/v1/admin/team/invites', { email: 'founder@hemlohq.com', permissions: ['overview.view'] })).json.error).toBe('ALREADY_ON_TEAM');
  });
});

describe('permissions', () => {
  it('onboarding: works requests with full contact details, but cannot see users or the team', async () => {
    const { b } = await join('onboard@hemlohq.com', STAFF_ROLES.onboarding);
    const req = (await b.get('/v1/admin/early-access')).json.requests[0];
    expect(req.phoneNumber).toBe('+9647701234567');
    expect(req.masked).toBe(false);
    const ap = await b.post(`/v1/admin/early-access/${requestId}/approve`);
    expect(ap.status).toBe(200);
    expect(ap.json.whatsappUrl).toMatch(/^https:\/\/wa\.me\/9647701234567/);
    expect((await b.get('/v1/admin/users')).json.error).toBe('NO_PERMISSION');
    expect((await b.get('/v1/admin/team')).json.error).toBe('NO_PERMISSION');
  });

  it('analyst: numbers only; phone and email are masked and nothing can be changed', async () => {
    const { b } = await join('analyst@hemlohq.com', STAFF_ROLES.analyst);
    const req = (await b.get('/v1/admin/early-access')).json.requests[0];
    expect(req).toMatchObject({ phoneNumber: '0770 ••• ••67', email: 'a•••@shop.iq', masked: true });
    const u = (await b.get('/v1/admin/users')).json.users.find((x: any) => x.email?.endsWith('@hemlohq.com'));
    expect(u.email).toMatch(/^.•••@hemlohq\.com$/);
    expect((await b.get('/v1/admin/users?q=noor@')).json.users).toHaveLength(0); // no searching by contact details either
    expect((await b.req('PATCH', `/v1/admin/early-access/${requestId}`, { adminNote: 'hi' })).json.error).toBe('NO_PERMISSION');
    expect((await b.post(`/v1/admin/early-access/${requestId}/approve`)).json.error).toBe('NO_PERMISSION');
    expect((await b.get('/v1/admin/overview')).json.latest[0].masked).toBe(true);
  });

  it('implied permissions are added: approving means seeing requests', async () => {
    const { b } = await join('approver@hemlohq.com', ['requests.approve']);
    expect((await b.get('/v1/me')).json.staff.permissions).toEqual(['requests.view', 'requests.approve']);
    expect((await b.get('/v1/admin/overview')).json.error).toBe('NO_PERMISSION');
  });
});

describe('managing the team', () => {
  it('nobody gives more than they hold, or manages someone who holds more', async () => {
    const { b: lead } = await join('lead@hemlohq.com', ['team.manage', 'requests.view']);
    expect((await lead.post('/v1/admin/team/invites', { email: 'x@hemlohq.com', permissions: ['people.contact'] })).json.error).toBe('PERMISSION_ABOVE_YOUR_OWN');
    expect((await lead.post('/v1/admin/team/invites', { email: 'x@hemlohq.com', permissions: ['requests.view'] })).status).toBe(201);

    const team = (await lead.get('/v1/admin/team')).json;
    const noor = team.members.find((m: any) => m.email === 'noor@hemlohq.com');
    const boss = team.members.find((m: any) => m.founder);
    expect(noor.canManage).toBe(false); // Noor holds people.contact; the lead doesn't
    expect(boss).toMatchObject({ role: 'founder', canManage: false });
    expect((await lead.req('PATCH', `/v1/admin/team/${noor.userId}`, { suspended: true })).json.error).toBe('PERMISSION_ABOVE_YOUR_OWN');
    expect((await lead.req('PATCH', `/v1/admin/team/${boss.userId}`, { suspended: true })).status).toBe(404);
    const self = team.members.find((m: any) => m.you);
    expect((await lead.req('PATCH', `/v1/admin/team/${self.userId}`, { permissions: ['team.manage', 'requests.view', 'users.view'] })).json.error).toBe('NOT_YOURSELF');
  });

  it('suspend, resume, temporary access, remove — each takes effect on the next request', async () => {
    const { b, userId } = await join('temp@hemlohq.com', STAFF_ROLES.support);
    expect((await b.get('/v1/admin/overview')).status).toBe(200);

    expect((await founder.req('PATCH', `/v1/admin/team/${userId}`, { suspended: true })).json.member.state).toBe('suspended');
    expect((await b.get('/v1/admin/overview')).json.error).toBe('STAFF_SUSPENDED');
    expect((await b.get('/v1/me')).json.user.hemloStaff).toBe(false);
    await founder.req('PATCH', `/v1/admin/team/${userId}`, { suspended: false });
    expect((await b.get('/v1/admin/overview')).status).toBe(200);

    await founder.req('PATCH', `/v1/admin/team/${userId}`, { accessUntil: new Date(Date.now() - 1000).toISOString() });
    expect((await b.get('/v1/admin/overview')).json.error).toBe('STAFF_EXPIRED');
    await founder.req('PATCH', `/v1/admin/team/${userId}`, { accessUntil: null, permissions: STAFF_ROLES.analyst });
    expect((await b.get('/v1/me')).json.staff.role).toBe('analyst');

    expect((await founder.req('DELETE', `/v1/admin/team/${userId}`)).status).toBe(200);
    expect((await b.get('/v1/admin/overview')).json.error).toBe('NOT_STAFF');
  });

  it('a pending invite can be canceled, and its link then stops working', async () => {
    const inv = await founder.post('/v1/admin/team/invites', { email: 'later@hemlohq.com', permissions: ['overview.view'] });
    const token = new URL(inv.json.url.replace('#/join?', 'join?')).searchParams.get('t')!;
    expect((await founder.get('/v1/admin/team')).json.invites.some((i: any) => i.email === 'later@hemlohq.com')).toBe(true);
    expect((await founder.req('DELETE', `/v1/admin/team/invites/${inv.json.invite.id}`)).status).toBe(200);
    expect((await new Browser(t.app).get(`/v1/team-invites/${encodeURIComponent(token)}`)).json.status).toBe('canceled');
  });

  it('the activity log says who did what', async () => {
    const events = (await founder.get('/v1/admin/activity')).json.events;
    const kinds = events.map((e: any) => e.kind);
    for (const k of ['staff.invited', 'staff.joined', 'staff.updated', 'staff.removed', 'admin.early_access_approved']) expect(kinds).toContain(k);
    expect(events.find((e: any) => e.kind === 'staff.removed').actor).toBe(null); // the founder never set a name in this test
    expect(events.find((e: any) => e.kind === 'staff.joined' && e.actor === 'Noor')).toBeTruthy();
  });
});
