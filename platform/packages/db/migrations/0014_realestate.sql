-- Hemlo Systems · Real Estate edition: properties and their public pages, owners, leads and what they want, matches,
-- collections, viewings, follow-ups, deals with their negotiation and commission, documents, activity, public stats,
-- notices and owner reports. Every table: organization_id + row-level security. Plus the edition's three plans.
CREATE TABLE IF NOT EXISTS "re_activity" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"kind" text NOT NULL,
	"property_id" text,
	"lead_id" text,
	"owner_id" text,
	"deal_id" text,
	"user_id" text,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "re_agent" (
	"member_id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text,
	"name" text NOT NULL,
	"phone" text,
	"whatsapp" text,
	"title" text,
	"photo_id" text,
	"branch_id" text,
	"agent_share" integer DEFAULT 4000 NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "re_branch" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"city" text,
	"phone" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "re_collection" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"token" text NOT NULL,
	"title" text NOT NULL,
	"note" text,
	"lead_id" text,
	"agent_id" text,
	"opens" integer DEFAULT 0 NOT NULL,
	"last_open_at" timestamp with time zone,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "re_collection_item" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"collection_id" text NOT NULL,
	"property_id" text NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"note" text,
	"favorite" boolean DEFAULT false NOT NULL,
	"opens" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "re_deal" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"property_id" text NOT NULL,
	"lead_id" text,
	"owner_id" text,
	"agent_id" text,
	"purpose" text DEFAULT 'sale' NOT NULL,
	"stage" text DEFAULT 'interested' NOT NULL,
	"asking" bigint,
	"agreed" bigint,
	"currency" text DEFAULT 'USD' NOT NULL,
	"commission_kind" text DEFAULT 'percent' NOT NULL,
	"commission_value" bigint DEFAULT 200 NOT NULL,
	"agent_share" integer DEFAULT 4000 NOT NULL,
	"closed_at" timestamp with time zone,
	"lost_reason" text,
	"notes" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "re_document" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"file_id" text NOT NULL,
	"kind" text DEFAULT 'other' NOT NULL,
	"title" text NOT NULL,
	"property_id" text,
	"owner_id" text,
	"deal_id" text,
	"expires_on" text,
	"notes" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "re_followup" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"lead_id" text,
	"property_id" text,
	"deal_id" text,
	"owner_id" text,
	"agent_id" text,
	"kind" text DEFAULT 'call' NOT NULL,
	"note" text,
	"due_at" timestamp with time zone NOT NULL,
	"done_at" timestamp with time zone,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "re_lead" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"whatsapp" text,
	"email" text,
	"lang" text DEFAULT 'ar' NOT NULL,
	"purpose" text DEFAULT 'sale' NOT NULL,
	"source" text DEFAULT 'other' NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"agent_id" text,
	"budget_min" bigint,
	"budget_max" bigint,
	"currency" text DEFAULT 'USD' NOT NULL,
	"types" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"areas" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"city" text,
	"bedrooms" integer,
	"bathrooms" integer,
	"size_min" integer,
	"size_max" integer,
	"must" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes" text,
	"consent" boolean DEFAULT false NOT NULL,
	"last_contact_at" timestamp with time zone,
	"next_follow_at" timestamp with time zone,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "re_lead_property" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"lead_id" text NOT NULL,
	"property_id" text NOT NULL,
	"status" text DEFAULT 'sent' NOT NULL,
	"score" integer,
	"opens" integer DEFAULT 0 NOT NULL,
	"sent_at" timestamp with time zone,
	"last_open_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "re_media" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"property_id" text NOT NULL,
	"file_id" text,
	"url" text,
	"width" integer,
	"height" integer,
	"caption" text,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "re_notice" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"agent_id" text,
	"kind" text NOT NULL,
	"property_id" text,
	"lead_id" text,
	"deal_id" text,
	"viewing_id" text,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "re_offer" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"deal_id" text NOT NULL,
	"kind" text NOT NULL,
	"amount" bigint,
	"note" text,
	"user_id" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "re_owner" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"whatsapp" text,
	"email" text,
	"lang" text DEFAULT 'ar' NOT NULL,
	"notes" text,
	"commission" jsonb,
	"agent_id" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "re_payment" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"deal_id" text NOT NULL,
	"amount" bigint NOT NULL,
	"from" text DEFAULT 'owner' NOT NULL,
	"paid_on" text NOT NULL,
	"note" text,
	"user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "re_property" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"ref" integer NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"title_en" text,
	"type" text NOT NULL,
	"purpose" text DEFAULT 'sale' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"price" bigint,
	"currency" text DEFAULT 'USD' NOT NULL,
	"rent_period" text,
	"negotiable" boolean DEFAULT true NOT NULL,
	"owner_min" bigint,
	"city" text,
	"area" text,
	"address" text,
	"lat" double precision,
	"lng" double precision,
	"show_exact" boolean DEFAULT false NOT NULL,
	"size" integer,
	"land" integer,
	"bedrooms" integer,
	"bathrooms" integer,
	"floors" integer,
	"parking" integer,
	"year_built" integer,
	"furnished" text,
	"condition" text,
	"features" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"description" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"notes" text,
	"owner_id" text,
	"agent_id" text,
	"branch_id" text,
	"cover_id" text,
	"video" text,
	"stats" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "re_report" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"token" text NOT NULL,
	"property_id" text NOT NULL,
	"owner_id" text,
	"note" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "re_settings" (
	"organization_id" text PRIMARY KEY NOT NULL,
	"phone" text,
	"whatsapp" text,
	"email" text,
	"address" text,
	"about" jsonb,
	"currency" text DEFAULT 'USD' NOT NULL,
	"city" text,
	"share_template" jsonb,
	"usd_rate" integer DEFAULT 1450 NOT NULL,
	"default_commission" integer DEFAULT 200 NOT NULL,
	"auto_match" boolean DEFAULT false NOT NULL,
	"wa_api" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "re_stat" (
	"organization_id" text NOT NULL,
	"property_id" text NOT NULL,
	"day" text NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"wa" integer DEFAULT 0 NOT NULL,
	"calls" integer DEFAULT 0 NOT NULL,
	"shares" integer DEFAULT 0 NOT NULL,
	"qr" integer DEFAULT 0 NOT NULL,
	"requests" integer DEFAULT 0 NOT NULL,
	"favorites" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "re_viewing" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"property_id" text NOT NULL,
	"lead_id" text,
	"agent_id" text,
	"starts_at" timestamp with time zone,
	"minutes" integer DEFAULT 45 NOT NULL,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"source" text DEFAULT 'agent' NOT NULL,
	"preferred" text,
	"notes" text,
	"outcome" text,
	"feedback" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "re_activity_property" ON "re_activity" USING btree ("organization_id","property_id","at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "re_activity_lead" ON "re_activity" USING btree ("organization_id","lead_id","at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "re_activity_owner" ON "re_activity" USING btree ("organization_id","owner_id","at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "re_activity_org_at" ON "re_activity" USING btree ("organization_id","at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "re_agent_org" ON "re_agent" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "re_agent_user" ON "re_agent" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "re_branch_org" ON "re_branch" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "re_collection_token" ON "re_collection" USING btree ("token");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "re_collection_lead" ON "re_collection" USING btree ("organization_id","lead_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "re_ci_pair" ON "re_collection_item" USING btree ("collection_id","property_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "re_ci_property" ON "re_collection_item" USING btree ("organization_id","property_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "re_deal_org_stage" ON "re_deal" USING btree ("organization_id","stage","updated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "re_deal_property" ON "re_deal" USING btree ("organization_id","property_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "re_deal_lead" ON "re_deal" USING btree ("organization_id","lead_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "re_document_property" ON "re_document" USING btree ("organization_id","property_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "re_document_expiry" ON "re_document" USING btree ("organization_id","expires_on");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "re_followup_due" ON "re_followup" USING btree ("organization_id","done_at","due_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "re_followup_lead" ON "re_followup" USING btree ("organization_id","lead_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "re_lead_org" ON "re_lead" USING btree ("organization_id","status","updated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "re_lead_agent" ON "re_lead" USING btree ("organization_id","agent_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "re_lead_phone" ON "re_lead" USING btree ("organization_id","phone");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "re_lp_pair" ON "re_lead_property" USING btree ("lead_id","property_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "re_lp_property" ON "re_lead_property" USING btree ("organization_id","property_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "re_media_property" ON "re_media" USING btree ("property_id","sort");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "re_notice_org" ON "re_notice" USING btree ("organization_id","read_at","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "re_offer_deal" ON "re_offer" USING btree ("deal_id","at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "re_owner_org" ON "re_owner" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "re_owner_phone" ON "re_owner" USING btree ("organization_id","phone");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "re_payment_deal" ON "re_payment" USING btree ("organization_id","deal_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "re_property_slug" ON "re_property" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "re_property_ref" ON "re_property" USING btree ("organization_id","ref");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "re_property_org_status" ON "re_property" USING btree ("organization_id","status","updated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "re_property_owner" ON "re_property" USING btree ("organization_id","owner_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "re_property_agent" ON "re_property" USING btree ("organization_id","agent_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "re_property_match" ON "re_property" USING btree ("organization_id","purpose","type","price");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "re_report_token" ON "re_report" USING btree ("token");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "re_report_property" ON "re_report" USING btree ("organization_id","property_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "re_stat_day" ON "re_stat" USING btree ("property_id","day");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "re_stat_org_day" ON "re_stat" USING btree ("organization_id","day");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "re_viewing_org_at" ON "re_viewing" USING btree ("organization_id","starts_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "re_viewing_property" ON "re_viewing" USING btree ("organization_id","property_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "re_viewing_lead" ON "re_viewing" USING btree ("organization_id","lead_id");
--> statement-breakpoint
ALTER TABLE "re_activity" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "re_activity" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY re_activity_org ON "re_activity" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));--> statement-breakpoint
ALTER TABLE "re_agent" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "re_agent" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY re_agent_org ON "re_agent" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));--> statement-breakpoint
ALTER TABLE "re_branch" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "re_branch" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY re_branch_org ON "re_branch" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));--> statement-breakpoint
ALTER TABLE "re_collection" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "re_collection" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY re_collection_org ON "re_collection" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));--> statement-breakpoint
ALTER TABLE "re_collection_item" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "re_collection_item" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY re_collection_item_org ON "re_collection_item" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));--> statement-breakpoint
ALTER TABLE "re_deal" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "re_deal" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY re_deal_org ON "re_deal" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));--> statement-breakpoint
ALTER TABLE "re_document" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "re_document" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY re_document_org ON "re_document" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));--> statement-breakpoint
ALTER TABLE "re_followup" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "re_followup" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY re_followup_org ON "re_followup" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));--> statement-breakpoint
ALTER TABLE "re_lead" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "re_lead" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY re_lead_org ON "re_lead" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));--> statement-breakpoint
ALTER TABLE "re_lead_property" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "re_lead_property" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY re_lead_property_org ON "re_lead_property" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));--> statement-breakpoint
ALTER TABLE "re_media" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "re_media" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY re_media_org ON "re_media" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));--> statement-breakpoint
ALTER TABLE "re_notice" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "re_notice" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY re_notice_org ON "re_notice" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));--> statement-breakpoint
ALTER TABLE "re_offer" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "re_offer" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY re_offer_org ON "re_offer" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));--> statement-breakpoint
ALTER TABLE "re_owner" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "re_owner" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY re_owner_org ON "re_owner" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));--> statement-breakpoint
ALTER TABLE "re_payment" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "re_payment" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY re_payment_org ON "re_payment" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));--> statement-breakpoint
ALTER TABLE "re_property" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "re_property" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY re_property_org ON "re_property" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));--> statement-breakpoint
ALTER TABLE "re_report" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "re_report" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY re_report_org ON "re_report" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));--> statement-breakpoint
ALTER TABLE "re_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "re_settings" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY re_settings_org ON "re_settings" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));--> statement-breakpoint
ALTER TABLE "re_stat" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "re_stat" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY re_stat_org ON "re_stat" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));--> statement-breakpoint
ALTER TABLE "re_viewing" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "re_viewing" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY re_viewing_org ON "re_viewing" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));--> statement-breakpoint
INSERT INTO "hemlo_plan" ("id", "edition", "code", "name", "tagline", "price_month", "price_year", "limits", "popular", "sort") VALUES
 ('plan_re_office', 'realestate', 'office', '{"ar":"المكتب","en":"Office","ckb":"نووسینگە"}', '{"ar":"وكيل أو وكيلان، حتى 100 عقار","en":"One or two agents, up to 100 listings","ckb":"یەک یان دوو بریکار، تا 100 موڵک"}', 35000, 350000, '{"users":2,"listings":100,"ai":100}', false, 1),
 ('plan_re_agency', 'realestate', 'agency', '{"ar":"الوكالة","en":"Agency","ckb":"ئاژانس"}', '{"ar":"حتى 8 وكلاء، عقارات بلا حد","en":"Up to 8 agents, unlimited listings","ckb":"تا 8 بریکار، موڵکی بێسنوور"}', 69000, 690000, '{"users":8,"ai":300}', true, 2),
 ('plan_re_group', 'realestate', 'group', '{"ar":"المجموعة","en":"Group","ckb":"گرووپ"}', '{"ar":"عدة فروع، حتى 25 وكيلاً","en":"Several branches, up to 25 agents","ckb":"چەند لق، تا 25 بریکار"}', 129000, 1290000, '{"users":25,"ai":800}', false, 3)
ON CONFLICT ("id") DO NOTHING;
