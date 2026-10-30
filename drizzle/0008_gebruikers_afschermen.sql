-- Gebruikers zijn organisatie-overstijgend en hebben geen organization_id.
-- De app-rol mag alleen gebruikers zien die lid zijn van de huidige
-- organisatie (namen bij berichten, collega's om aan toe te wijzen).
-- Het inlogpad gebruikt withPrivileged en valt hier niet onder.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY same_organization ON users FOR SELECT TO yuzu_app
  USING (EXISTS (
    SELECT 1 FROM memberships m
    WHERE m.user_id = users.id AND m.organization_id = app_current_org()
  ));
--> statement-breakpoint

-- Supabase geeft de rollen anon en authenticated (Data API, met de openbare
-- sleutel) standaard rechten op tabellen in public. Yuzu gebruikt de Data API
-- niet; die rechten halen we weg, ook voor tabellen die later komen.
DO $$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', r);
      EXECUTE format('REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM %I', r);
    END IF;
  END LOOP;
END
$$;
