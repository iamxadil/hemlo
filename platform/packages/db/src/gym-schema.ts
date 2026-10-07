// Hemlo Systems · Gym edition. Built on the shared core like the clinic: a member is a sys_customer (so balances, the debt
// book, payments and WhatsApp come for free) with a gym profile here; selling a membership is a sys_sale (so the cash
// drawer, receipts and reports work unchanged), and the gym's shop (water, protein, supplements) is the ordinary till.
// Every table belongs to one gym: organization_id + row-level security. Money is whole IQD.
import { pgTable, text, timestamp, integer, numeric, boolean, jsonb, date, index, uniqueIndex } from 'drizzle-orm/pg-core';

const at = (name: string) => timestamp(name, { withTimezone: true });
const org = () => text('organization_id').notNull();
const measure = (name: string) => numeric(name, { precision: 6, scale: 1, mode: 'number' });

/** One block of opening hours. who: everyone, men only, or women only (ladies' hours). */
export type GymHours = Record<string, { from: string; to: string; who: 'all' | 'm' | 'f' }[]>; // '0'..'6' = Sunday..Saturday

/** The gym's own settings. */
export const gymSettings = pgTable('gym_settings', {
  organizationId: text('organization_id').primaryKey(),
  hours: jsonb('hours').$type<GymHours>(),
  reentryMinutes: integer('reentry_minutes').notNull().default(180), // coming back within this time isn't a new visit
  graceDays: integer('grace_days').notNull().default(0),              // let a member in this many days after expiry (with a warning)
  reminderText: text('reminder_text'),                                // WhatsApp renewal reminder template
  doorKey: text('door_key'),                                          // the door screen's link key (display, and self check-in if allowed)
  selfCheckin: boolean('self_checkin').notNull().default(false),      // members may scan their own card at the door screen
  updatedAt: at('updated_at').notNull().defaultNow(),
});

/** A coach. member_id is their Hemlo account here (null: a coach without one). Personal training pays them a share. */
export const gymTrainer = pgTable('gym_trainer', {
  id: text('id').primaryKey(),
  organizationId: org(),
  memberId: text('member_id'),
  name: text('name').notNull(),
  phone: text('phone'),
  gender: text('gender'),                           // f | m (ladies' classes need a coach of their own)
  specialty: text('specialty'),
  color: text('color').notNull().default('#E4572E'),
  ptShare: integer('pt_share').notNull().default(0), // % of personal-training money that is the coach's
  active: boolean('active').notNull().default(true),
  createdAt: at('created_at').notNull().defaultNow(),
}, (t) => [index('gym_trainer_org').on(t.organizationId), uniqueIndex('gym_trainer_member').on(t.organizationId, t.memberId)]);

/** What the gym sells: a month, three months, 12 visits, personal training… */
export const gymPlan = pgTable('gym_plan', {
  id: text('id').primaryKey(),
  organizationId: org(),
  name: text('name').notNull(),
  category: text('category').notNull().default('gym'), // gym | pt (personal training) | class | other (a locker…)
  duration: integer('duration').notNull().default(1),  // how long it lasts…
  unit: text('unit').notNull().default('month'),       // …in day | month
  visits: integer('visits'),                           // null = unlimited visits while it lasts; n = n visits (or sessions)
  price: integer('price').notNull().default(0),
  gender: text('gender').notNull().default('all'),     // all | m | f
  freezeDays: integer('freeze_days').notNull().default(0), // how many days it may be paused in all
  color: text('color'),
  active: boolean('active').notNull().default(true),
  sort: integer('sort').notNull().default(0),
}, (t) => [index('gym_plan_org').on(t.organizationId)]);

/** A member's gym profile. customer_id is the sys_customer (name, phone, balance). */
export const gymMember = pgTable('gym_member', {
  customerId: text('customer_id').primaryKey(),
  organizationId: org(),
  memberNo: integer('member_no').notNull(),
  cardCode: text('card_code').notNull(),            // printed as a QR on the member's card; unguessable, so it can't be typed up
  gender: text('gender'),                           // f | m
  birthDate: date('birth_date'),
  photoId: text('photo_id'),                        // a sys_file (purpose 'member'): the desk sees who is really at the door
  goal: text('goal'),                               // lose | build | fit | strength | rehab | sport
  health: jsonb('health').$type<Record<string, unknown>>().notNull().default({}),
  alerts: jsonb('alerts').$type<string[]>().notNull().default([]), // derived from health: what a coach must know
  emergencyName: text('emergency_name'),
  emergencyPhone: text('emergency_phone'),
  referral: text('referral'),
  trainerId: text('trainer_id'),                    // their coach, if they have one
  notes: text('notes'),
  lastVisitAt: at('last_visit_at'),
  createdAt: at('created_at').notNull().defaultNow(),
  updatedAt: at('updated_at').notNull().defaultNow(),
}, (t) => [index('gym_member_org').on(t.organizationId), uniqueIndex('gym_member_no').on(t.organizationId, t.memberNo), uniqueIndex('gym_member_card').on(t.organizationId, t.cardCode)]);

