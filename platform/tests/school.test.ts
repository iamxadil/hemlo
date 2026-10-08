// Hemlo School's core: starting a school (this year, its grades and sections), admitting students (siblings share one
// guardian and one link), fee plans written as each student's instalments, payments with running receipt numbers and
// balances that are summed, never stored, the roll call, the morning picture, the guardian's page, a teacher who can
// take attendance but not touch money, and one school never seeing another's.
import { describe, it, expect, beforeAll } from 'vitest';
import { setup, Browser, signInEmail, signInPhone } from './helpers';
import { academicYear, defaultInstallments } from '../apps/api/src/routes/school/common';
import { today } from '../apps/api/src/routes/realestate/common';

let t: Awaited<ReturnType<typeof setup>>;
let owner: Browser, other: Browser, teacher: Browser;
let schoolId = '';
const ids: Record<string, string> = {};
const day = today();
const ay = academicYear(day);

const join = async (role: string, phone: string, name: string) => {
  const inv = await owner.post('/v1/invites', { phone, role, name });
  expect(inv.status).toBe(201);
  const b = new Browser(t.app);
  await signInPhone(b, '+964' + phone.slice(1));
  await b.post(`/v1/invites/by-token/${encodeURIComponent(new URL(inv.json.url).searchParams.get('t')!)}/accept`);
  await b.post('/v1/auth/organization/set-active', { organizationId: schoolId });
  return b;
};

beforeAll(async () => {
  t = await setup();
  owner = new Browser(t.app);
  await signInEmail(owner, 'suha@rowad-school.iq');
  const r = await owner.post('/v1/sch/start', { name: 'Al-Rowad School', city: 'Baghdad', kind: 'school', phone: '07701234567', lang: 'en' });
  expect(r.status).toBe(201);
  schoolId = r.json.organizationId;
  await owner.post('/v1/auth/organization/set-active', { organizationId: schoolId });
});

describe('the Iraqi school year', () => {
  it('starts in autumn and ends in June; three instalments add up to the year', () => {
    expect(academicYear('2026-10-08')).toMatchObject({ name: '2026–2027', startsOn: '2026-09-21', endsOn: '2027-06-30' });
    expect(academicYear('2027-03-01').name).toBe('2026–2027');
    const inst = defaultInstallments(2026, 1_800_001, 'en');
    expect(inst.map((x) => x.dueOn)).toEqual(['2026-09-21', '2027-01-04', '2027-03-01']);
    expect(inst.reduce((s, x) => s + x.amount, 0)).toBe(1_800_001);
  });
});

describe('a new school', () => {
  it('opens ready: this year, six primary grades, a section each', async () => {
    const s = (await owner.get('/v1/sch/setup')).json;
    expect(s.school).toMatchObject({ kind: 'school', city: 'Baghdad', year: { name: ay.name } });
    expect(s.grades.map((g: any) => g.name)).toEqual(['First primary', 'Second primary', 'Third primary', 'Fourth primary', 'Fifth primary', 'Sixth primary']);
    expect(s.classes).toHaveLength(6);
    expect(s.classes[0]).toMatchObject({ name: 'A', students: 0 });
    expect((await owner.get('/v1/sys/me')).json).toMatchObject({ business: { kind: 'school' }, can: { 'students.create': true, 'fees.manage': true, 'attendance.take': true } });
    ids.grade1 = s.grades[0].id; ids.class1A = s.classes[0].id; ids.grade2 = s.grades[1].id; ids.class2A = s.classes[1].id;
    expect((await owner.post('/v1/sch/start', { name: 'Again' })).json.error).toBe('TRIAL_USED');
  });
  it('a second section, and a fee plan for everyone', async () => {
    const b = await owner.post('/v1/sch/classes', { gradeId: ids.grade1, name: 'B', room: '102', capacity: 25 });
    expect(b.status).toBe(201);
    ids.class1B = b.json.id;
    expect((await owner.post('/v1/sch/fees/plans', { name: 'Tuition', installments: [{ label: 'One', dueOn: '2026-01-01', amount: 0 }] })).json.error).toBe('BAD_INSTALLMENTS');
    const p = await owner.post('/v1/sch/fees/plans', { name: 'Yearly tuition', installments: defaultInstallments(ay.start, 1_500_000, 'en') });
    expect(p.status).toBe(201);
    ids.plan = p.json.id;
  });
});

