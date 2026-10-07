// End-to-end tests of Hemlo ID: every flow in docs/architecture/auth-system-design.md §3–5, against the real API and a real Postgres.
import { describe, it, expect, beforeAll } from 'vitest';
import { sql } from 'drizzle-orm';
import { eq } from 'drizzle-orm';
import { withOrg } from '@hemlo/db';
import { counterDevice, authEvent } from '@hemlo/db/schema';
import { newId } from '@hemlo/core';
import { setup, Browser, signInEmail, signInPhone, createOrg, lastCode } from './helpers';

let t: Awaited<ReturnType<typeof setup>>;
beforeAll(async () => { t = await setup(); });

const ageSession = async (b: Browser, minutes: number) => {
  const s = await b.get('/v1/auth/get-session');
  await t.client.query(`update "session" set created_at = now() - interval '${minutes} minutes' where id = $1`, [s.json.session.id]);
  // the 5-minute cookie cache would hide the change; drop it
  for (const k of [...b.jar.keys()]) if (k.includes('session_data')) b.jar.delete(k);
};

describe('sign in with a code', () => {
  it('email: new person, then the same person again', async () => {
    const b = new Browser(t.app);
    const r = await signInEmail(b, 'sara@example.com');
    expect(r.user.email).toBe('sara@example.com');
    const again = new Browser(t.app);
    const r2 = await signInEmail(again, 'SARA@example.com');
    expect(r2.user.id).toBe(r.user.id);
  });

  it('phone: new person gets a hidden placeholder email, and the code is stored hashed', async () => {
    const b = new Browser(t.app);
    const phone = '+9647701110001';
    await b.post('/v1/auth/phone-number/send-otp', { phoneNumber: phone });
    const code = lastCode(phone);
    const stored = await t.client.query<{ value: string }>(`select value from verification where identifier = $1`, [phone]);
    expect(stored.rows[0].value).not.toContain(code);
    expect(stored.rows[0].value).toMatch(/^[0-9a-f]{64}:0$/);
    const r = await b.post('/v1/auth/phone-number/verify', { phoneNumber: phone, code });
    expect(r.status).toBe(200);
    const me = (await b.get('/v1/me')).json;
    expect(me.user.phoneNumber).toBe(phone);
    expect(me.user.email).toBeNull();
    expect(me.session.loginMethod).toBe('phone');
  });

  it('phone: only canonical Iraqi numbers are accepted', async () => {
    const b = new Browser(t.app);
    expect((await b.post('/v1/auth/phone-number/send-otp', { phoneNumber: '07701110002' })).status).toBe(400);
    expect((await b.post('/v1/auth/phone-number/send-otp', { phoneNumber: '+12025550101' })).status).toBe(400);
  });

  it('a wrong code counts; five wrong codes kill it', async () => {
    const b = new Browser(t.app);
    const phone = '+9647701110003';
    await b.post('/v1/auth/phone-number/send-otp', { phoneNumber: phone });
    const good = lastCode(phone);
    const bad = good === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) expect((await b.post('/v1/auth/phone-number/verify', { phoneNumber: phone, code: bad })).status).toBe(400);
    const r = await b.post('/v1/auth/phone-number/verify', { phoneNumber: phone, code: good });
    expect(r.status).toBeGreaterThanOrEqual(400);
  });

  it('sending codes is rate limited per number', async () => {
    const b = new Browser(t.app);
    const phone = '+9647701110004';
    const statuses: number[] = [];
    for (let i = 0; i < 7; i++) statuses.push((await b.post('/v1/auth/phone-number/send-otp', { phoneNumber: phone })).status);
    expect(statuses.slice(0, 5).every((s) => s === 200)).toBe(true);
    expect(statuses.at(-1)).toBe(429);
  });

  it('the code limit follows the address, so people sharing a carrier IP don’t block each other', async () => {
    const b = new Browser(t.app);
    const statuses: number[] = [];
    for (let i = 0; i < 8; i++) statuses.push((await b.post('/v1/auth/email-otp/send-verification-otp', { email: `shared-ip-${i}@example.com`, type: 'sign-in' })).status);
    expect(statuses.every((s) => s === 200)).toBe(true);
  });

  it('passwords are switched off', async () => {
    const b = new Browser(t.app);
    const r = await b.post('/v1/auth/sign-up/email', { email: 'x@example.com', password: 'password123', name: 'x' });
    expect(r.status).toBeGreaterThanOrEqual(400);
  });
});

