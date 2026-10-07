// Tables Hemlo adds next to Better Auth's own (auth-schema.ts, generated).
// Every table that belongs to a business has organization_id and row-level security (see migrations/rls.sql).
import { pgTable, text, timestamp, integer, boolean, jsonb, primaryKey, uniqueIndex, index } from 'drizzle-orm/pg-core';

/** Append-only log of security events: sign-ins, new devices, role changes, counter lockouts… */
export const authEvent = pgTable('auth_event', {
  id: text('id').primaryKey(),
  at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
  userId: text('user_id'),
  organizationId: text('organization_id'),
  kind: text('kind').notNull(),
  ip: text('ip'),
  userAgent: text('user_agent'),
  detail: jsonb('detail').$type<Record<string, unknown>>(),
}, (t) => [index('auth_event_user_idx').on(t.userId, t.at), index('auth_event_org_idx').on(t.organizationId, t.at)]);

/** Devices a person has signed in from before, so a new one can trigger an alert. */
export const knownDevice = pgTable('known_device', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  deviceHash: text('device_hash').notNull(),
  label: text('label'),
  firstSeen: timestamp('first_seen', { withTimezone: true }).notNull().defaultNow(),
  lastSeen: timestamp('last_seen', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex('known_device_user_hash').on(t.userId, t.deviceHash)]);

/** Staff invitations by phone or email. Accepting requires proving the same phone or email. */
export const staffInvite = pgTable('staff_invite', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull(),
  tokenHash: text('token_hash').notNull(),
  phoneNumber: text('phone_number'),
  email: text('email'),
  name: text('name'),
  role: text('role').notNull(),
  teamIds: jsonb('team_ids').$type<string[]>().notNull().default([]),
  inviterId: text('inviter_id').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  acceptedBy: text('accepted_by'),
  canceledAt: timestamp('canceled_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex('staff_invite_token').on(t.tokenHash), index('staff_invite_org').on(t.organizationId)]);

/** A shared shop device, trusted once by an owner or manager. Staff unlock it with their PIN. */
export const counterDevice = pgTable('counter_device', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull(),
  teamId: text('team_id'),
  name: text('name').notNull(),
  tokenHash: text('token_hash').notNull(),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  activeMemberId: text('active_member_id'),
  activeUntil: timestamp('active_until', { withTimezone: true }),
}, (t) => [uniqueIndex('counter_device_token').on(t.tokenHash), index('counter_device_org').on(t.organizationId)]);

/** Each member's counter PIN (keyed hash), per organization. Kept out of Better Auth's member table on purpose. */
export const counterPin = pgTable('counter_pin', {
  memberId: text('member_id').primaryKey(),
  organizationId: text('organization_id').notNull(),
  userId: text('user_id').notNull(),
  pinHash: text('pin_hash').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Wrong-PIN counts per device and member. Five in a row locks that member on that device. */
export const counterLock = pgTable('counter_lock', {
  deviceId: text('device_id').notNull(),
  memberId: text('member_id').notNull(),
  organizationId: text('organization_id').notNull(),
  failures: integer('failures').notNull().default(0),
  locked: boolean('locked').notNull().default(false),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.deviceId, t.memberId] })]);

