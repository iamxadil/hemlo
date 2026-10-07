// Hemlo Systems · Real Estate edition. One sales loop, one source of truth:
//   property → public page → WhatsApp → lead → matching → viewing → follow-up → negotiation → deal → commission.
// Every table belongs to one agency: organization_id + row-level security. Prices are whole units of their currency
// (USD or IQD, as Iraqi property is priced), as bigint: a Baghdad building can pass two billion dinars.
// A property's public page, a collection's link and an owner's report are reached by an unguessable slug or token; the
// public routes read only the columns meant to be public (see apps/api/src/routes/realestate/public.ts).
import { pgTable, text, timestamp, integer, bigint, boolean, jsonb, doublePrecision, index, uniqueIndex } from 'drizzle-orm/pg-core';

const at = (name: string) => timestamp(name, { withTimezone: true });
const org = () => text('organization_id').notNull();
const money = (name: string) => bigint(name, { mode: 'number' });

export const RE_TYPES = ['apartment', 'house', 'villa', 'land', 'office', 'shop', 'commercial', 'building', 'warehouse', 'farm'] as const;
export const RE_STATUSES = ['draft', 'available', 'reserved', 'negotiating', 'sold', 'rented', 'archived'] as const;
export const RE_SOURCES = ['whatsapp', 'facebook', 'instagram', 'website', 'phone', 'walk_in', 'referral', 'ad', 'other'] as const;

/** The agency: its public face (name, phone, WhatsApp, about) and how it works (currency, share message, consent rules). */
export const reSettings = pgTable('re_settings', {
  organizationId: text('organization_id').primaryKey(),
  phone: text('phone'),                                   // shown on public pages
  whatsapp: text('whatsapp'),                             // the agency's WhatsApp (an agent's own number wins on their listings)
  email: text('email'),
  address: text('address'),
  about: jsonb('about').$type<{ ar?: string; en?: string }>(),
  currency: text('currency').notNull().default('USD'),     // the default for new listings
  city: text('city'),
  shareTemplate: jsonb('share_template').$type<{ ar?: string; en?: string }>(), // the WhatsApp message, with {title} {price} …
  usdRate: integer('usd_rate').notNull().default(1450),   // dinars to a dollar, to compare a budget in one currency with a price in the other
  defaultCommission: integer('default_commission').notNull().default(200), // basis points: 2% (Iraqi agencies: 1–2.5%)
  autoMatch: boolean('auto_match').notNull().default(false), // never sends by itself: only lists who may want a new listing
  contractTerms: jsonb('contract_terms').$type<Record<string, { ar?: string[]; en?: string[] }>>(), // the agency's own default terms, per kind of contract
  waApi: jsonb('wa_api').$type<{ status: 'off' | 'requested' | 'connected'; phoneId?: string; requestedAt?: string } | null>(),
  updatedAt: at('updated_at').notNull().defaultNow(),
});

/** A branch of the agency (Erbil · 100m Street, Baghdad · Mansour…). Optional: a one-office agency never sees it. */
export const reBranch = pgTable('re_branch', {
  id: text('id').primaryKey(),
  organizationId: org(),
  name: text('name').notNull(),
  city: text('city'),
  phone: text('phone'),
  active: boolean('active').notNull().default(true),
  createdAt: at('created_at').notNull().defaultNow(),
}, (t) => [index('re_branch_org').on(t.organizationId)]);

/** An agent's public card (their own WhatsApp on their listings), linked to their Hemlo account (member). */
export const reAgent = pgTable('re_agent', {
  memberId: text('member_id').primaryKey(),
  organizationId: org(),
  userId: text('user_id'),
  name: text('name').notNull(),
  phone: text('phone'),
  whatsapp: text('whatsapp'),
  title: text('title'),                                   // "Senior agent", "مستشار عقاري"
  photoId: text('photo_id'),
  branchId: text('branch_id'),
  agentShare: integer('agent_share').notNull().default(4000), // basis points of the agency's commission paid to the agent (40%)
  active: boolean('active').notNull().default(true),
}, (t) => [index('re_agent_org').on(t.organizationId), uniqueIndex('re_agent_user').on(t.organizationId, t.userId)]);

