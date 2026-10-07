CREATE TABLE "sys_file" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"purpose" text NOT NULL,
	"ref_id" text,
	"mime" text NOT NULL,
	"bytes" integer NOT NULL,
	"width" integer,
	"height" integer,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sys_product" ADD COLUMN "image_id" text;--> statement-breakpoint
ALTER TABLE "sys_settings" ADD COLUMN "logo_id" text;--> statement-breakpoint
CREATE INDEX "sys_file_ref" ON "sys_file" USING btree ("organization_id","ref_id");--> statement-breakpoint
ALTER TABLE "sys_file" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "sys_file" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY sys_file_org ON "sys_file" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));
