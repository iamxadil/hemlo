-- Row-level security: the second lock. Business rows are only visible when the transaction has set
-- app.org_id to that business (withOrg), or app.system = 'on' (withSystem: auth internals only).
-- FORCE applies the rules to the table owner too (the app connects as the owner on Neon).
CREATE OR REPLACE FUNCTION hemlo_org_visible(org text) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT coalesce(current_setting('app.system', true), 'off') = 'on'
      OR (org IS NOT NULL AND org = nullif(current_setting('app.org_id', true), ''))
$$;
--> statement-breakpoint
ALTER TABLE "auth_event" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "auth_event" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY auth_event_org ON "auth_event" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));
--> statement-breakpoint
ALTER TABLE "staff_invite" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "staff_invite" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY staff_invite_org ON "staff_invite" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));
--> statement-breakpoint
ALTER TABLE "counter_device" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "counter_device" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY counter_device_org ON "counter_device" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));
--> statement-breakpoint
ALTER TABLE "counter_pin" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "counter_pin" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY counter_pin_org ON "counter_pin" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));
--> statement-breakpoint
ALTER TABLE "counter_lock" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "counter_lock" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY counter_lock_org ON "counter_lock" USING (hemlo_org_visible(organization_id)) WITH CHECK (hemlo_org_visible(organization_id));