/** Someone who owns property the agency sells or rents for them. */
export const reOwner = pgTable('re_owner', {
  id: text('id').primaryKey(),
  organizationId: org(),
  name: text('name').notNull(),
  phone: text('phone'),
  whatsapp: text('whatsapp'),
  email: text('email'),
  lang: text('lang').notNull().default('ar'),
  notes: text('notes'),
  commission: jsonb('commission').$type<{ kind: 'percent' | 'fixed'; value: number; note?: string } | null>(), // the agreement
  agentId: text('agent_id'),                              // who looks after this owner
  createdBy: text('created_by'),
  createdAt: at('created_at').notNull().defaultNow(),
  updatedAt: at('updated_at').notNull().defaultNow(),
  archivedAt: at('archived_at'),
}, (t) => [index('re_owner_org').on(t.organizationId), index('re_owner_phone').on(t.organizationId, t.phone)]);

/** A property: the one source of truth for its page, its messages, its matches and its deal. */
export const reProperty = pgTable('re_property', {
  id: text('id').primaryKey(),
  organizationId: org(),
  ref: integer('ref').notNull(),                          // the agency's own number: "Villa #4821"
  slug: text('slug').notNull(),                           // the public page: hemlohq.com/p/{slug} (unique across Hemlo)
  title: text('title').notNull(),
  titleEn: text('title_en'),
  type: text('type').notNull(),                           // RE_TYPES (an agency may add its own later; the matcher treats it as a word)
  purpose: text('purpose').notNull().default('sale'),     // sale | rent
  status: text('status').notNull().default('draft'),      // RE_STATUSES
  publishedAt: at('published_at'),                        // the public page is on (only while not draft/archived)
  price: money('price'),
  currency: text('currency').notNull().default('USD'),
  rentPeriod: text('rent_period'),                        // month | year (rent only)
  negotiable: boolean('negotiable').notNull().default(true),
  ownerMin: money('owner_min'),                           // the lowest the owner accepts: managers only, never public
  city: text('city'),
  area: text('area'),                                     // the neighbourhood: Dream City, Mansour, Ankawa…
  address: text('address'),                               // internal (the public page shows the area)
  lat: doublePrecision('lat'),
  lng: doublePrecision('lng'),
  showExact: boolean('show_exact').notNull().default(false), // public map: the exact spot, or only the area
  size: integer('size'),                                  // built area, m²
  land: integer('land'),                                  // plot, m²
  bedrooms: integer('bedrooms'),
  bathrooms: integer('bathrooms'),
  floors: integer('floors'),
  parking: integer('parking'),
  yearBuilt: integer('year_built'),
  furnished: text('furnished'),                           // none | semi | full
  condition: text('condition'),                           // new | excellent | good | needs_work | shell
  features: jsonb('features').$type<string[]>().notNull().default([]),
  description: jsonb('description').$type<{ ar?: string; en?: string }>().notNull().default({}), // public
  notes: text('notes'),                                   // internal
  ownerId: text('owner_id'),
  agentId: text('agent_id'),                              // a member id
  branchId: text('branch_id'),
  coverId: text('cover_id'),                              // a re_media id
  video: text('video'),                                   // a YouTube/Instagram/TikTok link
  stats: jsonb('stats').$type<Record<string, number>>().notNull().default({}), // running totals: views, wa, call, share, request, favorite, qr
  createdBy: text('created_by'),
  createdAt: at('created_at').notNull().defaultNow(),
  updatedAt: at('updated_at').notNull().defaultNow(),
  statusAt: at('status_at').notNull().defaultNow(),        // when the status last changed (how long on the market)
}, (t) => [
  uniqueIndex('re_property_slug').on(t.slug), uniqueIndex('re_property_ref').on(t.organizationId, t.ref),
  index('re_property_org_status').on(t.organizationId, t.status, t.updatedAt), index('re_property_owner').on(t.organizationId, t.ownerId),
  index('re_property_agent').on(t.organizationId, t.agentId), index('re_property_match').on(t.organizationId, t.purpose, t.type, t.price),
]);

