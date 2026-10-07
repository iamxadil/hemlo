CREATE TABLE "sys_fib_payment" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"fib_payment_id" text NOT NULL,
	"env" text NOT NULL,
	"amount" integer NOT NULL,
	"status" text DEFAULT 'UNPAID' NOT NULL,
	"readable_code" text,
	"qr_code" text,
	"personal_app_link" text,
	"valid_until" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"paid_by" text,
	"decline_reason" text,
	"checked_at" timestamp with time zone,
	"sale_id" text,
	"refunded_at" timestamp with time zone,
	"refund_status" text,
	"user_id" text,
	"device_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sys_settings" (
	"organization_id" text PRIMARY KEY NOT NULL,
	"fib" jsonb,
	"scale" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sys_product" ADD COLUMN "scale_code" text;--> statement-breakpoint
ALTER TABLE "sys_sale" ADD COLUMN "fib_payment_id" text;--> statement-breakpoint
ALTER TABLE "sys_shift" ADD COLUMN "device_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "sys_fib_payment_fib" ON "sys_fib_payment" USING btree ("fib_payment_id");--> statement-breakpoint
CREATE INDEX "sys_fib_payment_org" ON "sys_fib_payment" USING btree ("organization_id","created_at");--> statement-breakpoint
ALTER TABLE "sys_settings" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "sys_settings" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY sys_settings_org ON "sys_settings" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));
--> statement-breakpoint
ALTER TABLE "sys_fib_payment" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "sys_fib_payment" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY sys_fib_payment_org ON "sys_fib_payment" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));
