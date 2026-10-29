/**
 * Voorbeelddata voor de demo-omgeving. Draait alleen als er nog geen
 * demo-organisatie is; bestaande data wordt nooit overschreven.
 */
import { eq } from "drizzle-orm";
import type { TicketStatus } from "@/domain/tickets";
import { allocateTicketNumber } from "../repositories/tickets";
import * as s from "../schema";
import { withPrivileged, withTenant, type TenantTx } from "../tenant";
import type { Db } from "../types";

export const DEMO_ORG_SLUG = "demo";
export const DEMO_USER_ID = "00000000-0000-4000-8000-0000000000f1";

const minutes = (n: number) => new Date(Date.now() - n * 60_000);

type Lang = "nl" | "fr" | "es";
type ShopCode = "nl" | "be" | "fr" | "es";

const SHOPS: {
  code: ShopCode;
  name: string;
  domain: string;
  language: Lang;
  locale: string;
  senderName: string;
  senderEmail: string;
  signature: string;
  store: number;
  tone: string;
}[] = [
  {
    code: "nl",
    name: "Webshop Nederland",
    domain: "voorbeeldshop.nl",
    language: "nl",
    locale: "nl-NL",
    senderName: "Klantenservice",
    senderEmail: "support@voorbeeldshop.nl",
    signature: "Hartelijke groet,\nFrank\nKlantenservice",
    store: 1,
    tone: "Vriendelijk en persoonlijk, je-vorm, korte zinnen. Geen uitroeptekens behalve bij een bedankje.",
  },
  {
    code: "be",
    name: "Webshop België",
    domain: "voorbeeldshop.be",
    language: "nl",
    locale: "nl-BE",
    senderName: "Klantenservice",
    senderEmail: "support@voorbeeldshop.be",
    signature: "Met vriendelijke groeten,\nFrank\nKlantenservice",
    store: 2,
    tone: "Vriendelijk en iets formeler, u-vorm. Belgische termen waar gangbaar (bijvoorbeeld 'gsm').",
  },
  {
    code: "fr",
    name: "Boutique France",
    domain: "boutique-exemple.fr",
    language: "fr",
    locale: "fr-FR",
    senderName: "Service client",
    senderEmail: "service@boutique-exemple.fr",
    signature: "Bien cordialement,\nFrank\nService client",
    store: 3,
    tone: "Poli et chaleureux, vouvoiement. Formules de politesse complètes.",
  },
  {
    code: "es",
    name: "Tienda España",
    domain: "tienda-ejemplo.es",
    language: "es",
    locale: "es-ES",
    senderName: "Atención al cliente",
    senderEmail: "atencion@tienda-ejemplo.es",
    signature: "Un saludo,\nFrank\nAtención al cliente",
    store: 4,
    tone: "Cercano y claro, tuteo. Frases cortas.",
  },
];

type DemoTicket = {
  shop: ShopCode;
  contact: { email: string; name: string; language: Lang };
  subject: string;
  intent: string;
  status: TicketStatus;
  priority?: "normal" | "high";
  assigned?: boolean;
  orders?: string[];
  tags?: string[];
  thread: {
    dir: "inbound" | "outbound" | "note";
    by: "contact" | "user" | "ai" | "system";
    minutesAgo: number;
    text: string;
    translation?: string;
  }[];
  draft?: {
    body: string;
    translation?: string;
    confidence: number;
    sources: { title: string; path: string }[];
  };
};

