/**
 * Van Magento-REST-antwoorden naar Yuzu's eigen ordertype. Pure functies;
 * de HTTP-kant staat in api.ts.
 */
import type {
  MagentoCustomer,
  MagentoOrder,
  MagentoOrderStatus,
  MagentoShipment,
} from "./types";

export type RawAddress = {
  firstname?: string | null;
  lastname?: string | null;
  street?: string[] | null;
  postcode?: string | null;
  city?: string | null;
  country_id?: string | null;
};

export type RawItem = {
  item_id?: number;
  sku?: string;
  name?: string;
  qty_ordered?: number;
  price_incl_tax?: number;
  price?: number;
  parent_item_id?: number | null;
};

export type RawOrder = {
  entity_id: number;
  increment_id: string;
  created_at: string;
  status?: string;
  state?: string;
  grand_total?: number;
  order_currency_code?: string;
  total_due?: number;
  customer_email?: string;
  customer_firstname?: string | null;
  customer_lastname?: string | null;
  customer_is_guest?: number | boolean;
  customer_group_id?: number;
  store_id?: number;
  items?: RawItem[];
  payment?: { method?: string; additional_information?: string[] };
  billing_address?: RawAddress;
  extension_attributes?: {
    shipping_assignments?: { shipping?: { address?: RawAddress } }[];
  };
};

export type RawShipment = {
  order_id: number;
  created_at?: string;
  tracks?: {
    track_number?: string;
    title?: string;
    carrier_code?: string;
    created_at?: string;
  }[];
};

export type RawStoreView = {
  id: number;
  code: string;
  name: string;
  website_id: number;
  is_active?: number | boolean;
};

export type RawStoreConfig = {
  id: number;
  code: string;
  website_id: number;
  locale?: string;
  base_currency_code?: string;
  base_url?: string;
  secure_base_url?: string;
};

export type StoreView = {
  id: number;
  code: string;
  name: string;
  websiteId: number;
  active: boolean;
  url: string | null;
  locale: string | null;
};

/** Magento geeft tijden in UTC zonder tijdzone ("2026-10-27 10:15:33"). */
export function parseMagentoDate(value: string | undefined): Date {
  if (!value) return new Date(0);
  const iso = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)
    ? `${value.replace(" ", "T")}Z`
    : value;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? new Date(0) : d;
}

export function mapStatus(status?: string, state?: string): MagentoOrderStatus {
  const s = (status || state || "").toLowerCase();
  if (["pending", "pending_payment", "new", "payment_review"].includes(s))
    return "pending";
  if (s === "holded" || s === "fraud") return "on_hold";
  if (s === "complete") return "complete";
  if (s === "canceled") return "canceled";
  if (s === "closed") return "closed";
  if (s === "processing") return "processing";
  // Eigen statussen van een shop: val terug op de "state" van Magento.
  if (state && state !== status) return mapStatus(state);
  return "processing";
}

const PAYMENT_NAMES: [RegExp, string][] = [
  [/ideal/i, "iDEAL"],
  [/bancontact|mistercash/i, "Bancontact"],
  [/applepay|apple_pay/i, "Apple Pay"],
  [/googlepay|google_pay/i, "Google Pay"],
  [/paypal/i, "PayPal"],
  [/klarna/i, "Klarna"],
  [/riverty|afterpay/i, "Riverty"],
  [/in3/i, "in3"],
  [/creditcard|credit_card|cc$|braintree|stripe/i, "Creditcard"],
  [/banktransfer|bank_transfer/i, "Bankoverschrijving"],
  [/checkmo/i, "Cheque / postwissel"],
  [/cashondelivery/i, "Rembours"],
  [/^free$/i, "Gratis"],
];

export function paymentName(payment: RawOrder["payment"]): string {
  const code = payment?.method ?? "";
  for (const [re, name] of PAYMENT_NAMES) if (re.test(code)) return name;
  // Veel betaalmodules zetten de titel als eerste extra gegeven.
  const title = payment?.additional_information?.[0];
  if (title && title.length <= 40 && !/[{}[\]<>]/.test(title)) return title;
  return code ? code.replace(/[_-]+/g, " ") : "Onbekend";
}

