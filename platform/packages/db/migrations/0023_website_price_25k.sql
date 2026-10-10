-- Hemlo Website's price rises to 25,000 IQD a month, or 250,000 a year (ten months, like the core plans).
-- Only the launch price moves: a price Hemlo already set by hand in admin stays. Active entitlements keep the price
-- they were sold at (hemlo_addon_entitlement.price).
UPDATE "hemlo_addon" SET "price_month" = 25000, "updated_at" = now() WHERE "code" = 'website' AND "price_month" = 15000;
--> statement-breakpoint
UPDATE "hemlo_addon" SET "price_year" = 250000, "updated_at" = now() WHERE "code" = 'website' AND "price_year" = 150000;