const TICKETS: DemoTicket[] = [
  {
    shop: "nl",
    contact: { email: "sanne.deboer@example.nl", name: "Sanne de Boer", language: "nl" },
    subject: "Waar blijft mijn bestelling?",
    intent: "where_is_my_order",
    status: "new",
    orders: ["000012871"],
    thread: [
      {
        dir: "inbound",
        by: "contact",
        minutesAgo: 18,
        text: "Hoi,\n\nIk heb vorige week een dekbedovertrek besteld (ordernummer 000012871) maar nog niets ontvangen. Kunnen jullie kijken waar hij blijft?\n\nGroetjes,\nSanne",
      },
    ],
    draft: {
      confidence: 94,
      sources: [{ title: "Verzenden en levertijden", path: "/verzenden" }],
      body: "Hoi Sanne,\n\nDank je voor je bericht. Je bestelling 000012871 is eergisteren met PostNL verstuurd. Via deze link kun je precies zien waar je pakket nu is:\nhttps://jouw.postnl.nl/track-and-trace/3SVBS1234567-NL-1015KK\n\nPostNL bezorgt meestal binnen 1 tot 2 werkdagen na verzending. Is je pakket er overmorgen nog niet, laat het me dan weten, dan zoek ik het uit.\n\nHartelijke groet,\nFrank\nKlantenservice",
    },
  },
  {
    shop: "nl",
    contact: { email: "mark.jansen@example.nl", name: "Mark Jansen", language: "nl" },
    subject: "Plaid retourneren",
    intent: "return",
    status: "new",
    orders: ["000012790"],
    tags: ["Retour"],
    thread: [
      {
        dir: "inbound",
        by: "contact",
        minutesAgo: 47,
        text: "Goedemiddag,\n\nDe plaid die ik heb besteld is mooi, maar de kleur valt anders uit dan verwacht. Hoe kan ik hem terugsturen?\n\nMet vriendelijke groet,\nMark Jansen",
      },
    ],
    draft: {
      confidence: 91,
      sources: [
        { title: "Retourneren", path: "/retourneren" },
        { title: "Veelgestelde vragen", path: "/veelgestelde-vragen" },
      ],
      body: "Hoi Mark,\n\nJammer dat de kleur tegenvalt. Je kunt de plaid binnen 30 dagen na ontvangst kosteloos terugsturen, zolang hij ongebruikt is en in de originele verpakking zit.\n\nZo werkt het:\n1. Meld je retour aan via voorbeeldshop.nl/retourneren met je ordernummer 000012790 en je e-mailadres.\n2. Je ontvangt een retourlabel per mail.\n3. Breng het pakket naar een PostNL-punt.\n\nZodra we de plaid binnen hebben, storten we het bedrag binnen 5 werkdagen terug.\n\nHartelijke groet,\nFrank\nKlantenservice",
    },
  },
  {
    shop: "nl",
    contact: { email: "ayse.yilmaz@example.nl", name: "Ayşe Yılmaz", language: "nl" },
    subject: "Verkeerde maat badjas",
    intent: "return",
    status: "open",
    assigned: true,
    orders: ["000012833"],
    tags: ["Retour"],
    thread: [
      {
        dir: "inbound",
        by: "contact",
        minutesAgo: 60 * 26,
        text: "Hallo,\n\nIk heb een badjas in maat M besteld, maar hij is te klein. Kan ik hem ruilen voor een L?\n\nAyşe",
      },
      {
        dir: "note",
        by: "user",
        minutesAgo: 60 * 25,
        text: "Maat L is pas volgende week weer op voorraad. Even navragen bij inkoop of de levering van dinsdag doorgaat.",
      },
    ],
  },
  {
    shop: "nl",
    contact: {
      email: "p.bakker@bakkerinterieur.example.nl",
      name: "Peter Bakker",
      language: "nl",
    },
    subject: "Factuur op bedrijfsnaam",
    intent: "invoice",
    status: "pending_customer",
    assigned: true,
    orders: ["000012655"],
    tags: ["Zakelijk"],
    thread: [
      {
        dir: "inbound",
        by: "contact",
        minutesAgo: 60 * 50,
        text: "Goedendag,\n\nKunnen jullie de factuur van order 000012655 op naam van Bakker Interieur B.V. zetten, met ons btw-nummer NL001234567B01?\n\nMet vriendelijke groet,\nPeter Bakker",
      },
      {
        dir: "outbound",
        by: "user",
        minutesAgo: 60 * 48,
        text: "Beste Peter,\n\nDat kan zeker. Wil je me het volledige factuuradres sturen zoals het op de factuur moet komen? Dan pas ik hem aan en stuur ik hem opnieuw.\n\nHartelijke groet,\nFrank\nKlantenservice",
      },
    ],
  },
  {
    shop: "nl",
    contact: { email: "lotte.visser@example.nl", name: "Lotte Visser", language: "nl" },
    subject: "Wanneer wordt mijn bestelling verzonden?",
    intent: "where_is_my_order",
    status: "new",
    orders: ["000012902"],
    thread: [
      {
        dir: "inbound",
        by: "contact",
        minutesAgo: 95,
        text: "Hoi, gisteren besteld (000012902). Wanneer wordt het verstuurd? Ik wil het graag zaterdag in huis hebben. Lotte",
      },
    ],
    draft: {
      confidence: 88,
      sources: [{ title: "Verzenden en levertijden", path: "/verzenden" }],
      body: "Hoi Lotte,\n\nDank je voor je bestelling. Je kussens worden vandaag ingepakt en gaan vanmiddag met PostNL mee. Je krijgt de track & trace-link per mail zodra het pakket onderweg is.\n\nPostNL bezorgt meestal de volgende werkdag, dus naar verwachting heb je ze ruim voor zaterdag in huis.\n\nHartelijke groet,\nFrank\nKlantenservice",
    },
  },
  {
    shop: "be",
    contact: { email: "jens.peeters@example.be", name: "Jens Peeters", language: "nl" },
    subject: "Pakje als geleverd gemeld, maar niet ontvangen",
    intent: "where_is_my_order",
    status: "new",
    priority: "high",
    orders: ["000012844"],
    tags: ["Vervoerder"],
    thread: [
      {
        dir: "inbound",
        by: "contact",
        minutesAgo: 130,
        text: "Goeiedag,\n\nVolgens bpost is mijn pakje gisteren geleverd, maar ik heb niets ontvangen. Ook niet bij de buren. Wat nu?\n\nJens Peeters",
      },
      {
        dir: "note",
        by: "ai",
        minutesAgo: 129,
        text: "Overgedragen aan een medewerker: het pakket staat als geleverd, maar de klant heeft het niet. Dat vraagt een onderzoek bij bpost en mogelijk een vervanging; dat beslist de AI niet zelf.",
      },
    ],
  },
  {
    shop: "be",
    contact: { email: "elke.maes@example.be", name: "Elke Maes", language: "nl" },
    subject: "Retour theedoeken",
    intent: "return",
    status: "solved",
    assigned: true,
    orders: ["000012511"],
    tags: ["Retour"],
    thread: [
      {
        dir: "inbound",
        by: "contact",
        minutesAgo: 60 * 24 * 8,
        text: "Dag, ik wil de theedoeken graag terugsturen. Hoe gaat dat? Groeten, Elke",
      },
      {
        dir: "outbound",
        by: "user",
        minutesAgo: 60 * 24 * 8 - 40,
        text: "Beste Elke,\n\nU kunt de theedoeken binnen 30 dagen terugsturen. Meld de retour aan via voorbeeldshop.be/retourneren; u ontvangt dan een retourlabel van bpost.\n\nMet vriendelijke groeten,\nFrank\nKlantenservice",
      },
      {
        dir: "inbound",
        by: "contact",
        minutesAgo: 60 * 24 * 4,
        text: "Bedankt, het geld is binnen!",
      },
    ],
  },
  {
    shop: "fr",
    contact: {
      email: "camille.martin@example.fr",
      name: "Camille Martin",
      language: "fr",
    },
    subject: "Où est ma commande ?",
    intent: "where_is_my_order",
    status: "new",
    orders: ["000012859"],
    thread: [
      {
        dir: "inbound",
        by: "contact",
        minutesAgo: 33,
        text: "Bonjour,\n\nJ'ai commandé un plaid il y a cinq jours (commande 000012859) et je n'ai reçu aucune information sur la livraison. Pouvez-vous me dire où en est mon colis ?\n\nMerci d'avance,\nCamille Martin",
        translation:
          "Hallo,\n\nIk heb vijf dagen geleden een plaid besteld (order 000012859) en heb nog geen informatie over de levering gekregen. Kunt u me vertellen waar mijn pakket is?\n\nAlvast bedankt,\nCamille Martin",
      },
    ],
    draft: {
      confidence: 93,
      sources: [{ title: "Livraison et délais", path: "/livraison" }],
      body: "Bonjour Camille,\n\nMerci pour votre message. Votre commande 000012859 a été expédiée avant-hier par Colissimo. Vous pouvez suivre votre colis ici :\nhttps://www.laposte.fr/outils/suivre-vos-envois?code=6A23456789012\n\nColissimo livre généralement en 2 à 3 jours ouvrés. Si vous n'avez rien reçu d'ici la fin de la semaine, n'hésitez pas à revenir vers moi.\n\nBien cordialement,\nFrank\nService client",
      translation:
        "Hallo Camille,\n\nBedankt voor uw bericht. Uw bestelling 000012859 is eergisteren met Colissimo verstuurd. U kunt uw pakket hier volgen:\nhttps://www.laposte.fr/outils/suivre-vos-envois?code=6A23456789012\n\nColissimo bezorgt meestal binnen 2 tot 3 werkdagen. Heeft u eind deze week nog niets ontvangen, laat het me dan gerust weten.\n\nMet vriendelijke groet,\nFrank\nKlantenservice",
    },
  },
  {
    shop: "fr",
    contact: { email: "julien.dubois@example.fr", name: "Julien Dubois", language: "fr" },
    subject: "Retour d'un peignoir",
    intent: "return",
    status: "new",
    orders: ["000012812"],
    tags: ["Retour"],
    thread: [
      {
        dir: "inbound",
        by: "contact",
        minutesAgo: 75,
        text: "Bonjour,\n\nLe peignoir est trop grand. Comment puis-je le retourner et serai-je remboursé ?\n\nCordialement,\nJulien Dubois",
        translation:
          "Hallo,\n\nDe badjas is te groot. Hoe kan ik hem terugsturen en krijg ik mijn geld terug?\n\nMet vriendelijke groet,\nJulien Dubois",
      },
    ],
    draft: {
      confidence: 90,
      sources: [{ title: "Retours et remboursements", path: "/retours" }],
      body: "Bonjour Julien,\n\nVous pouvez nous retourner le peignoir dans les 30 jours suivant la réception, à condition qu'il n'ait pas été porté et qu'il soit dans son emballage d'origine.\n\n1. Déclarez votre retour sur boutique-exemple.fr/retours avec votre numéro de commande 000012812.\n2. Vous recevrez une étiquette de retour Colissimo par e-mail.\n3. Déposez le colis dans un bureau de poste ou un point relais.\n\nNous vous rembourserons sous 5 jours ouvrés après réception du peignoir.\n\nBien cordialement,\nFrank\nService client",
      translation:
        "Hallo Julien,\n\nU kunt de badjas binnen 30 dagen na ontvangst terugsturen, mits ongedragen en in de originele verpakking.\n\n1. Meld uw retour aan op boutique-exemple.fr/retours met uw ordernummer 000012812.\n2. U ontvangt een Colissimo-retourlabel per e-mail.\n3. Lever het pakket in bij een postkantoor of afhaalpunt.\n\nWe betalen u binnen 5 werkdagen na ontvangst van de badjas terug.\n\nMet vriendelijke groet,\nFrank\nKlantenservice",
    },
  },
  {
    shop: "fr",
    contact: { email: "chloe.bernard@example.fr", name: "Chloé Bernard", language: "fr" },
    subject: "Miroir cassé à la livraison",
    intent: "damaged",
    status: "new",
    priority: "high",
    orders: ["000012866"],
    tags: ["Vervoerder", "Spoed"],
    thread: [
      {
        dir: "inbound",
        by: "contact",
        minutesAgo: 240,
        text: "Bonjour,\n\nLe miroir est arrivé cassé, le carton était abîmé. Je joins des photos. Je souhaite un remplacement rapidement.\n\nChloé Bernard",
        translation:
          "Hallo,\n\nDe spiegel is kapot aangekomen, de doos was beschadigd. Ik stuur foto's mee. Ik wil graag snel een vervanging.\n\nChloé Bernard",
      },
      {
        dir: "note",
        by: "ai",
        minutesAgo: 239,
        text: "Overgedragen aan een medewerker: beschadigd product. Vervanging of terugbetaling beslist een mens; vraagtype 'Beschadigd product' staat op 'altijd een mens'.",
      },
    ],
  },
  {
    shop: "es",
    contact: { email: "lucia.garcia@example.es", name: "Lucía García", language: "es" },
    subject: "¿Dónde está mi pedido?",
    intent: "where_is_my_order",
    status: "new",
    orders: ["000012874"],
    thread: [
      {
        dir: "inbound",
        by: "contact",
        minutesAgo: 22,
        text: "Hola,\n\nHice un pedido hace unos días (000012874) y todavía no ha llegado. ¿Me podéis decir cuándo llegará?\n\nGracias,\nLucía",
        translation:
          "Hallo,\n\nIk heb een paar dagen geleden een bestelling geplaatst (000012874) en die is nog niet aangekomen. Kunnen jullie me vertellen wanneer die komt?\n\nBedankt,\nLucía",
      },
    ],
    draft: {
      confidence: 92,
      sources: [{ title: "Envíos y plazos de entrega", path: "/envios" }],
      body: "Hola Lucía,\n\nGracias por tu mensaje. Tu pedido 000012874 salió hace tres días con Correos. Puedes seguir el envío aquí:\nhttps://www.correos.es/es/es/herramientas/localizador/envios/detalle?tracking-number=PQ4F2A0712345670128004A\n\nCorreos suele entregar en 3 a 5 días laborables a la Península. Si el lunes todavía no lo tienes, escríbeme y lo revisamos.\n\nUn saludo,\nFrank\nAtención al cliente",
      translation:
        "Hallo Lucía,\n\nBedankt voor je bericht. Je bestelling 000012874 is drie dagen geleden met Correos verstuurd. Je kunt de zending hier volgen:\n[link]\n\nCorreos bezorgt op het vasteland meestal binnen 3 tot 5 werkdagen. Heb je het maandag nog niet, mail me dan en dan zoeken we het uit.\n\nGroet,\nFrank\nKlantenservice",
    },
  },
  {
    shop: "es",
    contact: {
      email: "javier.fernandez@example.es",
      name: "Javier Fernández",
      language: "es",
    },
    subject: "Devolución de cojines",
    intent: "return",
    status: "pending_customer",
    orders: ["000012801"],
    tags: ["Retour"],
    thread: [
      {
        dir: "inbound",
        by: "contact",
        minutesAgo: 60 * 30,
        text: "Hola, quiero devolver los dos cojines. ¿Cómo lo hago?",
        translation: "Hallo, ik wil de twee kussens terugsturen. Hoe doe ik dat?",
      },
      {
        dir: "outbound",
        by: "ai",
        minutesAgo: 60 * 30 - 2,
        text: "Hola Javier,\n\nPuedes devolver los cojines en un plazo de 30 días. Registra la devolución en tienda-ejemplo.es/devoluciones con tu número de pedido 000012801 y te enviaremos una etiqueta de Correos.\n\nUn saludo,\nFrank\nAtención al cliente",
        translation:
          "Hallo Javier,\n\nJe kunt de kussens binnen 30 dagen terugsturen. Meld de retour aan op tienda-ejemplo.es/devoluciones met je ordernummer 000012801, dan sturen we je een Correos-label.\n\nGroet,\nFrank\nKlantenservice",
      },
    ],
  },
  {
    shop: "es",
    contact: { email: "marta.lopez@example.es", name: "Marta López", language: "es" },
    subject: "Cambiar la dirección de entrega",
    intent: "address_change",
    status: "open",
    thread: [
      {
        dir: "inbound",
        by: "contact",
        minutesAgo: 12,
        text: "Hola, acabo de hacer el pedido 000012898 y me he equivocado de dirección. Debería ser Calle Larios 7, no 5. ¿Lo podéis cambiar antes de enviarlo?",
        translation:
          "Hallo, ik heb net bestelling 000012898 geplaatst en me vergist in het adres. Het moet Calle Larios 7 zijn, niet 5. Kunnen jullie dat aanpassen voordat het verstuurd wordt?",
      },
      {
        dir: "note",
        by: "ai",
        minutesAgo: 11,
        text: "Overgedragen: adreswijziging. De order is nog niet verzonden, dus aanpassen kan nog in Magento. Adressen wijzigen doet de AI niet zelf.",
      },
    ],
    orders: ["000012898"],
  },
];

