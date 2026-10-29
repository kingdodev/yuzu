-- Row Level Security: elke organisatie ziet alleen haar eigen data.
--
-- De app voert tenant-gebonden queries uit als rol `yuzu_app` (zonder
-- BYPASSRLS), binnen een transactie waarin `app.organization_id` is gezet.
-- Zie src/db/tenant.ts. Vergeet je de organisatie te zetten, dan zie je niets.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'yuzu_app') THEN
    CREATE ROLE yuzu_app NOLOGIN NOBYPASSRLS;
  END IF;
END
$$;
--> statement-breakpoint
GRANT yuzu_app TO CURRENT_USER;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO yuzu_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO yuzu_app;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO yuzu_app;
--> statement-breakpoint

-- Gebruikers en organisaties worden alleen via beheerpaden aangemaakt.
REVOKE INSERT, UPDATE, DELETE ON users FROM yuzu_app;
--> statement-breakpoint
REVOKE INSERT, DELETE ON organizations FROM yuzu_app;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION app_current_org() RETURNS uuid
  LANGUAGE sql STABLE
  AS $$ SELECT nullif(current_setting('app.organization_id', true), '')::uuid $$;
--> statement-breakpoint

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY own_organization ON organizations TO yuzu_app
  USING (id = app_current_org())
  WITH CHECK (id = app_current_org());
--> statement-breakpoint

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'shops', 'memberships', 'member_shops', 'teams', 'team_members',
    'contacts', 'contact_magento_links', 'tickets', 'messages', 'attachments',
    'tags', 'ticket_tags', 'ticket_orders', 'ticket_events', 'audit_log'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I TO yuzu_app '
      'USING (organization_id = app_current_org()) '
      'WITH CHECK (organization_id = app_current_org())',
      t
    );
  END LOOP;
END
$$;
--> statement-breakpoint

-- Het auditlog is alleen-toevoegen: ook de app zelf mag niets wijzigen of wissen.
REVOKE UPDATE, DELETE ON audit_log FROM yuzu_app;
