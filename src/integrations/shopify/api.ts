/**
 * De Shopify-koppeling via de Admin GraphQL API. Alleen lezen: deze module
 * stuurt alleen queries, nooit mutations.
 *
 * Inloggen kan op twee manieren:
 * - "client_credentials": een app uit het Shopify Dev Dashboard, eigendom van
 *   de winkel zelf. Met Client ID en Client secret haalt Yuzu zelf een token
 *   op dat 24 uur geldig is.
 * - "token": een vast Admin API-token (shpat_…) van een oudere custom app.
 */
import type { CustomerContext, MagentoClient as CommerceClient } from "../magento/types";
import { mapShopifyOrder, shopifyCustomer, type ShopifyOrder } from "./mapping";

export const SHOPIFY_API_VERSION = "2026-07";

export type ShopifyCredentials =
  | { mode: "client_credentials"; clientId: string; clientSecret: string }
  | { mode: "token"; accessToken: string };

export type ShopifyConnection = { shopDomain: string; credentials: ShopifyCredentials };

export type ShopifyErrorKind =
  "auth" | "forbidden" | "not_found" | "unreachable" | "timeout" | "server" | "throttled";

export class ShopifyError extends Error {
  constructor(
    public readonly kind: ShopifyErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "ShopifyError";
  }
}

const TIMEOUT_MS = 10_000;
const MAX_BYTES = 5 * 1024 * 1024;
type Fetch = typeof fetch;

const DOMAIN_RE = /^[a-z0-9][a-z0-9-]{0,60}\.myshopify\.com$/;

/** Tokens uit client credentials, per winkel+app, in het geheugen (24 uur geldig). */
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

async function request(
  doFetch: Fetch,
  url: string,
  init: RequestInit,
): Promise<Response> {
  try {
    return await doFetch(url, {
      ...init,
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")) {
      throw new ShopifyError("timeout", "Shopify reageert niet (na 10 seconden).");
    }
    throw new ShopifyError("unreachable", "Shopify is niet bereikbaar.");
  }
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.length > MAX_BYTES)
    throw new ShopifyError("server", "Antwoord van Shopify is te groot.");
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

export function createShopifyApi(
  connection: ShopifyConnection,
  deps: { fetch?: Fetch } = {},
) {
  const doFetch = deps.fetch ?? fetch;
  if (!DOMAIN_RE.test(connection.shopDomain)) {
    throw new ShopifyError("not_found", "Gebruik het myshopify.com-adres van je winkel.");
  }
  const base = `https://${connection.shopDomain}`;
  const cacheKey =
    connection.credentials.mode === "client_credentials"
      ? `${connection.shopDomain}|${connection.credentials.clientId}`
      : "";

  async function token(fresh = false): Promise<string> {
    const c = connection.credentials;
    if (c.mode === "token") return c.accessToken;
    const cached = tokenCache.get(cacheKey);
    if (!fresh && cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
    const response = await request(doFetch, `${base}/admin/oauth/access_token`, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: c.clientId,
        client_secret: c.clientSecret,
      }).toString(),
    });
    const body = (await readJson(response)) as {
      access_token?: string;
      expires_in?: number;
      error?: string;
      error_description?: string;
    } | null;
    if (response.status === 404) {
      throw new ShopifyError(
        "not_found",
        "Deze winkel bestaat niet. Controleer het myshopify.com-adres.",
      );
    }
    if (!response.ok || !body?.access_token) {
      const code = `${body?.error ?? ""} ${body?.error_description ?? ""}`;
      if (/shop_not_permitted/i.test(code)) {
        throw new ShopifyError(
          "auth",
          "Shopify staat deze app niet toe voor deze winkel. Maak de app aan in het Dev Dashboard van de organisatie waar de winkel bij hoort, en installeer hem op de winkel.",
        );
      }
      if (/not_installed|app_not_installed/i.test(code)) {
        throw new ShopifyError("auth", "De app is nog niet op de winkel geïnstalleerd.");
      }
      throw new ShopifyError(
        "auth",
        "Shopify accepteert de Client ID of het Client secret niet.",
      );
    }
    tokenCache.set(cacheKey, {
      token: body.access_token,
      expiresAt: Date.now() + (body.expires_in ?? 86_399) * 1000,
    });
    return body.access_token;
  }

  /** Eén GraphQL-query. Geen mutations: alleen lezen. */
  async function query<T>(
    gql: string,
    variables: Record<string, unknown> = {},
  ): Promise<T> {
    if (/^\s*mutation\b/i.test(gql)) throw new Error("Yuzu leest alleen uit Shopify");
    const send = async (fresh: boolean) =>
      request(doFetch, `${base}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          "x-shopify-access-token": await token(fresh),
        },
        body: JSON.stringify({ query: gql, variables }),
      });
    let response = await send(false);
    if (response.status === 401 && connection.credentials.mode === "client_credentials") {
      tokenCache.delete(cacheKey); // verlopen of ingetrokken: één keer een nieuw token proberen
      response = await send(true);
    }
    if (response.status >= 300 && response.status < 400) {
      throw new ShopifyError(
        "not_found",
        "Gebruik het myshopify.com-adres van je winkel.",
      );
    }
    if (response.status === 401) {
      throw new ShopifyError("auth", "Shopify accepteert het token niet (meer).");
    }
    if (response.status === 402)
      throw new ShopifyError("forbidden", "Deze winkel is gepauzeerd of gesloten.");
    if (response.status === 404)
      throw new ShopifyError("not_found", "Deze winkel bestaat niet.");
    if (response.status === 429)
      throw new ShopifyError("throttled", "Shopify vraagt om even te wachten.");
    const body = (await readJson(response)) as {
      data?: T;
      errors?: { message: string; extensions?: { code?: string } }[] | string;
    } | null;
    if (!response.ok || !body)
      throw new ShopifyError("server", `Shopify gaf een fout (${response.status}).`);
    if (Array.isArray(body.errors) && body.errors.length) {
      const denied = body.errors.find((e) => e.extensions?.code === "ACCESS_DENIED");
      if (denied) throw new ShopifyError("forbidden", denied.message);
      if (body.errors.some((e) => e.extensions?.code === "THROTTLED")) {
        throw new ShopifyError("throttled", "Shopify vraagt om even te wachten.");
      }
      throw new ShopifyError("server", "Shopify gaf een fout bij het ophalen.");
    }
    return body.data as T;
  }

  return { query };
}

const ORDER_FIELDS = `
  id legacyResourceId name createdAt cancelledAt closed
  displayFinancialStatus displayFulfillmentStatus email
  totalPriceSet { shopMoney { amount currencyCode } }
  totalOutstandingSet { shopMoney { amount } }
  paymentGatewayNames
  customer { id firstName lastName numberOfOrders amountSpent { amount currencyCode } }
  shippingAddress { name address1 address2 zip city countryCodeV2 }
  lineItems(first: 50) { nodes { sku name quantity originalUnitPriceSet { shopMoney { amount } } } }
  fulfillments(first: 10) { createdAt trackingInfo(first: 5) { company number url } }
`;

const ORDERS_QUERY = `query YuzuOrders($query: String!, $first: Int!) {
  orders(first: $first, query: $query, sortKey: CREATED_AT, reverse: true) { nodes { ${ORDER_FIELDS} } }
}`;

/** Zoekterm voor Shopify: tussen aanhalingstekens, zonder aanhalingstekens erin. */
const quote = (v: string) => `"${v.replace(/["\\]/g, "")}"`;

