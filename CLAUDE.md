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
   Security. `withPrivileged` alleen voor beheer over organisaties heen
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

## Demo-omgeving

Zonder `DATABASE_URL` draait Yuzu op PGlite in `.data/demo` met voorbeelddata
(`src/db/seed/demo.ts`), en is de ingelogde gebruiker altijd Frank (eigenaar).
Magento komt dan uit `src/integrations/magento/demo.ts`. De echte koppelingen
implementeren dezelfde interfaces; de schermen hoeven daarvoor niet te
veranderen.

De online demo draait op Supabase mét `DEMO_PASSWORD`: dan is de gebruiker ook
Frank (zie `usesDemoSession` in `src/db/connection.ts`), en laadt
`scripts/migrate.mts` bij elke deploy de migraties en eenmalig de voorbeelddata.
Zonder `DEMO_PASSWORD` geeft Yuzu met een database geen toegang, tot inloggen
gebouwd is.

## Bijlagen

Bestanden staan in Supabase Storage (privé-bucket `attachments`), nooit in de
database; sleutel `<organisatie-id>/<bijlage-id>`. Browsers uploaden
rechtstreeks met een ondertekend adres (Vercel laat maar 4,5 MB per verzoek
door) en downloaden via `/bijlagen/[id]`, dat RLS controleert en alleen
afbeeldingen en pdf's in de browser toont (`servingFor`). Wie bijlagen in de
database wist, wist ook de bestanden (zie `deleteAttachmentsOfTickets`).

## Structuur

- `src/app/(app)/inbox` — inbox en ticketscherm
- `src/app/(app)/beheer` — beheerpagina's (alleen eigenaar en beheerder)
- `src/server/` — data ophalen (`inbox.ts`, `admin.ts`, `reports.ts`),
  sessie en rechten (`session.ts`), server actions (`actions/`)
- `src/components/` — interface; ontwerptokens in `src/app/globals.css`
  (kleurstelling naar het voorbeeld van de Shopify-beheeromgeving).
  Yuzu-geel is alleen voor wat de AI klaarzet.

Next.js 16 met Cache Components: alles wat data of de URL leest, staat binnen
een `<Suspense>`. Gebruik geen `usePathname` buiten een Suspense-grens.

## Handige commando's

- `npm run dev` — lokaal draaien
- `npm test` — alle tests (geen database nodig)
- `npm run db:migrate` — migraties op `DATABASE_URL` toepassen
