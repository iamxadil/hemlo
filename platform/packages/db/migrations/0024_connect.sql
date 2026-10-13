-- Hemlo Connect: WhatsApp automation and an AI assistant for a business's own customers (real estate first).
CREATE TABLE IF NOT EXISTS "connect_channel" (
  "organization_id" text PRIMARY KEY NOT NULL,
  "provider" text DEFAULT 'sandbox' NOT NULL,
  "status" text DEFAULT 'connected' NOT NULL,
  "phone_number_id" text,
  "waba_id" text,
  "display_phone" text,
  "verified_name" text,
  "token_enc" text,
  "token_hint" text,
  "templates" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "ai" boolean DEFAULT true NOT NULL,
  "persona" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "error" text,
  "connected_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "connect_channel_phone" ON "connect_channel" USING btree ("phone_number_id");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "connect_recipe" (
  "organization_id" text NOT NULL,
  "key" text NOT NULL,
  "enabled" boolean DEFAULT false NOT NULL,
  "settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "connect_recipe_organization_id_key_pk" PRIMARY KEY("organization_id","key")
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "connect_conversation" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "phone" text NOT NULL,
  "name" text,
  "lead_id" text,
  "owner_id" text,
  "agent_id" text,
  "status" text DEFAULT 'open' NOT NULL,
  "handoff" boolean DEFAULT false NOT NULL,
  "opted_out" boolean DEFAULT false NOT NULL,
  "unread" integer DEFAULT 0 NOT NULL,
  "last_message_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_inbound_at" timestamp with time zone,
  "preview" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "connect_conversation_phone" ON "connect_conversation" USING btree ("organization_id","phone");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "connect_conversation_inbox" ON "connect_conversation" USING btree ("organization_id","last_message_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "connect_conversation_lead" ON "connect_conversation" USING btree ("organization_id","lead_id");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "connect_message" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "conversation_id" text NOT NULL,
  "direction" text NOT NULL,
  "author" text NOT NULL,
  "user_id" text,
  "kind" text DEFAULT 'text' NOT NULL,
  "body" text DEFAULT '' NOT NULL,
  "template" text,
  "recipe" text,
  "status" text DEFAULT 'sent' NOT NULL,
  "wa_id" text,
  "error" text,
  "meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "connect_message_thread" ON "connect_message" USING btree ("organization_id","conversation_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "connect_message_month" ON "connect_message" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "connect_message_wa" ON "connect_message" USING btree ("wa_id");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "connect_job" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "recipe" text NOT NULL,
  "dedupe" text NOT NULL,
  "phone" text NOT NULL,
  "lead_id" text,
  "owner_id" text,
  "payload" jsonb NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "tries" integer DEFAULT 0 NOT NULL,
  "error" text,
  "due_at" timestamp with time zone DEFAULT now() NOT NULL,
  "done_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "connect_job_dedupe" ON "connect_job" USING btree ("organization_id","dedupe");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "connect_job_due" ON "connect_job" USING btree ("status","due_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "connect_job_org" ON "connect_job" USING btree ("organization_id","created_at");--> statement-breakpoint
ALTER TABLE "connect_channel" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "connect_channel" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY connect_channel_org ON "connect_channel" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));--> statement-breakpoint
ALTER TABLE "connect_recipe" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "connect_recipe" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY connect_recipe_org ON "connect_recipe" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));--> statement-breakpoint
ALTER TABLE "connect_conversation" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "connect_conversation" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY connect_conversation_org ON "connect_conversation" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));--> statement-breakpoint
ALTER TABLE "connect_message" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "connect_message" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY connect_message_org ON "connect_message" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));--> statement-breakpoint
ALTER TABLE "connect_job" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "connect_job" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY connect_job_org ON "connect_job" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));--> statement-breakpoint
INSERT INTO "hemlo_addon" ("id", "code", "name", "description", "compatible_editions", "price_month", "price_year", "public", "active")
VALUES
  ('connect', 'connect', '{"ar":"Hemlo Connect","en":"Hemlo Connect"}', '{"ar":"واتساب يرد ويذكّر ويتابع عنك: صندوق محادثات للفريق، وتذكيرات المعاينات، وتنبيهات العقارات الجديدة للزبائن المناسبين.","en":"WhatsApp that answers, reminds and follows up for you: a team inbox, viewing reminders, and new-listing alerts to the right buyers."}', '["realestate"]', 35000, 350000, true, true),
  ('connect-pro', 'connect-pro', '{"ar":"Hemlo Connect Pro","en":"Hemlo Connect Pro"}', '{"ar":"كل ما في Connect، مع مساعد ذكي يرد على زبائنك على مدار الساعة من عقاراتك الحقيقية ويحجز المعاينات، وتقرير شهري لكل مالك، وإحياء الزبائن الذين انقطعوا.","en":"Everything in Connect, plus an AI assistant that answers around the clock from your real listings and books viewings, a monthly report for every owner, and reviving leads that went quiet."}', '["realestate"]', 75000, 750000, true, true)
ON CONFLICT ("code") DO NOTHING;
