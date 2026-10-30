/**
 * De echte Magento-koppeling, via de REST API. Alleen lezen: deze module
 * kent alleen GET-verzoeken (CLAUDE.md, regel 6).
 */
import { assertPublicHttpsUrl } from "@/lib/safe-url";
import {
  customerFromOrders,
  mapOrder,
  mergeStoreViews,
  parseMagentoDate,
  type RawOrder,
  type RawShipment,
  type RawStoreConfig,
  type RawStoreView,
  type StoreView,
} from "./mapping";
import {
  encodeQuery,
  oauthHeader,
  type OAuthCredentials,
  type SignatureMethod,
} from "./oauth";
import type { CustomerContext, MagentoClient } from "./types";

export type MagentoConnection = {
  /** Adres van de shop, bijv. https://www.kingdo.nl (zonder /rest). */
  baseUrl: string;
  credentials: OAuthCredentials;
  signatureMethod: SignatureMethod;
  /** "/rest/V1" of "/index.php/rest/V1", afhankelijk van de installatie. */
  restPath: string;
  /** Adres van de Magento-beheeromgeving, voor links naar orders (optioneel). */
  adminUrl?: string | null;
};

export type MagentoErrorKind =
  "auth" | "forbidden" | "not_found" | "unreachable" | "timeout" | "invalid" | "server";

export class MagentoError extends Error {
  constructor(
    public readonly kind: MagentoErrorKind,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "MagentoError";
  }
}

const TIMEOUT_MS = 10_000;
const MAX_BYTES = 5 * 1024 * 1024;

type Fetch = typeof fetch;
type Resolve = (host: string) => Promise<string[]>;

/** Filters voor Magento's searchCriteria, als querystring-paren. */
export function searchCriteria(input: {
  filters?: { field: string; value: string; condition?: string }[];
  sort?: { field: string; direction: "ASC" | "DESC" };
  pageSize?: number;
}): [string, string][] {
  const q: [string, string][] = [];
  (input.filters ?? []).forEach((f, i) => {
    const p = `searchCriteria[filter_groups][${i}][filters][0]`;
    q.push([`${p}[field]`, f.field], [`${p}[value]`, f.value]);
    q.push([`${p}[condition_type]`, f.condition ?? "eq"]);
  });
  if (input.sort) {
    q.push(["searchCriteria[sortOrders][0][field]", input.sort.field]);
    q.push(["searchCriteria[sortOrders][0][direction]", input.sort.direction]);
  }
  q.push(["searchCriteria[pageSize]", String(input.pageSize ?? 20)]);
  q.push(["searchCriteria[currentPage]", "1"]);
  return q;
}

// Alleen de velden die Yuzu gebruikt (Magento's "fields"-parameter). Een
// volledige order is al snel tientallen kilobytes; dit scheelt veel wachttijd.
const ADDRESS_FIELDS = "firstname,lastname,street,postcode,city,country_id";
export const ORDER_FIELDS =
  "items[entity_id,increment_id,created_at,status,state,grand_total," +
  "order_currency_code,total_due,customer_email,customer_firstname," +
  "customer_lastname,customer_is_guest,customer_group_id,store_id," +
  "items[item_id,sku,name,qty_ordered,price_incl_tax,price,parent_item_id]," +
  `payment[method,additional_information],billing_address[${ADDRESS_FIELDS}],` +
  `extension_attributes[shipping_assignments[shipping[address[${ADDRESS_FIELDS}]]]]]`;
export const SHIPMENT_FIELDS =
  "items[order_id,created_at,tracks[track_number,title,carrier_code,created_at]]";