const TEMPLATES: { language: Lang; name: string; body: string }[] = [
  {
    language: "nl",
    name: "Track & trace sturen",
    body: "Hoi {{voornaam}},\n\nJe bestelling {{ordernummer}} is verstuurd met {{vervoerder}}. Je kunt hem hier volgen:\n{{trackinglink}}\n\n{{handtekening}}",
  },
  {
    language: "nl",
    name: "Retourinstructies",
    body: "Hoi {{voornaam}},\n\nJe kunt je bestelling binnen 30 dagen kosteloos retourneren. Meld je retour aan via {{shopdomein}}/retourneren met ordernummer {{ordernummer}}; je ontvangt dan een retourlabel per mail.\n\n{{handtekening}}",
  },
  {
    language: "nl",
    name: "Factuur opnieuw verstuurd",
    body: "Hoi {{voornaam}},\n\nIn de bijlage vind je de aangepaste factuur van bestelling {{ordernummer}}.\n\n{{handtekening}}",
  },
  {
    language: "fr",
    name: "Suivi de commande",
    body: "Bonjour {{voornaam}},\n\nVotre commande {{ordernummer}} a été expédiée par {{vervoerder}}. Vous pouvez la suivre ici :\n{{trackinglink}}\n\n{{handtekening}}",
  },
  {
    language: "fr",
    name: "Instructions de retour",
    body: "Bonjour {{voornaam}},\n\nVous pouvez retourner votre commande dans les 30 jours. Déclarez votre retour sur {{shopdomein}}/retours avec le numéro {{ordernummer}}.\n\n{{handtekening}}",
  },
  {
    language: "es",
    name: "Seguimiento del pedido",
    body: "Hola {{voornaam}},\n\nTu pedido {{ordernummer}} ha salido con {{vervoerder}}. Puedes seguirlo aquí:\n{{trackinglink}}\n\n{{handtekening}}",
  },
  {
    language: "es",
    name: "Instrucciones de devolución",
    body: "Hola {{voornaam}},\n\nPuedes devolver tu pedido en un plazo de 30 días. Regístralo en {{shopdomein}}/devoluciones con el número {{ordernummer}}.\n\n{{handtekening}}",
  },
];

