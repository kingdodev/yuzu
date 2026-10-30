-- Toegang per shop. Bovenop de scheiding tussen organisaties (0001) mag een
-- gebruiker alleen tickets zien van shops waar die toegang toe heeft:
-- eigenaars en beheerders alles, anderen alle shops (all_shops) of alleen de
-- shops in member_shops.
--
-- withTenant zet `app.user_id` als het namens een ingelogde gebruiker werkt.
-- Zonder gebruiker (systeemwerk: inkomende mail, onderhoudsjobs, demodata)
-- geldt alleen de organisatiegrens.

CREATE OR REPLACE FUNCTION app_current_user() RETURNS uuid
  LANGUAGE sql STABLE
  AS $$ SELECT nullif(current_setting('app.user_id', true), '')::uuid $$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION app_visible_shop(shop uuid) RETURNS boolean
  LANGUAGE sql STABLE
  AS $$
    SELECT app_current_user() IS NULL
      OR EXISTS (
        SELECT 1 FROM memberships m
        WHERE m.organization_id = app_current_org()
          AND m.user_id = app_current_user()
          AND m.active
          AND (m.role IN ('owner', 'admin') OR m.all_shops)
      )
      OR EXISTS (
        SELECT 1 FROM member_shops ms
        JOIN memberships m
          ON m.organization_id = ms.organization_id AND m.user_id = ms.user_id
        WHERE ms.organization_id = app_current_org()
          AND ms.user_id = app_current_user()
          AND ms.shop_id = shop
          AND m.active
      )
  $$;
--> statement-breakpoint

-- RESTRICTIVE: komt bovenop tenant_isolation (beide moeten kloppen).
CREATE POLICY shop_access ON tickets AS RESTRICTIVE TO yuzu_app
  USING (app_visible_shop(shop_id))
  WITH CHECK (app_visible_shop(shop_id));
--> statement-breakpoint

-- Alles wat bij een ticket hoort, volgt de zichtbaarheid van dat ticket.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['messages', 'ticket_tags', 'ticket_orders', 'ticket_events', 'ai_drafts']
  LOOP
    EXECUTE format(
      'CREATE POLICY shop_access ON %I AS RESTRICTIVE TO yuzu_app '
      'USING (EXISTS (SELECT 1 FROM tickets t WHERE t.id = %I.ticket_id))',
      t, t
    );
  END LOOP;
END
$$;
--> statement-breakpoint

-- Bijlagen: via het bericht. Nog niet verstuurde bijlagen (zonder bericht)
-- zijn alleen te zien voor wie ze uploadde.
CREATE POLICY shop_access ON attachments AS RESTRICTIVE TO yuzu_app
  USING (
    (message_id IS NULL AND (app_current_user() IS NULL OR uploaded_by_id = app_current_user()))
    OR EXISTS (SELECT 1 FROM messages m WHERE m.id = attachments.message_id)
  );
