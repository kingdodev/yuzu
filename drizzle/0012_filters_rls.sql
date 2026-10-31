-- Row Level Security voor mailfilters: alleen de eigen organisatie.
GRANT SELECT, INSERT, UPDATE, DELETE ON mail_filters TO yuzu_app;--> statement-breakpoint
ALTER TABLE mail_filters ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY tenant_isolation ON mail_filters TO yuzu_app
  USING (organization_id = app_current_org())
  WITH CHECK (organization_id = app_current_org());
