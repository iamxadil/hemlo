// Hemlo Systems · Gym: a gym from its first day of trial. Members and their cards, memberships sold and renewed without
// losing a day, the door (in, again, turned back, let in anyway), visits plans, pauses, ladies' hours, personal training
// and the coach's share, classes with places, the door screen, the desk's numbers — and who may do what.
import { describe, it, expect, beforeAll } from 'vitest';
import { setup, Browser, signInEmail, signInPhone } from './helpers';
import { forgetSubscription } from '../apps/api/src/subscription';
import { addDays, addMonths, endOf, today, stateOf } from '../apps/api/src/routes/gym/common';

let t: Awaited<ReturnType<typeof setup>>;
let owner: Browser, desk: Browser, coach: Browser;
let gymId: string;
const ids: Record<string, any> = {};
const day = today();
const join = async (role: string, phone: string, name: string) => {
  const inv = await owner.post('/v1/invites', { phone, role, name });
  expect(inv.status).toBe(201);
  const b = new Browser(t.app);
  await signInPhone(b, '+964' + phone.slice(1));
  await b.post(`/v1/invites/by-token/${encodeURIComponent(new URL(inv.json.url).searchParams.get('t')!)}/accept`);
  await b.post('/v1/auth/organization/set-active', { organizationId: gymId });
  return b;
};
const sell = (b: Browser, memberId: string, plan: string, extra: Record<string, unknown> = {}) => b.post('/v1/gym/memberships', { memberId, planId: ids.plan[plan], paid: 0, ...extra });

beforeAll(async () => {
  t = await setup();
  owner = new Browser(t.app);
  await signInEmail(owner, 'coach.mustafa@titan.iq');
  await owner.post('/v1/auth/update-user', { name: 'Mustafa Adel' });
});

describe('dates', () => {
  it('a month ends the day before the same date next month; days count the first day', () => {
    expect(endOf('2026-01-15', 1, 'month')).toBe('2026-02-14');
    expect(endOf('2026-01-31', 1, 'month')).toBe('2026-02-27');
    expect(endOf('2026-10-05', 12, 'month')).toBe('2027-10-04');
    expect(endOf('2026-10-05', 1, 'day')).toBe('2026-10-05');
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29');
    expect(stateOf({ id: 'x', name: '', category: 'gym', startsOn: '2026-10-01', endsOn: '2026-10-05', visits: null, visitsUsed: 0, status: 'active', frozenFrom: null, freezeDays: 0, frozenDays: 0, trainerId: null, price: 0 }, '2026-10-05'))
      .toMatchObject({ state: 'active', daysLeft: 1 });
  });
});

describe('starting a gym', () => {
  it('an owner starts a 30-day free trial on their own, with a ready price list and hours', async () => {
    const r = await owner.post('/v1/gym/start', { name: 'Titan Fitness', city: 'Baghdad', lang: 'en' });
    expect(r.status).toBe(201);
    gymId = r.json.organizationId;
    await owner.post('/v1/auth/organization/set-active', { organizationId: gymId });
    const me = (await owner.get('/v1/sys/me')).json;
    expect(me.business).toMatchObject({ name: 'Titan Fitness', kind: 'gym', city: 'Baghdad' });
    expect(me.subscription).toMatchObject({ edition: 'gym', status: 'trial', daysLeft: 30 });
    expect(me.can).toMatchObject({ 'members.create': true, 'checkin.create': true, 'memberships.manage': true, 'gym.configure': true });
    const s = (await owner.get('/v1/gym/setup')).json;
    expect(s.plans).toHaveLength(8);
    expect(s.settings.hours['5']).toEqual([{ from: '14:00', to: '23:00', who: 'all' }]); // Friday afternoon
    ids.plan = Object.fromEntries(s.plans.map((p: any) => [p.name, p.id]));
    expect(s.plans.find((p: any) => p.name === '12 visits in a month')).toMatchObject({ visits: 12, duration: 1, unit: 'month', price: 30000 });
  });

  it('one free trial per person', async () => {
    expect((await owner.post('/v1/gym/start', { name: 'Second Gym' })).json.error).toBe('TRIAL_USED');
  });

  it('the team: a front desk and a coach on 40% of personal training', async () => {
    desk = await join('receptionist', '07701110001', 'Zahraa');
    coach = await join('trainer', '07701110002', 'Ahmed the coach');
    const set = (await owner.get('/v1/gym/setup')).json;
    const coachMember = set.members.find((m: any) => m.role === 'trainer');
    const tr = await owner.post('/v1/gym/trainers', { name: 'Coach Ahmed', memberId: coachMember.id, ptShare: 40, gender: 'm', phone: '07701110002' });
    expect(tr.status).toBe(201);
    ids.coach = tr.json.trainer.id;
    expect((await owner.post('/v1/gym/trainers', { name: 'Again', memberId: coachMember.id })).json.error).toBe('ALREADY_A_TRAINER');
    const lady = await owner.post('/v1/gym/trainers', { name: 'Coach Noor', gender: 'f', ptShare: 50 });
    ids.coachNoor = lady.json.trainer.id;
    // a coach opens the app, but sells nothing and changes no prices
    const me = (await coach.get('/v1/sys/me')).json;
    expect(me.can).toMatchObject({ 'members.read': true, 'training.write': true, 'checkin.create': true, 'memberships.sell': false });
    expect((await coach.post('/v1/gym/plans', { name: 'Cheap', category: 'gym', duration: 1, unit: 'month', price: 1 })).status).toBe(403);
  });
});