/** A photo (an uploaded sys_file) or, for demos, a ready image URL. Ordered; the cover is the property's cover_id. */
export const reMedia = pgTable('re_media', {
  id: text('id').primaryKey(),
  organizationId: org(),
  propertyId: text('property_id').notNull(),
  fileId: text('file_id'),
  url: text('url'),                                       // a static image (the demo agency's photographs)
  width: integer('width'),
  height: integer('height'),
  caption: text('caption'),
  sort: integer('sort').notNull().default(0),
  createdAt: at('created_at').notNull().defaultNow(),
}, (t) => [index('re_media_property').on(t.propertyId, t.sort)]);

/** A document about a property, an owner or a deal: title deed, contract, ID, inspection… Private: short-lived links only. */
export const reDocument = pgTable('re_document', {
  id: text('id').primaryKey(),
  organizationId: org(),
  fileId: text('file_id').notNull(),
  kind: text('kind').notNull().default('other'),           // deed | contract | id | inspection | commission | other
  title: text('title').notNull(),
  propertyId: text('property_id'),
  ownerId: text('owner_id'),
  dealId: text('deal_id'),
  expiresOn: text('expires_on'),                          // 'YYYY-MM-DD'
  notes: text('notes'),
  createdBy: text('created_by'),
  createdAt: at('created_at').notNull().defaultNow(),
}, (t) => [index('re_document_property').on(t.organizationId, t.propertyId), index('re_document_expiry').on(t.organizationId, t.expiresOn)]);

/** A person looking to buy or rent, with what they want (the matcher reads these columns). */
export const reLead = pgTable('re_lead', {
  id: text('id').primaryKey(),
  organizationId: org(),
  name: text('name').notNull(),
  phone: text('phone'),
  whatsapp: text('whatsapp'),
  email: text('email'),
  lang: text('lang').notNull().default('ar'),
  purpose: text('purpose').notNull().default('sale'),     // sale (wants to buy) | rent
  source: text('source').notNull().default('other'),      // RE_SOURCES
  status: text('status').notNull().default('new'),        // new | active | viewing | negotiating | won | lost
  agentId: text('agent_id'),
  budgetMin: money('budget_min'),
  budgetMax: money('budget_max'),
  currency: text('currency').notNull().default('USD'),
  types: jsonb('types').$type<string[]>().notNull().default([]),
  areas: jsonb('areas').$type<string[]>().notNull().default([]),
  city: text('city'),
  bedrooms: integer('bedrooms'),                          // at least
  bathrooms: integer('bathrooms'),
  sizeMin: integer('size_min'),
  sizeMax: integer('size_max'),
  must: jsonb('must').$type<string[]>().notNull().default([]), // features they insist on (garden, garage…)
  notes: text('notes'),
  consent: boolean('consent').notNull().default(false),   // agreed to receive listings on WhatsApp (needed before any automation)
  lastContactAt: at('last_contact_at'),
  nextFollowAt: at('next_follow_at'),                     // the earliest open follow-up (kept by the follow-up routes)
  createdBy: text('created_by'),
  createdAt: at('created_at').notNull().defaultNow(),
  updatedAt: at('updated_at').notNull().defaultNow(),
  archivedAt: at('archived_at'),
}, (t) => [index('re_lead_org').on(t.organizationId, t.status, t.updatedAt), index('re_lead_agent').on(t.organizationId, t.agentId), index('re_lead_phone').on(t.organizationId, t.phone)]);

/** A lead ↔ property link: suggested, sent, opened, liked, dismissed (what the matcher and the lead's page remember). */
export const reLeadProperty = pgTable('re_lead_property', {
  id: text('id').primaryKey(),
  organizationId: org(),
  leadId: text('lead_id').notNull(),
  propertyId: text('property_id').notNull(),
  status: text('status').notNull().default('sent'),       // sent | opened | favorite | dismissed | viewed (visited in person)
  score: integer('score'),
  opens: integer('opens').notNull().default(0),
  sentAt: at('sent_at'),
  lastOpenAt: at('last_open_at'),
  createdAt: at('created_at').notNull().defaultNow(),
}, (t) => [uniqueIndex('re_lp_pair').on(t.leadId, t.propertyId), index('re_lp_property').on(t.organizationId, t.propertyId)]);

