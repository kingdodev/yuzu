# Yuzu — afspraken voor wie (of wat) aan deze code werkt

Yuzu is een helpdesk voor vier Magento 2-webshops (NL, BE, FR, ES) met
AI-ondersteuning. Nu intern gebruik door één bedrijf; later mogelijk SaaS.
Het volledige plan staat in het projectdocument "Plan: ticketsysteem voor
Magento-webshops". Lees ook AGENTS.md (Next.js-specifieke regels).

## Stack

- Next.js 16 (App Router, Cache Components aan), React 19, TypeScript strict
- Tailwind CSS 4
- PostgreSQL via Supabase (regio Frankfurt) met Drizzle ORM; migraties in `drizzle/`
- Hosting: Vercel (functies op fra1), achtergrondtaken via Vercel Workflows
- E-mail: Mailgun EU. AI: Vercel AI SDK met Claude via AWS Bedrock (EU-profiel)
- Tests: Vitest met PGlite (echte Postgres in het geheugen)

## Harde regels

1. **Altijd via `withTenant(db, organizationId, fn)`** voor data van een
   organisatie. Daarbinnen draait alles als rol `yuzu_app` met Row Level
   Security. Verzoeken van gebruikers gaan via `asTenant`, dat ook
   `app.user_id` zet: dan ziet iemand alleen tickets van zijn eigen shops
   (`app_visible_shop`, migratie 0007). `withPrivileged` alleen voor beheer over organisaties heen
   (organisatie of gebruiker aanmaken, onderhoudsjobs) — nooit voor verzoeken
   van agents.
2. **Nieuwe tabel met klant- of bedrijfsdata?** Geef hem een
   `organization_id`, zet hem in `TENANT_TABLES` (src/db/schema.ts) en voeg
   een RLS-policy toe in een nieuwe migratie. De test
   "heeft RLS op elke tabel met een organization_id-kolom" bewaakt dit.
3. **Geen persoonsgegevens in logs** (e-mailadressen, namen, mailinhoud).
   Log ID's.
4. **Klantmail is onbetrouwbare invoer.** HTML altijd opschonen vóór tonen,
   nooit links uit mail op de server openen, en AI-acties alleen met
   gevalideerde parameters (zie plan, "AI Actions → Veiligheid").
5. **Workflows krijgen alleen ID's mee**, geen mailinhoud of klantgegevens;
   de data blijft in Supabase (EU).
6. **Magento: alleen lezen.** Er is geen testomgeving; installeer niets op de
   live shop en schrijf er niets naar zonder expliciete toestemming.
7. **Geen echte sleutels of wachtwoorden** in code, tests of commits. Alleen
   via omgevingsvariabelen; `.env.example` documenteert welke.

