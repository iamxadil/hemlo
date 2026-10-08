CREATE TABLE IF NOT EXISTS "sys_reminder" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"customer_id" text NOT NULL,
	"kind" text NOT NULL,
	"ref_id" text,
	"amount" integer,
	"sent_on" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" text
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sys_reminder_once" ON "sys_reminder" USING btree ("customer_id","kind","sent_on");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sys_reminder_org_at" ON "sys_reminder" USING btree ("organization_id","at");--> statement-breakpoint
ALTER TABLE "sys_reminder" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sys_reminder" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS sys_reminder_org ON "sys_reminder";--> statement-breakpoint
CREATE POLICY sys_reminder_org ON "sys_reminder" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));