/** A shortlist for one customer, sent as one link (hemlohq.com/c/{token}). */
export const reCollection = pgTable('re_collection', {
  id: text('id').primaryKey(),
  organizationId: org(),
  token: text('token').notNull(),
  title: text('title').notNull(),
  note: text('note'),                                     // a line from the agent at the top of the page
  leadId: text('lead_id'),
  agentId: text('agent_id'),
  opens: integer('opens').notNull().default(0),
  lastOpenAt: at('last_open_at'),
  createdBy: text('created_by'),
  createdAt: at('created_at').notNull().defaultNow(),
  archivedAt: at('archived_at'),
}, (t) => [uniqueIndex('re_collection_token').on(t.token), index('re_collection_lead').on(t.organizationId, t.leadId)]);

export const reCollectionItem = pgTable('re_collection_item', {
  id: text('id').primaryKey(),
  organizationId: org(),
  collectionId: text('collection_id').notNull(),
  propertyId: text('property_id').notNull(),
  sort: integer('sort').notNull().default(0),
  note: text('note'),
  favorite: boolean('favorite').notNull().default(false),  // the customer tapped the heart
  opens: integer('opens').notNull().default(0),
}, (t) => [uniqueIndex('re_ci_pair').on(t.collectionId, t.propertyId), index('re_ci_property').on(t.organizationId, t.propertyId)]);

/** A viewing: a customer sees a property with an agent. Requested from a public page, or booked by the agency. */
export const reViewing = pgTable('re_viewing', {
  id: text('id').primaryKey(),
  organizationId: org(),
  propertyId: text('property_id').notNull(),
  leadId: text('lead_id'),
  agentId: text('agent_id'),
  startsAt: at('starts_at'),                              // null: requested, no time agreed yet
  minutes: integer('minutes').notNull().default(45),
  status: text('status').notNull().default('scheduled'),  // requested | scheduled | confirmed | completed | cancelled | no_show
  source: text('source').notNull().default('agent'),      // agent | public
  preferred: text('preferred'),                           // the customer's own words from the public form ("Saturday evening")
  notes: text('notes'),
  outcome: text('outcome'),                               // liked | maybe | no
  feedback: text('feedback'),
  createdBy: text('created_by'),
  createdAt: at('created_at').notNull().defaultNow(),
  updatedAt: at('updated_at').notNull().defaultNow(),
}, (t) => [index('re_viewing_org_at').on(t.organizationId, t.startsAt), index('re_viewing_property').on(t.organizationId, t.propertyId), index('re_viewing_lead').on(t.organizationId, t.leadId)]);

/** Something to do for a lead (or a deal): call Ahmed after his viewing, send Sara alternatives… */
export const reFollowup = pgTable('re_followup', {
  id: text('id').primaryKey(),
  organizationId: org(),
  leadId: text('lead_id'),
  propertyId: text('property_id'),
  dealId: text('deal_id'),
  ownerId: text('owner_id'),
  agentId: text('agent_id'),
  kind: text('kind').notNull().default('call'),            // call | whatsapp | send | viewing | negotiation | other
  note: text('note'),
  dueAt: at('due_at').notNull(),
  doneAt: at('done_at'),
  createdBy: text('created_by'),
  createdAt: at('created_at').notNull().defaultNow(),
}, (t) => [index('re_followup_due').on(t.organizationId, t.doneAt, t.dueAt), index('re_followup_lead').on(t.organizationId, t.leadId)]);