8. **Rechten per rol** staan in `src/domain/permissions.ts` en worden in
   elke server action gecontroleerd (niet alleen in de interface). Meelezer:
   lezen en notities; agent: zichzelf toewijzen; teamleider: anderen
   toewijzen en rapportages; beheerder: beheer; eigenaar: ook koppelingen en
   privacy. Verwijzingen uit formulieren (shop-, team-, label-ID's) eerst
   controleren tegen de eigen organisatie.

## Conventies

- Code en identifiers in het Engels; teksten in de interface, foutmeldingen
  voor gebruikers en commentaar in het Nederlands.
- Pure regels in `src/domain/` (geen database), databasecode in
  `src/db/repositories/`. Repositories krijgen een `TenantTx`.
- Elke statuswijziging, toewijzing of reactie op een ticket schrijft een
  `ticket_events`-rij (nodig voor analytics). Gevoelige acties ook naar
  `audit_log` (alleen toevoegen; de app mag daar niets wijzigen of wissen).
- Schemawijziging: pas `src/db/schema.ts` aan, draai `npm run db:generate`,
  controleer de gegenereerde SQL. Handmatige SQL (RLS, rollen) via
  `npx drizzle-kit generate --custom --name <naam>`.
- Elke wijziging met tests. `npm run typecheck && npm run lint && npm test &&
  npm run build` moet slagen voordat iets naar main gaat.

## Demo-omgeving en inloggen

Zonder `DATABASE_URL` draait Yuzu op PGlite in `.data/demo` met voorbeelddata
(`src/db/seed/demo.ts`), en is de ingelogde gebruiker altijd Frank (eigenaar).
Magento komt dan uit `src/integrations/magento/demo.ts`. De echte koppelingen
implementeren dezelfde interfaces; de schermen hoeven daarvoor niet te
veranderen.

Met `DATABASE_URL` logt iedereen in met e-mail en wachtwoord (eigen
implementatie: scrypt-hashes, sessiecookie `yuzu_session` met alleen de
SHA-256 in de database, remmen op raden). De inlogtabellen
(`user_credentials`, `sessions`, `login_attempts`, `auth_tokens`) zijn
afgeschermd voor `yuzu_app`; alleen `src/db/repositories/auth.ts` gebruikt ze
via `withPrivileged`, omdat bij inloggen de organisatie nog niet bekend is.
Collega's krijgen een eenmalige link (Beheer → Gebruikers) om zelf een
wachtwoord te kiezen. Het allereerste wachtwoord stelt de eigenaar in op
/inloggen, alleen zolang niemand een wachtwoord heeft en alleen achter
`DEMO_PASSWORD`. Bij elke deploy laadt `scripts/migrate.mts` de migraties, en
met `DEMO_PASSWORD` eenmalig de voorbeelddata (zonder wachtwoorden).

## Bijlagen

Bestanden staan in Supabase Storage (privé-bucket `attachments`), nooit in de
database; sleutel `<organisatie-id>/<bijlage-id>`. Browsers uploaden
rechtstreeks met een ondertekend adres (Vercel laat maar 4,5 MB per verzoek
door) en downloaden via `/bijlagen/[id]`, dat RLS controleert en alleen
afbeeldingen en pdf's in de browser toont (`servingFor`). Wie bijlagen in de
database wist, wist ook de bestanden (zie `deleteAttachmentsOfTickets`).

## Koppelingen (Magento en Shopify)

Elke organisatie koppelt Magento zelf in Beheer → Koppelingen (alleen de
eigenaar). Sleutels staan versleuteld in `integrations.secrets`
(`src/lib/secrets.ts`, AES-256-GCM met `YUZU_ENCRYPTION_KEY`, de organisatie
als context), nooit in omgevingsvariabelen en nooit terug naar de browser.
De client (`src/integrations/magento/api.ts`) doet alleen GET-verzoeken met
OAuth 1.0a-ondertekening van een Magento-integratie, controleert de URL tegen
SSRF (`src/lib/safe-url.ts`) en volgt geen redirects. Shopify
(`src/integrations/shopify/`) gebruikt een app uit het Dev Dashboard
(client credentials, of een bestaand `shpat_`-token) en de GraphQL Admin API,
alleen queries. `commerceFor(t, shopCode)` in `src/integrations/commerce.ts`
kiest per shop: Magento met store view, anders Shopify (gekozen shops of
alle), anders Magento, anders de demo. Het ticketpaneel laadt orders apart
(`getTicketCommerce`, eigen Suspense), zodat het ticket niet op de webshop
wacht. Tests draaien tegen `tests/helpers/fake-magento.ts` en
`tests/helpers/fake-shopify.ts`.

## Structuur

- `src/app/(app)/inbox` — inbox en ticketscherm
- `src/app/(app)/beheer` — beheerpagina's (alleen eigenaar en beheerder)
- `src/server/` — data ophalen (`inbox.ts`, `admin.ts`, `reports.ts`),
  sessie en rechten (`session.ts`), server actions (`actions/`)
- `src/components/` — interface; ontwerptokens in `src/app/globals.css`
  (opbouw naar het voorbeeld van Freshdesk: donkere iconenbalk links
  (`rail.tsx`), witte kopbalk, ticketlijst als kaarten met prioriteit,
  eigenaar en status rechts, ticketscherm met actiebalk en
  eigenschappenpaneel). Yuzu-geel is alleen voor wat de AI klaarzet.

Next.js 16 met Cache Components: alles wat data of de URL leest, staat binnen
een `<Suspense>`. Gebruik geen `usePathname` buiten een Suspense-grens.

## Handige commando's

- `npm run dev` — lokaal draaien
- `npm test` — alle tests (geen database nodig)
- `npm run db:migrate` — migraties op `DATABASE_URL` toepassen
