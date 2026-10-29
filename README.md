# Yuzu

Klantenservice voor onze vier webshops (NL, BE, FR, ES) in één inbox, met een
AI-assistent die eenvoudige vragen voorbereidt of beantwoordt.

## Stand van zaken

**Werkt (met voorbeelddata):**

- Inbox met weergaven: te doen, mijn tickets, niet toegewezen, wacht op
  antwoord, opgelost, en per shop
- Ticketscherm: gesprek met automatische vertaling van Franse en Spaanse
  mails, concept-antwoord van Yuzu in de taal van de klant met Nederlandse
  vertaling ernaast, antwoorden, interne notities, sjablonen, status,
  eigenaar, prioriteit en labels
- Klant- en orderpaneel naast elk ticket: orders, artikelen, verzending met
  trackinglink, betaling, terugbetalingen
- Rapportages: drukte per shop, soorten vragen, reactietijd, gebruik van
  AI-concepten
- Beheer: shops, gebruikers en rollen, teams, labels, sjablonen, kennisbank
  (pagina's, documenten, werkinstructies), AI-instellingen per soort vraag,
  koppelingen, privacy (inzage, verwijderen, bewaartermijnen) en auditlog
- Afscherming per organisatie in de database (klaar voor SaaS), auditlog dat
  niemand kan wijzigen

**Nog nagebootst:** e-mail (Mailgun), Magento-orders, AI-concepten, crawler
en het verwerken van documenten. Verstuurde antwoorden worden opgeslagen maar
nog niet echt gemaild.

**Nog niet gebouwd:** inloggen met Google, en de echte koppelingen hierboven.

## Bekijken

Zonder `DATABASE_URL` start Yuzu met een lokale demodatabase en voorbeelddata
(vier shops, tickets in drie talen). Niets wordt naar buiten gestuurd.

```bash
npm install
npm run dev       # http://localhost:3000
```

De demodatabase staat in `.data/`. Verwijder die map om opnieuw met verse
voorbeelddata te beginnen.

## Voor ontwikkelaars

Vereist Node.js 22 of nieuwer.

```bash
npm test          # alle tests, geen database nodig
npm run typecheck
npm run lint
npm run build
```

Afspraken voor de code staan in [CLAUDE.md](CLAUDE.md).