describe('students and their families', () => {
  it('admitting a student: a number, a guardian, the class, the year’s instalments', async () => {
    const r = await owner.post('/v1/sch/students', { name: 'Ali Hassan', gender: 'm', classId: ids.class1A, guardian: { name: 'Hassan Kareem', relation: 'father', phone: '07801112233' } });
    expect(r.status).toBe(201);
    ids.ali = r.json.id;
    const f = (await owner.get(`/v1/sch/students/${ids.ali}`)).json;
    expect(f.student).toMatchObject({ number: 1, name: 'Ali Hassan' });
    expect(f.enrollment).toMatchObject({ className: 'A', gradeName: 'First primary' });
    expect(f.guardians[0]).toMatchObject({ name: 'Hassan Kareem', phone: '+9647801112233' });
    expect(f.charges.map((c: any) => c.amount)).toEqual([500_000, 500_000, 500_000]);
    expect(f.money).toMatchObject({ charged: 1_500_000, paid: 0, balance: 1_500_000, overdue: 500_000 }); // the first instalment fell due in September
  });
  it('a brother: the same father by phone, one guardian, one link; siblings show on each file', async () => {
    const r = await owner.post('/v1/sch/students', { name: 'Zainab Hassan', gender: 'f', classId: ids.class2A, guardian: { name: 'Hassan K.', phone: '+964 780 111 2233' } });
    ids.zainab = r.json.id;
    const f = (await owner.get(`/v1/sch/students/${ids.zainab}`)).json;
    const a = (await owner.get(`/v1/sch/students/${ids.ali}`)).json;
    expect(f.guardians[0].id).toBe(a.guardians[0].id);
    expect(f.siblings.map((s: any) => s.name)).toEqual(['Ali Hassan']);
    ids.token = a.guardians[0].token;
    expect(ids.token).toMatch(/^[a-z0-9]{16}$/);
  });
  it('a whole class at once, and the list (search by name, number or a parent’s phone; filter by class; money shown)', async () => {
    const r = await owner.post('/v1/sch/students/import', { classId: ids.class1B, rows: [
      { name: 'Maryam Adel', gender: 'f', guardianName: 'Adel Jasim', phone: '07711110001' },
      { name: 'Omar Sabah', gender: 'm', guardianName: 'Sabah Ali', phone: '07711110002' },
      { name: 'Noor Falah', gender: 'f' },
    ] });
    expect(r.json.added).toBe(3);
    expect((await owner.post('/v1/sch/students/import', { classId: ids.class1B, rows: [{ name: '' }] })).json.error).toBe('BAD_NAME');
    const all = (await owner.get('/v1/sch/students')).json;
    expect(all.total).toBe(5);
    expect(all.students[0]).toMatchObject({ className: 'A', gradeName: 'First primary', balance: 1_500_000, overdue: 500_000 });
    expect((await owner.get('/v1/sch/students?q=maryam')).json.students.map((s: any) => s.name)).toEqual(['Maryam Adel']);
    expect((await owner.get('/v1/sch/students?q=0771111000')).json.total).toBe(2); // the start of a number: both parents
    expect((await owner.get('/v1/sch/students?q=07711110002')).json.students.map((s: any) => s.name)).toEqual(['Omar Sabah']);
    expect((await owner.get(`/v1/sch/students?classId=${ids.class1B}`)).json.total).toBe(3);
    expect((await owner.get('/v1/sch/students?q=2')).json.students.map((s: any) => s.name)).toEqual(['Zainab Hassan']); // student number 2
    ids.omar = (await owner.get('/v1/sch/students?q=omar')).json.students[0].id;
  });
  it('moving class adds the new grade’s plan only once', async () => {
    const before = (await owner.get(`/v1/sch/students/${ids.omar}`)).json.charges.length;
    expect((await owner.post(`/v1/sch/students/${ids.omar}/move`, { classId: ids.class2A })).status).toBe(200);
    const f = (await owner.get(`/v1/sch/students/${ids.omar}`)).json;
    expect(f.enrollment.className).toBe('A');
    expect(f.charges.length).toBe(before); // the plan is for every grade: nothing new
  });
});

