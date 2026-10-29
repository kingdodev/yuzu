-- Row Level Security voor de tabellen uit 0002 (sjablonen, kennisbank, AI, koppelingen).
-- Rechten voor yuzu_app komen automatisch mee via ALTER DEFAULT PRIVILEGES uit 0001.

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'templates', 'knowledge_sources', 'ai_intent_settings', 'ai_drafts', 'integrations'
  ]
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO yuzu_app', t);
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
