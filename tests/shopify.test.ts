import { beforeEach, describe, expect, it } from "vitest";
import {
  checkShopify,
  clearShopifyTokenCache,
  createShopifyClient,
  type ShopifyConnection,
} from "@/integrations/shopify/api";
import {
  gatewayName,
  mapShopifyStatus,
  normalizeShopDomain,
  type ShopifyOrder,
} from "@/integrations/shopify/mapping";
import { fakeShopify } from "./helpers/fake-shopify";

const shopDomain = "testwinkel.myshopify.com";
const app: ShopifyConnection = {
  shopDomain,
  credentials: { mode: "client_credentials", clientId: "cid", clientSecret: "secret" },
};

const order = (
  o: Partial<ShopifyOrder> & Pick<ShopifyOrder, "id" | "name">,
): ShopifyOrder => ({
  legacyResourceId: o.id.replace(/\D/g, ""),
  createdAt: "2026-10-20T09:00:00Z",
  cancelledAt: null,
  displayFinancialStatus: "PAID",
  displayFulfillmentStatus: "UNFULFILLED",
  email: "sanne@example.nl",
  totalPriceSet: { shopMoney: { amount: "59.95", currencyCode: "EUR" } },
  totalOutstandingSet: { shopMoney: { amount: "0.0" } },
  paymentGatewayNames: ["shopify_payments"],
  customer: {
    id: "gid://shopify/Customer/1",
    firstName: "Sanne",
    lastName: "de Boer",
    numberOfOrders: "3",
    amountSpent: { amount: "180.00", currencyCode: "EUR" },
  },
  shippingAddress: {
    name: "Sanne de Boer",
    address1: "Kade 1",
    zip: "1015 KK",
    city: "Amsterdam",
    countryCodeV2: "NL",
  },
  lineItems: {
    nodes: [
      {
        sku: "SHIRT-M",
        name: "Thuisshirt, M",
        quantity: 2,
        originalUnitPriceSet: { shopMoney: { amount: "29.95" } },
      },
    ],
  },
  fulfillments: [],
  ...o,
});

const ORDERS = [
  order({
    id: "gid://shopify/Order/101",
    name: "#1001",
    createdAt: "2026-10-27T10:00:00Z",
    displayFulfillmentStatus: "FULFILLED",
    fulfillments: [
      {
        createdAt: "2026-10-28T07:00:00Z",
        trackingInfo: [{ company: "PostNL", number: "3SABC123", url: null }],
      },
    ],
  }),
  order({
    id: "gid://shopify/Order/102",
    name: "#1002",
    createdAt: "2026-10-29T10:00:00Z",
  }),
  order({ id: "gid://shopify/Order/103", name: "#1003", email: "partner@example.nl" }),
];

beforeEach(() => clearShopifyTokenCache());

describe("Shopify: gegevens vertalen", () => {
  it("maakt van wat iemand invult het myshopify-adres", () => {
    expect(normalizeShopDomain("testwinkel")).toBe(shopDomain);
    expect(normalizeShopDomain("https://testwinkel.myshopify.com/admin")).toBe(
      shopDomain,
    );
    expect(normalizeShopDomain("admin.shopify.com/store/testwinkel/orders")).toBe(
      shopDomain,
    );
    expect(normalizeShopDomain("www.testwinkel.nl")).toBeNull();
    expect(normalizeShopDomain("evil.com/x.myshopify.com")).toBeNull();
  });

  it("vertaalt statussen en betaalmethoden", () => {
    const base = ORDERS[1];
    expect(mapShopifyStatus({ ...base, cancelledAt: "2026-10-01T00:00:00Z" })).toBe(
      "canceled",
    );
    expect(mapShopifyStatus({ ...base, displayFinancialStatus: "REFUNDED" })).toBe(
      "closed",
    );
    expect(mapShopifyStatus({ ...base, displayFulfillmentStatus: "FULFILLED" })).toBe(
      "complete",
    );
    expect(mapShopifyStatus({ ...base, displayFinancialStatus: "PENDING" })).toBe(
      "pending",
    );
    expect(mapShopifyStatus(base)).toBe("processing");
    expect(gatewayName(["mollie_ideal"])).toBe("iDEAL");
    expect(gatewayName(undefined)).toBe("Onbekend");
  });
});

