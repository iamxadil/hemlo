-- Hemlo Connect in three tiers: Basic comes free with the System, Pro (35,000 IQD) adds the AI assistant, AI Studio
-- (50,000 IQD) adds marketing. Each add-on's limits live with it (editable in admin), WhatsApp messaging is an allowance
-- Hemlo pays for in IQD, AI use is recorded by kind (text, image, video), and one business can have its own AI models.
ALTER TABLE "hemlo_addon" ADD COLUMN IF NOT EXISTS "limits" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "hemlo_addon" ADD COLUMN IF NOT EXISTS "includes" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "hemlo_addon" ADD COLUMN IF NOT EXISTS "sort" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_usage" ADD COLUMN IF NOT EXISTS "kind" text DEFAULT 'text' NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_usage" ADD COLUMN IF NOT EXISTS "units" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "connect_message" ADD COLUMN IF NOT EXISTS "category" text;--> statement-breakpoint
ALTER TABLE "connect_message" ADD COLUMN IF NOT EXISTS "cost_iqd" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "hemlo_ai_route" ADD COLUMN IF NOT EXISTS "organization_id" text;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hemlo_setting" (
  "key" text PRIMARY KEY NOT NULL,
  "value" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "updated_by" text,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "hemlo_setting" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "hemlo_setting" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS hemlo_setting_system ON "hemlo_setting";--> statement-breakpoint
CREATE POLICY hemlo_setting_system ON "hemlo_setting" FOR ALL USING (current_setting('app.system', true) = 'on') WITH CHECK (current_setting('app.system', true) = 'on');--> statement-breakpoint
-- WhatsApp's rates for Iraqi numbers from a third-party guide (indicative, not an invoice): the team corrects them in admin.
-- The dollar rate and each business's share of the running costs are left empty: they are entered, never guessed.
INSERT INTO "hemlo_setting" ("key", "value") VALUES ('costs', '{"usdIqd":null,"infraIqd":null,"mediaBudgetUsd":10,"marginTarget":15,"waRates":{"IQ":{"marketing":45,"utility":10,"service":0},"other":{"marketing":45,"utility":10,"service":0}}}')
ON CONFLICT ("key") DO NOTHING;--> statement-breakpoint
UPDATE "hemlo_addon" SET "price_month" = 10000, "price_year" = 100000, "sort" = 0, "updated_at" = now() WHERE "code" = 'website';--> statement-breakpoint
UPDATE "hemlo_addon" SET "price_month" = 0, "price_year" = 0, "sort" = 1, "updated_at" = now(),
  "name" = '{"ar":"Hemlo Connect Basic","en":"Hemlo Connect Basic"}',
  "description" = '{"ar":"مع النظام بلا كلفة: صندوق محادثات واتساب للفريق، وتذكيرات المعاينات ومتابعتها، وتنبيهات العقارات الجديدة. رسائل واتساب مشمولة.","en":"Free with the System: a team WhatsApp inbox, viewing reminders and follow-ups, and new-listing alerts. WhatsApp messaging included."}',
  "limits" = '{"aiDay":0,"aiWeek":0,"aiMonth":0,"waIqd":3000,"waMarketingPct":30,"sendsDay":100}'
  WHERE "code" = 'connect';--> statement-breakpoint
UPDATE "hemlo_addon" SET "price_month" = 35000, "price_year" = 350000, "sort" = 2, "includes" = '["connect"]', "updated_at" = now(),
  "description" = '{"ar":"كل ما في Basic، مع مساعد ذكي يرد على زبائنك من عقاراتك الحقيقية ويحجز المعاينات، واقتراح الردود وتلخيص المحادثات للفريق، وتقرير شهري لكل مالك، وإحياء الزبائن الذين انقطعوا.","en":"Everything in Basic, plus an AI assistant that answers from your real listings and books viewings, suggested replies and chat summaries for the team, a monthly report for every owner, and reviving leads that went quiet."}',
  "limits" = '{"aiDay":60,"aiWeek":300,"aiMonth":1000,"waIqd":10000,"waMarketingPct":40,"sendsDay":300}'
  WHERE "code" = 'connect-pro';--> statement-breakpoint
INSERT INTO "hemlo_addon" ("id", "code", "name", "description", "compatible_editions", "price_month", "price_year", "public", "active", "limits", "includes", "sort")
VALUES ('ai-studio', 'ai-studio', '{"ar":"Hemlo AI Studio","en":"Hemlo AI Studio"}',
  '{"ar":"كل ما في Connect Pro، مع حملات تسويقية بالذكاء الاصطناعي: نصوص عربية وإنكليزية لواتساب وإنستغرام وفيسبوك، وتصاميم منشورات من عقاراتك، وخطة محتوى شهرية.","en":"Everything in Connect Pro, plus AI marketing: Arabic and English copy for WhatsApp, Instagram and Facebook, post designs from your listings, and a monthly content plan."}',
  '["realestate"]', 50000, 500000, true, true,
  '{"aiDay":60,"aiWeek":300,"aiMonth":1000,"waIqd":15000,"waMarketingPct":50,"sendsDay":400,"studioMonth":200,"imagesMonth":60,"videosMonth":0,"mediaIqd":15000}',
  '["connect-pro","connect"]', 3)
ON CONFLICT ("code") DO NOTHING;--> statement-breakpoint
-- the Website + Connect Pro bundle is retired (each is sold apart now); a demo started before this keeps it until it ends
UPDATE "hemlo_addon" SET "active" = false, "public" = false, "updated_at" = now() WHERE "code" = 'web-connect';--> statement-breakpoint
-- a business paying for Connect moves to Connect Pro, at the price it already pays (Basic is free now)
SELECT set_config('app.system', 'on', false);--> statement-breakpoint
UPDATE "hemlo_addon_entitlement" e SET "addon_id" = 'connect-pro', "updated_by" = 'migration:0026', "updated_at" = now()
  WHERE e."addon_id" = 'connect' AND e."status" = 'active'
    AND NOT EXISTS (SELECT 1 FROM "hemlo_addon_entitlement" x WHERE x."organization_id" = e."organization_id" AND x."addon_id" = 'connect-pro');--> statement-breakpoint
SELECT set_config('app.system', 'off', false);
