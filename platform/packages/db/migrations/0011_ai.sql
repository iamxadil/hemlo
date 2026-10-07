-- Hemlo AI, phase 1: what each business's AI tasks cost and did (ai_usage), and an owner's switch to turn AI off.
CREATE TABLE IF NOT EXISTS "ai_usage" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text,
	"feature" text NOT NULL,
	"engine" text NOT NULL,
	"model" text,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cost_micros" integer DEFAULT 0 NOT NULL,
	"ms" integer DEFAULT 0 NOT NULL,
	"ok" boolean NOT NULL,
	"counted" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_usage_org_month" ON "ai_usage" USING btree ("organization_id","created_at");--> statement-breakpoint
ALTER TABLE "sys_settings" ADD COLUMN IF NOT EXISTS "ai_off" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_usage" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "ai_usage" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY ai_usage_org ON "ai_usage" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));