const KNOWLEDGE: Record<
  ShopCode,
  {
    title: string;
    path: string;
    status?: "indexed" | "excluded" | "failed" | "pending";
    error?: string;
  }[]
> = {
  nl: [
    { title: "Verzenden en levertijden", path: "/verzenden" },
    { title: "Retourneren", path: "/retourneren" },
    { title: "Veelgestelde vragen", path: "/veelgestelde-vragen" },
    { title: "Algemene voorwaarden", path: "/algemene-voorwaarden" },
    { title: "Contact", path: "/contact" },
    { title: "Linnen dekbedovertrek", path: "/linnen-dekbedovertrek" },
    { title: "Wollen plaid", path: "/wollen-plaid" },
    { title: "Winkelwagen", path: "/checkout/cart", status: "excluded" },
  ],
  be: [
    { title: "Verzenden en levertijden", path: "/verzenden" },
    { title: "Retourneren", path: "/retourneren" },
    { title: "Veelgestelde vragen", path: "/veelgestelde-vragen" },
    {
      title: "Actievoorwaarden najaar",
      path: "/actievoorwaarden",
      status: "failed",
      error: "Pagina gaf een 404",
    },
  ],
  fr: [
    { title: "Livraison et délais", path: "/livraison" },
    { title: "Retours et remboursements", path: "/retours" },
    { title: "Questions fréquentes", path: "/faq" },
    { title: "Conditions générales de vente", path: "/cgv" },
  ],
  es: [
    { title: "Envíos y plazos de entrega", path: "/envios" },
    { title: "Devoluciones", path: "/devoluciones" },
    { title: "Preguntas frecuentes", path: "/preguntas-frecuentes" },
    {
      title: "Nueva colección de invierno",
      path: "/coleccion-invierno",
      status: "pending",
    },
  ],
};

