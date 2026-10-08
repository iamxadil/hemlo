// The demo school: a private primary school in Baghdad, three weeks into the year. Six grades in eight classes, about
// 120 students (brothers and sisters share a parent), the year's tuition in three instalments with most families on
// time and some late, a few on the school bus, a sibling discount, and three weeks of roll calls (today's half taken,
// so the morning looks like a real morning). Deterministic, written in one statement like the other demos.
import { newId } from '@hemlo/core';
import type { Database } from '@hemlo/db';
import { sysSettings, sysSequence, schSettings, schYear, schGrade, schClass, schStudent, schGuardian, schStudentGuardian, schEnrollment, schFeePlan, schCharge, schPayment, schAttendance } from '@hemlo/db/schema';
import { insertAll, rng, type Batch } from './demo-data';
import { academicYear, defaultInstallments } from './routes/school/common';
import { today, token } from './routes/realestate/common';

type Lang = 'ar' | 'en';
export const DEMO_SCHOOL = { ar: { name: 'مدارس الرواد الأهلية', owner: 'الأستاذة سهى كريم' }, en: { name: 'Al-Rowad Private Schools', owner: 'Ms. Suha Kareem' } };

const BOYS: [string, string][] = [['علي', 'Ali'], ['محمد', 'Mohammed'], ['حسين', 'Hussein'], ['يوسف', 'Yousif'], ['عمر', 'Omar'], ['مصطفى', 'Mustafa'], ['زيد', 'Zaid'], ['آدم', 'Adam'], ['حيدر', 'Haidar'], ['كرار', 'Karrar'], ['أحمد', 'Ahmed'], ['سجاد', 'Sajjad'], ['عباس', 'Abbas'], ['ياسين', 'Yaseen'], ['مرتضى', 'Murtadha'], ['أمير', 'Ameer'], ['إبراهيم', 'Ibrahim'], ['حمزة', 'Hamza']];
const GIRLS: [string, string][] = [['زينب', 'Zainab'], ['فاطمة', 'Fatima'], ['مريم', 'Maryam'], ['نور', 'Noor'], ['رقية', 'Ruqaya'], ['سارة', 'Sara'], ['ليان', 'Layan'], ['حوراء', 'Hawraa'], ['تبارك', 'Tabarak'], ['دانية', 'Dania'], ['ريم', 'Reem'], ['جنى', 'Jana'], ['آية', 'Aya'], ['ملاك', 'Malak'], ['زهراء', 'Zahraa'], ['شهد', 'Shahad']];
const FATHERS: [string, string][] = [['حسن', 'Hassan'], ['كريم', 'Kareem'], ['جاسم', 'Jasim'], ['عادل', 'Adel'], ['صباح', 'Sabah'], ['فلاح', 'Falah'], ['رعد', 'Raad'], ['سلام', 'Salam'], ['ناصر', 'Nasser'], ['عمار', 'Ammar'], ['ماجد', 'Majid'], ['باسم', 'Basim'], ['حميد', 'Hameed'], ['وليد', 'Waleed'], ['قاسم', 'Qasim'], ['ضياء', 'Dhiaa'], ['رياض', 'Riyadh'], ['منذر', 'Munther'], ['ثامر', 'Thamer'], ['هشام', 'Hisham'], ['لؤي', 'Luay'], ['أنور', 'Anwar'], ['طارق', 'Tariq'], ['خالد', 'Khalid'], ['سعد', 'Saad'], ['مهند', 'Muhannad'], ['عقيل', 'Aqeel'], ['فراس', 'Firas'], ['نبيل', 'Nabeel'], ['غسان', 'Ghassan']];
const FAMILIES: [string, string][] = [['الربيعي', 'Al-Rubaie'], ['العبيدي', 'Al-Obaidi'], ['الجبوري', 'Al-Jubouri'], ['التميمي', 'Al-Tamimi'], ['الساعدي', 'Al-Saadi'], ['الخفاجي', 'Al-Khafaji'], ['الموسوي', 'Al-Mousawi'], ['الزبيدي', 'Al-Zubaidi'], ['الدليمي', 'Al-Dulaimi'], ['البياتي', 'Al-Bayati']];

const D = (s: string, n: number) => new Date(Date.parse(`${s}T12:00:00Z`) + n * 86400_000).toISOString().slice(0, 10);
const schoolDay = (s: string) => { const w = new Date(`${s}T12:00:00Z`).getUTCDay(); return w !== 5 && w !== 6; }; // Friday and Saturday off