describe("Shopify-koppeling (tegen een nagebootste Shopify)", () => {
  const fake = (extra: Partial<Parameters<typeof fakeShopify>[0]> = {}) =>
    fakeShopify({
      shopDomain,
      clientId: "cid",
      clientSecret: "secret",
      orders: ORDERS,
      ...extra,
    });

  it("haalt een token op met client credentials en hergebruikt het", async () => {
    const f = fake();
    const client = createShopifyClient(app, { fetch: f.fetch });
    await client.getCustomerContext("nl", "sanne@example.nl");
    await client.getCustomerContext("nl", "sanne@example.nl");
    expect(f.tokenRequests()).toBe(1);
  });

  it("vindt een order op nummer, met of zonder #", async () => {
    const f = fake();
    const client = createShopifyClient(app, { fetch: f.fetch });
    expect(await client.findOrders("1003")).toEqual([
      { number: "#1003", email: "partner@example.nl", shopCode: null },
    ]);
    expect(await client.findOrders("#1001")).toMatchObject([{ number: "#1001" }]);
    expect(await client.findOrders("4040")).toEqual([]);
  });

  it("haalt orders van de klant op, plus gekoppelde ordernummers, met tracking", async () => {
    const f = fake();
    const ctx = await createShopifyClient(app, { fetch: f.fetch }).getCustomerContext(
      "nl",
      "sanne@example.nl",
      ["1003"],
    );
    expect(ctx.orders.map((o) => o.number)).toEqual(["#1002", "#1001", "#1003"]);
    const shipped = ctx.orders.find((o) => o.number === "#1001")!;
    expect(shipped).toMatchObject({
      status: "complete",
      total: 59.95,
      paid: true,
      paymentMethod: "Shopify Payments",
      adminUrl: "https://admin.shopify.com/store/testwinkel/orders/101",
      shippingAddress: { postcode: "1015 KK", city: "Amsterdam" },
    });
    expect(shipped.items).toEqual([
      { sku: "SHIRT-M", name: "Thuisshirt, M", qty: 2, price: 29.95 },
    ]);
    expect(shipped.shipments[0]).toMatchObject({
      carrier: "PostNL",
      trackingNumber: "3SABC123",
      trackingUrl: "https://jouw.postnl.nl/track-and-trace/3SABC123-NL-1015KK",
    });
    expect(ctx.customer).toMatchObject({
      name: "Sanne de Boer",
      orderCount: 3,
      lifetimeValue: 180,
    });
  });

  it("werkt ook met een oud vast token (shpat_)", async () => {
    const f = fake({ legacyToken: "shpat_oud" });
    const ctx = await createShopifyClient(
      { shopDomain, credentials: { mode: "token", accessToken: "shpat_oud" } },
      { fetch: f.fetch },
    ).getCustomerContext("nl", "sanne@example.nl");
    expect(ctx.orders).toHaveLength(2);
    expect(f.tokenRequests()).toBe(0);
  });

  it("test de verbinding en noemt wat er ontbreekt", async () => {
    expect(await checkShopify(app, { fetch: fake().fetch })).toEqual({
      shopName: "Testwinkel",
      primaryDomain: "https://www.testwinkel.nl",
      missing: [],
    });
    const noCustomers = await checkShopify(app, {
      fetch: fake({ scopes: ["read_orders"] }).fetch,
    });
    expect(noCustomers.missing).toEqual(["read_customers (klanten lezen)"]);
    const noOrders = await checkShopify(app, { fetch: fake({ scopes: [] }).fetch });
    expect(noOrders.missing).toContain("read_orders (orders lezen)");
    const noProtected = await checkShopify(app, {
      fetch: fake({ protectedData: false }).fetch,
    });
    expect(noProtected.missing[0]).toMatch(/klantgegevens/);
  });

  it("geeft duidelijke fouten", async () => {
    const wrong = {
      ...app,
      credentials: {
        mode: "client_credentials" as const,
        clientId: "cid",
        clientSecret: "fout",
      },
    };
    await expect(checkShopify(wrong, { fetch: fake().fetch })).rejects.toMatchObject({
      kind: "auth",
    });
    await expect(
      checkShopify(app, { fetch: fake({ notPermitted: true }).fetch }),
    ).rejects.toThrow(/organisatie/);
    await expect(
      checkShopify(
        { ...app, shopDomain: "bestaatniet.myshopify.com" },
        { fetch: fake().fetch },
      ),
    ).rejects.toMatchObject({ kind: "not_found" });
    expect(() => createShopifyClient({ ...app, shopDomain: "evil.example.com" })).toThrow(
      /myshopify/,
    );
  });
});