/** Lage-niveau toegang: één ondertekend GET-verzoek. */
export function createMagentoApi(
  connection: MagentoConnection,
  deps: { fetch?: Fetch; resolve?: Resolve } = {},
) {
  const doFetch = deps.fetch ?? fetch;
  let checked: Promise<URL> | null = null;

  async function get<T>(path: string, query: [string, string][] = []): Promise<T> {
    // Eén keer per client: is het adres (nog steeds) openbaar? (tegen SSRF)
    checked ??= assertPublicHttpsUrl(connection.baseUrl, deps.resolve);
    try {
      await checked;
    } catch (e) {
      throw new MagentoError(
        "invalid",
        e instanceof Error ? e.message : "Ongeldig adres",
      );
    }
    const url = `${connection.baseUrl.replace(/\/+$/, "")}${connection.restPath}/${path}`;
    const authorization = oauthHeader({
      method: "GET",
      url,
      query,
      credentials: connection.credentials,
      signatureMethod: connection.signatureMethod,
    });
    let response: Response;
    try {
      response = await doFetch(query.length ? `${url}?${encodeQuery(query)}` : url, {
        method: "GET",
        headers: { authorization, accept: "application/json" },
        redirect: "manual",
        cache: "no-store",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (e) {
      if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")) {
        throw new MagentoError("timeout", "Magento reageert niet (na 10 seconden).");
      }
      throw new MagentoError("unreachable", "Magento is niet bereikbaar op dit adres.");
    }

    if (response.status >= 300 && response.status < 400) {
      throw new MagentoError(
        "invalid",
        "Dit adres stuurt door naar een ander adres. Vul het adres in waar de shop echt draait (met of zonder www).",
        response.status,
      );
    }
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > MAX_BYTES)
      throw new MagentoError("server", "Antwoord van Magento is te groot.");
    const text = await response.text();
    if (text.length > MAX_BYTES)
      throw new MagentoError("server", "Antwoord van Magento is te groot.");

    let body: unknown;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      if (response.status === 404) {
        throw new MagentoError(
          "not_found",
          "Op dit adres staat geen Magento REST API.",
          404,
        );
      }
      throw new MagentoError(
        "invalid",
        "Dit adres geeft geen Magento-antwoord (geen JSON). Klopt het adres van de shop?",
        response.status,
      );
    }
    if (response.ok) return body as T;

    const message = magentoMessage(body);
    if (response.status === 401) {
      if (/isn't authorized to access|not authorized to access/i.test(message)) {
        throw new MagentoError("forbidden", message, 401);
      }
      throw new MagentoError(
        "auth",
        "Magento accepteert de sleutels niet. Controleer de vier sleutels en of de integratie geactiveerd is.",
        401,
      );
    }
    if (response.status === 403) throw new MagentoError("forbidden", message, 403);
    if (response.status === 404)
      throw new MagentoError("not_found", message || "Niet gevonden", 404);
    throw new MagentoError(
      "server",
      `Magento gaf een fout (${response.status}).`,
      response.status,
    );
  }

  return { get };
}

/** De foutmelding uit een Magento-antwoord, met de %parameters ingevuld. */
function magentoMessage(body: unknown): string {
  if (!body || typeof body !== "object") return "";
  const { message, parameters } = body as { message?: string; parameters?: unknown };
  if (!message) return "";
  if (Array.isArray(parameters)) {
    return parameters.reduce<string>(
      (m, p, i) => m.replace(`%${i + 1}`, String(p)),
      message,
    );
  }
  if (parameters && typeof parameters === "object") {
    return Object.entries(parameters).reduce<string>(
      (m, [k, v]) => m.replace(`%${k}`, String(v)),
      message,
    );
  }
  return message;
}

type ApiDeps = { fetch?: Fetch; resolve?: Resolve };

export type ConnectionCheck = {
  storeViews: StoreView[];
  /** Rechten die ontbreken in de integratie; leeg = alles goed. */
  missing: string[];
};

/**
 * Test de verbinding en de rechten. Leest alleen: winkels, één order en één
 * zending. Rechten die ontbreken, worden teruggegeven in begrijpelijke taal.
 */
export async function checkConnection(
  connection: MagentoConnection,
  deps: ApiDeps = {},
): Promise<ConnectionCheck> {
  const api = createMagentoApi(connection, deps);
  const missing: string[] = [];
  const attempt = async <T>(label: string, fn: () => Promise<T>): Promise<T | null> => {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof MagentoError && e.kind === "forbidden") {
        missing.push(label);
        return null;
      }
      throw e;
    }
  };
  const views = await attempt("Stores → Settings → All Stores", () =>
    api.get<RawStoreView[]>("store/storeViews"),
  );
  const configs = views
    ? ((await attempt("Stores → Settings → All Stores", () =>
        api.get<RawStoreConfig[]>("store/storeConfigs"),
      )) ?? [])
    : [];
  await attempt("Sales → Operations → Orders → Actions → View", () =>
    api.get("orders", searchCriteria({ pageSize: 1 })),
  );
  await attempt("Sales → Operations → Shipments", () =>
    api.get("shipments", searchCriteria({ pageSize: 1 })),
  );
  return {
    storeViews: mergeStoreViews(views ?? [], configs),
    missing: [...new Set(missing)],
  };
}