describe('businesses, invitations and roles', () => {
  const owner = () => new Browser(t.app);
  let o: Browser, orgId: string;

  beforeAll(async () => {
    o = owner();
    await signInEmail(o, 'owner-rafidain@example.com');
    const org = await createOrg(o, 'Al Rafidain Workshop');
    orgId = org.id;
  });

  it('the creator is the owner, with the active business set', async () => {
    const me = (await o.get('/v1/me')).json;
    expect(me.activeOrganizationId).toBe(orgId);
    expect(me.organizations[0].role).toBe('owner');
    expect((await o.get('/v1/can?resource=billing&action=manage')).json.allowed).toBe(true);
  });

  it('invite by phone → WhatsApp share link → accept with the same phone', async () => {
    const inv = await o.post('/v1/invites', { phone: '0770 222 0001', role: 'cashier', name: 'Ali' });
    expect(inv.status).toBe(201);
    expect(inv.json.whatsappUrl).toMatch(/^https:\/\/wa\.me\/9647702220001\?text=/);
    const token = new URL(inv.json.url).searchParams.get('t')!;

    const preview = await new Browser(t.app).get(`/v1/invites/by-token/${encodeURIComponent(token)}`);
    expect(preview.json.organization.name).toBe('Al Rafidain Workshop');
    expect(preview.json.contact.phone).toBe('0770 ••• ••01');

    // someone else can't use the link
    const stranger = new Browser(t.app);
    await signInPhone(stranger, '+9647702229999');
    expect((await stranger.post(`/v1/invites/by-token/${encodeURIComponent(token)}/accept`)).json.error).toBe('CONTACT_MISMATCH');

    const ali = new Browser(t.app);
    await signInPhone(ali, '+9647702220001');
    const acc = await ali.post(`/v1/invites/by-token/${encodeURIComponent(token)}/accept`);
    expect(acc.status).toBe(200);
    const me = (await ali.get('/v1/me')).json;
    expect(me.activeOrganizationId).toBe(orgId);
    expect(me.organizations[0].role).toBe('cashier');
    expect((await ali.get('/v1/can?resource=sales&action=create')).json.allowed).toBe(true);
    expect((await ali.get('/v1/can?resource=sales&action=refund')).json.allowed).toBe(false);

    // one use only
    expect((await ali.post(`/v1/invites/by-token/${encodeURIComponent(token)}/accept`)).json.error).toBe('INVITE_USED');
    // cashiers can't invite
    expect((await ali.post('/v1/invites', { phone: '07702220002', role: 'cashier' })).status).toBe(403);
  });

  it('invite by email sends the email; nobody can give a role above their own', async () => {
    const r = await o.post('/v1/invites', { email: 'admin@example.com', role: 'admin' });
    expect(r.status).toBe(201);
    const token = new URL(r.json.url).searchParams.get('t')!;
    const m = new Browser(t.app);
    await signInEmail(m, 'admin@example.com');
    expect((await m.post(`/v1/invites/by-token/${encodeURIComponent(token)}/accept`)).status).toBe(200);
    // an admin can invite a manager, but not an owner or another admin
    expect((await m.post('/v1/invites', { email: 'x@example.com', role: 'owner' })).json.error).toBe('ROLE_TOO_HIGH');
    expect((await m.post('/v1/invites', { email: 'x@example.com', role: 'admin' })).json.error).toBe('ROLE_TOO_HIGH');
    expect((await m.post('/v1/invites', { email: 'x@example.com', role: 'manager' })).status).toBe(201);
  });

  it('the business log records what happened', async () => {
    const ev = (await o.get('/v1/events/org')).json.events.map((e: any) => e.kind);
    expect(ev).toEqual(expect.arrayContaining(['org.created', 'invite.created', 'invite.accepted', 'member.added']));
  });

  it('API keys: fresh session needed, scoped permissions, usable with x-api-key', async () => {
    await ageSession(o, 30);
    const stale = await o.post('/v1/api-keys', { name: 'Website', permissions: { customers: ['read'] } });
    expect(stale.json.error).toBe('SESSION_NOT_FRESH');
    const fresh = new Browser(t.app);
    await signInEmail(fresh, 'owner-rafidain@example.com');
    await fresh.post('/v1/auth/organization/set-active', { organizationId: orgId });
    const k = await fresh.post('/v1/api-keys', { name: 'Website', permissions: { customers: ['read'] } });
    expect(k.status).toBe(201);
    expect(k.json.key).toMatch(/^hk_/);
    const bot = new Browser(t.app);
    expect((await bot.get('/v1/can?resource=customers&action=read', { 'x-api-key': k.json.key })).json).toMatchObject({ allowed: true, as: 'apikey', organizationId: orgId });
    expect((await bot.get('/v1/can?resource=sales&action=create', { 'x-api-key': k.json.key })).json.allowed).toBe(false);
    expect((await fresh.get('/v1/api-keys')).json.keys[0]).not.toHaveProperty('key');
    expect((await fresh.del(`/v1/api-keys/${k.json.id}`)).status).toBe(200);
    expect((await bot.get('/v1/can?resource=customers&action=read', { 'x-api-key': k.json.key })).status).toBe(401);
  });
});

