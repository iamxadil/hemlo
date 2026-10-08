// Hemlo School: private schools and tutoring institutes. The core loop:
//   academic year → grades and their classes (sections) → students enrolled in a class, with their guardians →
//   fees (a plan's instalments become each student's charges; payments come in with numbered receipts) →
//   daily attendance → the guardian's private link (attendance, what is owed, the next instalment).
// Every table belongs to one school: organization_id + row-level security. Money is whole dinars (bigint).
// A student's balance is never stored: charges minus payments, summed when asked (one indexed query).
import { pgTable, text, timestamp, integer, bigint, boolean, jsonb, date, index, uniqueIndex, primaryKey } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

const at = (name: string) => timestamp(name, { withTimezone: true });
const org = () => text('organization_id').notNull();
const money = (name: string) => bigint(name, { mode: 'number' });

export const SCH_KINDS = ['school', 'institute', 'kindergarten'] as const;
export const SCH_STAGES = ['kg', 'primary', 'intermediate', 'preparatory', 'course'] as const;
export const SCH_CHARGE_KINDS = ['tuition', 'registration', 'transport', 'books', 'uniform', 'activity', 'discount', 'other'] as const;
export const SCH_METHODS = ['cash', 'fib', 'zaincash', 'transfer', 'other'] as const;
export const SCH_MARKS = ['present', 'absent', 'late', 'excused'] as const;
export const SCH_RELATIONS = ['father', 'mother', 'brother', 'sister', 'grandparent', 'uncle', 'guardian'] as const;

export type SchInstallment = { label: string; dueOn: string; amount: number };

/** The school: what kind it is, how to reach it, the year it is in, and the words it sends to guardians. */
export const schSettings = pgTable('sch_settings', {
  organizationId: text('organization_id').primaryKey(),
  kind: text('kind').notNull().default('school'),          // school | institute | kindergarten
  city: text('city'),
  phone: text('phone'),
  whatsapp: text('whatsapp'),
  currentYearId: text('current_year_id'),
  passMark: integer('pass_mark').notNull().default(50),
  absentText: jsonb('absent_text').$type<{ ar?: string; en?: string }>(),   // "{student} was absent today…"
  feeText: jsonb('fee_text').$type<{ ar?: string; en?: string }>(),         // "an instalment of {amount} is due…"
  updatedAt: at('updated_at').notNull().defaultNow(),
});

/** An academic year (2026–2027). One is current; classes, enrolments, fee plans and charges belong to a year. */
export const schYear = pgTable('sch_year', {
  id: text('id').primaryKey(),
  organizationId: org(),
  name: text('name').notNull(),
  startsOn: date('starts_on').notNull(),
  endsOn: date('ends_on').notNull(),
  createdAt: at('created_at').notNull().defaultNow(),
}, (t) => [index('sch_year_org').on(t.organizationId)]);

/** A grade (First primary, Sixth preparatory · science) — or, in an institute, a course. Lasts across years. */
export const schGrade = pgTable('sch_grade', {
  id: text('id').primaryKey(),
  organizationId: org(),
  name: text('name').notNull(),
  stage: text('stage').notNull().default('primary'),
  sort: integer('sort').notNull().default(0),
  active: boolean('active').notNull().default(true),
}, (t) => [index('sch_grade_org').on(t.organizationId, t.sort)]);

/** A class in one year: a grade's section (أ، ب) or an institute's group, with its homeroom teacher. */
export const schClass = pgTable('sch_class', {
  id: text('id').primaryKey(),
  organizationId: org(),
  yearId: text('year_id').notNull(),
  gradeId: text('grade_id').notNull(),
  name: text('name').notNull(),
  teacherMemberId: text('teacher_member_id'),
  room: text('room'),
  capacity: integer('capacity'),
  createdAt: at('created_at').notNull().defaultNow(),
}, (t) => [index('sch_class_year').on(t.organizationId, t.yearId)]);

/** A student. `number` is the school's own running number (shown on receipts and cards). */
export const schStudent = pgTable('sch_student', {
  id: text('id').primaryKey(),
  organizationId: org(),
  number: integer('number').notNull(),
  name: text('name').notNull(),
  gender: text('gender'),                                   // m | f
  birthDate: date('birth_date'),
  phone: text('phone'),                                     // the student's own (older students)
  photoId: text('photo_id'),
  health: text('health'),                                   // allergies, conditions: shown to staff in a hurry
  notes: text('notes'),
  status: text('status').notNull().default('active'),      // active | left | graduated
  joinedOn: date('joined_on'),
  createdAt: at('created_at').notNull().defaultNow(),
  updatedAt: at('updated_at').notNull().defaultNow(),
}, (t) => [uniqueIndex('sch_student_number').on(t.organizationId, t.number), index('sch_student_status').on(t.organizationId, t.status)]);

