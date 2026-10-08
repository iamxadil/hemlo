-- Hemlo School: years, grades, classes, students and guardians, enrolments, fee plans, charges, payments, attendance.
-- Every table: organization_id + row-level security. Plus the edition's plans (hidden until priced).
CREATE TABLE IF NOT EXISTS "sch_settings" (
	"organization_id" text PRIMARY KEY NOT NULL,
	"kind" text DEFAULT 'school' NOT NULL,
	"city" text,
	"phone" text,
	"whatsapp" text,
	"current_year_id" text,
	"pass_mark" integer DEFAULT 50 NOT NULL,
	"absent_text" jsonb,
	"fee_text" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sch_year" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sch_grade" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"stage" text DEFAULT 'primary' NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sch_class" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"year_id" text NOT NULL,
	"grade_id" text NOT NULL,
	"name" text NOT NULL,
	"teacher_member_id" text,
	"room" text,
	"capacity" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sch_student" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"number" integer NOT NULL,
	"name" text NOT NULL,
	"gender" text,
	"birth_date" date,
	"phone" text,
	"photo_id" text,
	"health" text,
	"notes" text,
	"status" text DEFAULT 'active' NOT NULL,
	"joined_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sch_guardian" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"relation" text DEFAULT 'father' NOT NULL,
	"phone" text,
	"whatsapp" text,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sch_student_guardian" (
	"student_id" text NOT NULL,
	"guardian_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"primary" boolean DEFAULT true NOT NULL,
	CONSTRAINT "sch_student_guardian_student_id_guardian_id_pk" PRIMARY KEY("student_id","guardian_id")
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sch_enrollment" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"student_id" text NOT NULL,
	"year_id" text NOT NULL,
	"class_id" text NOT NULL,
	"status" text DEFAULT 'enrolled' NOT NULL,
	"enrolled_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sch_fee_plan" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"year_id" text NOT NULL,
	"grade_id" text,
	"name" text NOT NULL,
	"installments" jsonb NOT NULL,
	"total" bigint NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sch_charge" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"student_id" text NOT NULL,
	"year_id" text NOT NULL,
	"plan_id" text,
	"kind" text DEFAULT 'tuition' NOT NULL,
	"label" text NOT NULL,
	"amount" bigint NOT NULL,
	"due_on" date NOT NULL,
	"user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sch_payment" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"student_id" text NOT NULL,
	"number" integer NOT NULL,
	"amount" bigint NOT NULL,
	"method" text DEFAULT 'cash' NOT NULL,
	"payer" text,
	"note" text,
	"void" boolean DEFAULT false NOT NULL,
	"user_id" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sch_attendance" (
	"student_id" text NOT NULL,
	"day" date NOT NULL,
	"organization_id" text NOT NULL,
	"class_id" text NOT NULL,
	"status" text NOT NULL,
	"note" text,
	"user_id" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sch_attendance_student_id_day_pk" PRIMARY KEY("student_id","day")
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sch_year_org" ON "sch_year" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sch_grade_org" ON "sch_grade" USING btree ("organization_id","sort");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sch_class_year" ON "sch_class" USING btree ("organization_id","year_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sch_student_number" ON "sch_student" USING btree ("organization_id","number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sch_student_status" ON "sch_student" USING btree ("organization_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sch_guardian_token" ON "sch_guardian" USING btree ("token");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sch_guardian_phone" ON "sch_guardian" USING btree ("organization_id","phone");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sch_sg_guardian" ON "sch_student_guardian" USING btree ("guardian_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sch_enrollment_one" ON "sch_enrollment" USING btree ("student_id","year_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sch_enrollment_class" ON "sch_enrollment" USING btree ("organization_id","class_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sch_fee_plan_year" ON "sch_fee_plan" USING btree ("organization_id","year_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sch_charge_student" ON "sch_charge" USING btree ("organization_id","student_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sch_charge_due" ON "sch_charge" USING btree ("organization_id","due_on");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sch_charge_plan_once" ON "sch_charge" USING btree ("student_id","plan_id","label") WHERE plan_id is not null;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sch_payment_number" ON "sch_payment" USING btree ("organization_id","number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sch_payment_student" ON "sch_payment" USING btree ("organization_id","student_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sch_payment_at" ON "sch_payment" USING btree ("organization_id","at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sch_attendance_class_day" ON "sch_attendance" USING btree ("organization_id","class_id","day");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sch_attendance_day" ON "sch_attendance" USING btree ("organization_id","day");--> statement-breakpoint
ALTER TABLE "sch_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sch_settings" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS sch_settings_org ON "sch_settings";--> statement-breakpoint
CREATE POLICY sch_settings_org ON "sch_settings" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));--> statement-breakpoint
ALTER TABLE "sch_year" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sch_year" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS sch_year_org ON "sch_year";--> statement-breakpoint
CREATE POLICY sch_year_org ON "sch_year" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));--> statement-breakpoint
ALTER TABLE "sch_grade" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sch_grade" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS sch_grade_org ON "sch_grade";--> statement-breakpoint
CREATE POLICY sch_grade_org ON "sch_grade" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));--> statement-breakpoint
ALTER TABLE "sch_class" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sch_class" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS sch_class_org ON "sch_class";--> statement-breakpoint
CREATE POLICY sch_class_org ON "sch_class" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));--> statement-breakpoint
ALTER TABLE "sch_student" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sch_student" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS sch_student_org ON "sch_student";--> statement-breakpoint
CREATE POLICY sch_student_org ON "sch_student" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));--> statement-breakpoint
ALTER TABLE "sch_guardian" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sch_guardian" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS sch_guardian_org ON "sch_guardian";--> statement-breakpoint
CREATE POLICY sch_guardian_org ON "sch_guardian" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));--> statement-breakpoint
ALTER TABLE "sch_student_guardian" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sch_student_guardian" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS sch_student_guardian_org ON "sch_student_guardian";--> statement-breakpoint
CREATE POLICY sch_student_guardian_org ON "sch_student_guardian" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));--> statement-breakpoint
ALTER TABLE "sch_enrollment" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sch_enrollment" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS sch_enrollment_org ON "sch_enrollment";--> statement-breakpoint
CREATE POLICY sch_enrollment_org ON "sch_enrollment" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));--> statement-breakpoint
ALTER TABLE "sch_fee_plan" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sch_fee_plan" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS sch_fee_plan_org ON "sch_fee_plan";--> statement-breakpoint
CREATE POLICY sch_fee_plan_org ON "sch_fee_plan" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));--> statement-breakpoint
ALTER TABLE "sch_charge" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sch_charge" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS sch_charge_org ON "sch_charge";--> statement-breakpoint
CREATE POLICY sch_charge_org ON "sch_charge" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));--> statement-breakpoint
ALTER TABLE "sch_payment" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sch_payment" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS sch_payment_org ON "sch_payment";--> statement-breakpoint
CREATE POLICY sch_payment_org ON "sch_payment" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));--> statement-breakpoint
ALTER TABLE "sch_attendance" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sch_attendance" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS sch_attendance_org ON "sch_attendance";--> statement-breakpoint
CREATE POLICY sch_attendance_org ON "sch_attendance" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));--> statement-breakpoint
INSERT INTO "hemlo_plan" ("id", "edition", "code", "name", "tagline", "price_month", "price_year", "limits", "popular", "sort", "public") VALUES
 ('plan_sch_institute', 'school', 'institute', '{"ar":"المعهد","en":"Institute","ckb":"پەیمانگا"}', '{"ar":"معهد أو روضة، حتى 150 طالباً","en":"An institute or kindergarten, up to 150 students","ckb":"پەیمانگا یان باخچە، تا 150 قوتابی"}', 49000, 490000, '{"users":4,"ai":100}', false, 1, false),
 ('plan_sch_school', 'school', 'school', '{"ar":"المدرسة","en":"School","ckb":"قوتابخانە"}', '{"ar":"مدرسة حتى 600 طالب","en":"A school of up to 600 students","ckb":"قوتابخانەیەک تا 600 قوتابی"}', 99000, 990000, '{"users":15,"ai":300}', true, 2, false),
 ('plan_sch_campus', 'school', 'campus', '{"ar":"المجمّع","en":"Campus","ckb":"کامپەس"}', '{"ar":"عدة مراحل، حتى 2000 طالب","en":"Several stages, up to 2,000 students","ckb":"چەند قۆناغ، تا 2000 قوتابی"}', 179000, 1790000, '{"users":40,"ai":800}', false, 3, false)
ON CONFLICT ("id") DO NOTHING;