/** Early-access requests from hemlohq.com (no account needed). Read only by Hemlo staff. */
export const earlyAccess = pgTable('early_access', {
  id: text('id').primaryKey(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  name: text('name').notNull(),
  phoneNumber: text('phone_number').notNull(),
  email: text('email'),
  business: text('business').notNull(),
  kind: text('kind').notNull(),
  city: text('city'),
  note: text('note'),
  locale: text('locale').notNull().default('ar'),
  ip: text('ip'),
  status: text('status').notNull().default('new'), // new → contacted → approved → activated (or declined)
  adminNote: text('admin_note'),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  approvedBy: text('approved_by'),
  tokenHash: text('token_hash'),            // the private access link (keyed hash)
  tokenExpiresAt: timestamp('token_expires_at', { withTimezone: true }),
  claimedAt: timestamp('claimed_at', { withTimezone: true }),
  claimedBy: text('claimed_by'),
  organizationId: text('organization_id'),
}, (t) => [index('early_access_created').on(t.createdAt), index('early_access_phone').on(t.phoneNumber), uniqueIndex('early_access_token').on(t.tokenHash)]);

/** The Hemlo team: who may open admin.hemlohq.com, and with which permissions (see @hemlo/core staff.ts). The founder is user.role = 'admin'. */
export const hemloStaff = pgTable('hemlo_staff', {
  userId: text('user_id').primaryKey(),
  permissions: jsonb('permissions').$type<string[]>().notNull().default([]),
  title: text('title'),                                                // e.g. "Onboarding, Erbil"
  accessUntil: timestamp('access_until', { withTimezone: true }),      // temporary access ends here
  suspendedAt: timestamp('suspended_at', { withTimezone: true }),
  invitedBy: text('invited_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/** An invitation to the Hemlo team, bound to one email address. The link carries a token; only its keyed hash is stored. */
export const hemloStaffInvite = pgTable('hemlo_staff_invite', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  name: text('name'),
  title: text('title'),
  permissions: jsonb('permissions').$type<string[]>().notNull().default([]),
  accessUntil: timestamp('access_until', { withTimezone: true }),
  tokenHash: text('token_hash').notNull(),
  invitedBy: text('invited_by').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  acceptedBy: text('accepted_by'),
  canceledAt: timestamp('canceled_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex('hemlo_staff_invite_token').on(t.tokenHash)]);

/**
 * What a business pays for (or is trying). One row per business: which edition, trial or paid, how many dentist seats…
 * No row means the free plan (Stores & Markets candidates today). Hemlo's team changes it from the admin dashboard.
 */
export const hemloSubscription = pgTable('hemlo_subscription', {
  organizationId: text('organization_id').primaryKey(),
  edition: text('edition').notNull(),                  // store | dental | …
  status: text('status').notNull(),                    // trial | active | free | canceled
  plan: text('plan'),                                  // null = the edition's one plan; room for tiers later
  seats: integer('seats').notNull().default(1),        // dentists (the priced unit); staff are free
  trialEndsAt: timestamp('trial_ends_at', { withTimezone: true }),
  paidUntil: timestamp('paid_until', { withTimezone: true }),
  priceNote: text('price_note'),                       // what was agreed, in words (e.g. "$45/month, 3 dentists")
  planId: text('plan_id'),                             // the hemlo_plan they pay for (null: a trial, or an old free shop)
  billing: text('billing').notNull().default('month'), // month | year
  price: integer('price'),                             // agreed IQD per billing period; null = the plan's list price
  note: text('note'),
  updatedBy: text('updated_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Hemlo's price list: plans per edition, edited from the admin dashboard and shown on the website and in the app.
 *  limits: users (staff accounts), devices (shared tills), dentists, members (active gym members), ai (tasks a month);
 *  a missing limit means no limit. Every plan has every feature: the plans differ by size. */
export type PlanLimits = { users?: number; devices?: number; dentists?: number; members?: number; ai?: number };
export type Words = { ar: string; en: string; ckb?: string };
export const hemloPlan = pgTable('hemlo_plan', {
  id: text('id').primaryKey(),
  edition: text('edition').notNull(),                  // store | dental | gym
  code: text('code').notNull(),                        // basic | plus | business …
  name: jsonb('name').$type<Words>().notNull(),
  tagline: jsonb('tagline').$type<Words>(),
  priceMonth: integer('price_month').notNull(),        // IQD
  priceYear: integer('price_year').notNull(),          // IQD for 12 months (usually 10× a month)
  limits: jsonb('limits').$type<PlanLimits>().notNull().default({}),
  popular: boolean('popular').notNull().default(false),
  public: boolean('public').notNull().default(true),   // shown on the website and in the app
  active: boolean('active').notNull().default(true),   // can be chosen (old plans stay for those on them)
  sort: integer('sort').notNull().default(0),
  updatedBy: text('updated_by'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex('hemlo_plan_code').on(t.edition, t.code)]);

/** Money received from a business for its plan (cash, FIB, Zain Cash, a transfer): each one moves its paid-until date. */
export const hemloPayment = pgTable('hemlo_payment', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull(),
  planId: text('plan_id'),
  amount: integer('amount').notNull(),                 // IQD
  months: integer('months').notNull(),
  method: text('method').notNull(),                    // cash | fib | zaincash | transfer | other
  reference: text('reference'),
  note: text('note'),
  paidUntil: timestamp('paid_until', { withTimezone: true }).notNull(), // the new paid-until date this payment set
  createdBy: text('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('hemlo_payment_org').on(t.organizationId, t.createdAt)]);

/** A business asks for a plan from inside the app; Hemlo's team calls, takes the payment, and activates it. */
export const hemloPlanRequest = pgTable('hemlo_plan_request', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull(),
  planId: text('plan_id'),                             // null: Enterprise (talk to Hemlo Studio)
  billing: text('billing').notNull().default('month'),
  message: text('message'),
  userId: text('user_id'),
  status: text('status').notNull().default('new'),     // new | done | dismissed
  handledBy: text('handled_by'),
  handledAt: timestamp('handled_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('hemlo_plan_request_org').on(t.organizationId, t.status)]);