/** A deal: one property, one buyer or tenant, from first interest to the commission collected. */
export const reDeal = pgTable('re_deal', {
  id: text('id').primaryKey(),
  organizationId: org(),
  propertyId: text('property_id').notNull(),
  leadId: text('lead_id'),
  ownerId: text('owner_id'),
  agentId: text('agent_id'),
  purpose: text('purpose').notNull().default('sale'),
  stage: text('stage').notNull().default('interested'),   // interested | viewing | offer | negotiation | reserved | closed | lost
  asking: money('asking'),                                // the price when the deal started
  agreed: money('agreed'),
  currency: text('currency').notNull().default('USD'),
  commissionKind: text('commission_kind').notNull().default('percent'), // percent | fixed
  commissionValue: money('commission_value').notNull().default(200),     // basis points (percent) or an amount (fixed)
  agentShare: integer('agent_share').notNull().default(4000),            // basis points of the commission
  closedAt: at('closed_at'),
  lostReason: text('lost_reason'),
  notes: text('notes'),
  createdBy: text('created_by'),
  createdAt: at('created_at').notNull().defaultNow(),
  updatedAt: at('updated_at').notNull().defaultNow(),
}, (t) => [index('re_deal_org_stage').on(t.organizationId, t.stage, t.updatedAt), index('re_deal_property').on(t.organizationId, t.propertyId), index('re_deal_lead').on(t.organizationId, t.leadId)]);

/** The negotiation, step by step: $200k asking → $185k offer → $192k counter → $190k agreed. */
export const reOffer = pgTable('re_offer', {
  id: text('id').primaryKey(),
  organizationId: org(),
  dealId: text('deal_id').notNull(),
  kind: text('kind').notNull(),                           // offer (buyer) | counter (owner) | agreed | rejected | withdrawn
  amount: money('amount'),
  note: text('note'),
  userId: text('user_id'),
  at: at('at').notNull().defaultNow(),
}, (t) => [index('re_offer_deal').on(t.dealId, t.at)]);

/** Commission money as it comes in (from the owner, the buyer, or both). */
export const rePayment = pgTable('re_payment', {
  id: text('id').primaryKey(),
  organizationId: org(),
  dealId: text('deal_id').notNull(),
  amount: money('amount').notNull(),
  from: text('from').notNull().default('owner'),          // owner | buyer | other
  paidOn: text('paid_on').notNull(),                      // 'YYYY-MM-DD'
  note: text('note'),
  userId: text('user_id'),
  createdAt: at('created_at').notNull().defaultNow(),
}, (t) => [index('re_payment_deal').on(t.organizationId, t.dealId)]);

/** What happened, for the timelines (a property's, a lead's, an owner's, a deal's) and for the audit. */
export const reActivity = pgTable('re_activity', {
  id: text('id').primaryKey(),
  organizationId: org(),
  kind: text('kind').notNull(),                           // property.created, property.price, lead.sent, viewing.done, deal.stage…
  propertyId: text('property_id'),
  leadId: text('lead_id'),
  ownerId: text('owner_id'),
  dealId: text('deal_id'),
  userId: text('user_id'),                                // null: the customer (public page) or Hemlo
  detail: jsonb('detail').$type<Record<string, unknown>>().notNull().default({}),
  at: at('at').notNull().defaultNow(),
}, (t) => [index('re_activity_property').on(t.organizationId, t.propertyId, t.at), index('re_activity_lead').on(t.organizationId, t.leadId, t.at),
  index('re_activity_owner').on(t.organizationId, t.ownerId, t.at), index('re_activity_org_at').on(t.organizationId, t.at)]);

/** What a public page saw, by day (no addresses, no cookies): views, WhatsApp taps, calls, shares, QR scans… */
export const reStat = pgTable('re_stat', {
  organizationId: org(),
  propertyId: text('property_id').notNull(),
  day: text('day').notNull(),                             // 'YYYY-MM-DD', Baghdad
  views: integer('views').notNull().default(0),
  wa: integer('wa').notNull().default(0),
  calls: integer('calls').notNull().default(0),
  shares: integer('shares').notNull().default(0),
  qr: integer('qr').notNull().default(0),
  requests: integer('requests').notNull().default(0),
  favorites: integer('favorites').notNull().default(0),
}, (t) => [uniqueIndex('re_stat_day').on(t.propertyId, t.day), index('re_stat_org_day').on(t.organizationId, t.day)]);

