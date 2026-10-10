-- Optional System capabilities. Core plans and subscriptions remain unchanged.
CREATE TABLE IF NOT EXISTS "hemlo_addon" (
  "id" text PRIMARY KEY NOT NULL,
  "code" text NOT NULL UNIQUE,
  "name" jsonb NOT NULL,
  "description" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "compatible_editions" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "price_month" integer,
  "price_year" integer,
  "public" boolean DEFAULT true NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "updated_by" text,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
INSERT INTO "hemlo_addon" ("id", "code", "name", "description", "compatible_editions", "price_month", "price_year", "public", "active")
VALUES ('website', 'website', '{"ar":"موقع Hemlo","en":"Hemlo Website"}', '{"ar":"أنشئ موقعاً تجارياً يحمل علامتك، ومتصل مباشرة بمساحة عمل Hemlo.","en":"Create your own branded business website, connected directly to your Hemlo workspace."}', '["realestate"]', NULL, NULL, true, true)
ON CONFLICT ("code") DO NOTHING;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hemlo_addon_request" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "addon_id" text NOT NULL,
  "edition" text NOT NULL,
  "action" text DEFAULT 'activate' NOT NULL,
  "billing" text DEFAULT 'month' NOT NULL,
  "price" integer,
  "message" text,
  "user_id" text,
  "status" text DEFAULT 'new' NOT NULL,
  "handled_by" text,
  "handled_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hemlo_addon_request_org" ON "hemlo_addon_request" USING btree ("organization_id", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hemlo_addon_request_addon" ON "hemlo_addon_request" USING btree ("addon_id", "status");
--> statement-breakpoint
ALTER TABLE "hemlo_addon_request" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "hemlo_addon_request" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY hemlo_addon_request_org ON "hemlo_addon_request" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hemlo_addon_entitlement" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "addon_id" text NOT NULL,
  "edition" text NOT NULL,
  "status" text DEFAULT 'active' NOT NULL,
  "billing" text DEFAULT 'month' NOT NULL,
  "price" integer NOT NULL,
  "starts_at" timestamp with time zone DEFAULT now() NOT NULL,
  "paid_until" timestamp with time zone,
  "updated_by" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "hemlo_addon_entitlement_org" ON "hemlo_addon_entitlement" USING btree ("organization_id", "addon_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hemlo_addon_entitlement_status" ON "hemlo_addon_entitlement" USING btree ("status", "paid_until");
--> statement-breakpoint
ALTER TABLE "hemlo_addon_entitlement" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "hemlo_addon_entitlement" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY hemlo_addon_entitlement_org ON "hemlo_addon_entitlement" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hemlo_addon_payment" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "addon_id" text NOT NULL,
  "amount" integer NOT NULL,
  "periods" integer DEFAULT 1 NOT NULL,
  "method" text NOT NULL,
  "reference" text,
  "paid_until" timestamp with time zone NOT NULL,
  "created_by" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hemlo_addon_payment_org" ON "hemlo_addon_payment" USING btree ("organization_id", "created_at");
--> statement-breakpoint
ALTER TABLE "hemlo_addon_payment" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "hemlo_addon_payment" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY hemlo_addon_payment_org ON "hemlo_addon_payment" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));