describe('members', () => {
  it('the desk adds members; each gets a number and a card', async () => {
    const a = await desk.post('/v1/gym/members', { name: 'Ali Hussein', phone: '07801234567', gender: 'm', goal: 'build', health: { knee: true, notes: 'old ACL injury' } });
    expect(a.status).toBe(201);
    expect(a.json.member).toMatchObject({ memberNo: 1, name: 'Ali Hussein', phone: '+9647801234567', alerts: ['knee'] });
    ids.ali = a.json.member.id;
    ids.sara = (await desk.post('/v1/gym/members', { name: 'Sara Kareem', phone: '07811112222', gender: 'f' })).json.member.id;
    ids.omar = (await desk.post('/v1/gym/members', { name: 'Omar Salem', gender: 'm' })).json.member.id;
    ids.zaid = (await desk.post('/v1/gym/members', { name: 'Zaid Faris', gender: 'm', birthDate: `1995-${day.slice(5)}` })).json.member.id;
    const file = (await desk.get(`/v1/gym/members/${ids.ali}`)).json;
    expect(file.member.cardCode).toMatch(/^[2-9A-HJ-NP-Z]{10}$/);
    expect(file.member.health).toMatchObject({ knee: true, notes: 'old ACL injury' });
    ids.aliCard = file.member.cardCode;
    // found by phone, by number, by the scanned card (with the card's prefix)
    expect((await desk.get('/v1/gym/members?q=0780123')).json.members[0].id).toBe(ids.ali);
    expect((await desk.get('/v1/gym/members?q=2')).json.members[0].id).toBe(ids.sara);
    expect((await desk.get(`/v1/gym/members?q=HEMLO-GYM:${ids.aliCard}`)).json.members.map((m: any) => m.id)).toEqual([ids.ali]);
  });
});

describe('selling memberships', () => {
  it('a month, part paid: the rest goes on the account; the sale is in the till', async () => {
    const r = await sell(desk, ids.ali, 'One month', { paid: 25000, method: 'cash' });
    expect(r.status).toBe(201);
    expect(r.json.membership).toMatchObject({ startsOn: day, endsOn: endOf(day, 1, 'month'), price: 40000, state: 'active' });
    expect(r.json.sale).toMatchObject({ total: 40000, paid: 25000, due: 15000, method: 'mixed', note: 'gym' });
    expect(r.json.customer.balance).toBe(15000);
    ids.aliMonth = r.json.membership.id;
  });

  it('renewing early: the new month starts the day after the current one ends (no day lost)', async () => {
    const r = await sell(desk, ids.ali, 'One month', { paid: 40000 });
    expect(r.json.membership.startsOn).toBe(addDays(endOf(day, 1, 'month'), 1));
    expect(r.json.membership.state).toBe('future');
    ids.aliNext = r.json.membership.id;
  });

  it('a different price needs a manager; a discount does not', async () => {
    expect((await sell(desk, ids.sara, 'One month', { price: 10000 })).json.error).toBe('PRICE_LOCKED');
    const r = await sell(desk, ids.sara, '12 visits in a month', { discount: 5000, paid: 25000 });
    expect(r.json.membership).toMatchObject({ price: 25000, discount: 5000, visits: 12, visitsUsed: 0 });
    ids.saraVisits = r.json.membership.id;
    expect((await sell(coach, ids.omar, 'One month')).status).toBe(403);
  });
});