export type ShopifyCheck = {
  shopName: string;
  primaryDomain: string | null;
  /** Wat er nog ontbreekt, in begrijpelijke taal; leeg = alles goed. */
  missing: string[];
};

/** Test de verbinding: winkelgegevens, en of orders en klantgegevens leesbaar zijn. */
export async function checkShopify(
  connection: ShopifyConnection,
  deps: { fetch?: Fetch } = {},
): Promise<ShopifyCheck> {
  const api = createShopifyApi(connection, deps);
  const shop = await api.query<{
    shop: { name: string; primaryDomain?: { url: string } | null };
  }>(`query YuzuShop { shop { name primaryDomain { url } } }`);
  const missing: string[] = [];
  try {
    const data = await api.query<{
      orders: { nodes: { id: string; email: string | null }[] };
    }>(`query YuzuCheck { orders(first: 1) { nodes { id email } } }`);
    const first = data.orders.nodes[0];
    if (first && !first.email) {
      missing.push(
        "Toegang tot klantgegevens (Protected customer data: naam, e-mail en adres) – zonder dat vindt Yuzu geen orders bij een e-mailadres",
      );
    }
  } catch (e) {
    if (e instanceof ShopifyError && e.kind === "forbidden")
      missing.push("read_orders (orders lezen)");
    else throw e;
  }
  try {
    await api.query(`query YuzuCustomers { customers(first: 1) { nodes { id } } }`);
  } catch (e) {
    if (e instanceof ShopifyError && e.kind === "forbidden")
      missing.push("read_customers (klanten lezen)");
    else throw e;
  }
  return {
    shopName: shop.shop.name,
    primaryDomain: shop.shop.primaryDomain?.url ?? null,
    missing,
  };
}

export function createShopifyClient(
  connection: ShopifyConnection,
  deps: { fetch?: Fetch } = {},
): CommerceClient {
  const api = createShopifyApi(connection, deps);
  return {
    async findOrders(number) {
      const bare = number.replace(/^#/, "");
      if (!/^[\w-]{1,32}$/.test(bare)) return [];
      const data = await api.query<{ orders: { nodes: ShopifyOrder[] } }>(ORDERS_QUERY, {
        query: `name:${quote(`#${bare}`)} OR name:${quote(bare)}`,
        first: 5,
      });
      return data.orders.nodes.map((o) => ({
        number: o.name,
        email: o.email ?? null,
        shopCode: null,
      }));
    },

    async getCustomerContext(
      shopCode,
      email,
      linkedOrderNumbers = [],
    ): Promise<CustomerContext> {
      const numbers = [...new Set(linkedOrderNumbers)].filter((n) =>
        /^#?[\w-]{1,32}$/.test(n),
      );
      const [byEmail, byNumber] = await Promise.all([
        api.query<{ orders: { nodes: ShopifyOrder[] } }>(ORDERS_QUERY, {
          query: `email:${quote(email)}`,
          first: 20,
        }),
        numbers.length
          ? api.query<{ orders: { nodes: ShopifyOrder[] } }>(ORDERS_QUERY, {
              query: numbers
                .flatMap((n) => {
                  const bare = n.replace(/^#/, "");
                  return [`name:${quote(`#${bare}`)}`, `name:${quote(bare)}`];
                })
                .join(" OR "),
              first: numbers.length * 2,
            })
          : Promise.resolve({ orders: { nodes: [] } }),
      ]);
      const seen = new Set<string>();
      const orders = [...byEmail.orders.nodes, ...byNumber.orders.nodes]
        .filter((o) => (seen.has(o.id) ? false : (seen.add(o.id), true)))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return {
        customer: shopifyCustomer(email, orders),
        orders: orders.map((o) =>
          mapShopifyOrder(o, { shopCode, shopDomain: connection.shopDomain }),
        ),
      };
    },
  };
}

/** Alleen voor tests: tokens vergeten. */
export function clearShopifyTokenCache() {
  tokenCache.clear();
}
