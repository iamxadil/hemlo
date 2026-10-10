-- Hemlo Website's launch price: 15,000 IQD a month, or 150,000 a year (ten months, like the core plans).
-- Only fills a price nobody set yet, so a price Hemlo already chose in admin stays.
UPDATE "hemlo_addon" SET "price_month" = 15000, "updated_at" = now() WHERE "code" = 'website' AND "price_month" IS NULL;
--> statement-breakpoint
UPDATE "hemlo_addon" SET "price_year" = 150000, "updated_at" = now() WHERE "code" = 'website' AND "price_year" IS NULL;
