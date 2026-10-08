// What makes the first gyms pay: the register photographed into Hemlo (no typing), and the money the WhatsApp reminders
// brought back, shown against what Hemlo costs. The reader's checks on their own; then a gym's month: reminders logged
// (once a day), renewals and payments that came after one counted, and those that didn't, not.
import { describe, it, expect, beforeAll } from 'vitest';
import { setup, Browser, signInEmail } from './helpers';
import { phoneFrom, toRows, sampleRows, samplePage, type GymPlanLite } from '../apps/api/src/ai/register';
import { addDays, today, endOf } from '../apps/api/src/routes/gym/common';
import { sql } from 'drizzle-orm';
import { withOrg } from '@hemlo/db';
import type { Engine, AskJson } from '../apps/api/src/ai/engine';

const day = today();
const PLANS: GymPlanLite[] = [
  { id: 'p1', name: 'One month', duration: 1, unit: 'month' }, { id: 'p3', name: 'Three months', duration: 3, unit: 'month' },
  { id: 'pd', name: 'Day pass', duration: 1, unit: 'day' },
];

describe('reading a register page', () => {
  it('phones come out as the desk writes them; anything else is flagged', () => {
    expect(phoneFrom('٠٧٧١٢٣٤٥٦٧٨')).toEqual({ phone: '07712345678', ok: true });
    expect(phoneFrom('+964 771 234 5678')).toEqual({ phone: '07712345678', ok: true });
    expect(phoneFrom('7712345678')).toEqual({ phone: '07712345678', ok: true });
    expect(phoneFrom('0771234')).toEqual({ phone: '0771234', ok: false });
    expect(phoneFrom('')).toEqual({ phone: '', ok: true });
  });
  it('memberships matched to the gym’s own; the end worked out from the start; doubts flagged, not guessed', () => {
    const rows = toRows({ rows: [
      { name: 'Karrar Hussein', phone: '07712345601', plan: 'شهر', planIndex: 0, startsOn: addDays(day, -10), endsOn: '', paid: 40000, owes: 0, notes: '' },
      { name: 'Zainab', phone: '0780 123 4502', plan: 'three months', planIndex: -1, startsOn: '', endsOn: addDays(day, 50), paid: 0, owes: 20000, notes: '' },
      { name: 'Ali', phone: '123', plan: 'yoga', planIndex: -1, startsOn: '', endsOn: '', paid: 0, owes: 0, notes: 'back pain' },
      { name: '   ', phone: '', plan: '', planIndex: -1, startsOn: '', endsOn: '', paid: 0, owes: 0, notes: '' },
      { name: 'Noor', phone: '', plan: 'One month', planIndex: 0, startsOn: '1999-01-01', endsOn: '1999-01-31', paid: 0, owes: 0, notes: '' },
    ] }, PLANS, day);
    expect(rows).toHaveLength(4); // the empty line is gone
    expect(rows[0]).toMatchObject({ name: 'Karrar Hussein', plan: 'One month', planId: 'p1', startsOn: addDays(day, -10), check: [] });
    expect(rows[0].endsOn).toBe(endOf(addDays(day, -10), 1, 'month')); // a month on from the start
    expect(rows[1]).toMatchObject({ phone: '07801234502', plan: 'Three months', planId: 'p3', balance: 20000, check: [] });
    expect(rows[2]).toMatchObject({ plan: 'yoga', planId: null, notes: 'back pain' });
    expect(rows[2].check).toEqual(['phone', 'plan', 'date']); // "Ali" is a whole name; the rest is doubtful
    expect(rows[3].check).toContain('date'); // a date years away is a misreading
  });
  it('the demo’s sample page reads into the gym’s own memberships, and the page is drawn as it was written', () => {
    const rows = sampleRows(PLANS, day);
    expect(rows.length).toBeGreaterThan(4);
    expect(rows[0]).toMatchObject({ name: 'كرار حسين', planId: 'p1', startsOn: addDays(day, -12), check: [] });
    expect(rows[1]).toMatchObject({ phone: '07801234502', planId: 'p3', balance: 20000 });
    expect(rows[4].check).toContain('phone'); // a digit short on the page: flagged for the desk
    const page = samplePage(day);
    expect(page[0]).toMatchObject({ name: 'كرار حسين', plan: 'شهر' });
    expect(page[1].owes).toBe('٢٠ الف');
    expect(page[0].from).toMatch(/^[٠-٩]+\/[٠-٩]+$/);
  });
});