export const AI_INTENTS: {
  intent: string;
  label: string;
  mode: "off" | "draft" | "autopilot";
  threshold: number;
}[] = [
  {
    intent: "where_is_my_order",
    label: "Waar is mijn bestelling?",
    mode: "draft",
    threshold: 92,
  },
  { intent: "return", label: "Retourneren", mode: "draft", threshold: 90 },
  { intent: "delivery_time", label: "Levertijd", mode: "draft", threshold: 90 },
  { intent: "invoice", label: "Factuur", mode: "draft", threshold: 95 },
  {
    intent: "product_question",
    label: "Vraag over een product",
    mode: "draft",
    threshold: 95,
  },
  { intent: "address_change", label: "Adres wijzigen", mode: "off", threshold: 100 },
  { intent: "damaged", label: "Beschadigd product", mode: "off", threshold: 100 },
  { intent: "complaint", label: "Klacht", mode: "off", threshold: 100 },
  { intent: "other", label: "Overig", mode: "draft", threshold: 95 },
];

export async function seedDemo(db: Db) {
  const existing = await withPrivileged(db, (tx) =>
    tx
      .select({ id: s.organizations.id })
      .from(s.organizations)
      .where(eq(s.organizations.slug, DEMO_ORG_SLUG)),
  );
  if (existing.length > 0) return;

  const org = await withPrivileged(db, async (tx) => {
    const [o] = await tx
      .insert(s.organizations)
      .values({ name: "Kingdo", slug: DEMO_ORG_SLUG, ticketSeq: 1000 })
      .returning();
    await tx
      .insert(s.users)
      .values({ id: DEMO_USER_ID, email: "frank@kingdo.nl", name: "Frank" })
      .onConflictDoNothing();
    return o;
  });

  await withTenant(db, org.id, async (t) => {
    const { tx, organizationId } = t;
    await tx
      .insert(s.memberships)
      .values({ organizationId, userId: DEMO_USER_ID, role: "owner" });

    const shopRows = await tx
      .insert(s.shops)
      .values(
        SHOPS.map((sh) => ({
          organizationId,
          code: sh.code,
          name: sh.name,
          domain: sh.domain,
          language: sh.language,
          locale: sh.locale,
          senderName: sh.senderName,
          senderEmail: sh.senderEmail,
          signature: sh.signature,
          magentoStoreId: sh.store,
          magentoWebsiteId: sh.store,
          toneOfVoice: sh.tone,
        })),
      )
      .returning();
    const shopId = Object.fromEntries(shopRows.map((r) => [r.code, r.id])) as Record<
      ShopCode,
      string
    >;
    const shopDomain = Object.fromEntries(
      shopRows.map((r) => [r.code, r.domain]),
    ) as Record<ShopCode, string>;

    const [team] = await tx
      .insert(s.teams)
      .values({ organizationId, name: "Klantenservice" })
      .returning();
    await tx
      .insert(s.teamMembers)
      .values({ organizationId, teamId: team.id, userId: DEMO_USER_ID });

    const tagRows = await tx
      .insert(s.tags)
      .values([
        { organizationId, name: "Retour", color: "green" },
        { organizationId, name: "Vervoerder", color: "blue" },
        { organizationId, name: "Zakelijk", color: "purple" },
        { organizationId, name: "Spoed", color: "red" },
      ])
      .returning();
    const tagId = Object.fromEntries(tagRows.map((r) => [r.name, r.id]));

    await tx
      .insert(s.templates)
      .values(TEMPLATES.map((tpl) => ({ organizationId, ...tpl })));

    await tx.insert(s.aiIntentSettings).values(
      AI_INTENTS.map((a) => ({
        organizationId,
        intent: a.intent,
        label: a.label,
        mode: a.mode,
        confidenceThreshold: a.threshold,
      })),
    );

    await tx.insert(s.integrations).values([
      { organizationId, kind: "mailgun", status: "demo", settings: { region: "EU" } },
      {
        organizationId,
        kind: "magento",
        status: "demo",
        settings: { version: "2.4.8", mode: "alleen lezen" },
      },
      {
        organizationId,
        kind: "ai",
        status: "demo",
        settings: { provider: "AWS Bedrock", region: "EU (Frankfurt)" },
      },
    ]);

    for (const code of Object.keys(KNOWLEDGE) as ShopCode[]) {
      await tx.insert(s.knowledgeSources).values(
        KNOWLEDGE[code].map((k, i) => ({
          organizationId,
          shopId: shopId[code],
          kind: "page" as const,
          title: k.title,
          url: `https://${shopDomain[code]}${k.path}`,
          status: k.status ?? ("indexed" as const),
          error: k.error ?? null,
          lastCrawledAt: k.status === "pending" ? null : minutes(60 * (5 + i)),
        })),
      );
    }
    await tx.insert(s.knowledgeSources).values({
      organizationId,
      shopId: shopId.nl,
      kind: "upload",
      title: "Maattabel badjassen.pdf",
      status: "indexed",
      lastCrawledAt: minutes(60 * 24 * 3),
    });

    // Tickets in volgorde van aanmaak (oudste eerst), zodat nummers logisch oplopen.
    const ordered = [...TICKETS].sort(
      (a, b) => b.thread[0].minutesAgo - a.thread[0].minutesAgo,
    );
    for (const d of ordered) {
      await seedTicket(t, d, {
        shopId: shopId[d.shop],
        shopDomain: shopDomain[d.shop],
        tagId,
      });
    }
  });
}

