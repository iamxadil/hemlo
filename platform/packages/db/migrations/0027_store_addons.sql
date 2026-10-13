-- Hemlo's add-ons for shops: each add-on can have its own price, allowances and words per system (a shop pays less
-- than an agency); Connect links a chat to a shop's customer; products can be shown in the online shop; and the shop's
-- orders, which become sales when they are delivered.
ALTER TABLE "hemlo_addon" ADD COLUMN IF NOT EXISTS "editions" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "connect_conversation" ADD COLUMN IF NOT EXISTS "customer_id" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "connect_conversation_customer" ON "connect_conversation" USING btree ("organization_id", "customer_id");--> statement-breakpoint
ALTER TABLE "sys_product" ADD COLUMN IF NOT EXISTS "online" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sys_product" ADD COLUMN IF NOT EXISTS "slug" text;--> statement-breakpoint
ALTER TABLE "sys_product" ADD COLUMN IF NOT EXISTS "description" text;--> statement-breakpoint
ALTER TABLE "sys_product" ADD COLUMN IF NOT EXISTS "photo_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sys_product_slug" ON "sys_product" USING btree ("organization_id", "slug");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shop_order" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "number" integer NOT NULL,
  "code" text NOT NULL,
  "status" text DEFAULT 'new' NOT NULL,
  "name" text NOT NULL,
  "phone" text NOT NULL,
  "delivery" text DEFAULT 'delivery' NOT NULL,
  "city" text,
  "area" text,
  "address" text,
  "note" text,
  "subtotal" integer NOT NULL,
  "delivery_fee" integer DEFAULT 0 NOT NULL,
  "total" integer NOT NULL,
  "payment" text DEFAULT 'cod' NOT NULL,
  "lang" text DEFAULT 'ar' NOT NULL,
  "customer_id" text,
  "sale_id" text,
  "cancel_reason" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "confirmed_at" timestamp with time zone,
  "delivered_at" timestamp with time zone
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shop_order_org_time" ON "shop_order" USING btree ("organization_id", "created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shop_order_number" ON "shop_order" USING btree ("organization_id", "number");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shop_order_code" ON "shop_order" USING btree ("code");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shop_order_line" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "order_id" text NOT NULL,
  "product_id" text,
  "name" text NOT NULL,
  "qty" numeric(12, 3) NOT NULL,
  "price" integer NOT NULL,
  "total" integer NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shop_order_line_order" ON "shop_order_line" USING btree ("order_id");--> statement-breakpoint
ALTER TABLE "shop_order" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "shop_order" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS shop_order_org ON "shop_order";--> statement-breakpoint
CREATE POLICY shop_order_org ON "shop_order" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));--> statement-breakpoint
ALTER TABLE "shop_order_line" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "shop_order_line" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS shop_order_line_org ON "shop_order_line";--> statement-breakpoint
CREATE POLICY shop_order_line_org ON "shop_order_line" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));--> statement-breakpoint
-- the shop's prices and allowances (each still clears its margin at full use), and words about a shop, not an agency
UPDATE "hemlo_addon" SET "updated_at" = now(), "editions" = '{"store":{"priceMonth":10000,"priceYear":100000,"description":{"ar":"متجرك على الإنترنت: منتجاتك بصورها وأسعارها، سلة وطلب بالدفع عند الاستلام، والطلبات تصلك في النظام.","en":"Your shop online: your products with photos and prices, a cart and cash-on-delivery checkout, and the orders arrive in your system."}}}'
  WHERE "code" = 'website';--> statement-breakpoint
UPDATE "hemlo_addon" SET "updated_at" = now(), "editions" = '{"store":{"limits":{"aiDay":0,"aiWeek":0,"aiMonth":0,"waIqd":2000,"waMarketingPct":30,"sendsDay":80},"description":{"ar":"مع النظام بلا كلفة: صندوق محادثات واتساب للفريق، وتحديثات الطلبات لزبائنك، وتذكير الديون. رسائل واتساب مشمولة.","en":"Free with the System: a team WhatsApp inbox, order updates for your customers, and debt reminders. WhatsApp messaging included."}}}'
  WHERE "code" = 'connect';--> statement-breakpoint
UPDATE "hemlo_addon" SET "updated_at" = now(), "editions" = '{"store":{"priceMonth":25000,"priceYear":250000,"limits":{"aiDay":40,"aiWeek":200,"aiMonth":700,"waIqd":7000,"waMarketingPct":40,"sendsDay":200},"description":{"ar":"كل ما في Basic، مع مساعد ذكي يرد على زبائنك من منتجاتك وأسعارك ومخزونك الحقيقي، واقتراح الردود وتلخيص المحادثات للفريق.","en":"Everything in Basic, plus an AI assistant that answers your customers from your real products, prices and stock, with suggested replies and chat summaries for the team."}}}'
  WHERE "code" = 'connect-pro';--> statement-breakpoint
UPDATE "hemlo_addon" SET "updated_at" = now(), "editions" = '{"store":{"priceMonth":35000,"priceYear":350000,"limits":{"aiDay":40,"aiWeek":200,"aiMonth":700,"waIqd":9000,"waMarketingPct":50,"sendsDay":300,"studioMonth":120,"imagesMonth":30,"videosMonth":0,"mediaIqd":7000},"description":{"ar":"كل ما في Connect Pro، مع حملات تسويقية بالذكاء الاصطناعي: نصوص عربية وإنكليزية لواتساب وإنستغرام وفيسبوك، وتصاميم منشورات من منتجاتك، وخطة محتوى شهرية.","en":"Everything in Connect Pro, plus AI marketing: Arabic and English copy for WhatsApp, Instagram and Facebook, post designs from your products, and a monthly content plan."}}}'
  WHERE "code" = 'ai-studio';--> statement-breakpoint
UPDATE "hemlo_addon" SET "compatible_editions" = "compatible_editions" || '["store"]'::jsonb, "updated_at" = now()
  WHERE "code" IN ('website', 'connect', 'connect-pro', 'ai-studio') AND NOT ("compatible_editions" ? 'store');