describe('the door', () => {
  it('a scanned card lets a member in; coming back within the hour is the same visit', async () => {
    const r = await desk.post('/v1/gym/checkin', { code: `HEMLO-GYM:${ids.aliCard}` });
    expect(r.status).toBe(201);
    expect(r.json).toMatchObject({ result: 'ok', reason: null, member: { name: 'Ali Hussein' }, membership: { id: ids.aliMonth, state: 'active' } });
    expect(r.json.warn).toContain('owes'); // 15,000 still owed
    const again = await desk.post('/v1/gym/checkin', { memberId: ids.ali });
    expect(again.status).toBe(200);
    expect(again.json.result).toBe('again');
    expect((await desk.post('/v1/gym/checkin', { code: 'ZZZZZZZZZZ' })).json.error).toBe('CARD_UNKNOWN');
  });

  it('a visits plan counts one per visit, and turns the member back once used up — unless the desk lets them in', async () => {
    const r = await desk.post('/v1/gym/checkin', { memberId: ids.sara });
    expect(r.json).toMatchObject({ result: 'ok', membership: { visitsUsed: 1, visitsLeft: 11 } });
    await desk.del(`/v1/gym/checkins/${r.json.checkin.id}`); // a mistake: undone, the visit goes back
    const file = (await desk.get(`/v1/gym/members/${ids.sara}`)).json;
    expect(file.memberships.find((m: any) => m.id === ids.saraVisits).visitsUsed).toBe(0);
    await owner.req('PATCH', `/v1/gym/memberships/${ids.saraVisits}`, { visitsUsed: 12 });
    const denied = await desk.post('/v1/gym/checkin', { memberId: ids.sara });
    expect(denied.json).toMatchObject({ result: 'denied', reason: 'no_visits' });
    const let_in = await desk.post('/v1/gym/checkin', { memberId: ids.sara, override: true });
    expect(let_in.json).toMatchObject({ result: 'override', reason: 'no_visits' });
  });

  it('no membership, or an old one: turned back with the reason; grace days let them in with a warning', async () => {
    expect((await desk.post('/v1/gym/checkin', { memberId: ids.omar })).json).toMatchObject({ result: 'denied', reason: 'none' });
    await sell(desk, ids.omar, 'One month', { startsOn: addDays(day, -32) }); // ended a day or two ago
    expect((await desk.post('/v1/gym/checkin', { memberId: ids.omar })).json).toMatchObject({ result: 'denied', reason: 'expired' });
    await owner.put('/v1/gym/settings', { graceDays: 3 });
    const g = await desk.post('/v1/gym/checkin', { memberId: ids.omar });
    expect(g.json.result).toBe('ok');
    expect(g.json.warn).toContain('grace');
    await owner.put('/v1/gym/settings', { graceDays: 0 });
  });

  it('a paused membership turns them back; resuming adds the paused days to the end', async () => {
    const z = await sell(desk, ids.zaid, 'Three months', { paid: 110000 });
    ids.zaidMs = z.json.membership.id;
    const f = await desk.post(`/v1/gym/memberships/${ids.zaidMs}/freeze`);
    expect(f.json.membership).toMatchObject({ status: 'frozen', frozenFrom: day });
    expect((await desk.post('/v1/gym/checkin', { memberId: ids.zaid })).json).toMatchObject({ result: 'denied', reason: 'frozen' });
    // pretend it was paused 5 days ago
    await t.client.transaction(async (tx: any) => { await tx.query("select set_config('app.system', 'on', true)"); await tx.query('update gym_membership set frozen_from = $1 where id = $2', [addDays(day, -5), ids.zaidMs]); });
    const u = await desk.post(`/v1/gym/memberships/${ids.zaidMs}/unfreeze`);
    expect(u.json).toMatchObject({ paused: 5, added: 5, membership: { status: 'active', frozenDays: 5, endsOn: addDays(endOf(day, 3, 'month'), 5) } });
    const ok = await desk.post('/v1/gym/checkin', { memberId: ids.zaid });
    expect(ok.json.warn).toContain('birthday');
  });

  it('ladies\' hours: a man is turned back while the gym is for women', async () => {
    await owner.put('/v1/gym/settings', { hours: Object.fromEntries(['0', '1', '2', '3', '4', '5', '6'].map((k) => [k, [{ from: '00:00', to: '24:00', who: 'f' }]])), reentryMinutes: 0 });
    expect((await desk.post('/v1/gym/checkin', { memberId: ids.ali })).json).toMatchObject({ result: 'denied', reason: 'hours' });
    await owner.put('/v1/gym/settings', { hours: Object.fromEntries(['0', '1', '2', '3', '4', '5', '6'].map((k) => [k, []])), reentryMinutes: 180 });
    expect((await owner.put('/v1/gym/settings', { hours: { '1': [{ from: '10:00', to: '09:00' }] } })).json.error).toBe('BAD_HOURS');
  });
});