describe('counter mode', () => {
  let owner: Browser, orgId: string, counter: Browser, cashier: Browser, cashierMemberId: string;

  beforeAll(async () => {
    owner = new Browser(t.app);
    await signInEmail(owner, 'owner-counter@example.com');
    orgId = (await createOrg(owner, 'Karrada Phones')).id;
    const inv = await owner.post('/v1/invites', { phone: '07703330001', role: 'cashier', name: 'Noor' });
    cashier = new Browser(t.app);
    await signInPhone(cashier, '+9647703330001');
    await cashier.post(`/v1/invites/by-token/${encodeURIComponent(new URL(inv.json.url).searchParams.get('t')!)}/accept`);
  });

  it('staff set their own PIN (weak PINs refused)', async () => {
    expect((await cashier.put('/v1/counter/pin', { pin: '1234' })).json.error).toBe('PIN_TOO_EASY');
    expect((await cashier.put('/v1/counter/pin', { pin: '48' })).json.error).toBe('PIN_FORMAT');
    expect((await cashier.put('/v1/counter/pin', { pin: '4827' })).status).toBe(200);
    expect((await cashier.get('/v1/counter/pin')).json.hasPin).toBe(true);
  });

  it('a cashier cannot trust a device; an owner can, from a fresh session', async () => {
    expect((await cashier.post('/v1/counter/devices', { name: 'Front desk' })).status).toBe(403);
    counter = new Browser(t.app, 'Mozilla/5.0 (Linux; Android 13; SM-T220) Chrome/129.0 Safari/537.36');
    await signInEmail(counter, 'owner-counter@example.com'); // the owner signs in on the shop tablet
    await counter.post('/v1/auth/organization/set-active', { organizationId: orgId });
    const r = await counter.post('/v1/counter/devices', { name: 'Front desk' });
    expect(r.status).toBe(201);
    expect(counter.jar.has('hemlo.counter')).toBe(true);
    // trusting hands the device over: the owner's session on it is gone
    expect((await counter.get('/v1/me')).status).toBe(401);
    expect((await owner.get('/v1/me')).status).toBe(200); // their phone is unaffected
  });

  it('the device shows who can unlock it; nothing works until someone does', async () => {
    const s = await counter.get('/v1/counter/state');
    expect(s.json.device.organization.name).toBe('Karrada Phones');
    expect(s.json.staff.map((x: any) => x.name)).toEqual(['Noor']); // the name typed in the invitation
    cashierMemberId = s.json.staff[0].memberId;
    expect(s.json.active).toBeNull();
    expect((await counter.get('/v1/can?resource=sales&action=create')).status).toBe(423);
  });

  it('five wrong PINs lock that person on that device; the owner unlocks', async () => {
    for (let i = 0; i < 4; i++) expect((await counter.post('/v1/counter/unlock', { memberId: cashierMemberId, pin: '0000' })).json.error).toBe('WRONG_PIN');
    expect((await counter.post('/v1/counter/unlock', { memberId: cashierMemberId, pin: '0000' })).json.error).toBe('PIN_LOCKED');
    expect((await counter.post('/v1/counter/unlock', { memberId: cashierMemberId, pin: '4827' })).json.error).toBe('PIN_LOCKED');
    const devices = (await owner.get('/v1/counter/devices')).json.devices;
    await owner.post(`/v1/counter/devices/${devices[0].id}/unlock-member`, { memberId: cashierMemberId });
    const ok = await counter.post('/v1/counter/unlock', { memberId: cashierMemberId, pin: '4827' });
    expect(ok.status).toBe(200);
    expect(ok.json.active.memberId).toBe(cashierMemberId);
  });

  it('unlocked: the cashier’s counter permissions only', async () => {
    expect((await counter.get('/v1/can?resource=sales&action=create')).json).toMatchObject({ allowed: true, as: 'counter' });
    expect((await counter.get('/v1/can?resource=sales&action=refund')).json.allowed).toBe(false);
    await counter.post('/v1/counter/lock');
    expect((await counter.get('/v1/can?resource=sales&action=create')).status).toBe(423);
  });

  it('a revoked device stops working at once', async () => {
    const devices = (await owner.get('/v1/counter/devices')).json.devices;
    await owner.del(`/v1/counter/devices/${devices[0].id}`);
    expect((await counter.get('/v1/counter/state')).status).toBe(401);
  });
});