// ---------------------------------------------------------------- a gym's month
let t: Awaited<ReturnType<typeof setup>>;
let owner: Browser, other: Browser;
const ids: Record<string, any> = {};
const asked: AskJson[] = [];
const fake: Engine = {
  name: 'test',
  async json<T>(req: AskJson) {
    asked.push(req);
    const data = { rows: [
      { name: 'Hussein Kareem', phone: '٠٧٧٠١٢٣٤٥٦٧', plan: 'شهر', planIndex: 0, startsOn: addDays(day, -3), endsOn: '', paid: 40000, owes: 0, notes: '' },
      { name: 'Rusul Ahmed', phone: '07801112233', plan: 'ثلاثة أشهر', planIndex: 1, startsOn: '', endsOn: addDays(day, 70), paid: 0, owes: 15000, notes: '' },
    ] };
    return { data: data as T, model: 'test', inputTokens: 10, outputTokens: 10, costMicros: 0 };
  },
};

beforeAll(async () => {
  t = await setup({}, fake);
  owner = new Browser(t.app);
  await signInEmail(owner, 'owner@iron-gym.iq');
  const r = await owner.post('/v1/gym/start', { name: 'Iron Gym', city: 'Baghdad', lang: 'en' });
  ids.gym = r.json.organizationId;
  await owner.post('/v1/auth/organization/set-active', { organizationId: ids.gym });
  ids.plans = Object.fromEntries((await owner.get('/v1/gym/setup')).json.plans.map((p: any) => [p.name, p.id]));
});

describe('the register, photographed', () => {
  it('a photo becomes rows to check; one AI action; nothing saved until the desk adds them', async () => {
    const before = (await owner.get('/v1/sys/ai')).json.used;
    const r = await owner.post('/v1/sys/ai/members', { image: 'data:image/jpeg;base64,AAAA' });
    expect(r.status).toBe(200);
    expect(r.json.rows).toHaveLength(2);
    expect(r.json.rows[0]).toMatchObject({ name: 'Hussein Kareem', phone: '07701234567', plan: 'One month', planId: ids.plans['One month'] });
    expect(r.json.rows[1]).toMatchObject({ plan: 'Three months', balance: 15000, endsOn: addDays(day, 70) });
    expect(r.json.used).toBe(before + 1);
    expect(asked.at(-1)!.text).toContain('One month'); // the model is shown the gym's own memberships
    expect((await owner.get('/v1/gym/members')).json.counts.all).toBe(0);
    // the desk adds them through the ordinary import
    const add = await owner.post('/v1/gym/members/import', { rows: r.json.rows.map(({ check, planId, ...x }: any) => x) });
    expect(add.json).toMatchObject({ created: 2, memberships: 2 });
    expect((await owner.post('/v1/sys/ai/members', { image: 'not a photo' })).status).toBe(400);
  });
});

