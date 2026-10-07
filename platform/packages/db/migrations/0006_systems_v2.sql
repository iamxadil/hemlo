CREATE TABLE "sys_expense" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"category" text NOT NULL,
	"amount" integer NOT NULL,
	"note" text,
	"from_drawer" boolean DEFAULT false NOT NULL,
	"shift_id" text,
	"user_id" text
);
--> statement-breakpoint
CREATE TABLE "sys_purchase" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"number" integer NOT NULL,
	"supplier_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" text,
	"reference" text,
	"total" integer NOT NULL,
	"paid" integer DEFAULT 0 NOT NULL,
	"due" integer DEFAULT 0 NOT NULL,
	"from_drawer" boolean DEFAULT false NOT NULL,
	"shift_id" text,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "sys_purchase_line" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"purchase_id" text NOT NULL,
	"product_id" text NOT NULL,
	"name" text NOT NULL,
	"qty" numeric(12, 3) NOT NULL,
	"pack_size" integer,
	"base_qty" numeric(12, 3) NOT NULL,
	"cost" integer NOT NULL,
	"total" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sys_return" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"sale_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" text,
	"total" integer NOT NULL,
	"cost" integer DEFAULT 0 NOT NULL,
	"refund" text NOT NULL,
	"shift_id" text,
	"reason" text
);
--> statement-breakpoint
CREATE TABLE "sys_return_line" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"return_id" text NOT NULL,
	"sale_line_id" text NOT NULL,
	"product_id" text,
	"name" text NOT NULL,
	"qty" numeric(12, 3) NOT NULL,
	"base_qty" numeric(12, 3) NOT NULL,
	"price" integer NOT NULL,
	"total" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sys_shift" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"opened_by" text,
	"opening_cash" integer DEFAULT 0 NOT NULL,
	"closed_at" timestamp with time zone,
	"closed_by" text,
	"expected_cash" integer,
	"counted_cash" integer,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "sys_supplier" (
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
CREATE TABLE "sys_supplier_ledger" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"supplier_id" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"kind" text NOT NULL,
	"amount" integer NOT NULL,
	"balance" integer NOT NULL,
	"purchase_id" text,
	"from_drawer" boolean DEFAULT false NOT NULL,
	"shift_id" text,
	"note" text,
	"user_id" text
);
--> statement-breakpoint
ALTER TABLE "sys_ledger" ADD COLUMN "method" text;--> statement-breakpoint
ALTER TABLE "sys_ledger" ADD COLUMN "shift_id" text;--> statement-breakpoint
ALTER TABLE "sys_product" ADD COLUMN "pack_size" integer;--> statement-breakpoint
ALTER TABLE "sys_product" ADD COLUMN "pack_barcode" text;--> statement-breakpoint
ALTER TABLE "sys_product" ADD COLUMN "pack_price" integer;--> statement-breakpoint
ALTER TABLE "sys_sale" ADD COLUMN "shift_id" text;--> statement-breakpoint
ALTER TABLE "sys_sale" ADD COLUMN "returned" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "sys_sale_line" ADD COLUMN "pack_size" integer;--> statement-breakpoint
ALTER TABLE "sys_sale_line" ADD COLUMN "base_qty" numeric(12, 3);--> statement-breakpoint
ALTER TABLE "sys_sale_line" ADD COLUMN "returned_qty" numeric(12, 3) DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "sys_expense_org_time" ON "sys_expense" USING btree ("organization_id","at");--> statement-breakpoint
CREATE INDEX "sys_purchase_org_time" ON "sys_purchase" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sys_purchase_number" ON "sys_purchase" USING btree ("organization_id","number");--> statement-breakpoint
CREATE INDEX "sys_purchase_line_purchase" ON "sys_purchase_line" USING btree ("purchase_id");--> statement-breakpoint
CREATE INDEX "sys_return_org_time" ON "sys_return" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "sys_return_sale" ON "sys_return" USING btree ("sale_id");--> statement-breakpoint
CREATE INDEX "sys_return_line_return" ON "sys_return_line" USING btree ("return_id");--> statement-breakpoint
CREATE INDEX "sys_shift_org" ON "sys_shift" USING btree ("organization_id","opened_at");--> statement-breakpoint
CREATE INDEX "sys_supplier_org" ON "sys_supplier" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "sys_supplier_ledger_supplier" ON "sys_supplier_ledger" USING btree ("supplier_id","at");--> statement-breakpoint
CREATE UNIQUE INDEX "sys_product_pack_barcode" ON "sys_product" USING btree ("organization_id","pack_barcode");--> statement-breakpoint
ALTER TABLE "sys_return" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "sys_return" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY sys_return_org ON "sys_return" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));
--> statement-breakpoint
ALTER TABLE "sys_return_line" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "sys_return_line" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY sys_return_line_org ON "sys_return_line" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));
--> statement-breakpoint
ALTER TABLE "sys_shift" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "sys_shift" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY sys_shift_org ON "sys_shift" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));
--> statement-breakpoint
ALTER TABLE "sys_supplier" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "sys_supplier" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY sys_supplier_org ON "sys_supplier" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));
--> statement-breakpoint
ALTER TABLE "sys_purchase" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "sys_purchase" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY sys_purchase_org ON "sys_purchase" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));
--> statement-breakpoint
ALTER TABLE "sys_purchase_line" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "sys_purchase_line" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY sys_purchase_line_org ON "sys_purchase_line" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));
--> statement-breakpoint
ALTER TABLE "sys_supplier_ledger" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "sys_supplier_ledger" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY sys_supplier_ledger_org ON "sys_supplier_ledger" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));
--> statement-breakpoint
ALTER TABLE "sys_expense" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "sys_expense" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY sys_expense_org ON "sys_expense" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));