export async function seedDemoSchool(tx: Database, org: string, userId: string, memberId: string, lang: Lang, first: Batch[] = []) {
  const L = (ar: string, en: string) => (lang === 'ar' ? ar : en), i18 = lang === 'ar' ? 0 : 1;
  const r = rng(20261008), pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];
  const day = today(), ay = academicYear(day), yearId = newId();
  const nowMs = Date.now();

  // ---- grades and classes ----
  const ord = lang === 'ar' ? ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس'] : ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth'];
  const grades = ord.map((x, i) => ({ id: newId(), organizationId: org, name: L(`${x} الابتدائي`, `${x} primary`), stage: 'primary', sort: i + 1 }));
  const sections = [[0, L('أ', 'A')], [0, L('ب', 'B')], [1, L('أ', 'A')], [2, L('أ', 'A')], [3, L('أ', 'A')], [4, L('أ', 'A')], [5, L('أ', 'A')], [5, L('ب', 'B')]] as const;
  const classes = sections.map(([g, name], i) => ({ id: newId(), organizationId: org, yearId, gradeId: grades[g].id, name, room: String(101 + i), capacity: 25, teacherMemberId: i === 0 ? memberId : null }));

  // ---- families and students ----
  const guardians: any[] = [], links: any[] = [], students: any[] = [], enrol: any[] = [];
  let number = 0;
  const families = Array.from({ length: 96 }, (_, i) => ({ father: FATHERS[i % FATHERS.length], family: FAMILIES[Math.floor(i / 3) % FAMILIES.length], kids: i % 5 === 0 ? 2 : i % 23 === 0 ? 3 : 1 }));
  const perClass = new Map<string, number>();
  for (const [fi, f] of families.entries()) {
    const gid = newId(), phone = `+9647${['70', '71', '72', '80', '81', '50', '51'][fi % 7]}${String(1000000 + fi * 7919 % 9000000).padStart(7, '0')}`;
    guardians.push({ id: gid, organizationId: org, name: L(`${f.father[0]} ${f.family[0]}`, `${f.father[1]} ${f.family[1]}`), relation: fi % 9 === 4 ? 'mother' : 'father', phone, whatsapp: phone, token: token(16) });
    for (let k = 0; k < f.kids; k++) {
      // brothers and sisters land in different grades
      const ci = (fi * 3 + k * 3) % classes.length;
      if ((perClass.get(classes[ci].id) ?? 0) >= 17) continue;
      perClass.set(classes[ci].id, (perClass.get(classes[ci].id) ?? 0) + 1);
      const girl = r() < 0.47, first = girl ? pick(GIRLS) : pick(BOYS), id = newId();
      const gIdx = sections[ci][0], age = 6 + gIdx;
      students.push({ id, organizationId: org, number: ++number, name: L(`${first[0]} ${f.father[0]} ${f.family[0]}`, `${first[1]} ${f.father[1]} ${f.family[1]}`), gender: girl ? 'f' : 'm',
        birthDate: `${ay.start - age}-${String(1 + Math.floor(r() * 12)).padStart(2, '0')}-${String(1 + Math.floor(r() * 27)).padStart(2, '0')}`,
        health: number % 29 === 3 ? L('حساسية من الفول السوداني', 'Peanut allergy') : number % 41 === 7 ? L('ربو خفيف، البخاخ مع المرشدة', 'Mild asthma, inhaler with the counsellor') : null,
        joinedOn: ay.startsOn, status: 'active', _family: fi, _kid: k, _class: ci });
      links.push({ studentId: id, guardianId: gid, organizationId: org, primary: true });
      enrol.push({ id: newId(), organizationId: org, studentId: id, yearId, classId: classes[ci].id, enrolledOn: ay.startsOn });
    }
  }

  // ---- fees: the year's tuition in three instalments; the bus for some; a sibling discount ----
  const inst = defaultInstallments(ay.start, 1_800_000, lang);
  const plan = { id: newId(), organizationId: org, yearId, gradeId: null, name: L('القسط السنوي · الابتدائي', 'Yearly tuition · Primary'), installments: inst, total: 1_800_000 };
  const charges: any[] = [], payments: any[] = [];
  for (const s of students) {
    for (const x of inst) charges.push({ id: newId(), organizationId: org, studentId: s.id, yearId, planId: plan.id, kind: 'tuition', label: x.label, amount: x.amount, dueOn: x.dueOn });
    if (s.number % 4 === 1) charges.push({ id: newId(), organizationId: org, studentId: s.id, yearId, kind: 'transport', label: L('خط النقل · الفصل الأول', 'School bus · first term'), amount: 250_000, dueOn: ay.startsOn });
    if (s._kid > 0) charges.push({ id: newId(), organizationId: org, studentId: s.id, yearId, kind: 'discount', label: L('خصم الأخوة 10٪', 'Sibling discount 10%'), amount: -180_000, dueOn: ay.startsOn });
  }
  // who has paid what: most families the first instalment (and the bus), some the whole year, some are late
  const paidDays = Math.max(1, Math.round((nowMs - Date.parse(`${ay.startsOn}T09:00:00Z`)) / 86400_000));
  for (const s of students) {
    const due = charges.filter((c) => c.studentId === s.id && c.dueOn <= day).reduce((t, c) => t + c.amount, 0);
    const all = charges.filter((c) => c.studentId === s.id).reduce((t, c) => t + c.amount, 0);
    const roll = r();
    const amount = roll < 0.16 ? all : roll < 0.82 ? due : roll < 0.9 ? Math.round(due / 2 / 50_000) * 50_000 : 0;
    if (amount <= 0) continue;
    const parts = roll >= 0.16 && roll < 0.82 && amount > 600_000 && r() < 0.3 ? [amount - 250_000, 250_000] : [amount];
    for (const p of parts) {
      const at = new Date(Date.parse(`${ay.startsOn}T06:00:00Z`) + Math.floor(r() * paidDays * 0.9) * 86400_000 + Math.floor(r() * 6 * 3600_000));
      payments.push({ studentId: s.id, amount: p, method: r() < 0.82 ? 'cash' : r() < 0.6 ? 'fib' : 'zaincash', payer: null, at: at > new Date(nowMs) ? new Date(nowMs - 3600_000) : at });
    }
  }
  payments.sort((a, b) => a.at - b.at);
  const paymentRows = payments.map((p, i) => ({ id: newId(), organizationId: org, number: i + 1, userId, ...p }));

  // ---- three weeks of roll calls; today, the first five classes have taken it ----
  const att: any[] = [];
  const habitual = new Set(students.filter((s) => s.number % 17 === 5).map((s) => s.id)); // a few who miss often
  const from = D(day, -21) > ay.startsOn ? D(day, -21) : ay.startsOn;
  for (let x = from; x <= day; x = D(x, 1)) {
    if (!schoolDay(x)) continue;
    for (const s of students) {
      if (x === day && s._class >= 5) continue;
      const p = r(), miss = habitual.has(s.id) ? 0.22 : 0.035;
      const status = p < miss ? 'absent' : p < miss + 0.03 ? 'late' : p < miss + 0.035 ? 'excused' : 'present';
      att.push({ studentId: s.id, day: x, organizationId: org, classId: classes[s._class].id, status, userId, note: status === 'excused' ? L('مراجعة طبيب', 'Doctor’s appointment') : null,
        at: new Date(Date.parse(`${x}T05:${String(10 + Math.floor(r() * 30)).padStart(2, '0')}:00Z`)) });
    }
  }

  await insertAll(tx, [
    ...first,
    [sysSettings, [{ organizationId: org }]],
    [schYear, [{ id: yearId, organizationId: org, name: ay.name, startsOn: ay.startsOn, endsOn: ay.endsOn }]],
    [schSettings, [{ organizationId: org, kind: 'school', city: L('بغداد', 'Baghdad'), phone: '+9647701234567', whatsapp: '+9647701234567', currentYearId: yearId }]],
    [schGrade, grades], [schClass, classes],
    [schStudent, students.map(({ _family, _kid, _class, ...s }) => s)], [schGuardian, guardians], [schStudentGuardian, links], [schEnrollment, enrol],
    [schFeePlan, [plan]], [schCharge, charges], [schPayment, paymentRows], [schAttendance, att],
    [sysSequence, [{ organizationId: org, name: 'sch_student', value: number }, { organizationId: org, name: 'sch_receipt', value: paymentRows.length }]],
  ]);
  void i18;
  return { students: students.length, classes: classes.length, payments: paymentRows.length };
}
