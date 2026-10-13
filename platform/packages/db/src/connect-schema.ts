// Hemlo Connect · WhatsApp automation and an AI assistant, built on the data a business already keeps in Hemlo. The
// System stays the source of truth: a conversation belongs to a lead (or an owner), and what Connect learns or books
// lands in the same leads, viewings and notices the team already works from. Nothing here is a second CRM.
//
// Five tables, each small and indexed for the one way it is read:
//   connect_channel       the business's WhatsApp number (one per business), its sealed token and its templates
//   connect_recipe        which automations are on, and their few settings
//   connect_conversation  one per customer phone: the inbox row (last message, unread, whether a person took over)
//   connect_message       every message in and out, with WhatsApp's delivery status
//   connect_job           the outbox: every automatic send, once (a dedupe key per business), retried on failure
import { pgTable, text, timestamp, integer, boolean, jsonb, index, uniqueIndex, primaryKey } from 'drizzle-orm/pg-core';

const at = (name: string) => timestamp(name, { withTimezone: true });
const org = () => text('organization_id').notNull();

export const CONNECT_PROVIDERS = ['sandbox', 'meta'] as const;
export const CONNECT_RECIPES = ['instant_reply', 'viewing_reminder', 'viewing_followup', 'new_listing', 'cold_lead', 'owner_report', 'rent_due'] as const;
export type ConnectRecipeKey = (typeof CONNECT_RECIPES)[number];
/** A message template's state at WhatsApp, per template name: only an approved template may start a conversation. */
export type ConnectTemplateState = Record<string, { status: 'missing' | 'pending' | 'approved' | 'rejected'; reason?: string | null }>;
/** How the assistant speaks for this business. */
export type ConnectPersona = { greeting?: { ar?: string; en?: string }; hours?: string | null; notes?: string | null; quick?: { title: string; text: string }[] };

export const connectChannel = pgTable('connect_channel', {
  organizationId: text('organization_id').primaryKey(),
  provider: text('provider').notNull().default('sandbox'),   // sandbox (try it, nothing leaves Hemlo) | meta (WhatsApp Cloud API)
  status: text('status').notNull().default('connected'),     // connected | error | off
  phoneNumberId: text('phone_number_id'),                    // Meta's id for the number (how a webhook finds its business)
  wabaId: text('waba_id'),                                   // the WhatsApp Business Account
  displayPhone: text('display_phone'),
  verifiedName: text('verified_name'),
  tokenEnc: text('token_enc'),                               // the access token, sealed (AES-GCM); never sent back to anyone
  tokenHint: text('token_hint'),
  templates: jsonb('templates').$type<ConnectTemplateState>().notNull().default({}),
  ai: boolean('ai').notNull().default(true),                 // the assistant answers new messages (a person can take over any chat)
  persona: jsonb('persona').$type<ConnectPersona>().notNull().default({}),
  error: text('error'),
  connectedAt: at('connected_at').notNull().defaultNow(),
  updatedAt: at('updated_at').notNull().defaultNow(),
}, (t) => [uniqueIndex('connect_channel_phone').on(t.phoneNumberId)]);

export const connectRecipe = pgTable('connect_recipe', {
  organizationId: org(),
  key: text('key').notNull(),                                // CONNECT_RECIPES
  enabled: boolean('enabled').notNull().default(false),
  settings: jsonb('settings').$type<Record<string, unknown>>().notNull().default({}),
  updatedAt: at('updated_at').notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.organizationId, t.key] })]);

export const connectConversation = pgTable('connect_conversation', {
  id: text('id').primaryKey(),
  organizationId: org(),
  phone: text('phone').notNull(),                            // +964…, the customer's WhatsApp
  name: text('name'),                                        // their WhatsApp profile name
  leadId: text('lead_id'),
  ownerId: text('owner_id'),
  agentId: text('agent_id'),                                 // follows the lead's agent
  status: text('status').notNull().default('open'),          // open | closed
  handoff: boolean('handoff').notNull().default(false),      // a person took over: the assistant stays quiet in this chat
  optedOut: boolean('opted_out').notNull().default(false),   // said stop: no automatic message ever again
  unread: integer('unread').notNull().default(0),
  lastMessageAt: at('last_message_at').notNull().defaultNow(),
  lastInboundAt: at('last_inbound_at'),                      // WhatsApp's 24-hour window opens from here
  preview: text('preview'),
  createdAt: at('created_at').notNull().defaultNow(),
}, (t) => [
  uniqueIndex('connect_conversation_phone').on(t.organizationId, t.phone),
  index('connect_conversation_inbox').on(t.organizationId, t.lastMessageAt),
  index('connect_conversation_lead').on(t.organizationId, t.leadId),
]);

export const connectMessage = pgTable('connect_message', {
  id: text('id').primaryKey(),
  organizationId: org(),
  conversationId: text('conversation_id').notNull(),
  direction: text('direction').notNull(),                    // in | out
  author: text('author').notNull(),                          // customer | agent | ai | automation
  userId: text('user_id'),                                   // the agent who wrote it
  kind: text('kind').notNull().default('text'),              // text | template | media | other
  body: text('body').notNull().default(''),
  template: text('template'),
  recipe: text('recipe'),                                    // which automation sent it
  status: text('status').notNull().default('sent'),          // received | queued | sent | delivered | read | failed
  waId: text('wa_id'),                                       // WhatsApp's message id (dedupes webhook retries)
  error: text('error'),
  meta: jsonb('meta').$type<Record<string, unknown>>().notNull().default({}),
  category: text('category'),                                // out: marketing | utility (a template) | service (a reply in the 24-hour window)
  costIqd: integer('cost_iqd').notNull().default(0),         // what WhatsApp charges for it, at Hemlo's rates when it was sent
  createdAt: at('created_at').notNull().defaultNow(),
}, (t) => [
  index('connect_message_thread').on(t.organizationId, t.conversationId, t.createdAt),
  index('connect_message_month').on(t.organizationId, t.createdAt),
  uniqueIndex('connect_message_wa').on(t.waId),
]);

export const connectJob = pgTable('connect_job', {
  id: text('id').primaryKey(),
  organizationId: org(),
  recipe: text('recipe').notNull(),
  dedupe: text('dedupe').notNull(),                          // "viewing_reminder:<viewing>:<time>": the same message never goes twice
  phone: text('phone').notNull(),
  leadId: text('lead_id'),
  ownerId: text('owner_id'),
  payload: jsonb('payload').$type<{ template: string; lang: 'ar' | 'en'; params: string[]; text: string }>().notNull(),
  status: text('status').notNull().default('pending'),       // pending | done | skipped | failed
  tries: integer('tries').notNull().default(0),
  error: text('error'),
  dueAt: at('due_at').notNull().defaultNow(),
  doneAt: at('done_at'),
  createdAt: at('created_at').notNull().defaultNow(),
}, (t) => [
  uniqueIndex('connect_job_dedupe').on(t.organizationId, t.dedupe),
  index('connect_job_due').on(t.status, t.dueAt),
  index('connect_job_org').on(t.organizationId, t.createdAt),
]);