describe('protection for owners', () => {
  it('a phone code alone cannot open an owner account that has a backup; the email completes it', async () => {
    const phone = '+9647704440001', email = 'boss@example.com';
    const first = new Browser(t.app);
    await signInEmail(first, email);
    await createOrg(first, 'Boss Co');
    // add a phone number to the account
    await first.post('/v1/auth/phone-number/send-otp', { phoneNumber: phone });
    expect((await first.post('/v1/auth/phone-number/verify', { phoneNumber: phone, code: lastCode(phone), updatePhoneNumber: true })).status).toBe(200);

    // someone with the (recycled) SIM signs in with only a phone code
    const sim = new Browser(t.app, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) Safari/604.1');
    await signInPhone(sim, phone);
    const me = (await sim.get('/v1/me')).json;
    expect(me.session.secondFactorPending).toBe(true);
    expect((await sim.get('/v1/auth/organization/list')).json?.code).toBe('SECOND_FACTOR_REQUIRED');
    expect((await sim.get('/v1/can?resource=billing&action=manage')).json).toMatchObject({ allowed: false, reason: 'SECOND_FACTOR_REQUIRED' });
    expect((await sim.get('/v1/events/me')).json.error).toBe('SECOND_FACTOR_REQUIRED');
    expect((await sim.get('/v1/auth/passkey/generate-register-options')).json?.code).toBe('SECOND_FACTOR_REQUIRED');

    // the real owner completes it with the email code → the waiting session is replaced
    await signInEmail(sim, email);
    const after = (await sim.get('/v1/me')).json;
    expect(after.session.secondFactorPending).toBe(false);
    const pending = await t.client.query(`select count(*)::int as n from "session" where second_factor_pending = true`);
    expect(pending.rows[0]).toEqual({ n: 0 });
  });
});

describe('sessions', () => {
  it('a new device triggers an alert; sessions can be listed and signed out', async () => {
    const email = 'devices@example.com';
    const a = new Browser(t.app, 'Mozilla/5.0 (Windows NT 10.0) Chrome/130.0 Safari/537.36');
    await signInEmail(a, email);
    const b = new Browser(t.app, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) Safari/604.1');
    await signInEmail(b, email);
    const events = (await a.get('/v1/events/me')).json.events.map((e: any) => e.kind);
    expect(events).toContain('session.new_device');
    const sessions = (await a.get('/v1/auth/list-sessions')).json;
    expect(sessions.length).toBe(2);
    expect((await a.post('/v1/auth/revoke-other-sessions')).status).toBe(200);
    for (const k of [...b.jar.keys()]) if (k.includes('session_data')) b.jar.delete(k);
    expect((await b.get('/v1/me')).status).toBe(401);
    await a.post('/v1/auth/sign-out');
    expect((await a.get('/v1/me')).status).toBe(401);
  });

  it('an older session can still see its devices; signing others out needs a fresh sign-in', async () => {
    const a = new Browser(t.app);
    await signInEmail(a, 'older-session@example.com');
    await ageSession(a, 30);
    const list = await a.get('/v1/auth/list-sessions');
    expect(list.status).toBe(200);
    expect(list.json.length).toBe(1);
    const revoke = await a.post('/v1/auth/revoke-other-sessions');
    expect(revoke.status).toBe(403);
    expect(revoke.json.code).toBe('SESSION_NOT_FRESH');
  });
});

describe('the second lock: row-level security', () => {
  it('rows of one business are invisible from another', async () => {
    const orgA = 'orgA-' + newId(), orgB = 'orgB-' + newId();
    await withOrg(t.db, orgA, (tx) => tx.insert(counterDevice).values({ id: newId(), organizationId: orgA, name: 'A', tokenHash: newId(), createdBy: 'u', expiresAt: new Date(Date.now() + 1e9) }));
    expect((await withOrg(t.db, orgA, (tx) => tx.select().from(counterDevice).where(eq(counterDevice.organizationId, orgA)))).length).toBe(1);
    expect((await withOrg(t.db, orgB, (tx) => tx.select().from(counterDevice).where(eq(counterDevice.organizationId, orgA)))).length).toBe(0);
    // no scope at all → nothing
    expect((await t.db.select().from(counterDevice)).length).toBe(0);
    expect((await t.db.select().from(authEvent)).length).toBe(0);
    // writing into another business is refused
    await expect(withOrg(t.db, orgB, (tx) => tx.insert(counterDevice).values({ id: newId(), organizationId: orgA, name: 'x', tokenHash: newId(), createdBy: 'u', expiresAt: new Date() }))).rejects.toThrow();
    const role = await t.db.execute(sql`select current_user as u, (select rolsuper from pg_roles where rolname = current_user) as su`);
    expect((role as any).rows?.[0] ?? (role as any)[0]).toMatchObject({ u: 'hemlo_app', su: false });
  });
});

describe('OpenID for mobile apps and custom domains', () => {
  it('publishes discovery metadata and keys', async () => {
    const b = new Browser(t.app);
    const d = await b.get('/.well-known/openid-configuration');
    expect(d.status).toBe(200);
    expect(d.json.authorization_endpoint).toContain('/v1/auth/oauth2/authorize');
    expect((await b.get('/v1/auth/jwks')).json.keys.length).toBeGreaterThan(0);
  });
});