/** De koppeling zoals de rest van Yuzu hem gebruikt. */
export function createMagentoClient(
  connection: MagentoConnection,
  /** Shopcode in Yuzu → store-ID in Magento (null = alle stores). */
  storeIds: Record<string, number | null>,
  deps: ApiDeps = {},
): MagentoClient {
  const api = createMagentoApi(connection, deps);
  const shopOfStore = new Map(
    Object.entries(storeIds)
      .filter(([, id]) => id !== null)
      .map(([code, id]) => [id as number, code]),
  );
  return {
    async findOrders(number) {
      const value = number.replace(/^#/, "");
      if (!/^[\w-]{1,32}$/.test(value)) return [];
      // Magento-nummers hebben vaak voorloopnullen (000012844); "12844" moet ook werken.
      const candidates = [value];
      if (/^\d{1,8}$/.test(value)) candidates.push(value.padStart(9, "0"));
      const result = await api.get<{ items?: RawOrder[] }>(
        "orders",
        searchCriteria({
          filters: [
            {
              field: "increment_id",
              value: [...new Set(candidates)].join(","),
              condition: "in",
            },
          ],
          pageSize: 5,
        }).concat([["fields", "items[increment_id,customer_email,store_id]"]]),
      );
      return (result.items ?? []).map((o) => ({
        number: o.increment_id,
        email: o.customer_email ?? null,
        shopCode: o.store_id != null ? (shopOfStore.get(o.store_id) ?? null) : null,
      }));
    },

    async getCustomerContext(
      shopCode,
      email,
      linkedOrderNumbers = [],
    ): Promise<CustomerContext> {
      const storeId = storeIds[shopCode] ?? null;
      const numbers = [...new Set(linkedOrderNumbers)].filter((n) =>
        /^[\w-]{1,32}$/.test(n),
      );
      const [byEmail, byNumber] = await Promise.all([
        api.get<{ items?: RawOrder[] }>(
          "orders",
          searchCriteria({
            filters: [{ field: "customer_email", value: email }],
            sort: { field: "created_at", direction: "DESC" },
            pageSize: 20,
          }).concat([["fields", ORDER_FIELDS]]),
        ),
        numbers.length
          ? api.get<{ items?: RawOrder[] }>(
              "orders",
              searchCriteria({
                filters: [
                  { field: "increment_id", value: numbers.join(","), condition: "in" },
                ],
                pageSize: numbers.length,
              }).concat([["fields", ORDER_FIELDS]]),
            )
          : Promise.resolve({ items: [] }),
      ]);
      const seen = new Set<number>();
      const orders = [...(byEmail.items ?? []), ...(byNumber.items ?? [])].filter((o) => {
        if (seen.has(o.entity_id)) return false;
        seen.add(o.entity_id);
        // Alleen orders van deze shop (als de shop aan een store view gekoppeld is).
        return storeId === null || o.store_id === storeId;
      });
      orders.sort(
        (a, b) =>
          parseMagentoDate(b.created_at).getTime() -
          parseMagentoDate(a.created_at).getTime(),
      );

      const shipments = orders.length
        ? ((
            await api.get<{ items?: RawShipment[] }>(
              "shipments",
              searchCriteria({
                filters: [
                  {
                    field: "order_id",
                    value: orders.map((o) => o.entity_id).join(","),
                    condition: "in",
                  },
                ],
                pageSize: 100,
              }).concat([["fields", SHIPMENT_FIELDS]]),
            )
          ).items ?? [])
        : [];

      return {
        customer: customerFromOrders(email, orders),
        orders: orders.map((o) =>
          mapOrder(o, shipments, { shopCode, adminUrl: connection.adminUrl }),
        ),
      };
    },
  };
}