/** Track & trace-link per vervoerder; null als we de vervoerder niet kennen. */
export function trackingUrl(
  carrier: string,
  number: string,
  postcode?: string | null,
  country?: string | null,
): string | null {
  const c = carrier.toLowerCase();
  const n = encodeURIComponent(number.trim());
  const pc = (postcode ?? "").replace(/\s+/g, "").toUpperCase();
  if (c.includes("postnl")) {
    return pc && country
      ? `https://jouw.postnl.nl/track-and-trace/${n}-${encodeURIComponent(country.toUpperCase())}-${encodeURIComponent(pc)}`
      : `https://jouw.postnl.nl/track-and-trace/${n}`;
  }
  if (c.includes("bpost"))
    return `https://track.bpost.cloud/btr/web/#/search?itemCode=${n}&lang=nl`;
  if (c.includes("dhl"))
    return `https://www.dhl.com/nl-nl/home/tracking.html?tracking-id=${n}`;
  if (c.includes("dpd"))
    return `https://www.dpdgroup.com/nl/mydpd/my-parcels/track?parcelNumber=${n}`;
  if (c.includes("gls")) return `https://gls-group.com/NL/nl/pakket-volgen?match=${n}`;
  if (c.includes("ups")) return `https://www.ups.com/track?tracknum=${n}`;
  if (c.includes("fedex")) return `https://www.fedex.com/fedextrack/?trknbr=${n}`;
  if (c.includes("colissimo") || c.includes("la poste") || c.includes("laposte")) {
    return `https://www.laposte.fr/outils/suivre-vos-envois?code=${n}`;
  }
  if (c.includes("chronopost"))
    return `https://www.chronopost.fr/tracking-no-cms/suivi-page?listeNumerosLT=${n}`;
  if (c.includes("correos")) {
    return `https://www.correos.es/es/es/herramientas/localizador/envios/detalle?tracking-number=${n}`;
  }
  if (c.includes("seur"))
    return `https://www.seur.com/livetracking/?segOnlineIdentificador=${n}`;
  return null;
}

function shippingAddressOf(order: RawOrder): RawAddress {
  return (
    order.extension_attributes?.shipping_assignments?.[0]?.shipping?.address ??
    order.billing_address ??
    {}
  );
}

function fullName(a: { firstname?: string | null; lastname?: string | null }) {
  return [a.firstname, a.lastname].filter(Boolean).join(" ").trim();
}

export function mapOrder(
  order: RawOrder,
  shipments: RawShipment[],
  context: { shopCode: string; adminUrl?: string | null },
): MagentoOrder {
  const address = shippingAddressOf(order);
  const status = mapStatus(order.status, order.state);
  const mappedShipments: MagentoShipment[] = shipments
    .filter((s) => s.order_id === order.entity_id)
    .flatMap((s) =>
      (s.tracks ?? [])
        .filter((t) => t.track_number)
        .map((t) => {
          const carrier = t.title || t.carrier_code || "Vervoerder";
          return {
            carrier,
            trackingNumber: t.track_number!,
            trackingUrl: trackingUrl(
              `${t.carrier_code ?? ""} ${carrier}`,
              t.track_number!,
              address.postcode,
              address.country_id,
            ),
            shippedAt: parseMagentoDate(t.created_at ?? s.created_at),
          };
        }),
    );
  const admin = context.adminUrl?.replace(/\/+$/, "");
  return {
    number: order.increment_id,
    shopCode: context.shopCode,
    createdAt: parseMagentoDate(order.created_at),
    status,
    total: Number(order.grand_total ?? 0),
    currency: order.order_currency_code ?? "EUR",
    paymentMethod: paymentName(order.payment),
    paid:
      status !== "pending" &&
      status !== "canceled" &&
      Number(order.total_due ?? 0) <= 0.005,
    // Configureerbare producten staan er twee keer in (ouder en kind); alleen de ouder tonen.
    items: (order.items ?? [])
      .filter((i) => !i.parent_item_id)
      .map((i, index) => ({
        sku: i.sku ?? `item-${i.item_id ?? index}`,
        name: i.name ?? i.sku ?? "Product",
        qty: Number(i.qty_ordered ?? 1),
        price: Number(i.price_incl_tax ?? i.price ?? 0),
      })),
    shippingAddress: {
      name: fullName(address),
      street: (address.street ?? []).join(" "),
      postcode: address.postcode ?? "",
      city: address.city ?? "",
      country: address.country_id ?? "",
    },
    shipments: mappedShipments,
    invoices: [],
    creditMemos: [],
    adminUrl: admin ? `${admin}/sales/order/view/order_id/${order.entity_id}/` : null,
  };
}