/** A membership sold to a member: dates (inclusive), visits, what was paid (its sys_sale), pauses. */
export const gymMembership = pgTable('gym_membership', {
  id: text('id').primaryKey(),
  organizationId: org(),
  memberId: text('member_id').notNull(),
  planId: text('plan_id'),
  name: text('name').notNull(),                     // the plan's name when sold
  category: text('category').notNull().default('gym'),
  startsOn: date('starts_on').notNull(),
  endsOn: date('ends_on').notNull(),                // the last day it's good for (moves later when paused)
  visits: integer('visits'),                        // null = unlimited
  visitsUsed: integer('visits_used').notNull().default(0),
  price: integer('price').notNull().default(0),     // after the discount
  discount: integer('discount').notNull().default(0),
  saleId: text('sale_id'),
  trainerId: text('trainer_id'),                    // personal training: the coach
  status: text('status').notNull().default('active'), // active | frozen | canceled (ended = past its last day)
  freezeDays: integer('freeze_days').notNull().default(0), // allowed in all
  frozenFrom: date('frozen_from'),
  frozenDays: integer('frozen_days').notNull().default(0), // used so far
  note: text('note'),
  createdBy: text('created_by'),
  createdAt: at('created_at').notNull().defaultNow(),
  canceledAt: at('canceled_at'),
}, (t) => [index('gym_ms_member').on(t.memberId, t.endsOn), index('gym_ms_org_end').on(t.organizationId, t.endsOn)]);

/** Every time someone came through the door (or was turned back), and every personal-training session. */
export const gymCheckin = pgTable('gym_checkin', {
  id: text('id').primaryKey(),
  organizationId: org(),
  memberId: text('member_id').notNull(),
  membershipId: text('membership_id'),
  at: at('at').notNull().defaultNow(),
  via: text('via').notNull().default('desk'),       // desk | door (self check-in) | pt (a training session) | class
  result: text('result').notNull(),                 // ok | override (let in by staff despite a problem) | denied
  reason: text('reason'),                           // expired | frozen | no_visits | none | not_started | hours | gender
  counted: boolean('counted').notNull().default(false), // used one of a membership's visits
  trainerId: text('trainer_id'),
  userId: text('user_id'),
}, (t) => [index('gym_checkin_org_at').on(t.organizationId, t.at), index('gym_checkin_member').on(t.memberId, t.at)]);

/** The weekly timetable: Zumba on Sunday at 6, kickboxing on Monday at 8… */
export const gymClass = pgTable('gym_class', {
  id: text('id').primaryKey(),
  organizationId: org(),
  name: text('name').notNull(),
  trainerId: text('trainer_id'),
  day: integer('day').notNull(),                    // 0..6, Sunday..Saturday
  startsAt: text('starts_at').notNull(),            // 'HH:MM', Baghdad time
  minutes: integer('minutes').notNull().default(60),
  capacity: integer('capacity'),                    // null = no limit
  gender: text('gender').notNull().default('all'),
  color: text('color'),
  active: boolean('active').notNull().default(true),
}, (t) => [index('gym_class_org').on(t.organizationId, t.day)]);

/** A place in one class on one date. */
export const gymBooking = pgTable('gym_booking', {
  id: text('id').primaryKey(),
  organizationId: org(),
  classId: text('class_id').notNull(),
  date: date('date').notNull(),
  memberId: text('member_id').notNull(),
  status: text('status').notNull().default('booked'), // booked | attended | no_show | canceled
  createdAt: at('created_at').notNull().defaultNow(),
}, (t) => [index('gym_booking_class').on(t.organizationId, t.date, t.classId), uniqueIndex('gym_booking_once').on(t.classId, t.date, t.memberId)]);

/** Body measurements over time: what keeps members coming back is seeing the change. */
export const gymMeasure = pgTable('gym_measure', {
  id: text('id').primaryKey(),
  organizationId: org(),
  memberId: text('member_id').notNull(),
  at: at('at').notNull().defaultNow(),
  weight: measure('weight'),                        // kg
  height: measure('height'),                        // cm
  bodyFat: measure('body_fat'),                     // %
  muscle: measure('muscle'),                        // kg
  waist: measure('waist'),                          // cm
  chest: measure('chest'),
  arm: measure('arm'),
  thigh: measure('thigh'),
  hip: measure('hip'),
  note: text('note'),
  userId: text('user_id'),
}, (t) => [index('gym_measure_member').on(t.memberId, t.at)]);