describe('money', () => {
  it('payments get running receipt numbers; balance and overdue follow; a discount and a one-off count too', async () => {
    const p1 = await owner.post(`/v1/sch/students/${ids.ali}/payments`, { amount: 300_000, method: 'cash', payer: 'Hassan' });
    expect(p1.status).toBe(201);
    expect(p1.json).toMatchObject({ payment: { number: 1, amount: 300_000 }, balance: 1_200_000, overdue: 200_000 });
    const p2 = await owner.post(`/v1/sch/students/${ids.zainab}/payments`, { amount: 500_000, method: 'fib' });
    expect(p2.json).toMatchObject({ payment: { number: 2 }, overdue: 0 });
    expect((await owner.post(`/v1/sch/students/${ids.ali}/payments`, { amount: -5 })).json.error).toBe('BAD_AMOUNT');
    await owner.post(`/v1/sch/students/${ids.zainab}/charges`, { kind: 'discount', label: 'Sibling 10%', amount: 150_000 });
    await owner.post(`/v1/sch/students/${ids.zainab}/charges`, { kind: 'books', label: 'Books', amount: 60_000, dueOn: day });
    const z = (await owner.get(`/v1/sch/students/${ids.zainab}`)).json.money;
    expect(z).toMatchObject({ charged: 1_500_000 - 150_000 + 60_000, paid: 500_000, balance: 910_000 });
  });
  it('a voided receipt stops counting, and keeps its number', async () => {
    const p = await owner.post(`/v1/sch/students/${ids.omar}/payments`, { amount: 100_000 });
    expect((await owner.post(`/v1/sch/payments/${p.json.payment.id}/void`, { reason: 'typed twice' })).status).toBe(200);
    expect((await owner.post(`/v1/sch/payments/${p.json.payment.id}/void`, {})).status).toBe(404);
    expect((await owner.get(`/v1/sch/students/${ids.omar}`)).json.money.paid).toBe(0);
    expect((await owner.post(`/v1/sch/students/${ids.omar}/payments`, { amount: 100_000 })).json.payment.number).toBe(4);
  });
  it('the overview: collected, who is late (most first, with the parent’s number), what falls due', async () => {
    const o = (await owner.get('/v1/sch/fees/overview')).json;
    expect(o.totals.today).toBe(900_000);
    expect(o.totals.todayCount).toBe(3);
    expect(o.late[0]).toMatchObject({ name: expect.any(String), overdue: 500_000 });
    expect(o.late.find((x: any) => x.name === 'Ali Hassan')).toMatchObject({ overdue: 200_000, guardianPhone: '+9647801112233' });
    expect(o.late.some((x: any) => x.name === 'Zainab Hassan')).toBe(false); // the sibling discount covers today's books
    expect(o.totals.lateCount).toBe(o.late.length);
    expect((await owner.get('/v1/sch/payments')).json.payments.map((p: any) => p.number)).toEqual([4, 3, 2, 1]);
  });
});

describe('attendance and the morning', () => {
  it('a roll call: everyone in the class, saved at once; strangers ignored; no future days', async () => {
    const roll = (await owner.get(`/v1/sch/attendance?classId=${ids.class2A}`)).json;
    expect(roll.taken).toBe(false);
    expect(roll.students.map((s: any) => s.name).sort()).toEqual(['Omar Sabah', 'Zainab Hassan']);
    const r = await owner.put('/v1/sch/attendance', { classId: ids.class2A, day, marks: [
      { studentId: ids.zainab, status: 'absent' }, { studentId: ids.omar, status: 'late', note: 'bus' }, { studentId: ids.ali, status: 'present' },
    ] });
    expect(r.json.saved).toBe(2); // Ali isn't in that class
    expect((await owner.put('/v1/sch/attendance', { classId: ids.class2A, day: '2999-01-01', marks: [{ studentId: ids.omar, status: 'present' }] })).json.error).toBe('FUTURE_DAY');
    expect((await owner.put('/v1/sch/attendance', { classId: ids.class2A, day, marks: [{ studentId: ids.omar, status: 'asleep' }] })).json.error).toBe('BAD_MARK');
    const again = (await owner.get(`/v1/sch/attendance?classId=${ids.class2A}&day=${day}`)).json;
    expect(again.taken).toBe(true);
    expect(again.students.find((s: any) => s.name === 'Omar Sabah')).toMatchObject({ status: 'late', note: 'bus' });
  });
  it('Today: classes done, who is absent (with the parent’s number), money for those who may see it', async () => {
    const x = (await owner.get('/v1/sch/today')).json;
    expect(x.attendance).toMatchObject({ students: 5, marked: 2, absent: 1, late: 1, classesDone: 1, classes: 7 });
    expect(x.absent[0]).toMatchObject({ name: 'Zainab Hassan', status: 'absent', guardianPhone: '+9647801112233' });
    expect(x.money).toMatchObject({ today: 900_000 });
  });
});

