-- Inloggegevens zijn niet voor de app-rol. Nieuwe tabellen krijgen via de
-- standaardrechten uit 0001 automatisch toegang voor yuzu_app; die halen we
-- hier weer weg. Alleen het inlogpad (withPrivileged) mag erbij.
REVOKE ALL ON user_credentials, sessions, login_attempts, auth_tokens FROM yuzu_app;
--> statement-breakpoint

-- Extra slot: RLS aan zonder policies, dus ook bij een per ongeluk
-- teruggegeven recht ziet yuzu_app niets.
ALTER TABLE user_credentials ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE auth_tokens ENABLE ROW LEVEL SECURITY;

-- users mocht yuzu_app al niet wijzigen (0001), dus ook password_set_at en
-- last_login_at niet.