describe('coaching', () => {
  it('personal training: sessions used one by one, and the coach earns their share of each', async () => {
    const pt = await sell(desk, ids.ali, 'Personal training · 12 sessions', { trainerId: ids.coach, paid: 180000 });
    expect(pt.json.membership).toMatchObject({ category: 'pt', trainerId: ids.coach, visits: 12 });
    ids.pt = pt.json.membership.id;
    for (let i = 0; i < 3; i++) expect((await coach.post(`/v1/gym/memberships/${ids.pt}/session`)).status).toBe(201);
    const rep = (await owner.get('/v1/gym/reports')).json;
    const ahmed = rep.coaches.find((c: any) => c.id === ids.coach);
    expect(ahmed).toMatchObject({ sessions: 3, value: 45000, share: 18000 }); // 180,000 ÷ 12 × 3 × 40%
    expect(rep.money.memberships).toBeGreaterThan(0);
    // the member now has this coach
    expect((await desk.get(`/v1/gym/members/${ids.ali}`)).json.member.trainerId).toBe(ids.coach);
  });

  it('measurements: a coach records them; the desk can\'t', async () => {
    expect((await coach.post(`/v1/gym/members/${ids.ali}/measures`, { weight: 92.4, bodyFat: 24, waist: 98 })).status).toBe(201);
    expect((await coach.post(`/v1/gym/members/${ids.ali}/measures`, {})).json.error).toBe('EMPTY_MEASURE');
    expect((await desk.post(`/v1/gym/members/${ids.ali}/measures`, { weight: 90 })).status).toBe(403);
    expect((await coach.get(`/v1/gym/members/${ids.ali}`)).json.measures[0]).toMatchObject({ weight: 92.4, bodyFat: 24 });
  });

  it('classes: places run out; a ladies\' class is for ladies', async () => {
    const dow = new Date(`${day}T12:00:00Z`).getUTCDay();
    const k = await owner.post('/v1/gym/classes', { name: 'Zumba', day: dow, startsAt: '18:00', minutes: 50, capacity: 1, gender: 'f', trainerId: ids.coachNoor });
    expect(k.status).toBe(201);
    const s = (await desk.get('/v1/gym/sessions')).json.sessions;
    expect(s.find((x: any) => x.classId === k.json.class.id)).toMatchObject({ date: day, booked: 0, capacity: 1 });
    expect((await desk.post('/v1/gym/bookings', { classId: k.json.class.id, date: day, memberId: ids.ali })).json.error).toBe('CLASS_GENDER');
    expect((await desk.post('/v1/gym/bookings', { classId: k.json.class.id, date: day, memberId: ids.sara })).status).toBe(201);
    expect((await desk.post('/v1/gym/bookings', { classId: k.json.class.id, date: day, memberId: ids.sara })).json.error).toBe('ALREADY_BOOKED');
    const lady2 = (await desk.post('/v1/gym/members', { name: 'Huda', gender: 'f' })).json.member.id;
    expect((await desk.post('/v1/gym/bookings', { classId: k.json.class.id, date: day, memberId: lady2 })).json.error).toBe('CLASS_FULL');
    expect((await desk.post('/v1/gym/bookings', { classId: k.json.class.id, date: addDays(day, 1), memberId: lady2 })).json.error).toBe('BAD_CLASS'); // not that day
  });
});

