// Bringing a business's people in from a spreadsheet: shop customers with what they owe, clinic patients with their file
// numbers, gym members with the membership they have now. Bad rows are skipped with a reason; importing the same sheet
// again updates instead of duplicating; old debts land in the debt book as one line each.
import { describe, it, expect, beforeAll } from 'vitest';
import { setup, Browser, signInEmail } from './helpers';
import { today, addDays } from '../apps/api/src/routes/gym/common';

let t: Awaited<ReturnType<typeof setup>>;
const day = today();
const owner = async (email: string, start: string, body: Record<string, unknown>) => {
  const b = new Browser(t.app);
  await signInEmail(b, email);
  const r = await b.post(start, body);
  expect(r.status).toBe(201);
  await b.post('/v1/auth/organization/set-active', { organizationId: r.json.organizationId });
  return b;
};

beforeAll(async () => { t = await setup(); });

describe('a shop imports its debt book', () => {
  it('adds customers with their old debts; the same sheet again updates; bad rows are reported', async () => {
    const shop = await owner('shop@import.iq', '/v1/store/start', { name: 'Al-Amal Market' });
    const rows = [
      { name: 'Abu Ali', phone: '07701112233', balance: 25000, note: 'pays on Thursdays' },
      { name: 'Um Zahraa', phone: '0770 111 2244', balance: 0 },
      { name: '', phone: '07701112255' },                        // no name
      { name: 'Hassan', phone: '12' },                           // not a phone
      { name: 'Abu Ali again', phone: '+9647701112233', balance: 1 }, // same phone twice in the sheet
    ];
    const r = await shop.post('/v1/sys/customers/import', { rows });
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({ created: 2, updated: 0 });
    expect(r.json.errors).toEqual([{ row: 2, code: 'BAD_NAME' }, { row: 3, code: 'BAD_PHONE' }, { row: 4, code: 'DUPLICATE_PHONE' }]);
    const list = (await shop.get('/v1/sys/customers')).json.customers;
    const ali = list.find((c: any) => c.name === 'Abu Ali');
    expect(ali).toMatchObject({ phone: '+9647701112233', balance: 25000, note: 'pays on Thursdays' });
    const book = (await shop.get(`/v1/sys/customers/${ali.id}`)).json.ledger;
    expect(book).toHaveLength(1);
    expect(book[0]).toMatchObject({ kind: 'adjust', amount: 25000, balance: 25000, note: 'import' });
    // again, with a corrected debt: updated, and the debt book shows the change
    const again = await shop.post('/v1/sys/customers/import', { rows: [{ name: 'Abu Ali', phone: '07701112233', balance: 20000 }] });
    expect(again.json).toMatchObject({ created: 0, updated: 1 });
    expect((await shop.get(`/v1/sys/customers/${ali.id}`)).json.ledger[0]).toMatchObject({ amount: -5000, balance: 20000 });
    expect((await shop.post('/v1/sys/customers/import', { rows: [] })).json.error).toBe('BAD_IMPORT');
  });
});

describe('a clinic imports its patients', () => {
  it('keeps file numbers from the sheet when free, numbers the rest after them, and reads genders in Arabic', async () => {
    const clinic = await owner('dr@import.iq', '/v1/dent/start', { name: 'Smile' });
    const r = await clinic.post('/v1/dent/patients/import', { rows: [
      { name: 'زينب حسين', phone: '07801234567', fileNo: 120, gender: 'أنثى', birthDate: '1990-04-12', balance: 75000 },
      { name: 'علي كاظم', phone: '07801234568', gender: 'ذكر' },
      { name: 'Taken', fileNo: 120 },
      { name: 'Bad date', birthDate: '12/40/1990' },
      { name: 'Bad gender', gender: 'x' },
    ] });
    expect(r.json).toMatchObject({ created: 2, updated: 0 });
    expect(r.json.errors.map((e: any) => e.code)).toEqual(['FILE_NO_TAKEN', 'BAD_BIRTH_DATE', 'BAD_GENDER']);
    const list = (await clinic.get('/v1/dent/patients')).json.patients;
    expect(list.find((p: any) => p.name === 'زينب حسين')).toMatchObject({ fileNo: 120, gender: 'f', birthDate: '1990-04-12', balance: 75000 });
    expect(list.find((p: any) => p.name === 'علي كاظم')).toMatchObject({ fileNo: 121, gender: 'm' });
    // a new patient added by hand continues after them
    expect((await clinic.post('/v1/dent/patients', { name: 'New one' })).json.patient.fileNo).toBe(122);
    // the same sheet again: updated, not doubled
    expect((await clinic.post('/v1/dent/patients/import', { rows: [{ name: 'زينب حسين', phone: '07801234567', notes: 'moved from paper' }] })).json).toMatchObject({ created: 0, updated: 1 });
    expect((await clinic.get('/v1/dent/patients')).json.patients).toHaveLength(3);
  });
});

describe('a gym imports its members', () => {
  it('members with the membership they have now: plans matched by name, days and visits left, opening debts', async () => {
    const gym = await owner('coach@import.iq', '/v1/gym/start', { name: 'Iron', lang: 'en' });
    const r = await gym.post('/v1/gym/members/import', { planName: 'Previous membership', rows: [
      { name: 'Ali Hussein', phone: '07501112233', gender: 'male', plan: 'three months', endsOn: addDays(day, 40), balance: 15000 },
      { name: 'Sara Ahmed', phone: '07501112244', gender: 'F', plan: '12 visits in a month', endsOn: addDays(day, 10), visitsLeft: 4 },
      { name: 'Omar', phone: '07501112255', memberNo: 300, plan: 'Old VIP deal', startsOn: addDays(day, -60), endsOn: addDays(day, -5) },
      { name: 'Nobody', startsOn: day },
    ] });
    expect(r.json).toMatchObject({ created: 3, updated: 0, memberships: 3 });
    expect(r.json.errors).toEqual([{ row: 3, code: 'NO_END_DATE' }]);
    const list = (await gym.get('/v1/gym/members?status=all')).json;
    const ali = list.members.find((m: any) => m.name === 'Ali Hussein'), sara = list.members.find((m: any) => m.name === 'Sara Ahmed'), omar = list.members.find((m: any) => m.name === 'Omar');
    expect(ali).toMatchObject({ state: 'active', balance: 15000, gender: 'm', membership: { name: 'Three months', endsOn: addDays(day, 40) } });
    expect(sara.membership).toMatchObject({ name: '12 visits in a month', visits: 4, visitsUsed: 0 });
    expect(omar).toMatchObject({ memberNo: 300, state: 'expired', membership: { name: 'Old VIP deal' } });
    expect(list.counts.owing).toBe(1);
    // they check in at the desk at once, with their imported days
    const ci = await gym.post('/v1/gym/checkin', { memberId: ali.id });
    expect(ci.json).toMatchObject({ result: 'ok', membership: { daysLeft: 41 } });
    // new members are numbered after the highest imported number
    expect((await gym.post('/v1/gym/members', { name: 'Walk-in' })).json.member.memberNo).toBe(301);
    // the same sheet again: nothing doubled
    const again = await gym.post('/v1/gym/members/import', { rows: [{ name: 'Ali Hussein', phone: '07501112233', plan: 'three months', endsOn: addDays(day, 40) }] });
    expect(again.json).toMatchObject({ created: 0, updated: 1, memberships: 0 });
    // only people who may add members can import
    expect((await new Browser(t.app).post('/v1/gym/members/import', { rows: [{ name: 'x' }] })).status).toBe(401);
  });
});
