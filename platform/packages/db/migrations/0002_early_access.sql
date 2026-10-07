CREATE TABLE "early_access" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"phone_number" text NOT NULL,
	"email" text,
	"business" text NOT NULL,
	"kind" text NOT NULL,
	"city" text,
	"note" text,
	"locale" text DEFAULT 'ar' NOT NULL,
	"ip" text,
	"status" text DEFAULT 'new' NOT NULL
);
--> statement-breakpoint
CREATE INDEX "early_access_created" ON "early_access" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "early_access_phone" ON "early_access" USING btree ("phone_number");