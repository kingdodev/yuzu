/**
 * Nagebootste Shopify Admin API voor tests: client credentials-token,
 * GraphQL met rechtencontrole, en weigert mutations.
 */
import type { ShopifyOrder } from "@/integrations/shopify/mapping";

export type FakeShopifyOptions = {
  shopDomain: string;
  clientId?: string;
  clientSecret?: string;
  legacyToken?: string;
  scopes?: string[];
  /** Zonder toegang tot klantgegevens geeft Shopify null voor e-mail. */
  protectedData?: boolean;
  notPermitted?: boolean;
  orders?: ShopifyOrder[];
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

export function fakeShopify(o: FakeShopifyOptions) {
  const scopes = o.scopes ?? ["read_orders", "read_customers"];
  const issued = new Set<string>();
  const calls: { path: string; operation?: string }[] = [];
  let tokenRequests = 0;

  const fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.hostname !== o.shopDomain) return new Response("Not found", { status: 404 });
    if (url.pathname === "/admin/oauth/access_token") {
      tokenRequests++;
      calls.push({ path: url.pathname });
      const form = new URLSearchParams(String(init?.body ?? ""));
      if (o.notPermitted) return json(400, { error: "shop_not_permitted" });
      if (
        form.get("grant_type") !== "client_credentials" ||
        form.get("client_id") !== o.clientId ||
        form.get("client_secret") !== o.clientSecret
      ) {
        return json(400, { error: "invalid_client" });
      }
      const token = `tok_${tokenRequests}`;
      issued.add(token);
      return json(200, {
        access_token: token,
        scope: scopes.join(","),
        expires_in: 86399,
      });
    }
    if (url.pathname !== "/admin/api/2026-07/graphql.json" || init?.method !== "POST") {
      return new Response("Not found", { status: 404 });
    }
    const token = new Headers(init.headers).get("x-shopify-access-token") ?? "";
    if (!issued.has(token) && token !== o.legacyToken) {
      return json(401, {
        errors:
          "[API] Invalid API key or access token (unrecognized login or wrong password)",
      });
    }
    const { query, variables } = JSON.parse(String(init.body)) as {
      query: string;
      variables: { query?: string; first?: number };
    };
    const operation = /query\s+(\w+)/.exec(query)?.[1];
    calls.push({ path: url.pathname, operation });
    if (/^\s*mutation/.test(query)) return json(200, { errors: [{ message: "nee" }] });
    const denied = (scope: string, field: string) =>
      json(200, {
        errors: [
          {
            message: `Access denied for ${field} field. Required access: \`${scope}\` access scope.`,
            extensions: { code: "ACCESS_DENIED" },
          },
        ],
      });
    const visible = (order: ShopifyOrder) =>
      o.protectedData === false ? { ...order, email: null, customer: null } : order;

    switch (operation) {
      case "YuzuShop":
        return json(200, {
          data: {
            shop: {
              name: "Testwinkel",
              primaryDomain: { url: "https://www.testwinkel.nl" },
            },
          },
        });
      case "YuzuCheck":
        if (!scopes.includes("read_orders")) return denied("read_orders", "orders");
        return json(200, {
          data: {
            orders: {
              nodes: (o.orders ?? [])
                .slice(0, 1)
                .map((x) => ({ id: x.id, email: visible(x).email })),
            },
          },
        });
      case "YuzuCustomers":
        if (!scopes.includes("read_customers"))
          return denied("read_customers", "customers");
        return json(200, { data: { customers: { nodes: [] } } });
      case "YuzuOrders": {
        if (!scopes.includes("read_orders")) return denied("read_orders", "orders");
        const q = variables.query ?? "";
        const email = /^email:"([^"]+)"$/.exec(q)?.[1];
        const names = [...q.matchAll(/name:"([^"]+)"/g)].map((m) => m[1]);
        const nodes = (o.orders ?? [])
          .filter((x) => (email ? x.email === email : names.includes(x.name)))
          .map(visible)
          .slice(0, variables.first ?? 20);
        return json(200, { data: { orders: { nodes } } });
      }
      default:
        return json(200, { errors: [{ message: "Onbekende query" }] });
    }
  };
  return {
    fetch: fetch as typeof globalThis.fetch,
    calls,
    tokenRequests: () => tokenRequests,
  };
}
