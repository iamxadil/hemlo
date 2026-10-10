// Tables Hemlo adds next to Better Auth's own (auth-schema.ts, generated).
// Every table that belongs to a business has organization_id and row-level security (see migrations/rls.sql).
import { pgTable, text, timestamp, integer, boolean, jsonb, primaryKey, uniqueIndex, index, doublePrecision } from 'drizzle-orm/pg-core';

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
export type PlanLimits = { users?: number; devices?: number; dentists?: number; members?: number; listings?: number; ai?: number };
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

/** Optional capability sold alongside a core System plan. A nullable price means the offer is not configured yet. */
export const hemloAddon = pgTable('hemlo_addon', {
  id: text('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: jsonb('name').$type<Words>().notNull(),
  description: jsonb('description').$type<Words>().notNull().default({ ar: '', en: '' }),
  compatibleEditions: jsonb('compatible_editions').$type<string[]>().notNull().default([]),
  priceMonth: integer('price_month'),
  priceYear: integer('price_year'),
  public: boolean('public').notNull().default(true),
  active: boolean('active').notNull().default(true),
  updatedBy: text('updated_by'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/** A workspace's request to add/renew/cancel a capability. A request never grants paid access by itself. */
export const hemloAddonRequest = pgTable('hemlo_addon_request', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull(),
  addonId: text('addon_id').notNull(),
  edition: text('edition').notNull(),
  action: text('action').notNull().default('activate'), // activate | cancel
  billing: text('billing').notNull().default('month'),
  price: integer('price'),                         // trusted catalog snapshot; null only for cancel requests
  message: text('message'),
  userId: text('user_id'),
  status: text('status').notNull().default('new'), // new | done | dismissed
  handledBy: text('handled_by'),
  handledAt: timestamp('handled_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('hemlo_addon_request_org').on(t.organizationId, t.status), index('hemlo_addon_request_addon').on(t.addonId, t.status)]);

/** Confirmed access to an add-on, owned by the existing business workspace. */
export const hemloAddonEntitlement = pgTable('hemlo_addon_entitlement', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull(),
  addonId: text('addon_id').notNull(),
  edition: text('edition').notNull(),
  status: text('status').notNull().default('active'), // active | canceled
  billing: text('billing').notNull().default('month'),
  price: integer('price').notNull(),                // agreed recurring price per billing period, in IQD
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull().defaultNow(),
  paidUntil: timestamp('paid_until', { withTimezone: true }),
  updatedBy: text('updated_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex('hemlo_addon_entitlement_org').on(t.organizationId, t.addonId), index('hemlo_addon_entitlement_status').on(t.status, t.paidUntil)]);

/** Manual payments recorded by Hemlo; each receipt advances the add-on's paid-through date. */
export const hemloAddonPayment = pgTable('hemlo_addon_payment', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull(),
  addonId: text('addon_id').notNull(),
  amount: integer('amount').notNull(),
  periods: integer('periods').notNull().default(1),
  method: text('method').notNull(),
  reference: text('reference'),
  paidUntil: timestamp('paid_until', { withTimezone: true }).notNull(),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('hemlo_addon_payment_org').on(t.organizationId, t.createdAt)]);

/** An AI provider Hemlo can use: Cloudflare Workers AI (free, built in), Anthropic, or any OpenAI-compatible service
 *  (OpenAI, OpenRouter, Google Gemini, Groq, or one added by the team). Its API key is kept encrypted (AES-GCM, with a key
 *  from a Worker secret) and is never sent back to anyone; only its last four characters are shown. System-only table. */
export const hemloAiProvider = pgTable('hemlo_ai_provider', {
  id: text('id').primaryKey(),                         // 'openrouter', 'openai', 'gemini', 'groq', 'anthropic', or 'custom-…'
  kind: text('kind').notNull(),                        // workers-ai | anthropic | openai (OpenAI-compatible)
  label: text('label').notNull(),
  baseUrl: text('base_url'),                           // OpenAI-compatible: the API's base (…/v1)
  keyEnc: text('key_enc'),                             // the API key, encrypted
  keyHint: text('key_hint'),                           // its last four characters
  enabled: boolean('enabled').notNull().default(true),
  updatedBy: text('updated_by'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Which model does one AI job in one system ('gym:members', 'store:invoice'…), and what to fall back on if it fails.
 *  No row: the default engine. Prices (US$ per million tokens) only where the provider doesn't report the cost itself. */
export const hemloAiRoute = pgTable('hemlo_ai_route', {
  id: text('id').primaryKey(),                         // '{edition}:{feature}'
  edition: text('edition').notNull(),
  feature: text('feature').notNull(),
  provider: text('provider').notNull(),
  model: text('model').notNull(),
  fallbackProvider: text('fallback_provider'),
  fallbackModel: text('fallback_model'),
  priceIn: doublePrecision('price_in'),
  priceOut: doublePrecision('price_out'),
  updatedBy: text('updated_by'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
