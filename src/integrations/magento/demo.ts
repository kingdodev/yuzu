/**
 * Nagebootste Magento met voorbeeldorders, zolang de echte koppeling er nog
 * niet is. Datums zijn relatief aan nu, zodat de voorbeelden kloppen.
 */
import type { CustomerContext, MagentoClient, MagentoOrder } from "./types";

const day = 24 * 60 * 60 * 1000;
const ago = (days: number, hours = 0) =>
  new Date(Date.now() - days * day - hours * 3600_000);

const ADMIN = "https://admin.voorbeeldshop.nl/admin/sales/order/view/order_id/";

type Seed = Omit<
  MagentoOrder,
  "createdAt" | "shipments" | "invoices" | "creditMemos" | "adminUrl"
> & {
  daysAgo: number;
  shipped?: { carrier: string; code: string; url: string; daysAgo: number };
  creditMemo?: { amount: number; daysAgo: number };
};

const ORDERS: Record<string, Seed[]> = {
  "sanne.deboer@example.nl": [
    {
      number: "000012871",
      shopCode: "nl",
      daysAgo: 3,
      status: "complete",
      total: 89.9,
      currency: "EUR",
      paymentMethod: "iDEAL",
      paid: true,
      items: [
        {
          sku: "DBO-240-SAL",
          name: "Linnen dekbedovertrek 240×220, salie",
          qty: 1,
          price: 79.95,
        },
        { sku: "KUS-60-SAL", name: "Kussensloop 60×70, salie", qty: 1, price: 9.95 },
      ],
      shippingAddress: {
        name: "Sanne de Boer",
        street: "Lindengracht 12",
        postcode: "1015 KK",
        city: "Amsterdam",
        country: "NL",
      },
      shipped: {
        carrier: "PostNL",
        code: "3SVBS1234567",
        url: "https://jouw.postnl.nl/track-and-trace/3SVBS1234567-NL-1015KK",
        daysAgo: 2,
      },
    },
    {
      number: "000011204",
      shopCode: "nl",
      daysAgo: 64,
      status: "complete",
      total: 34.5,
      currency: "EUR",
      paymentMethod: "iDEAL",
      paid: true,
      items: [
        { sku: "THD-50-ZND", name: "Theedoek set van 3, zand", qty: 1, price: 34.5 },
      ],
      shippingAddress: {
        name: "Sanne de Boer",
        street: "Lindengracht 12",
        postcode: "1015 KK",
        city: "Amsterdam",
        country: "NL",
      },
      shipped: {
        carrier: "PostNL",
        code: "3SVBS0987654",
        url: "https://jouw.postnl.nl/track-and-trace/3SVBS0987654-NL-1015KK",
        daysAgo: 63,
      },
    },
  ],
  "mark.jansen@example.nl": [
    {
      number: "000012790",
      shopCode: "nl",
      daysAgo: 9,
      status: "complete",
      total: 149,
      currency: "EUR",
      paymentMethod: "Creditcard",
      paid: true,
      items: [
        { sku: "PLD-130-OCH", name: "Wollen plaid 130×180, oker", qty: 1, price: 149 },
      ],
      shippingAddress: {
        name: "Mark Jansen",
        street: "Oudegracht 201",
        postcode: "3511 NH",
        city: "Utrecht",
        country: "NL",
      },
      shipped: {
        carrier: "PostNL",
        code: "3SVBS2233445",
        url: "https://jouw.postnl.nl/track-and-trace/3SVBS2233445-NL-3511NH",
        daysAgo: 8,
      },
    },
  ],
  "ayse.yilmaz@example.nl": [
    {
      number: "000012833",
      shopCode: "nl",
      daysAgo: 6,
      status: "complete",
      total: 59.95,
      currency: "EUR",
      paymentMethod: "Klarna",
      paid: true,
      items: [
        {
          sku: "BJS-M-ANT",
          name: "Badjas wafelstof, antraciet, maat M",
          qty: 1,
          price: 59.95,
        },
      ],
      shippingAddress: {
        name: "Ayşe Yılmaz",
        street: "Schiekade 88",
        postcode: "3032 AJ",
        city: "Rotterdam",
        country: "NL",
      },
      shipped: {
        carrier: "PostNL",
        code: "3SVBS3344556",
        url: "https://jouw.postnl.nl/track-and-trace/3SVBS3344556-NL-3032AJ",
        daysAgo: 5,
      },
    },
  ],
  "p.bakker@bakkerinterieur.example.nl": [
    {
      number: "000012655",
      shopCode: "nl",
      daysAgo: 21,
      status: "complete",
      total: 612.4,
      currency: "EUR",
      paymentMethod: "Bankoverschrijving",
      paid: true,
      items: [
        {
          sku: "DBO-200-WIT",
          name: "Linnen dekbedovertrek 200×220, wit",
          qty: 6,
          price: 74.95,
        },
        { sku: "LKN-240-WIT", name: "Hoeslaken 180×200, wit", qty: 6, price: 27.12 },
      ],
      shippingAddress: {
        name: "Bakker Interieur B.V.",
        street: "Industrieweg 4",
        postcode: "5311 KD",
        city: "Gameren",
        country: "NL",
      },
      shipped: {
        carrier: "DHL",
        code: "JVGL0612345678",
        url: "https://www.dhl.com/nl-nl/home/tracking.html?tracking-id=JVGL0612345678",
        daysAgo: 20,
      },
    },
  ],
  "lotte.visser@example.nl": [
    {
      number: "000012902",
      shopCode: "nl",
      daysAgo: 1,
      status: "processing",
      total: 42.9,
      currency: "EUR",
      paymentMethod: "iDEAL",
      paid: true,
      items: [
        {
          sku: "KSN-45-GRN",
          name: "Sierkussen velours 45×45, groen",
          qty: 2,
          price: 21.45,
        },
      ],
      shippingAddress: {
        name: "Lotte Visser",
        street: "Vismarkt 3",
        postcode: "9711 KR",
        city: "Groningen",
        country: "NL",
      },
    },
  ],
  "jens.peeters@example.be": [
    {
      number: "000012844",
      shopCode: "be",
      daysAgo: 7,
      status: "complete",
      total: 129.95,
      currency: "EUR",
      paymentMethod: "Bancontact",
      paid: true,
      items: [
        {
          sku: "DBO-240-SAL",
          name: "Linnen dekbedovertrek 240×220, salie",
          qty: 1,
          price: 129.95,
        },
      ],
      shippingAddress: {
        name: "Jens Peeters",
        street: "Kammenstraat 41",
        postcode: "2000",
        city: "Antwerpen",
        country: "BE",
      },
      shipped: {
        carrier: "bpost",
        code: "323299912345678",
        url: "https://track.bpost.cloud/btr/web/#/search?itemCode=323299912345678",
        daysAgo: 6,
      },
    },
  ],
  "elke.maes@example.be": [
    {
      number: "000012511",
      shopCode: "be",
      daysAgo: 30,
      status: "closed",
      total: 39.95,
      currency: "EUR",
      paymentMethod: "Bancontact",
      paid: true,
      items: [
        { sku: "THD-50-ZND", name: "Theedoek set van 3, zand", qty: 1, price: 39.95 },
      ],
      shippingAddress: {
        name: "Elke Maes",
        street: "Veldstraat 9",
        postcode: "9000",
        city: "Gent",
        country: "BE",
      },
      shipped: {
        carrier: "bpost",
        code: "323299900011122",
        url: "https://track.bpost.cloud/btr/web/#/search?itemCode=323299900011122",
        daysAgo: 29,
      },
      creditMemo: { amount: 39.95, daysAgo: 4 },
    },
  ],
  "camille.martin@example.fr": [
    {
      number: "000012859",
      shopCode: "fr",
      daysAgo: 5,
      status: "complete",
      total: 104.9,
      currency: "EUR",
      paymentMethod: "Carte bancaire",
      paid: true,
      items: [
        {
          sku: "PLD-130-OCH",
          name: "Plaid en laine 130×180, ocre",
          qty: 1,
          price: 104.9,
        },
      ],
      shippingAddress: {
        name: "Camille Martin",
        street: "12 rue de la Charité",
        postcode: "69002",
        city: "Lyon",
        country: "FR",
      },
      shipped: {
        carrier: "Colissimo",
        code: "6A23456789012",
        url: "https://www.laposte.fr/outils/suivre-vos-envois?code=6A23456789012",
        daysAgo: 4,
      },
    },
  ],
  "julien.dubois@example.fr": [
    {
      number: "000012812",
      shopCode: "fr",
      daysAgo: 11,
      status: "complete",
      total: 64.9,
      currency: "EUR",
      paymentMethod: "PayPal",
      paid: true,
      items: [
        {
          sku: "BJS-L-ANT",
          name: "Peignoir gaufré, anthracite, taille L",
          qty: 1,
          price: 64.9,
        },
      ],
      shippingAddress: {
        name: "Julien Dubois",
        street: "8 quai des Chartrons",
        postcode: "33000",
        city: "Bordeaux",
        country: "FR",
      },
      shipped: {
        carrier: "Colissimo",
        code: "6A23456700045",
        url: "https://www.laposte.fr/outils/suivre-vos-envois?code=6A23456700045",
        daysAgo: 10,
      },
    },
  ],
  "chloe.bernard@example.fr": [
    {
      number: "000012866",
      shopCode: "fr",
      daysAgo: 4,
      status: "complete",
      total: 219,
      currency: "EUR",
      paymentMethod: "Carte bancaire",
      paid: true,
      items: [
        { sku: "SPG-L-CER", name: "Miroir en céramique, grand", qty: 1, price: 219 },
      ],
      shippingAddress: {
        name: "Chloé Bernard",
        street: "3 place du Capitole",
        postcode: "31000",
        city: "Toulouse",
        country: "FR",
      },
      shipped: {
        carrier: "Colissimo",
        code: "6A23456711122",
        url: "https://www.laposte.fr/outils/suivre-vos-envois?code=6A23456711122",
        daysAgo: 3,
      },
    },
  ],
  "lucia.garcia@example.es": [
    {
      number: "000012874",
      shopCode: "es",
      daysAgo: 4,
      status: "complete",
      total: 79.95,
      currency: "EUR",
      paymentMethod: "Tarjeta",
      paid: true,
      items: [
        {
          sku: "DBO-200-WIT",
          name: "Funda nórdica de lino 200×220, blanco",
          qty: 1,
          price: 79.95,
        },
      ],
      shippingAddress: {
        name: "Lucía García",
        street: "Calle de Fuencarral 45",
        postcode: "28004",
        city: "Madrid",
        country: "ES",
      },
      shipped: {
        carrier: "Correos",
        code: "PQ4F2A0712345670128004A",
        url: "https://www.correos.es/es/es/herramientas/localizador/envios/detalle?tracking-number=PQ4F2A0712345670128004A",
        daysAgo: 3,
      },
    },
  ],
  "javier.fernandez@example.es": [
    {
      number: "000012801",
      shopCode: "es",
      daysAgo: 13,
      status: "complete",
      total: 49.9,
      currency: "EUR",
      paymentMethod: "PayPal",
      paid: true,
      items: [
        {
          sku: "KSN-45-GRN",
          name: "Cojín de terciopelo 45×45, verde",
          qty: 2,
          price: 24.95,
        },
      ],
      shippingAddress: {
        name: "Javier Fernández",
        street: "Passeig de Gràcia 70",
        postcode: "08008",
        city: "Barcelona",
        country: "ES",
      },
      shipped: {
        carrier: "Correos",
        code: "PQ4F2A0700098760108008B",
        url: "https://www.correos.es/es/es/herramientas/localizador/envios/detalle?tracking-number=PQ4F2A0700098760108008B",
        daysAgo: 12,
      },
    },
  ],
  "marta.lopez@example.es": [
    {
      number: "000012898",
      shopCode: "es",
      daysAgo: 0,
      status: "processing",
      total: 159.9,
      currency: "EUR",
      paymentMethod: "Tarjeta",
      paid: true,
      items: [
        { sku: "PLD-130-OCH", name: "Manta de lana 130×180, ocre", qty: 1, price: 159.9 },
      ],
      shippingAddress: {
        name: "Marta López",
        street: "Calle Larios 5",
        postcode: "29005",
        city: "Málaga",
        country: "ES",
      },
    },
  ],
};