/** Klantgegevens afgeleid uit de orders (zonder extra rechten op klanten in Magento). */
export function customerFromOrders(
  email: string,
  orders: RawOrder[],
): MagentoCustomer | null {
  const own = orders.filter(
    (o) => o.customer_email?.toLowerCase() === email.toLowerCase(),
  );
  if (own.length === 0) return null;
  const latest = [...own].sort(
    (a, b) =>
      parseMagentoDate(b.created_at).getTime() - parseMagentoDate(a.created_at).getTime(),
  )[0];
  const guest = own.every((o) => Boolean(o.customer_is_guest));
  const group: MagentoCustomer["group"] = guest
    ? "Gast"
    : latest.customer_group_id === 2
      ? "Zakelijk"
      : "Particulier";
  const counted = own.filter((o) => mapStatus(o.status, o.state) !== "canceled");
  return {
    magentoId: null,
    name:
      fullName({
        firstname: latest.customer_firstname,
        lastname: latest.customer_lastname,
      }) ||
      fullName(shippingAddressOf(latest)) ||
      email,
    email,
    group,
    orderCount: counted.length,
    lifetimeValue:
      Math.round(counted.reduce((sum, o) => sum + Number(o.grand_total ?? 0), 0) * 100) /
      100,
  };
}

export function mergeStoreViews(
  views: RawStoreView[],
  configs: RawStoreConfig[],
): StoreView[] {
  return views
    .filter((v) => v.id !== 0) // 0 is de beheeromgeving
    .map((v) => {
      const config = configs.find((c) => c.id === v.id);
      return {
        id: v.id,
        code: v.code,
        name: v.name,
        websiteId: v.website_id,
        active: v.is_active === undefined ? true : Boolean(v.is_active),
        url: config?.secure_base_url ?? config?.base_url ?? null,
        locale: config?.locale ?? null,
      };
    })
    .sort((a, b) => a.id - b.id);
}

/** Welke store view hoort bij welke shop, op basis van de domeinnaam. */
export function suggestStoreView(
  shopDomain: string,
  views: StoreView[],
): StoreView | null {
  const want = shopDomain.toLowerCase().replace(/^www\./, "");
  return (
    views.find((v) => {
      if (!v.url) return false;
      try {
        return new URL(v.url).hostname.toLowerCase().replace(/^www\./, "") === want;
      } catch {
        return false;
      }
    }) ?? null
  );
}

/**
 * Het adres van de shop zoals iemand het invult, netjes gemaakt:
 * "www.kingdo.nl/" → "https://www.kingdo.nl". Een geplakt API-adres
 * (…/rest/V1/…) of admin-adres wordt teruggebracht tot de shop zelf.
 */
export function normalizeShopUrl(input: string): string {
  let value = input.trim();
  if (!value) return "";
  if (!/^[a-z]+:\/\//i.test(value)) value = `https://${value}`;
  const url = new URL(value);
  let path = url.pathname.replace(/\/(index\.php\/)?rest(\/.*)?$/i, "");
  path = path.replace(/\/+$/, "");
  return `${url.protocol}//${url.host}${path}`;
}
