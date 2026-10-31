/**
 * Extra voorbeeldtickets, bovenop de eerste set in demo.ts. Ook toe te voegen
 * aan een demo-organisatie die al bestaat (zie `seedMoreDemoTickets`): per
 * ticket alleen als het e-mailadres van de klant nog niet bestaat.
 * Alleen verzonnen klanten met example-adressen.
 */
import type { DemoTicket } from "./demo";

const H = 60;
const D = 24 * H;

export const MORE_TICKETS: DemoTicket[] = [
  // --- Nederland -----------------------------------------------------------
  {
    shop: "nl",
    contact: { email: "eva.smit@example.nl", name: "Eva Smit", language: "nl" },
    subject: "Kortingscode werkt niet",
    intent: "other",
    status: "new",
    thread: [
      {
        dir: "inbound",
        by: "contact",
        minutesAgo: 6,
        text: "Hallo,\n\nIk probeer de code NAJAAR15 uit jullie nieuwsbrief te gebruiken, maar bij het afrekenen staat er 'code ongeldig'. Hij is toch nog geldig tot zondag?\n\nGroet,\nEva",
      },
    ],
    draft: {
      confidence: 88,
      sources: [{ title: "Veelgestelde vragen", path: "/veelgestelde-vragen" }],
      body: "Hoi Eva,\n\nVervelend dat de code niet werkt. NAJAAR15 geldt vanaf een bestelbedrag van € 50 en niet op artikelen die al in de sale zijn. Zit je daar misschien net onder, of staat er een sale-artikel in je winkelwagen?\n\nLukt het daarna nog steeds niet, laat het me weten; dan zet ik de korting met de hand op je bestelling.\n\nHartelijke groet,\nFrank\nKlantenservice",
    },
  },
  {
    shop: "nl",
    contact: { email: "daan.mulder@example.nl", name: "Daan Mulder", language: "nl" },
    subject: "Is het linnen dekbedovertrek ook in 260×220?",
    intent: "product_question",
    status: "new",
    thread: [
      {
        dir: "inbound",
        by: "contact",
        minutesAgo: 41,
        text: "Goedemiddag,\n\nIk zie het linnen dekbedovertrek alleen in 240×220. Komt er ook een lits-jumeaux van 260×220? En krimpt linnen in de was?\n\nMet vriendelijke groet,\nDaan Mulder",
      },
    ],
    draft: {
      confidence: 91,
      sources: [{ title: "Linnen dekbedovertrek", path: "/linnen-dekbedovertrek" }],
      body: "Hoi Daan,\n\nHet linnen dekbedovertrek komt over ongeveer drie weken ook in 260×220. Op de productpagina kun je je aanmelden voor een mail zodra hij binnen is.\n\nOver krimpen: het linnen is voorgewassen, dus het krimpt nauwelijks. Was het op 40 graden en droog het liefst aan de lijn.\n\nHartelijke groet,\nFrank\nKlantenservice",
    },
  },
  {
    shop: "nl",
    contact: {
      email: "fatima.elamrani@example.nl",
      name: "Fatima El Amrani",
      language: "nl",
    },
    subject: "Dubbel afgeschreven",
    intent: "complaint",
    status: "open",
    priority: "urgent",
    assigned: true,
    orders: ["000012931"],
    tags: ["Spoed"],
    thread: [
      {
        dir: "inbound",
        by: "contact",
        minutesAgo: 2 * H,
        text: "Hallo,\n\nIk heb gisteren één keer besteld (000012931), maar het bedrag van € 89,90 is twee keer van mijn rekening gegaan. Dit wil ik graag zo snel mogelijk terug.\n\nFatima",
      },
      {
        dir: "note",
        by: "user",
        minutesAgo: 95,
        text: "In Mollie staan twee betalingen; de tweede is na een time-out opnieuw gestart. Terugbetaling van de tweede aangevraagd, wacht op bevestiging.",
      },
    ],
  },
  {
    shop: "nl",
    contact: { email: "jeroen.bakker@example.nl", name: "Jeroen Bakker", language: "nl" },
    subject: "Offerte voor 40 badjassen (hotel)",
    intent: "other",
    status: "pending_customer",
    priority: "high",
    assigned: true,
    tags: ["Zakelijk"],
    thread: [
      {
        dir: "inbound",
        by: "contact",
        minutesAgo: 2 * D,
        text: "Beste,\n\nVoor ons boutiquehotel in Utrecht zoeken we 40 wafelbadjassen, liefst met geborduurd logo. Kunnen jullie een offerte maken en wat is de levertijd?\n\nMet vriendelijke groet,\nJeroen Bakker\nHotel De Gracht",
      },
      {
        dir: "outbound",
        by: "user",
        minutesAgo: 2 * D - 3 * H,
        text: "Beste Jeroen,\n\nLeuk dat u aan ons denkt. Bij 40 stuks geven we 20% korting; borduren kost € 4,50 per badjas plus eenmalig € 35 voor het logo. Levertijd is ongeveer drie weken.\n\nKunt u de verdeling over de maten en uw logo (als vectorbestand) sturen? Dan maak ik de offerte definitief.\n\nHartelijke groet,\nFrank\nKlantenservice",
      },
    ],
  },
  {
    shop: "nl",
    contact: { email: "lisa.dekker@example.nl", name: "Lisa Dekker", language: "nl" },
    subject: "Adres aanpassen voor verzending",
    intent: "address_change",
    status: "solved",
    orders: ["000012905"],
    thread: [
      {
        dir: "inbound",
        by: "contact",
        minutesAgo: 3 * D,
        text: "Hoi,\n\nIk zie dat ik mijn oude adres heb gebruikt bij bestelling 000012905. Kan het naar Zonnebloemstraat 12, 3512 AB Utrecht?\n\nDank je!\nLisa",
      },
      {
        dir: "outbound",
        by: "user",
        minutesAgo: 3 * D - 40,
        text: "Hoi Lisa,\n\nGelukt: je bestelling gaat naar Zonnebloemstraat 12 in Utrecht. Hij was nog niet ingepakt, dus er verandert verder niets.\n\nHartelijke groet,\nFrank\nKlantenservice",
      },
      {
        dir: "inbound",
        by: "contact",
        minutesAgo: 3 * D - 55,
        text: "Top, bedankt!",
      },
    ],
  },
  {
    shop: "nl",
    contact: { email: "tom.visser@example.nl", name: "Tom Visser", language: "nl" },
    subject: "Pakket staat al drie dagen bij het sorteercentrum",
    intent: "where_is_my_order",
    status: "pending_third_party",
    assigned: true,
    orders: ["000012888"],
    tags: ["Vervoerder"],
    thread: [
      {
        dir: "inbound",
        by: "contact",
        minutesAgo: 4 * D,
        text: "Hallo,\n\nVolgens de track & trace ligt mijn pakket sinds maandag in het sorteercentrum in Nieuwegein. Er gebeurt niets meer. Kunnen jullie navragen wat er aan de hand is?\n\nTom",
      },
      {
        dir: "outbound",
        by: "user",
        minutesAgo: 4 * D - 2 * H,
        text: "Hoi Tom,\n\nIk heb een onderzoek gestart bij PostNL. Ze reageren meestal binnen twee werkdagen; ik laat het je weten zodra ik iets hoor. Is het pakket zoek, dan sturen we een nieuwe.\n\nHartelijke groet,\nFrank\nKlantenservice",
      },
      {
        dir: "note",
        by: "user",
        minutesAgo: 4 * D - 2 * H - 5,
        text: "PostNL-onderzoek aangevraagd, referentie PNL-77812.",
      },
    ],
  },

  // --- België --------------------------------------------------------------
  {
    shop: "be",
    contact: { email: "wout.peeters@example.be", name: "Wout Peeters", language: "nl" },
    subject: "Levertijd kussenslopen",
    intent: "delivery_time",
    status: "new",
    thread: [
      {
        dir: "inbound",
        by: "contact",
        minutesAgo: 12,
        text: "Goeiemiddag,\n\nBij de katoenen kussenslopen staat 'binnenkort weer op voorraad'. Weet u wanneer ongeveer? Ik heb ze nodig voor eind november.\n\nMet vriendelijke groeten,\nWout Peeters",
      },
    ],
    draft: {
      confidence: 86,
      sources: [{ title: "Verzenden en levertijden", path: "/verzenden" }],
      body: "Beste Wout,\n\nDe katoenen kussenslopen verwachten we volgende week weer binnen. Bestelt u ze daarna, dan zijn ze binnen 2 tot 3 werkdagen bij u, ruim op tijd voor eind november.\n\nMet vriendelijke groeten,\nFrank\nKlantenservice",
    },
  },
  {
    shop: "be",
    contact: { email: "els.maes@example.be", name: "Els Maes", language: "nl" },
    subject: "Verkeerde kleur ontvangen",
    intent: "return",
    status: "open",
    priority: "high",
    orders: ["000012915"],
    tags: ["Retour"],
    thread: [
      {
        dir: "inbound",
        by: "contact",
        minutesAgo: 5 * H,
        text: "Hallo,\n\nIk bestelde een plaid in oker, maar kreeg er een in grijs. Op de verpakking staat wel oker. Kan ik hem omruilen zonder extra kosten?\n\nEls",
      },
    ],
    draft: {
      confidence: 84,
      sources: [{ title: "Retourneren", path: "/retourneren" }],
      body: "Beste Els,\n\nExcuses, daar is bij het inpakken iets misgegaan. U krijgt van ons een gratis retourlabel per mail; zodra u het pakket heeft afgegeven, sturen we de okerkleurige plaid meteen op. U hoeft niets bij te betalen.\n\nMet vriendelijke groeten,\nFrank\nKlantenservice",
    },
  },
  {
    shop: "be",
    contact: { email: "bram.claes@example.be", name: "Bram Claes", language: "nl" },
    subject: "Factuur met btw-nummer",
    intent: "invoice",
    status: "solved",
    orders: ["000012870"],
    tags: ["Zakelijk"],
    thread: [
      {
        dir: "inbound",
        by: "contact",
        minutesAgo: 5 * D,
        text: "Dag,\n\nKan ik voor bestelling 000012870 een factuur krijgen met ons btw-nummer BE0123.456.789 erop?\n\nBram Claes",
      },
      {
        dir: "outbound",
        by: "user",
        minutesAgo: 5 * D - 90,
        text: "Beste Bram,\n\nIn de bijlage vindt u de factuur met uw btw-nummer.\n\nMet vriendelijke groeten,\nFrank\nKlantenservice",
      },
    ],
  },

  // --- Frankrijk -----------------------------------------------------------
  {
    shop: "fr",
    contact: { email: "lea.moreau@example.fr", name: "Léa Moreau", language: "fr" },
    subject: "Changer l'adresse de livraison",
    intent: "address_change",
    status: "new",
    priority: "high",
    orders: ["000012940"],
    thread: [
      {
        dir: "inbound",
        by: "contact",
        minutesAgo: 22,
        text: "Bonjour,\n\nJe viens de passer la commande 000012940 mais je me suis trompée d'adresse. Pouvez-vous l'envoyer au 8 rue des Lilas, 69003 Lyon ?\n\nMerci beaucoup,\nLéa",
        translation:
          "Hallo,\n\nIk heb net bestelling 000012940 geplaatst, maar ik heb het verkeerde adres gebruikt. Kunt u hem naar 8 rue des Lilas, 69003 Lyon sturen?\n\nHartelijk dank,\nLéa",
      },
    ],
  },
  {
    shop: "fr",
    contact: { email: "hugo.laurent@example.fr", name: "Hugo Laurent", language: "fr" },
    subject: "Taille des draps housse",
    intent: "product_question",
    status: "new",
    thread: [
      {
        dir: "inbound",
        by: "contact",
        minutesAgo: 3 * H,
        text: "Bonjour,\n\nMon matelas fait 30 cm d'épaisseur. Est-ce que votre drap housse 160×200 convient ?\n\nCordialement,\nHugo Laurent",
        translation:
          "Hallo,\n\nMijn matras is 30 cm dik. Past jullie hoeslaken van 160×200 daarop?\n\nMet vriendelijke groet,\nHugo Laurent",
      },
    ],
    draft: {
      confidence: 92,
      sources: [{ title: "Questions fréquentes", path: "/faq" }],
      body: "Bonjour Hugo,\n\nOui : nos draps housse ont un bonnet de 35 cm, ils conviennent donc à un matelas de 30 cm, même avec un surmatelas fin.\n\nBien cordialement,\nFrank\nService client",
      translation:
        "Hallo Hugo,\n\nJa: onze hoeslakens hebben een hoekhoogte van 35 cm, dus ze passen op een matras van 30 cm, ook met een dunne topper.\n\nMet vriendelijke groet,\nFrank\nKlantenservice",
    },
  },
  {
    shop: "fr",
    contact: { email: "manon.petit@example.fr", name: "Manon Petit", language: "fr" },
    subject: "Remboursement toujours pas reçu",
    intent: "complaint",
    status: "open",
    priority: "high",
    assigned: true,
    orders: ["000012801"],
    thread: [
      {
        dir: "inbound",
        by: "contact",
        minutesAgo: 1 * D,
        text: "Bonjour,\n\nJ'ai renvoyé mon colis il y a deux semaines et je n'ai toujours pas été remboursée. Ce n'est pas normal.\n\nManon Petit",
        translation:
          "Hallo,\n\nIk heb mijn pakket twee weken geleden teruggestuurd en ik heb nog steeds geen geld terug. Dat is niet normaal.\n\nManon Petit",
      },
      {
        dir: "note",
        by: "user",
        minutesAgo: 1 * D - 30,
        text: "Retour staat in het magazijn als ontvangen op 21/10, maar terugbetaling is niet gestart. Navraag gedaan bij het magazijn.",
      },
    ],
  },

  // --- Spanje --------------------------------------------------------------
  {
    shop: "es",
    contact: { email: "pablo.ruiz@example.es", name: "Pablo Ruiz", language: "es" },
    subject: "¿Hacéis envíos a Canarias?",
    intent: "delivery_time",
    status: "new",
    thread: [
      {
        dir: "inbound",
        by: "contact",
        minutesAgo: 55,
        text: "Hola,\n\nVivo en Las Palmas. ¿Enviáis a Canarias? ¿Y cuánto cuesta el envío?\n\nGracias,\nPablo",
        translation:
          "Hallo,\n\nIk woon in Las Palmas. Verzenden jullie naar de Canarische Eilanden? En wat kost de verzending?\n\nBedankt,\nPablo",
      },
    ],
    draft: {
      confidence: 89,
      sources: [{ title: "Envíos y plazos de entrega", path: "/envios" }],
      body: "Hola Pablo,\n\nSí, enviamos a Canarias. El envío cuesta 9,95 € y tarda entre 5 y 7 días laborables. Ten en cuenta que puede haber que pagar el IGIC al recibir el paquete.\n\nUn saludo,\nFrank\nAtención al cliente",
      translation:
        "Hallo Pablo,\n\nJa, we verzenden naar de Canarische Eilanden. Verzending kost € 9,95 en duurt 5 tot 7 werkdagen. Houd er rekening mee dat je bij ontvangst mogelijk IGIC (lokale btw) moet betalen.\n\nGroet,\nFrank\nKlantenservice",
    },
  },
  {
    shop: "es",
    contact: {
      email: "carmen.navarro@example.es",
      name: "Carmen Navarro",
      language: "es",
    },
    subject: "Paquete dañado",
    intent: "damaged",
    status: "new",
    priority: "high",
    orders: ["000012922"],
    thread: [
      {
        dir: "inbound",
        by: "contact",
        minutesAgo: 90,
        text: "Hola,\n\nEl paquete llegó con la caja rota y una de las fundas de cojín está rasgada. Adjunto fotos.\n\nCarmen",
        translation:
          "Hallo,\n\nHet pakket kwam aan met een kapotte doos en een van de kussenhoezen is gescheurd. Foto's in de bijlage.\n\nCarmen",
      },
      {
        dir: "note",
        by: "ai",
        minutesAgo: 89,
        text: "Overgedragen aan een medewerker: beschadigd product. Bij schade beslist de AI niet zelf over vervanging of terugbetaling.",
      },
    ],
  },
  {
    shop: "es",
    contact: { email: "javier.moreno@example.es", name: "Javier Moreno", language: "es" },
    subject: "Factura de mi pedido",
    intent: "invoice",
    status: "pending_customer",
    orders: ["000012899"],
    thread: [
      {
        dir: "inbound",
        by: "contact",
        minutesAgo: 1 * D + 4 * H,
        text: "Hola,\n\n¿Me podéis enviar la factura del pedido 000012899 a nombre de mi empresa?\n\nJavier",
        translation:
          "Hallo,\n\nKunnen jullie me de factuur van bestelling 000012899 op naam van mijn bedrijf sturen?\n\nJavier",
      },
      {
        dir: "outbound",
        by: "user",
        minutesAgo: 1 * D + 3 * H,
        text: "Hola Javier,\n\nClaro. ¿Me indicas el nombre de la empresa, la dirección y el NIF? Con eso te preparo la factura.\n\nUn saludo,\nFrank\nAtención al cliente",
        translation:
          "Hallo Javier,\n\nNatuurlijk. Kun je me de bedrijfsnaam, het adres en het btw-nummer (NIF) geven? Dan maak ik de factuur voor je.\n\nGroet,\nFrank\nKlantenservice",
      },
    ],
  },
  {
    shop: "es",
    contact: { email: "lucia.romero@example.es", name: "Lucía Romero", language: "es" },
    subject: "Gracias por el regalo",
    intent: "other",
    status: "solved",
    priority: "low",
    thread: [
      {
        dir: "inbound",
        by: "contact",
        minutesAgo: 6 * D,
        text: "¡Hola! Solo quería deciros que la manta llegó perfecta y que a mi madre le encantó. ¡Gracias!\n\nLucía",
        translation:
          "Hoi! Ik wilde alleen even laten weten dat de plaid perfect aankwam en dat mijn moeder hem prachtig vond. Bedankt!\n\nLucía",
      },
      {
        dir: "outbound",
        by: "user",
        minutesAgo: 6 * D - H,
        text: "¡Qué alegría, Lucía! Muchas gracias por contárnoslo.\n\nUn saludo,\nFrank\nAtención al cliente",
        translation:
          "Wat leuk, Lucía! Hartelijk dank dat je het ons laat weten.\n\nGroet,\nFrank\nKlantenservice",
      },
    ],
  },
  {
    shop: "nl",
    contact: {
      email: "sophie.vandijk@example.nl",
      name: "Sophie van Dijk",
      language: "nl",
    },
    subject: "Cadeauverpakking mogelijk?",
    intent: "product_question",
    status: "new",
    priority: "low",
    thread: [
      {
        dir: "inbound",
        by: "contact",
        minutesAgo: 2 * H + 20,
        text: "Hoi,\n\nIk wil een badjas als cadeau laten opsturen naar mijn zus. Kunnen jullie hem inpakken en een kaartje meesturen zonder prijs?\n\nLiefs,\nSophie",
      },
    ],
    draft: {
      confidence: 93,
      sources: [{ title: "Veelgestelde vragen", path: "/veelgestelde-vragen" }],
      body: "Hoi Sophie,\n\nDat kan! Kies bij het afrekenen 'cadeauverpakking' (€ 3,95); dan pakken we de badjas in en schrijven we je tekst op een kaartje. Er zit nooit een prijs of pakbon met bedragen in een cadeaupakket.\n\nHartelijke groet,\nFrank\nKlantenservice",
    },
  },
  {
    shop: "be",
    contact: { email: "nina.jacobs@example.be", name: "Nina Jacobs", language: "nl" },
    subject: "Bestelling annuleren",
    intent: "other",
    status: "new",
    priority: "high",
    orders: ["000012944"],
    thread: [
      {
        dir: "inbound",
        by: "contact",
        minutesAgo: 9,
        text: "Hallo,\n\nIk heb per ongeluk twee keer dezelfde bestelling geplaatst. Kunt u 000012944 annuleren voordat hij verstuurd wordt?\n\nAlvast bedankt,\nNina",
      },
    ],
  },
];