const GROUPS: Record<string, "Gast" | "Particulier" | "Zakelijk"> = {
  "p.bakker@bakkerinterieur.example.nl": "Zakelijk",
  "lotte.visser@example.nl": "Gast",
  "marta.lopez@example.es": "Gast",
};

function build(seed: Seed, index: number): MagentoOrder {
  const createdAt = ago(seed.daysAgo, 3);
  return {
    number: seed.number,
    shopCode: seed.shopCode,
    createdAt,
    status: seed.status,
    total: seed.total,
    currency: seed.currency,
    paymentMethod: seed.paymentMethod,
    paid: seed.paid,
    items: seed.items,
    shippingAddress: seed.shippingAddress,
    shipments: seed.shipped
      ? [
          {
            carrier: seed.shipped.carrier,
            trackingNumber: seed.shipped.code,
            trackingUrl: seed.shipped.url,
            shippedAt: ago(seed.shipped.daysAgo, 1),
          },
        ]
      : [],
    invoices: seed.paid ? [{ number: `INV-${seed.number}`, createdAt }] : [],
    creditMemos: seed.creditMemo
      ? [
          {
            number: `CM-${seed.number}`,
            amount: seed.creditMemo.amount,
            createdAt: ago(seed.creditMemo.daysAgo),
          },
        ]
      : [],
    adminUrl: `${ADMIN}${40000 + index}/`,
  };
}

export const demoMagento: MagentoClient = {
  async getCustomerContext(shopCode, email) {
    const seeds = (ORDERS[email] ?? []).filter((o) => o.shopCode === shopCode);
    const orders = seeds.map((s) => build(s, Number(s.number.slice(-4))));
    if (orders.length === 0)
      return { customer: null, orders: [] } satisfies CustomerContext;
    const group = GROUPS[email] ?? "Particulier";
    return {
      customer: {
        magentoId: group === "Gast" ? null : 1000 + Number(orders[0].number.slice(-3)),
        name: orders[0].shippingAddress.name,
        email,
        group,
        orderCount: orders.length,
        lifetimeValue: orders.reduce((sum, o) => sum + o.total, 0),
      },
      orders,
    };
  },
};