/** A notice for the agency: a new viewing request, a match for a new listing, an offer… Leads to an action. */
export const reNotice = pgTable('re_notice', {
  id: text('id').primaryKey(),
  organizationId: org(),
  agentId: text('agent_id'),                              // for this agent (null: for the agency)
  kind: text('kind').notNull(),                           // request | match | offer | doc_expiry | deal_closed | lead_new
  propertyId: text('property_id'),
  leadId: text('lead_id'),
  dealId: text('deal_id'),
  viewingId: text('viewing_id'),
  detail: jsonb('detail').$type<Record<string, unknown>>().notNull().default({}),
  readAt: at('read_at'),
  createdAt: at('created_at').notNull().defaultNow(),
}, (t) => [index('re_notice_org').on(t.organizationId, t.readAt, t.createdAt)]);

/** An owner's report link (hemlohq.com/r/{token}): one property's activity, ready to send. */
export const reReport = pgTable('re_report', {
  id: text('id').primaryKey(),
  organizationId: org(),
  token: text('token').notNull(),
  propertyId: text('property_id').notNull(),
  ownerId: text('owner_id'),
  note: text('note'),
  createdBy: text('created_by'),
  createdAt: at('created_at').notNull().defaultNow(),
  expiresAt: at('expires_at').notNull(),
}, (t) => [uniqueIndex('re_report_token').on(t.token), index('re_report_property').on(t.organizationId, t.propertyId)]);

/** A contract the agency drew up: a sale, a rent, a deposit (عربون) receipt, or the owner's brokerage agreement.
 *  Its words live in `data` (the parties, the property, the money, the terms), so a signed contract never changes when
 *  the deal or the property does. A draft can be edited; signed or void, it is fixed. */
export const RE_CONTRACT_KINDS = ['sale', 'rent', 'deposit', 'brokerage'] as const;
export type ReParty = { name: string; idNo?: string | null; address?: string | null; phone?: string | null; rep?: string | null };
export type ReContractData = {
  purpose: 'sale' | 'rent';
  date: string; place?: string | null;
  first: ReParty; second: ReParty;
  agency: { name: string; phone?: string | null; address?: string | null; agent?: string | null };
  property: { type?: string | null; ref?: number | null; title?: string | null; address?: string | null; area?: string | null; city?: string | null; plot?: string | null;
    size?: number | null; land?: number | null; rooms?: string | null; details?: string | null };
  money: { currency: 'USD' | 'IQD'; price?: number | null; paid?: number | null; restDue?: string | null;
    rent?: number | null; period?: 'month' | 'year'; start?: string | null; end?: string | null; payEvery?: 'month' | 'quarter' | 'half' | 'year'; insurance?: number | null;
    deposit?: number | null; holdUntil?: string | null;
    commission?: number | null; commissionNote?: string | null; commissionBy?: 'first' | 'second' | 'both' | null; exclusive?: boolean; validUntil?: string | null };
  clauses: string[];
  witnesses: { name: string; idNo?: string | null }[];
  notes?: string | null;
};
export const reContract = pgTable('re_contract', {
  id: text('id').primaryKey(),
  organizationId: org(),
  number: integer('number').notNull(),                    // the agency's own numbering: 1, 2, 3…
  kind: text('kind').notNull(),                           // RE_CONTRACT_KINDS
  status: text('status').notNull().default('draft'),      // draft | signed | void
  lang: text('lang').notNull().default('ar'),             // the language it is written in
  dealId: text('deal_id'),
  propertyId: text('property_id'),
  leadId: text('lead_id'),
  ownerId: text('owner_id'),
  data: jsonb('data').$type<ReContractData>().notNull(),
  documentId: text('document_id'),                        // the signed copy, scanned (re_document)
  signedAt: at('signed_at'),
  createdBy: text('created_by'),
  createdAt: at('created_at').notNull().defaultNow(),
  updatedAt: at('updated_at').notNull().defaultNow(),
}, (t) => [uniqueIndex('re_contract_number').on(t.organizationId, t.number), index('re_contract_org').on(t.organizationId, t.updatedAt),
  index('re_contract_deal').on(t.organizationId, t.dealId), index('re_contract_property').on(t.organizationId, t.propertyId)]);
