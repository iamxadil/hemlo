CREATE TABLE "sys_customer" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"note" text,
	"balance" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sys_ledger" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"customer_id" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"kind" text NOT NULL,
	"amount" integer NOT NULL,
	"balance" integer NOT NULL,
	"sale_id" text,
	"note" text,
	"user_id" text
);
--> statement-breakpoint
CREATE TABLE "sys_product" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"barcode" text,
	"category" text,
	"unit" text DEFAULT 'piece' NOT NULL,
	"price" integer NOT NULL,
	"cost" integer,
	"stock" numeric(12, 3) DEFAULT 0 NOT NULL,
	"low_stock" numeric(12, 3),
	"track_stock" boolean DEFAULT true NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sys_sale" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"number" integer NOT NULL,
	"client_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" text,
	"device_id" text,
	"customer_id" text,
	"subtotal" integer NOT NULL,
	"discount" integer DEFAULT 0 NOT NULL,
	"total" integer NOT NULL,
	"paid" integer NOT NULL,
	"due" integer DEFAULT 0 NOT NULL,
	"method" text NOT NULL,
	"cost" integer DEFAULT 0 NOT NULL,
	"note" text,
	"voided_at" timestamp with time zone,
	"voided_by" text
);
--> statement-breakpoint
CREATE TABLE "sys_sale_line" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"sale_id" text NOT NULL,
	"product_id" text,
	"name" text NOT NULL,
	"qty" numeric(12, 3) NOT NULL,
	"price" integer NOT NULL,
	"cost" integer DEFAULT 0 NOT NULL,
	"total" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sys_sequence" (
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"value" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "sys_sequence_organization_id_name_pk" PRIMARY KEY("organization_id","name")
);
--> statement-breakpoint
CREATE TABLE "sys_stock_move" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"product_id" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"kind" text NOT NULL,
	"qty" numeric(12, 3) NOT NULL,
	"stock" numeric(12, 3) NOT NULL,
	"cost" integer,
	"sale_id" text,
	"note" text,
	"user_id" text
);
--> statement-breakpoint
CREATE INDEX "sys_customer_org" ON "sys_customer" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "sys_ledger_customer" ON "sys_ledger" USING btree ("customer_id","at");--> statement-breakpoint
CREATE INDEX "sys_product_org" ON "sys_product" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sys_product_barcode" ON "sys_product" USING btree ("organization_id","barcode");--> statement-breakpoint
CREATE INDEX "sys_sale_org_time" ON "sys_sale" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sys_sale_number" ON "sys_sale" USING btree ("organization_id","number");--> statement-breakpoint
CREATE UNIQUE INDEX "sys_sale_client" ON "sys_sale" USING btree ("organization_id","client_id");--> statement-breakpoint
CREATE INDEX "sys_sale_line_sale" ON "sys_sale_line" USING btree ("sale_id");--> statement-breakpoint
CREATE INDEX "sys_sale_line_product" ON "sys_sale_line" USING btree ("organization_id","product_id");--> statement-breakpoint
CREATE INDEX "sys_stock_move_product" ON "sys_stock_move" USING btree ("product_id","at");--> statement-breakpoint
ALTER TABLE "sys_product" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "sys_product" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY sys_product_org ON "sys_product" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));
--> statement-breakpoint
ALTER TABLE "sys_customer" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "sys_customer" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY sys_customer_org ON "sys_customer" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));
--> statement-breakpoint
ALTER TABLE "sys_sale" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "sys_sale" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY sys_sale_org ON "sys_sale" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));
--> statement-breakpoint
ALTER TABLE "sys_sale_line" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "sys_sale_line" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY sys_sale_line_org ON "sys_sale_line" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));
--> statement-breakpoint
ALTER TABLE "sys_ledger" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "sys_ledger" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY sys_ledger_org ON "sys_ledger" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));
--> statement-breakpoint
ALTER TABLE "sys_stock_move" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "sys_stock_move" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY sys_stock_move_org ON "sys_stock_move" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));
--> statement-breakpoint
ALTER TABLE "sys_sequence" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "sys_sequence" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY sys_sequence_org ON "sys_sequence" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));
