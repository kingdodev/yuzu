# Yuzu

Klantenservice voor onze vier webshops (NL, BE, FR, ES) in één inbox, met een
AI-assistent die eenvoudige vragen voorbereidt of beantwoordt.

## Stand van zaken

Gebouwd:

- Projectbasis (Next.js, TypeScript, Tailwind)
- Datamodel: organisaties, shops, gebruikers en rollen, teams, klanten,
  tickets, berichten, bijlagen, tags, gekoppelde orders, ticketgeschiedenis en
  auditlog
- Afscherming per organisatie in de database zelf (Row Level Security), zodat
  Yuzu later veilig meerdere bedrijven kan bedienen
- Ticketregels: nummering, statussen, heropenen bij een reactie van de klant
- Herkennen van e-mailadressen en ordernummers in mailtekst
- Automatische tests voor al het bovenstaande

Volgende stappen: inloggen met Google, e-mail ontvangen en versturen via
Mailgun, de inbox, en de koppeling met Magento.

## Wat jij moet doen (Frank)

Nog niets voor deze stap. Als de eerste testversie online moet, maak je een
Supabase- en Vercel-account aan; de exacte stappen volgen dan.

## Voor ontwikkelaars

Vereist Node.js 22 of nieuwer.

```bash
npm install
npm test          # alle tests, geen database nodig
npm run dev       # lokaal draaien op http://localhost:3000
```

Afspraken voor de code staan in [CLAUDE.md](CLAUDE.md).