describe('the door screen and the desk', () => {
  it('a display-only link greets members by short name; self check-in only when the owner allows it', async () => {
    const link = (await desk.get('/v1/gym/door-link')).json.key;
    const door = new Browser(t.app);
    const s = await door.get(`/v1/gym/door?k=${link}`);
    expect(s.status).toBe(200);
    expect(s.json.gym.name).toBe('Titan Fitness');
    expect(s.json.recent.length).toBeGreaterThan(0);
    expect(s.json.recent.map((x: any) => x.name)).toContain('Zaid F.');
    expect(s.json.classes[0]).toMatchObject({ name: 'Zumba', booked: 1 });
    expect((await door.post(`/v1/gym/door/checkin?k=${link}`, { code: ids.aliCard })).json.error).toBe('SELF_CHECKIN_OFF');
    await owner.put('/v1/gym/settings', { selfCheckin: true, reentryMinutes: 0 });
    const self = await door.post(`/v1/gym/door/checkin?k=${link}`, { code: ids.aliCard });
    expect(self.json).toMatchObject({ result: 'ok', name: 'Ali H.', membership: { state: 'active' } });
    expect(self.json.warn).not.toContain('owes'); // money is between the member and the desk
    expect((await door.get(`/v1/gym/door?k=${link}x`)).status).toBe(404);
    const reset = (await owner.post('/v1/gym/door-link/reset')).json.key;
    expect((await door.get(`/v1/gym/door?k=${link}`)).status).toBe(404);
    expect((await door.get(`/v1/gym/door?k=${reset}`)).status).toBe(200);
  });

  it('the desk\'s day: in now, visits, renewals due, money', async () => {
    const d = (await desk.get('/v1/gym/today')).json;
    expect(d.inNow).toBeGreaterThanOrEqual(3);
    expect(d.visits).toBeGreaterThanOrEqual(4);
    expect(d.turnedBack).toBeGreaterThanOrEqual(3);
    expect(d.active).toBe(2); // Ali, Zaid (Sara's visits are used up, Omar's month is over)
    expect(d.membershipsToday).toBeGreaterThan(0);
    expect(d.owed).toBe(15000 + 40000); // Ali's rest, Omar's unpaid month
    expect(d.hours).toHaveLength(24);
    const list = (await desk.get('/v1/gym/members?status=owing')).json;
    expect(list.counts).toMatchObject({ all: 5, owing: 2 });
    expect(list.members.map((m: any) => m.name).sort()).toEqual(['Ali Hussein', 'Omar Salem']);
    const day1 = (await desk.get('/v1/gym/checkins')).json.checkins;
    expect(day1.some((c: any) => c.result === 'denied')).toBe(true);
  });

  it('when the trial ends, everything opens but nothing new: not at the desk, not at the door', async () => {
    await t.client.transaction(async (tx: any) => {
      await tx.query("select set_config('app.system', 'on', true)");
      await tx.query(`update hemlo_subscription set trial_ends_at = now() - interval '1 minute' where organization_id = $1`, [gymId]);
    });
    forgetSubscription(gymId);
    expect((await desk.get('/v1/gym/members')).status).toBe(200);
    expect((await desk.post('/v1/gym/checkin', { memberId: ids.ali })).json.error).toBe('TRIAL_ENDED');
    const link = (await desk.get('/v1/gym/door-link')).json.key;
    expect((await new Browser(t.app).post(`/v1/gym/door/checkin?k=${link}`, { code: ids.aliCard })).json.error).toBe('TRIAL_ENDED');
  });
});

describe('the demo gym', () => {
  it('opens with a month of life: members on every kind of plan, people training now, coaches, classes, the shop', async () => {
    const v = new Browser(t.app);
    const r = await v.post('/v1/demo/start', { lang: 'en', kind: 'gym' }, { 'cf-connecting-ip': '10.7.7.7' });
    expect(r.status).toBe(201);
    expect(r.json).toMatchObject({ kind: 'gym', business: 'Titan Fitness Club' });
    const h = { authorization: `Bearer ${r.json.token}` };
    expect((await v.get('/v1/sys/me', h)).json.business).toMatchObject({ kind: 'gym', demo: true });
    const d = (await v.get('/v1/gym/today', h)).json;
    expect(d.active).toBeGreaterThan(25);
    expect(d.ending).toBeGreaterThan(2);
    expect(d.lapsed).toBeGreaterThan(2);
    expect(d.owed).toBeGreaterThan(0);
    const list = (await v.get('/v1/gym/members', h)).json;
    expect(list.counts.all).toBe(42);
    expect(list.counts.frozen).toBe(1);
    const s = (await v.get('/v1/gym/setup', h)).json;
    expect(s.trainers).toHaveLength(4);
    expect(s.classes.length).toBeGreaterThan(8);
    const rep = (await v.get('/v1/gym/reports', h)).json;
    expect(rep.members.visits).toBeGreaterThan(300);
    expect(rep.coaches.find((c: any) => c.sessions > 0)).toBeTruthy();
    expect(rep.money.shop).toBeGreaterThan(0);
    // the demo's own member checks in at the desk
    const someone = list.members.find((m: any) => m.state === 'active');
    expect((await v.post('/v1/gym/checkin', { memberId: someone.id }, h)).status).toBeLessThan(300);
    expect((await v.post('/v1/gym/start', { name: 'Real Gym' }, h)).json.error).toBe('NOT_IN_DEMO');
  });
});
