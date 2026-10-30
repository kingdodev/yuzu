import { describe, expect, it } from "vitest";
import {
  checkConnection,
  createMagentoClient,
  MagentoError,
  type MagentoConnection,
} from "@/integrations/magento/api";
import {
  mapStatus,
  normalizeShopUrl,
  paymentName,
  parseMagentoDate,
  suggestStoreView,
  trackingUrl,
  type RawOrder,
  type RawShipment,
} from "@/integrations/magento/mapping";
import { fakeMagento, publicDns } from "./helpers/fake-magento";

const credentials = {
  consumerKey: "ck123",
  consumerSecret: "cs456",
  accessToken: "at789",
  accessTokenSecret: "ats012",
};
const connection: MagentoConnection = {
  baseUrl: "https://www.voorbeeldshop.nl",
  credentials,
  signatureMethod: "HMAC-SHA256",
  restPath: "/rest/V1",
  adminUrl: "https://www.voorbeeldshop.nl/beheer",
};

const order = (
  o: Partial<RawOrder> & Pick<RawOrder, "entity_id" | "increment_id">,
): RawOrder => ({
  created_at: "2026-10-20 09:00:00",
  status: "processing",
  state: "processing",
  grand_total: 59.95,
  order_currency_code: "EUR",
  total_due: 0,
  customer_email: "sanne@example.nl",
  customer_firstname: "Sanne",
  customer_lastname: "de Boer",
  customer_is_guest: 0,
  customer_group_id: 1,
  store_id: 1,
  items: [
    {
      item_id: 1,
      sku: "BADJAS",
      name: "Badjas wafelstof",
      qty_ordered: 1,
      price_incl_tax: 59.95,
    },
    {
      item_id: 2,
      sku: "BADJAS-M",
      name: "Badjas wafelstof, M",
      qty_ordered: 1,
      parent_item_id: 1,
    },
  ],
  payment: { method: "mollie_methods_ideal", additional_information: ["iDEAL"] },
  extension_attributes: {
    shipping_assignments: [
      {
        shipping: {
          address: {
            firstname: "Sanne",
            lastname: "de Boer",
            street: ["Kade 1"],
            postcode: "1015 KK",
            city: "Amsterdam",
            country_id: "NL",
          },
        },
      },
    ],
  },
  ...o,
});

const ORDERS: RawOrder[] = [
  order({
    entity_id: 101,
    increment_id: "000012871",
    created_at: "2026-10-27 10:15:33",
    status: "complete",
    state: "complete",
  }),
  order({
    entity_id: 102,
    increment_id: "000011204",
    created_at: "2026-08-27 08:00:00",
    status: "canceled",
    state: "canceled",
    grand_total: 10,
  }),
  order({
    entity_id: 103,
    increment_id: "000012900",
    store_id: 3,
    created_at: "2026-10-28 08:00:00",
  }),
  // Besteld met een ander adres; het ordernummer stond in de mail.
  order({
    entity_id: 104,
    increment_id: "000012950",
    customer_email: "partner@example.nl",
  }),
];
const SHIPMENTS: RawShipment[] = [
  {
    order_id: 101,
    created_at: "2026-10-28 07:00:00",
    tracks: [
      {
        track_number: "3SVBS1234567",
        title: "PostNL",
        carrier_code: "postnl",
        created_at: "2026-10-28 07:00:00",
      },
    ],
  },
];

describe("vertalen van Magento-gegevens", () => {
  it("leest tijden als UTC", () => {
    expect(parseMagentoDate("2026-10-27 10:15:33").toISOString()).toBe(
      "2026-10-27T10:15:33.000Z",
    );
  });

  it("vertaalt statussen, ook eigen statussen via de state", () => {
    expect(mapStatus("pending_payment")).toBe("pending");
    expect(mapStatus("holded")).toBe("on_hold");
    expect(mapStatus("verzonden_naar_magazijn", "processing")).toBe("processing");
    expect(mapStatus("klaar", "complete")).toBe("complete");
  });

  it("herkent betaalmethoden", () => {
    expect(paymentName({ method: "mollie_methods_ideal" })).toBe("iDEAL");
    expect(paymentName({ method: "mollie_methods_bancontact" })).toBe("Bancontact");
    expect(
      paymentName({ method: "onbekend_ding", additional_information: ["Op rekening"] }),
    ).toBe("Op rekening");
  });

  it("maakt track & trace-links voor bekende vervoerders", () => {
    expect(trackingUrl("postnl PostNL", "3SVBS1234567", "1015 KK", "NL")).toBe(
      "https://jouw.postnl.nl/track-and-trace/3SVBS1234567-NL-1015KK",
    );
    expect(trackingUrl("bpost", "323299")).toContain("bpost");
    expect(trackingUrl("Eigen bezorging", "123")).toBeNull();
  });

  it("maakt een ingevuld adres netjes", () => {
    expect(normalizeShopUrl("www.kingdo.nl/")).toBe("https://www.kingdo.nl");
    expect(normalizeShopUrl("https://www.kingdo.nl/rest/V1/orders")).toBe(
      "https://www.kingdo.nl",
    );
    expect(normalizeShopUrl("https://www.kingdo.nl/index.php/rest/V1")).toBe(
      "https://www.kingdo.nl",
    );
    expect(normalizeShopUrl("https://shop.nl/winkel/")).toBe("https://shop.nl/winkel");
  });

  it("koppelt store views aan shops op domeinnaam", () => {
    const views = [
      {
        id: 1,
        code: "nl",
        name: "NL",
        websiteId: 1,
        active: true,
        url: "https://www.voorbeeldshop.nl/",
        locale: "nl_NL",
      },
      {
        id: 2,
        code: "be",
        name: "BE",
        websiteId: 1,
        active: true,
        url: "https://voorbeeldshop.be/",
        locale: "nl_BE",
      },
    ];
    expect(suggestStoreView("voorbeeldshop.be", views)?.id).toBe(2);
    expect(suggestStoreView("www.voorbeeldshop.nl", views)?.id).toBe(1);
    expect(suggestStoreView("andere.nl", views)).toBeNull();
  });
});