async function seedTicket(
  t: TenantTx,
  d: DemoTicket,
  ctx: { shopId: string; shopDomain: string; tagId: Record<string, string> },
) {
  const { tx, organizationId } = t;
  const [contact] = await tx
    .insert(s.contacts)
    .values({
      organizationId,
      email: d.contact.email,
      name: d.contact.name,
      language: d.contact.language,
    })
    .returning();

  const number = await allocateTicketNumber(t);

  const first = d.thread[0];
  const last = d.thread[d.thread.length - 1];
  const firstOutbound = d.thread.find((m) => m.dir === "outbound");
  const [ticket] = await tx
    .insert(s.tickets)
    .values({
      organizationId,
      number,
      shopId: ctx.shopId,
      contactId: contact.id,
      subject: d.subject,
      status: d.status,
      priority: d.priority ?? "normal",
      language: d.contact.language,
      intent: d.intent,
      assigneeId: d.assigned ? DEMO_USER_ID : null,
      firstResponseAt: firstOutbound ? minutes(firstOutbound.minutesAgo) : null,
      solvedAt: d.status === "solved" ? minutes(last.minutesAgo - 30) : null,
      lastMessageAt: minutes(last.minutesAgo),
      createdAt: minutes(first.minutesAgo),
      updatedAt: minutes(last.minutesAgo),
    })
    .returning();

  await tx.insert(s.ticketEvents).values({
    organizationId,
    ticketId: ticket.id,
    type: "created",
    toValue: "new",
    actorType: "system",
    createdAt: minutes(first.minutesAgo),
  });
  if (d.status !== "new") {
    await tx.insert(s.ticketEvents).values({
      organizationId,
      ticketId: ticket.id,
      type: "status_changed",
      fromValue: "new",
      toValue: d.status,
      actorType: d.assigned ? "user" : "ai",
      actorUserId: d.assigned ? DEMO_USER_ID : null,
      createdAt: minutes(last.minutesAgo - 1),
    });
  }

  for (const [i, m] of d.thread.entries()) {
    await tx.insert(s.messages).values({
      organizationId,
      ticketId: ticket.id,
      direction: m.dir,
      authorType: m.by,
      authorUserId: m.by === "user" ? DEMO_USER_ID : null,
      fromEmail: m.dir === "inbound" ? contact.email : null,
      toEmails: m.dir === "outbound" ? [contact.email] : [],
      subject: i === 0 ? d.subject : `Re: ${d.subject}`,
      bodyText: m.text,
      translatedText: m.translation ?? null,
      messageIdHeader:
        m.dir === "note" ? null : `<demo-${number}-${i}@${ctx.shopDomain}>`,
      createdAt: minutes(m.minutesAgo),
    });
  }

  for (const order of d.orders ?? []) {
    await tx.insert(s.ticketOrders).values({
      organizationId,
      ticketId: ticket.id,
      orderNumber: order,
      linkedBy: "system",
    });
  }
  for (const tag of d.tags ?? []) {
    await tx
      .insert(s.ticketTags)
      .values({ organizationId, ticketId: ticket.id, tagId: ctx.tagId[tag] });
  }
  if (d.draft) {
    await tx.insert(s.aiDrafts).values({
      organizationId,
      ticketId: ticket.id,
      body: d.draft.body,
      translation: d.draft.translation ?? null,
      confidence: d.draft.confidence,
      sources: d.draft.sources.map((src) => ({
        title: src.title,
        url: `https://${ctx.shopDomain}${src.path}`,
      })),
      createdAt: minutes(first.minutesAgo - 1),
    });
  }
}
