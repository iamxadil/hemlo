CREATE TABLE "hemlo_subscription" (
	"organization_id" text PRIMARY KEY NOT NULL,
	"edition" text NOT NULL,
	"status" text NOT NULL,
	"plan" text,
	"seats" integer DEFAULT 1 NOT NULL,
	"trial_ends_at" timestamp with time zone,
	"paid_until" timestamp with time zone,
	"price_note" text,
	"note" text,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dent_access_log" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"patient_id" text NOT NULL,
	"user_id" text,
	"action" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dent_appointment" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"patient_id" text NOT NULL,
	"dentist_id" text,
	"chair_id" text,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'booked' NOT NULL,
	"reason" text,
	"note" text,
	"booked_by" text,
	"reminded_at" timestamp with time zone,
	"arrived_at" timestamp with time zone,
	"seated_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dent_chair" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "dent_consent" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"patient_id" text NOT NULL,
	"kind" text NOT NULL,
	"text" text NOT NULL,
	"signed_name" text NOT NULL,
	"signature_file_id" text,
	"signed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text
);
--> statement-breakpoint
CREATE TABLE "dent_dentist" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"member_id" text,
	"name" text NOT NULL,
	"specialty" text,
	"color" text DEFAULT '#A8532E' NOT NULL,
	"share_percent" integer DEFAULT 0 NOT NULL,
	"share_basis" text DEFAULT 'collected' NOT NULL,
	"lab_deduct" boolean DEFAULT true NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dent_finding" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"patient_id" text NOT NULL,
	"tooth" integer NOT NULL,
	"surfaces" text,
	"kind" text NOT NULL,
	"status" text NOT NULL,
	"note" text,
	"plan_item_id" text,
	"visit_id" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"removed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "dent_image" (
	"file_id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"patient_id" text NOT NULL,
	"kind" text NOT NULL,
	"teeth" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"visit_id" text,
	"taken_at" timestamp with time zone DEFAULT now() NOT NULL,
	"note" text,
	"created_by" text
);
--> statement-breakpoint
CREATE TABLE "dent_installment" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"patient_id" text NOT NULL,
	"plan_id" text,
	"due_date" date NOT NULL,
	"amount" integer NOT NULL,
	"paid_at" timestamp with time zone,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "dent_lab_order" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"patient_id" text NOT NULL,
	"lab_id" text,
	"dentist_id" text,
	"work" text NOT NULL,
	"teeth" text,
	"shade" text,
	"material" text,
	"note" text,
	"status" text DEFAULT 'sent' NOT NULL,
	"cost" integer DEFAULT 0 NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"due_at" timestamp with time zone,
	"received_at" timestamp with time zone,
	"fitted_at" timestamp with time zone,
	"visit_item_id" text,
	"created_by" text
);
--> statement-breakpoint
CREATE TABLE "dent_patient" (
	"customer_id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"file_no" integer NOT NULL,
	"gender" text,
	"birth_date" date,
	"address" text,
	"occupation" text,
	"referral" text,
	"guardian" text,
	"medical" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"alerts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"recall_due" date,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dent_perio" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"patient_id" text NOT NULL,
	"dentist_id" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"data" jsonb NOT NULL,
	"note" text,
	"created_by" text
);
--> statement-breakpoint
CREATE TABLE "dent_plan" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"patient_id" text NOT NULL,
	"title" text NOT NULL,
	"kind" text DEFAULT 'general' NOT NULL,
	"status" text DEFAULT 'proposed' NOT NULL,
	"option_group" text,
	"discount" integer DEFAULT 0 NOT NULL,
	"note" text,
	"dentist_id" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "dent_plan_item" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"plan_id" text NOT NULL,
	"procedure_id" text,
	"name" text NOT NULL,
	"tooth" integer,
	"surfaces" text,
	"phase" integer DEFAULT 1 NOT NULL,
	"currency" text DEFAULT 'IQD' NOT NULL,
	"price" integer NOT NULL,
	"status" text DEFAULT 'planned' NOT NULL,
	"visit_id" text,
	"sort" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dent_procedure" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"code" text,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"currency" text DEFAULT 'IQD' NOT NULL,
	"price" integer DEFAULT 0 NOT NULL,
	"minutes" integer DEFAULT 30 NOT NULL,
	"scope" text DEFAULT 'tooth' NOT NULL,
	"mark" text,
	"lab_work" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dent_rx" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"patient_id" text NOT NULL,
	"visit_id" text,
	"dentist_id" text,
	"items" jsonb NOT NULL,
	"note" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dent_settings" (
	"organization_id" text PRIMARY KEY NOT NULL,
	"usd_rate" integer DEFAULT 1450 NOT NULL,
	"slot_minutes" integer DEFAULT 15 NOT NULL,
	"hours" jsonb,
	"recall_months" integer DEFAULT 6 NOT NULL,
	"rx_header" text,
	"reminder_text" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dent_visit" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"patient_id" text NOT NULL,
	"appointment_id" text,
	"dentist_id" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"complaint" text,
	"notes" text,
	"anesthesia" text,
	"amendments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sale_id" text,
	"created_by" text
);
--> statement-breakpoint
CREATE TABLE "dent_visit_item" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"visit_id" text NOT NULL,
	"procedure_id" text,
	"name" text NOT NULL,
	"tooth" integer,
	"surfaces" text,
	"currency" text DEFAULT 'IQD' NOT NULL,
	"price_original" integer NOT NULL,
	"usd_rate" integer,
	"amount" integer NOT NULL,
	"dentist_id" text,
	"plan_item_id" text,
	"lab_cost" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sys_supplier" ADD COLUMN "kind" text;--> statement-breakpoint
