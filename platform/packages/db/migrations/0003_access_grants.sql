ALTER TABLE "user" ADD COLUMN "early_access" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "early_access" ADD COLUMN "admin_note" text;--> statement-breakpoint
ALTER TABLE "early_access" ADD COLUMN "approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "early_access" ADD COLUMN "approved_by" text;--> statement-breakpoint
ALTER TABLE "early_access" ADD COLUMN "token_hash" text;--> statement-breakpoint
ALTER TABLE "early_access" ADD COLUMN "token_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "early_access" ADD COLUMN "claimed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "early_access" ADD COLUMN "claimed_by" text;--> statement-breakpoint
ALTER TABLE "early_access" ADD COLUMN "organization_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "early_access_token" ON "early_access" USING btree ("token_hash");