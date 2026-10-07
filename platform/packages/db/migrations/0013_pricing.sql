-- Pricing: Hemlo's plans per edition (edited from the admin dashboard), payments received, plan requests from the app,
-- and the plan a business is on. Trials become 30 days (running ones are extended to 30 days from their start).
ALTER TABLE "hemlo_subscription" ADD COLUMN IF NOT EXISTS "plan_id" text;--> statement-breakpoint
ALTER TABLE "hemlo_subscription" ADD COLUMN IF NOT EXISTS "billing" text DEFAULT 'month' NOT NULL;--> statement-breakpoint
ALTER TABLE "hemlo_subscription" ADD COLUMN IF NOT EXISTS "price" integer;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hemlo_plan" (
	"id" text PRIMARY KEY NOT NULL,
	"edition" text NOT NULL,
	"code" text NOT NULL,
	"name" jsonb NOT NULL,
	"tagline" jsonb,
	"price_month" integer NOT NULL,
	"price_year" integer NOT NULL,
	"limits" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"popular" boolean DEFAULT false NOT NULL,
	"public" boolean DEFAULT true NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "hemlo_plan_code" ON "hemlo_plan" USING btree ("edition","code");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hemlo_payment" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"plan_id" text,
	"amount" integer NOT NULL,
	"months" integer NOT NULL,
	"method" text NOT NULL,
	"reference" text,
	"note" text,
	"paid_until" timestamp with time zone NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hemlo_payment_org" ON "hemlo_payment" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hemlo_plan_request" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"plan_id" text,
	"billing" text DEFAULT 'month' NOT NULL,
	"message" text,
	"user_id" text,
	"status" text DEFAULT 'new' NOT NULL,
	"handled_by" text,
	"handled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hemlo_plan_request_org" ON "hemlo_plan_request" USING btree ("organization_id","status");--> statement-breakpoint
ALTER TABLE "hemlo_payment" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "hemlo_payment" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY hemlo_payment_org ON "hemlo_payment" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));--> statement-breakpoint
ALTER TABLE "hemlo_plan_request" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "hemlo_plan_request" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY hemlo_plan_request_org ON "hemlo_plan_request" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));--> statement-breakpoint
-- the price list everyone can read; only the system (the admin dashboard) changes it
ALTER TABLE "hemlo_plan" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "hemlo_plan" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY hemlo_plan_read ON "hemlo_plan" FOR SELECT USING (true);--> statement-breakpoint
CREATE POLICY hemlo_plan_write ON "hemlo_plan" FOR ALL USING (current_setting('app.system', true) = 'on') WITH CHECK (current_setting('app.system', true) = 'on');--> statement-breakpoint
INSERT INTO "hemlo_plan" ("id", "edition", "code", "name", "tagline", "price_month", "price_year", "limits", "popular", "sort") VALUES
 ('plan_store_starter', 'store', 'starter', '{"ar":"البداية","en":"Starter","ckb":"دەستپێک"}', '{"ar":"محل صغير بكاشير واحد","en":"A small shop with one till","ckb":"دوکانێکی بچووک بە یەک کاشێر"}', 15000, 150000, '{"users":2,"devices":1,"ai":50}', false, 1),
 ('plan_store_growth', 'store', 'growth', '{"ar":"النمو","en":"Growth","ckb":"گەشە"}', '{"ar":"ماركت بعدة كاشيرات وموظفين","en":"A market with a few tills and staff","ckb":"مارکێتێک بە چەند کاشێر و کارمەند"}', 29000, 290000, '{"users":6,"devices":3,"ai":150}', true, 2),
 ('plan_store_business', 'store', 'business', '{"ar":"الأعمال","en":"Business","ckb":"بازرگانی"}', '{"ar":"متجر كبير، كاشيرات كثيرة","en":"A big store, many tills","ckb":"فرۆشگایەکی گەورە، کاشێری زۆر"}', 49000, 490000, '{"users":20,"devices":10,"ai":400}', false, 3),
 ('plan_dental_solo', 'dental', 'solo', '{"ar":"طبيب واحد","en":"Solo","ckb":"تاک"}', '{"ar":"طبيب واحد وفريقه","en":"One dentist and their team","ckb":"یەک پزیشک و تیمەکەی"}', 35000, 350000, '{"dentists":1,"users":3,"devices":1,"ai":150}', false, 1),
 ('plan_dental_clinic', 'dental', 'clinic', '{"ar":"العيادة","en":"Clinic","ckb":"نۆرینگە"}', '{"ar":"حتى 3 أطباء","en":"Up to 3 dentists","ckb":"تا 3 پزیشک"}', 75000, 750000, '{"dentists":3,"users":8,"devices":3,"ai":400}', true, 2),
 ('plan_dental_center', 'dental', 'center', '{"ar":"المركز","en":"Centre","ckb":"سەنتەر"}', '{"ar":"حتى 8 أطباء","en":"Up to 8 dentists","ckb":"تا 8 پزیشک"}', 140000, 1400000, '{"dentists":8,"users":20,"devices":8,"ai":1000}', false, 3),
 ('plan_gym_starter', 'gym', 'starter', '{"ar":"البداية","en":"Starter","ckb":"دەستپێک"}', '{"ar":"حتى 150 مشتركاً فعّالاً","en":"Up to 150 active members","ckb":"تا 150 بەشداربووی چالاک"}', 25000, 250000, '{"members":150,"users":3,"devices":1,"ai":50}', false, 1),
 ('plan_gym_standard', 'gym', 'standard', '{"ar":"القياسي","en":"Standard","ckb":"ستاندارد"}', '{"ar":"حتى 500 مشترك فعّال","en":"Up to 500 active members","ckb":"تا 500 بەشداربووی چالاک"}', 45000, 450000, '{"members":500,"users":8,"devices":3,"ai":150}', true, 2),
 ('plan_gym_pro', 'gym', 'pro', '{"ar":"المحترف","en":"Pro","ckb":"پڕۆ"}', '{"ar":"مشتركون بلا حد","en":"Unlimited members","ckb":"بەشداربووی بێسنوور"}', 75000, 750000, '{"users":20,"devices":10,"ai":400}', false, 3)
ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint
UPDATE "hemlo_subscription" SET "trial_ends_at" = "created_at" + interval '30 days' WHERE "status" = 'trial' AND "trial_ends_at" < "created_at" + interval '30 days';