CREATE INDEX "dent_access_patient" ON "dent_access_log" USING btree ("patient_id","at");--> statement-breakpoint
CREATE INDEX "dent_appt_day" ON "dent_appointment" USING btree ("organization_id","starts_at");--> statement-breakpoint
CREATE INDEX "dent_appt_patient" ON "dent_appointment" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "dent_chair_org" ON "dent_chair" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "dent_consent_patient" ON "dent_consent" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "dent_dentist_org" ON "dent_dentist" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "dent_dentist_member" ON "dent_dentist" USING btree ("organization_id","member_id");--> statement-breakpoint
CREATE INDEX "dent_finding_patient" ON "dent_finding" USING btree ("patient_id","tooth");--> statement-breakpoint
CREATE INDEX "dent_image_patient" ON "dent_image" USING btree ("patient_id","taken_at");--> statement-breakpoint
CREATE INDEX "dent_inst_org" ON "dent_installment" USING btree ("organization_id","due_date");--> statement-breakpoint
CREATE INDEX "dent_lab_org" ON "dent_lab_order" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "dent_patient_org" ON "dent_patient" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "dent_patient_file" ON "dent_patient" USING btree ("organization_id","file_no");--> statement-breakpoint
CREATE INDEX "dent_perio_patient" ON "dent_perio" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "dent_plan_patient" ON "dent_plan" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "dent_plan_item_plan" ON "dent_plan_item" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "dent_procedure_org" ON "dent_procedure" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "dent_rx_patient" ON "dent_rx" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "dent_visit_patient" ON "dent_visit" USING btree ("patient_id","at");--> statement-breakpoint
CREATE INDEX "dent_visit_item_visit" ON "dent_visit_item" USING btree ("visit_id");--> statement-breakpoint
ALTER TABLE "hemlo_subscription" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "hemlo_subscription" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY hemlo_subscription_org ON "hemlo_subscription" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));
--> statement-breakpoint
ALTER TABLE "dent_settings" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "dent_settings" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY dent_settings_org ON "dent_settings" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));
--> statement-breakpoint
ALTER TABLE "dent_chair" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "dent_chair" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY dent_chair_org ON "dent_chair" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));
--> statement-breakpoint
ALTER TABLE "dent_dentist" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "dent_dentist" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY dent_dentist_org ON "dent_dentist" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));
--> statement-breakpoint
ALTER TABLE "dent_procedure" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "dent_procedure" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY dent_procedure_org ON "dent_procedure" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));
--> statement-breakpoint
ALTER TABLE "dent_patient" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "dent_patient" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY dent_patient_org ON "dent_patient" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));
--> statement-breakpoint
ALTER TABLE "dent_appointment" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "dent_appointment" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY dent_appointment_org ON "dent_appointment" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));
--> statement-breakpoint
ALTER TABLE "dent_finding" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "dent_finding" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY dent_finding_org ON "dent_finding" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));
--> statement-breakpoint
ALTER TABLE "dent_plan" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "dent_plan" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY dent_plan_org ON "dent_plan" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));
--> statement-breakpoint
ALTER TABLE "dent_plan_item" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "dent_plan_item" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY dent_plan_item_org ON "dent_plan_item" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));
--> statement-breakpoint
ALTER TABLE "dent_visit" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "dent_visit" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY dent_visit_org ON "dent_visit" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));
--> statement-breakpoint
ALTER TABLE "dent_visit_item" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "dent_visit_item" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY dent_visit_item_org ON "dent_visit_item" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));
--> statement-breakpoint
ALTER TABLE "dent_rx" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "dent_rx" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY dent_rx_org ON "dent_rx" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));
--> statement-breakpoint
ALTER TABLE "dent_lab_order" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "dent_lab_order" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY dent_lab_order_org ON "dent_lab_order" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));
--> statement-breakpoint
ALTER TABLE "dent_perio" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "dent_perio" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY dent_perio_org ON "dent_perio" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));
--> statement-breakpoint
ALTER TABLE "dent_installment" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "dent_installment" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY dent_installment_org ON "dent_installment" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));
--> statement-breakpoint
ALTER TABLE "dent_consent" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "dent_consent" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY dent_consent_org ON "dent_consent" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));
--> statement-breakpoint
ALTER TABLE "dent_image" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "dent_image" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY dent_image_org ON "dent_image" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));
--> statement-breakpoint
ALTER TABLE "dent_access_log" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "dent_access_log" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY dent_access_log_org ON "dent_access_log" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));
