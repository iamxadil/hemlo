CREATE TABLE IF NOT EXISTS "re_contract" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"number" integer NOT NULL,
	"kind" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"lang" text DEFAULT 'ar' NOT NULL,
	"deal_id" text,
	"property_id" text,
	"lead_id" text,
	"owner_id" text,
	"data" jsonb NOT NULL,
	"document_id" text,
	"signed_at" timestamp with time zone,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "re_contract_number" ON "re_contract" USING btree ("organization_id","number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "re_contract_org" ON "re_contract" USING btree ("organization_id","updated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "re_contract_deal" ON "re_contract" USING btree ("organization_id","deal_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "re_contract_property" ON "re_contract" USING btree ("organization_id","property_id");--> statement-breakpoint
ALTER TABLE "re_settings" ADD COLUMN IF NOT EXISTS "contract_terms" jsonb;--> statement-breakpoint
ALTER TABLE "re_contract" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "re_contract" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS re_contract_org ON "re_contract";--> statement-breakpoint
CREATE POLICY re_contract_org ON "re_contract" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));