describe("Magento-koppeling (tegen een nagebootste Magento)", () => {
  const fake = () => fakeMagento({ credentials, orders: ORDERS, shipments: SHIPMENTS });

  it("haalt orders van de klant in deze shop op, met zendingen en gekoppelde orders", async () => {
    const m = fake();
    const client = createMagentoClient(
      connection,
      { nl: 1, fr: 3 },
      { fetch: m.fetch, resolve: publicDns },
    );
    const ctx = await client.getCustomerContext("nl", "sanne@example.nl", ["000012950"]);

    expect(ctx.orders.map((o) => o.number)).toEqual([
      "000012871",
      "000012950",
      "000011204",
    ]);
    const shipped = ctx.orders.find((o) => o.number === "000012871")!;
    expect(shipped).toMatchObject({
      status: "complete",
      total: 59.95,
      paymentMethod: "iDEAL",
      paid: true,
      shippingAddress: { postcode: "1015 KK", city: "Amsterdam" },
      adminUrl: "https://www.voorbeeldshop.nl/beheer/sales/order/view/order_id/101/",
    });
    expect(shipped.items).toEqual([
      { sku: "BADJAS", name: "Badjas wafelstof", qty: 1, price: 59.95 },
    ]);
    expect(shipped.shipments[0]).toMatchObject({
      carrier: "PostNL",
      trackingNumber: "3SVBS1234567",
      trackingUrl: "https://jouw.postnl.nl/track-and-trace/3SVBS1234567-NL-1015KK",
    });
    // Klantgegevens uit de eigen orders; geannuleerd telt niet mee.
    expect(ctx.customer).toMatchObject({
      name: "Sanne de Boer",
      group: "Particulier",
      orderCount: 1,
      lifetimeValue: 59.95,
    });
    // Alleen lezen.
    expect(m.calls.every((c) => c.method === "GET")).toBe(true);
  });

  it("zonder gekoppelde store view: orders uit alle shops", async () => {
    const m = fake();
    const client = createMagentoClient(
      connection,
      { nl: null },
      { fetch: m.fetch, resolve: publicDns },
    );
    const ctx = await client.getCustomerContext("nl", "sanne@example.nl");
    expect(ctx.orders.map((o) => o.number)).toContain("000012900");
  });

  it("geen orders: geen klant, en geen zendingen opvragen", async () => {
    const m = fake();
    const client = createMagentoClient(
      connection,
      { nl: 1 },
      { fetch: m.fetch, resolve: publicDns },
    );
    const ctx = await client.getCustomerContext("nl", "nieuw@example.nl");
    expect(ctx).toEqual({ customer: null, orders: [] });
    expect(m.calls.some((c) => c.path.endsWith("/shipments"))).toBe(false);
  });

  it("test de verbinding en noemt ontbrekende rechten", async () => {
    const ok = await checkConnection(connection, {
      fetch: fake().fetch,
      resolve: publicDns,
    });
    expect(ok.missing).toEqual([]);
    expect(ok.storeViews.map((v) => [v.id, v.code, v.url])).toEqual([
      [1, "nl", "https://www.voorbeeldshop.nl/"],
      [2, "be", "https://www.voorbeeldshop.be/"],
      [3, "fr", "https://www.boutique-exemple.fr/"],
    ]);

    const limited = fakeMagento({ credentials, resources: ["Magento_Backend::store"] });
    const partly = await checkConnection(connection, {
      fetch: limited.fetch,
      resolve: publicDns,
    });
    expect(partly.missing).toEqual([
      "Sales → Operations → Orders → Actions → View",
      "Sales → Operations → Shipments",
    ]);
  });

  it("geeft duidelijke fouten bij verkeerde sleutels, adres of netwerk", async () => {
    const wrongKeys = {
      ...connection,
      credentials: { ...credentials, consumerSecret: "fout" },
    };
    await expect(
      checkConnection(wrongKeys, { fetch: fake().fetch, resolve: publicDns }),
    ).rejects.toMatchObject({ kind: "auth" });

    const wrongPath = { ...connection, restPath: "/index.php/rest/V1" };
    await expect(
      checkConnection(wrongPath, { fetch: fake().fetch, resolve: publicDns }),
    ).rejects.toMatchObject({ kind: "not_found" });

    const down = async () => {
      throw new TypeError("fetch failed");
    };
    await expect(
      checkConnection(connection, {
        fetch: down as unknown as typeof fetch,
        resolve: publicDns,
      }),
    ).rejects.toMatchObject({ kind: "unreachable" });

    const redirect = async () =>
      new Response(null, { status: 301, headers: { location: "https://elders.nl" } });
    await expect(
      checkConnection(connection, {
        fetch: redirect as unknown as typeof fetch,
        resolve: publicDns,
      }),
    ).rejects.toMatchObject({ kind: "invalid" });
  });

  it("weigert interne adressen, ook via DNS", async () => {
    const m = fake();
    const err = await checkConnection(connection, {
      fetch: m.fetch,
      resolve: async () => ["10.0.0.5"],
    }).catch((e) => e);
    expect(err).toBeInstanceOf(MagentoError);
    expect(err.kind).toBe("invalid");
    expect(m.calls).toEqual([]);
  });
});