describe('the guardian’s page', () => {
  it('both children: class, attendance, what is owed and when; nothing for a wrong link', async () => {
    const r = await new Browser(t.app).get(`/v1/sch/pub/family/${ids.token}`);
    expect(r.status).toBe(200);
    expect(r.json.school.name).toBe('Al-Rowad School');
    expect(r.json.children.map((c: any) => c.name)).toEqual(['Ali Hassan', 'Zainab Hassan']);
    const z = r.json.children[1];
    expect(z.attendance).toMatchObject({ absent: 1 });
    expect(z.money).toMatchObject({ balance: 910_000, last: { number: 2, amount: 500_000 } });
    expect(z.money.next).toMatchObject({ amount: 500_000 });
    expect(JSON.stringify(r.json)).not.toContain('7801112233'); // the school's number, never a family's
    expect((await new Browser(t.app).get('/v1/sch/pub/family/notarealtoken00')).status).toBe(404);
  });
  it('a new link stops the old one', async () => {
    const g = (await owner.get(`/v1/sch/students/${ids.ali}`)).json.guardians[0];
    await owner.req('PATCH', `/v1/sch/guardians/${g.id}`, { newLink: true });
    expect((await new Browser(t.app).get(`/v1/sch/pub/family/${ids.token}`)).status).toBe(404);
  });
});

describe('who may do what', () => {
  it('a teacher takes the roll call but sees no money and changes nothing else', async () => {
    teacher = await join('teacher', '07702220001', 'Ms. Huda');
    const me = (await teacher.get('/v1/sys/me')).json;
    expect(me.can).toMatchObject({ 'attendance.take': true, 'students.read': true, 'fees.read': false, 'students.create': false });
    expect((await teacher.put('/v1/sch/attendance', { classId: ids.class1A, day, marks: [{ studentId: ids.ali, status: 'present' }] })).json.saved).toBe(1);
    expect((await teacher.get('/v1/sch/today')).json.money).toBeNull();
    expect((await teacher.post(`/v1/sch/students/${ids.ali}/payments`, { amount: 1000 })).status).toBe(403);
    expect((await teacher.get('/v1/sch/fees/overview')).status).toBe(403);
    expect((await teacher.post('/v1/sch/students', { name: 'X', classId: ids.class1A })).status).toBe(403);
    const old = new Date(Date.parse(`${day}T12:00:00Z`) - 10 * 86400_000).toISOString().slice(0, 10);
    if (old >= ay.startsOn) expect((await teacher.put('/v1/sch/attendance', { classId: ids.class1A, day: old, marks: [{ studentId: ids.ali, status: 'absent' }] })).json.error).toBe('TOO_OLD');
  });
  it('another school sees nothing of this one', async () => {
    other = new Browser(t.app);
    await signInEmail(other, 'owner@other-school.iq');
    const r = await other.post('/v1/sch/start', { name: 'Other School', kind: 'institute', lang: 'ar' });
    await other.post('/v1/auth/organization/set-active', { organizationId: r.json.organizationId });
    const s = (await other.get('/v1/sch/setup')).json;
    expect(s.grades.map((g: any) => g.name)).toEqual(['الثالث المتوسط', 'السادس الإعدادي · علمي', 'السادس الإعدادي · أدبي']);
    expect((await other.get('/v1/sch/students')).json.total).toBe(0);
    expect((await other.get(`/v1/sch/students/${ids.ali}`)).status).toBe(404);
    expect((await other.post(`/v1/sch/students/${ids.ali}/payments`, { amount: 1000 })).status).toBe(404);
    expect((await other.put('/v1/sch/attendance', { classId: ids.class1A, day, marks: [{ studentId: ids.ali, status: 'absent' }] })).json.saved).toBe(0);
  });
});

describe('the demo school', () => {
  it('opens with a believable morning', async () => {
    const b = new Browser(t.app);
    const r = await b.post('/v1/demo/start', { lang: 'ar', kind: 'school' });
    expect(r.status).toBe(201);
    expect(r.json.students).toBeGreaterThan(100);
    const h = { authorization: `Bearer ${r.json.token}` };
    const x = (await b.get('/v1/sch/today', h)).json;
    expect(x.attendance.classes).toBe(8);
    expect(x.money.late).toBeGreaterThan(0);
    const o = (await b.get('/v1/sch/fees/overview', h)).json;
    expect(o.totals.collected).toBeGreaterThan(0);
    expect(o.late.length).toBeGreaterThan(0);
  });
});
