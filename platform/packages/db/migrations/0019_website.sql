-- Hemlo Systems · Website add-on: one optional public site per business, drawn from the edition's own data. A site has
-- its look, its words and its addresses (subdomain, external domain); a page is a slug and an ordered list of typed
-- sections. Every table: organization_id + row-level security. No plans: the website is an add-on, not an edition.
CREATE TABLE IF NOT EXISTS "web_page" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"website_id" text NOT NULL,
	"slug" text DEFAULT '' NOT NULL,
	"kind" text DEFAULT 'custom' NOT NULL,
	"title" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sections" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"seo" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "web_site" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"vertical" text NOT NULL,
	"status" text DEFAULT 'not_enabled' NOT NULL,
	"lang" text DEFAULT 'ar' NOT NULL,
	"name" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"tagline" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"about" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"theme" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"logo_id" text,
	"favicon_id" text,
	"subdomain" text,
	"domain" text,
	"domain_status" text DEFAULT 'none' NOT NULL,
	"published_at" timestamp with time zone,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "web_page_slug" ON "web_page" USING btree ("website_id","slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "web_page_site" ON "web_page" USING btree ("organization_id","website_id","sort");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "web_site_org" ON "web_site" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "web_site_subdomain" ON "web_site" USING btree ("subdomain");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "web_site_domain" ON "web_site" USING btree ("domain");
--> statement-breakpoint
ALTER TABLE "web_page" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "web_page" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY web_page_org ON "web_page" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));--> statement-breakpoint
ALTER TABLE "web_site" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "web_site" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY web_site_org ON "web_site" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));
