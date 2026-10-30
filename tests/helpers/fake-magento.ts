/**
 * Een nagebootste Magento 2 REST API voor tests: controleert de
 * OAuth-handtekening, de rechten van de integratie en de zoekfilters, en
 * weigert alles behalve GET.
 */
import { oauthHeader, type OAuthCredentials } from "@/integrations/magento/oauth";
import type { RawOrder, RawShipment } from "@/integrations/magento/mapping";

export type FakeMagentoOptions = {
  credentials: OAuthCredentials;
  /** Rechten van de integratie (Magento ACL-resources). */
  resources?: string[];
  restPath?: string;
  orders?: RawOrder[];
  shipments?: RawShipment[];
};

const ALL = [
  "Magento_Backend::store",
  "Magento_Sales::actions_view",
  "Magento_Sales::shipment",
];

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function parseOAuth(header: string | null): Record<string, string> | null {
  if (!header?.startsWith("OAuth ")) return null;
  const out: Record<string, string> = {};
  for (const part of header.slice(6).split(/,\s*/)) {
    const m = /^([^=]+)="([^"]*)"$/.exec(part);
    if (m) out[decodeURIComponent(m[1])] = decodeURIComponent(m[2]);
  }
  return out;
}

/** searchCriteria uit de querystring halen (alleen wat Yuzu gebruikt). */
function criteria(params: URLSearchParams) {
  const filters: { field: string; value: string; condition: string }[] = [];
  for (
    let i = 0;
    params.has(`searchCriteria[filter_groups][${i}][filters][0][field]`);
    i++
  ) {
    const p = `searchCriteria[filter_groups][${i}][filters][0]`;
    filters.push({
      field: params.get(`${p}[field]`)!,
      value: params.get(`${p}[value]`)!,
      condition: params.get(`${p}[condition_type]`) ?? "eq",
    });
  }
  return {
    filters,
    pageSize: Number(params.get("searchCriteria[pageSize]") ?? 20),
    sortDesc: params.get("searchCriteria[sortOrders][0][direction]") === "DESC",
  };
}

function matches(
  row: Record<string, unknown>,
  f: { field: string; value: string; condition: string },
) {
  const v = String(row[f.field] ?? "");
  if (f.condition === "in") return f.value.split(",").includes(v);
  return v.toLowerCase() === f.value.toLowerCase();
}

export function fakeMagento(options: FakeMagentoOptions) {
  const resources = options.resources ?? ALL;
  const restPath = options.restPath ?? "/rest/V1";
  const calls: { method: string; path: string; fields: string | null }[] = [];

  const fetch = async (
    input: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    calls.push({ method, path: url.pathname, fields: url.searchParams.get("fields") });
    if (method !== "GET") return json(405, { message: "Alleen lezen in deze test" });
    if (!url.pathname.startsWith(restPath + "/")) {
      return new Response("<html>Not found</html>", { status: 404 });
    }

    // Handtekening controleren zoals Magento: opnieuw berekenen met dezelfde nonce/tijd.
    const headers = new Headers(init?.headers);
    const oauth = parseOAuth(headers.get("authorization"));
    if (!oauth || oauth.oauth_consumer_key !== options.credentials.consumerKey) {
      return json(401, {
        message: "The consumer isn't authorized to access %resources.",
        parameters: { resources: "self" },
      });
    }
    const query = [...url.searchParams.entries()];
    const expected = parseOAuth(
      oauthHeader({
        method: "GET",
        url: `${url.origin}${url.pathname}`,
        query,
        credentials: options.credentials,
        signatureMethod: oauth.oauth_signature_method as "HMAC-SHA256",
        nonce: oauth.oauth_nonce,
        timestamp: Number(oauth.oauth_timestamp),
      }),
    )!;
    if (expected.oauth_signature !== oauth.oauth_signature) {
      return json(401, { message: "The signature is invalid. Verify and try again." });
    }

    const path = url.pathname.slice(restPath.length + 1);
    const need = path.startsWith("store/")
      ? "Magento_Backend::store"
      : path === "orders"
        ? "Magento_Sales::actions_view"
        : path === "shipments"
          ? "Magento_Sales::shipment"
          : null;
    if (need && !resources.includes(need)) {
      return json(401, {
        message: "The consumer isn't authorized to access %resources.",
        parameters: { resources: need },
      });
    }

    const c = criteria(url.searchParams);
    switch (path) {
      case "store/storeViews":
        return json(200, [
          { id: 0, code: "admin", name: "Admin", website_id: 0 },
          { id: 1, code: "nl", name: "Nederlands", website_id: 1 },
          { id: 2, code: "be", name: "België", website_id: 1 },
          { id: 3, code: "fr", name: "Français", website_id: 2 },
        ]);
      case "store/storeConfigs":
        return json(200, [
          {
            id: 1,
            code: "nl",
            website_id: 1,
            locale: "nl_NL",
            secure_base_url: "https://www.voorbeeldshop.nl/",
          },
          {
            id: 2,
            code: "be",
            website_id: 1,
            locale: "nl_BE",
            secure_base_url: "https://www.voorbeeldshop.be/",
          },
          {
            id: 3,
            code: "fr",
            website_id: 2,
            locale: "fr_FR",
            secure_base_url: "https://www.boutique-exemple.fr/",
          },
        ]);
      case "orders": {
        let items = (options.orders ?? []).filter((o) =>
          c.filters.every((f) => matches(o as unknown as Record<string, unknown>, f)),
        );
        if (c.sortDesc)
          items = [...items].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
        return json(200, {
          items: items.slice(0, c.pageSize),
          total_count: items.length,
        });
      }
      case "shipments": {
        const items = (options.shipments ?? []).filter((s) =>
          c.filters.every((f) => matches(s as unknown as Record<string, unknown>, f)),
        );
        return json(200, {
          items: items.slice(0, c.pageSize),
          total_count: items.length,
        });
      }
      default:
        return json(404, { message: "Request does not match any route." });
    }
  };

  return { fetch: fetch as typeof globalThis.fetch, calls };
}

/** DNS-nabootsing: elke naam wijst naar een openbaar adres. */
export const publicDns = async () => ["93.184.216.34"];