/** A guardian (a parent, usually). One guardian, many children; the token opens their private page. */
export const schGuardian = pgTable('sch_guardian', {
  id: text('id').primaryKey(),
  organizationId: org(),
  name: text('name').notNull(),
  relation: text('relation').notNull().default('father'),
  phone: text('phone'),
  whatsapp: text('whatsapp'),
  token: text('token').notNull(),                           // unguessable: the guardian's link
  createdAt: at('created_at').notNull().defaultNow(),
}, (t) => [uniqueIndex('sch_guardian_token').on(t.token), index('sch_guardian_phone').on(t.organizationId, t.phone)]);

export const schStudentGuardian = pgTable('sch_student_guardian', {
  studentId: text('student_id').notNull(),
  guardianId: text('guardian_id').notNull(),
  organizationId: org(),
  primary: boolean('primary').notNull().default(true),
}, (t) => [primaryKey({ columns: [t.studentId, t.guardianId] }), index('sch_sg_guardian').on(t.guardianId)]);

/** A student in a class for a year. One per student per year: moving class edits it. */
export const schEnrollment = pgTable('sch_enrollment', {
  id: text('id').primaryKey(),
  organizationId: org(),
  studentId: text('student_id').notNull(),
  yearId: text('year_id').notNull(),
  classId: text('class_id').notNull(),
  status: text('status').notNull().default('enrolled'),    // enrolled | withdrawn
  enrolledOn: date('enrolled_on'),
  createdAt: at('created_at').notNull().defaultNow(),
}, (t) => [uniqueIndex('sch_enrollment_one').on(t.studentId, t.yearId), index('sch_enrollment_class').on(t.organizationId, t.classId)]);

/** A fee plan: the year's tuition for a grade (or for everyone), split into dated instalments. */
export const schFeePlan = pgTable('sch_fee_plan', {
  id: text('id').primaryKey(),
  organizationId: org(),
  yearId: text('year_id').notNull(),
  gradeId: text('grade_id'),                                // null: every grade
  name: text('name').notNull(),
  installments: jsonb('installments').$type<SchInstallment[]>().notNull(),
  total: money('total').notNull(),
  active: boolean('active').notNull().default(true),
  createdAt: at('created_at').notNull().defaultNow(),
}, (t) => [index('sch_fee_plan_year').on(t.organizationId, t.yearId)]);

/** What a student owes: an instalment from a plan, or a one-off (books, uniform, transport), or a discount (negative). */
export const schCharge = pgTable('sch_charge', {
  id: text('id').primaryKey(),
  organizationId: org(),
  studentId: text('student_id').notNull(),
  yearId: text('year_id').notNull(),
  planId: text('plan_id'),
  kind: text('kind').notNull().default('tuition'),
  label: text('label').notNull(),
  amount: money('amount').notNull(),
  dueOn: date('due_on').notNull(),
  userId: text('user_id'),
  createdAt: at('created_at').notNull().defaultNow(),
}, (t) => [
  index('sch_charge_student').on(t.organizationId, t.studentId),
  index('sch_charge_due').on(t.organizationId, t.dueOn),
  uniqueIndex('sch_charge_plan_once').on(t.studentId, t.planId, t.label).where(sql`plan_id is not null`),
]);

/** Money received from a student's family, with the school's running receipt number. A mistake is voided, not deleted. */
export const schPayment = pgTable('sch_payment', {
  id: text('id').primaryKey(),
  organizationId: org(),
  studentId: text('student_id').notNull(),
  number: integer('number').notNull(),
  amount: money('amount').notNull(),
  method: text('method').notNull().default('cash'),
  payer: text('payer'),
  note: text('note'),
  void: boolean('void').notNull().default(false),
  userId: text('user_id'),
  at: at('at').notNull().defaultNow(),
}, (t) => [uniqueIndex('sch_payment_number').on(t.organizationId, t.number), index('sch_payment_student').on(t.organizationId, t.studentId), index('sch_payment_at').on(t.organizationId, t.at)]);

/** One mark per student per day. Not written = not taken yet (a class's roll call writes everyone at once). */
export const schAttendance = pgTable('sch_attendance', {
  studentId: text('student_id').notNull(),
  day: date('day').notNull(),
  organizationId: org(),
  classId: text('class_id').notNull(),
  status: text('status').notNull(),                         // present | absent | late | excused
  note: text('note'),
  userId: text('user_id'),
  at: at('at').notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.studentId, t.day] }), index('sch_attendance_class_day').on(t.organizationId, t.classId, t.day), index('sch_attendance_day').on(t.organizationId, t.day)]);
