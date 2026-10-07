CREATE TABLE "hemlo_staff" (
	"user_id" text PRIMARY KEY NOT NULL,
	"permissions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"title" text,
	"access_until" timestamp with time zone,
	"suspended_at" timestamp with time zone,
	"invited_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hemlo_staff_invite" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"title" text,
	"permissions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"access_until" timestamp with time zone,
	"token_hash" text NOT NULL,
	"invited_by" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"accepted_by" text,
	"canceled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "hemlo_staff_invite_token" ON "hemlo_staff_invite" USING btree ("token_hash");