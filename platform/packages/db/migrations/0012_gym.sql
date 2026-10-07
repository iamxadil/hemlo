-- Hemlo Systems · Gym edition: members (a gym profile on sys_customer), plans, memberships, check-ins, coaches, the weekly
-- timetable and its bookings, and body measurements. Every table: organization_id + row-level security.
CREATE TABLE IF NOT EXISTS "gym_settings" (
	"organization_id" text PRIMARY KEY NOT NULL,
	"hours" jsonb,
	"reentry_minutes" integer DEFAULT 180 NOT NULL,
	"grace_days" integer DEFAULT 0 NOT NULL,
	"reminder_text" text,
	"door_key" text,
	"self_checkin" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "gym_trainer" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"member_id" text,
	"name" text NOT NULL,
	"phone" text,
	"gender" text,
	"specialty" text,
	"color" text DEFAULT '#E4572E' NOT NULL,
	"pt_share" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "gym_plan" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text DEFAULT 'gym' NOT NULL,
	"duration" integer DEFAULT 1 NOT NULL,
	"unit" text DEFAULT 'month' NOT NULL,
	"visits" integer,
	"price" integer DEFAULT 0 NOT NULL,
	"gender" text DEFAULT 'all' NOT NULL,
	"freeze_days" integer DEFAULT 0 NOT NULL,
	"color" text,
	"active" boolean DEFAULT true NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "gym_member" (
	"customer_id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"member_no" integer NOT NULL,
	"card_code" text NOT NULL,
	"gender" text,
	"birth_date" date,
	"photo_id" text,
	"goal" text,
	"health" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"alerts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"emergency_name" text,
	"emergency_phone" text,
	"referral" text,
	"trainer_id" text,
	"notes" text,
	"last_visit_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "gym_membership" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"member_id" text NOT NULL,
	"plan_id" text,
	"name" text NOT NULL,
	"category" text DEFAULT 'gym' NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"visits" integer,
	"visits_used" integer DEFAULT 0 NOT NULL,
	"price" integer DEFAULT 0 NOT NULL,
	"discount" integer DEFAULT 0 NOT NULL,
	"sale_id" text,
	"trainer_id" text,
	"status" text DEFAULT 'active' NOT NULL,
	"freeze_days" integer DEFAULT 0 NOT NULL,
	"frozen_from" date,
	"frozen_days" integer DEFAULT 0 NOT NULL,
	"note" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"canceled_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "gym_checkin" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"member_id" text NOT NULL,
	"membership_id" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"via" text DEFAULT 'desk' NOT NULL,
	"result" text NOT NULL,
	"reason" text,
	"counted" boolean DEFAULT false NOT NULL,
	"trainer_id" text,
	"user_id" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "gym_class" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"trainer_id" text,
	"day" integer NOT NULL,
	"starts_at" text NOT NULL,
	"minutes" integer DEFAULT 60 NOT NULL,
	"capacity" integer,
	"gender" text DEFAULT 'all' NOT NULL,
	"color" text,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "gym_booking" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"class_id" text NOT NULL,
	"date" date NOT NULL,
	"member_id" text NOT NULL,
	"status" text DEFAULT 'booked' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "gym_measure" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"member_id" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"weight" numeric(6, 1),
	"height" numeric(6, 1),
	"body_fat" numeric(6, 1),
	"muscle" numeric(6, 1),
	"waist" numeric(6, 1),
	"chest" numeric(6, 1),
	"arm" numeric(6, 1),
	"thigh" numeric(6, 1),
	"hip" numeric(6, 1),
	"note" text,
	"user_id" text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gym_trainer_org" ON "gym_trainer" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "gym_trainer_member" ON "gym_trainer" USING btree ("organization_id","member_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gym_plan_org" ON "gym_plan" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gym_member_org" ON "gym_member" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "gym_member_no" ON "gym_member" USING btree ("organization_id","member_no");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "gym_member_card" ON "gym_member" USING btree ("organization_id","card_code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gym_ms_member" ON "gym_membership" USING btree ("member_id","ends_on");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gym_ms_org_end" ON "gym_membership" USING btree ("organization_id","ends_on");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gym_checkin_org_at" ON "gym_checkin" USING btree ("organization_id","at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gym_checkin_member" ON "gym_checkin" USING btree ("member_id","at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gym_class_org" ON "gym_class" USING btree ("organization_id","day");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gym_booking_class" ON "gym_booking" USING btree ("organization_id","date","class_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "gym_booking_once" ON "gym_booking" USING btree ("class_id","date","member_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gym_measure_member" ON "gym_measure" USING btree ("member_id","at");--> statement-breakpoint
ALTER TABLE "gym_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "gym_settings" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY gym_settings_org ON "gym_settings" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));--> statement-breakpoint
ALTER TABLE "gym_trainer" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "gym_trainer" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY gym_trainer_org ON "gym_trainer" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));--> statement-breakpoint
ALTER TABLE "gym_plan" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "gym_plan" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY gym_plan_org ON "gym_plan" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));--> statement-breakpoint
ALTER TABLE "gym_member" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "gym_member" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY gym_member_org ON "gym_member" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));--> statement-breakpoint
ALTER TABLE "gym_membership" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "gym_membership" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY gym_membership_org ON "gym_membership" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));--> statement-breakpoint
ALTER TABLE "gym_checkin" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "gym_checkin" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY gym_checkin_org ON "gym_checkin" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));--> statement-breakpoint
ALTER TABLE "gym_class" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "gym_class" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY gym_class_org ON "gym_class" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));--> statement-breakpoint
ALTER TABLE "gym_booking" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "gym_booking" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY gym_booking_org ON "gym_booking" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));--> statement-breakpoint
ALTER TABLE "gym_measure" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "gym_measure" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY gym_measure_org ON "gym_measure" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));
