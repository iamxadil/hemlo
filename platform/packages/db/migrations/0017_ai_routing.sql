CREATE TABLE IF NOT EXISTS "hemlo_ai_provider" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"label" text NOT NULL,
	"base_url" text,
	"key_enc" text,
	"key_hint" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hemlo_ai_route" (
	"id" text PRIMARY KEY NOT NULL,
	"edition" text NOT NULL,
	"feature" text NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"fallback_provider" text,
	"fallback_model" text,
	"price_in" double precision,
	"price_out" double precision,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
-- the system alone reads and writes these (they hold encrypted API keys): never a business, never the app's role directly
ALTER TABLE "hemlo_ai_provider" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "hemlo_ai_provider" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS hemlo_ai_provider_system ON "hemlo_ai_provider";--> statement-breakpoint
CREATE POLICY hemlo_ai_provider_system ON "hemlo_ai_provider" FOR ALL USING (current_setting('app.system', true) = 'on') WITH CHECK (current_setting('app.system', true) = 'on');--> statement-breakpoint
ALTER TABLE "hemlo_ai_route" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "hemlo_ai_route" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS hemlo_ai_route_system ON "hemlo_ai_route";--> statement-breakpoint
CREATE POLICY hemlo_ai_route_system ON "hemlo_ai_route" FOR ALL USING (current_setting('app.system', true) = 'on') WITH CHECK (current_setting('app.system', true) = 'on');