describe('what the reminders brought back', () => {
  it('reminders are logged once a person a day, only for this gym’s own members', async () => {
    const add = (name: string, phone: string) => owner.post('/v1/gym/members', { name, phone }).then((x) => x.json.member?.id ?? x.json.id);
    ids.a = await add('Ahmed Ali', '07711110001');
    ids.b = await add('Baqir Hadi', '07711110002');
    ids.c = await add('Ceylan Omar', '07711110003');
    expect(ids.a && ids.b && ids.c).toBeTruthy();
    for (const id of [ids.a, ids.b, ids.c]) await owner.post('/v1/gym/memberships', { memberId: id, planId: ids.plans['One month'], paid: 40000, startsOn: addDays(day, -27) });
    expect((await owner.post('/v1/sys/reminders', { customerId: ids.a, kind: 'renewal' })).status).toBe(200);
    expect((await owner.post('/v1/sys/reminders', { customerId: ids.a, kind: 'renewal' })).status).toBe(200); // again today: no second one
    await owner.post('/v1/sys/reminders', { customerId: ids.c, kind: 'renewal' });
    expect((await owner.post('/v1/sys/reminders', { customerId: ids.a, kind: 'shout' })).status).toBe(400);
    const list = (await owner.get('/v1/gym/renewals')).json.renewals;
    expect(list.find((x: any) => x.memberId === ids.a).remindedOn).toBe(day);
    expect(list.find((x: any) => x.memberId === ids.b).remindedOn).toBeNull();
  });
  it('a renewal after a reminder counts; one without a reminder does not; nor one long after', async () => {
    await owner.post('/v1/gym/memberships', { memberId: ids.a, planId: ids.plans['Three months'], paid: 110000 });   // reminded: counts
    await owner.post('/v1/gym/memberships', { memberId: ids.b, planId: ids.plans['One month'], paid: 40000 });       // not reminded: doesn't
    // a reminder three weeks ago, and a renewal now: too long after to say it came of it
    await withOrg(t.db, ids.gym, async (tx) => {
      await tx.execute(sql`insert into sys_reminder (id, organization_id, customer_id, kind, sent_on, at) values ('old1', ${ids.gym}, ${ids.c}, 'lapsed', ${addDays(day, -21)}, now() - interval '21 days')`);
      await tx.execute(sql`delete from sys_reminder where customer_id = ${ids.c} and sent_on = ${day}`);
    });
    await owner.post('/v1/gym/memberships', { memberId: ids.c, planId: ids.plans['One month'], paid: 40000 });
    // a debt, a reminder, and a payment
    const owes = await owner.post('/v1/gym/memberships', { memberId: ids.b, planId: ids.plans['Day pass'], paid: 0 });
    expect(owes.status).toBe(201);
    await owner.post('/v1/sys/reminders', { customerId: ids.b, kind: 'debt', amount: 5000 });
    expect((await owner.post(`/v1/sys/customers/${ids.b}/payments`, { amount: 5000 })).status).toBeLessThan(300);
    const x = (await owner.get('/v1/sys/impact')).json;
    expect(x.renewals).toEqual({ n: 1, money: 110000 });
    expect(x.payments).toEqual({ n: 1, money: 5000 });
    expect(x.back).toEqual({ n: 0, money: 0 });
    expect(x.total).toBe(115000);
    expect(x.reminders).toBe(3); // Ahmed's renewal, Baqir's debt, and Ceylan's three weeks ago (in the month, but too early for her renewal)
    expect(x.price).toBe(45000); // a trial is compared with the plan most gyms choose
    expect(x.trial).toMatchObject({ daysLeft: 30 });
  });
  it('another gym sees none of it, and can’t log a reminder for this gym’s member', async () => {
    other = new Browser(t.app);
    await signInEmail(other, 'owner@other-gym.iq');
    const r = await other.post('/v1/gym/start', { name: 'Other Gym', city: 'Basra', lang: 'en' });
    await other.post('/v1/auth/organization/set-active', { organizationId: r.json.organizationId });
    await other.post('/v1/sys/reminders', { customerId: ids.b, kind: 'renewal' });
    expect((await other.get('/v1/sys/impact')).json).toMatchObject({ reminders: 0, total: 0 });
    const [row] = (await t.client.query(`select count(*)::int as n from sys_reminder where customer_id = $1 and kind = 'renewal'`, [ids.b])).rows as any[];
    expect(row.n).toBe(0);
  });
});

describe('the demo gym', () => {
  it('shows money brought back by its reminders, and a sample register page reads for free', async () => {
    const v = new Browser(t.app);
    const r = await v.post('/v1/demo/start', { lang: 'en', kind: 'gym' }, { 'cf-connecting-ip': '10.8.8.8' });
    const h = { authorization: `Bearer ${r.json.token}` };
    const x = (await v.get('/v1/sys/impact', h)).json;
    expect(x.renewals.n).toBeGreaterThan(3);
    expect(x.price).toBe(45000); // a demo gym has no subscription: compared with the gym plan most choose, not a shop's
    expect(x.total).toBeGreaterThan(x.price);
    expect(x.payments.n).toBe(1);
    const s = await v.post('/v1/sys/ai/members', { sample: true }, h);
    expect(s.json.page.length).toBe(s.json.rows.length);
    expect(s.json.rows.length).toBeGreaterThan(4);
    expect(s.json.rows[0].planId).toBeTruthy();
    expect(s.json.used).toBe(0); // the sample is free
    expect((await v.get('/v1/gym/renewals', h)).json.renewals.some((x: any) => x.remindedOn)).toBe(true);
  });
});
