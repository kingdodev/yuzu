/**
 * Van Shopify Admin GraphQL-antwoorden naar Yuzu's ordertype (hetzelfde type
 * als bij Magento, zodat het ticketpaneel niet hoeft te weten welke shop het is).
 */
import { trackingUrl } from "../magento/mapping";
import type {
  MagentoCustomer as Customer,
  MagentoOrder as Order,
  MagentoOrderStatus as OrderStatus,
} from "../magento/types";

type Money = { amount: string; currencyCode?: string };

export type ShopifyOrder = {
  id: string;
  legacyResourceId: string;
  name: string;
  createdAt: string;
  cancelledAt?: string | null;
  closed?: boolean;
  displayFinancialStatus?: string | null;
  displayFulfillmentStatus?: string | null;
  email?: string | null;
  totalPriceSet?: { shopMoney: Money } | null;
  totalOutstandingSet?: { shopMoney: Money } | null;
  paymentGatewayNames?: string[];
  customer?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    numberOfOrders?: string | number | null;
    amountSpent?: Money | null;
  } | null;
  shippingAddress?: {
    name?: string | null;
    address1?: string | null;
    address2?: string | null;
    zip?: string | null;
    city?: string | null;
    countryCodeV2?: string | null;
  } | null;
  lineItems?: {
    nodes: {
      sku?: string | null;
      name: string;
      quantity: number;
      originalUnitPriceSet?: { shopMoney: Money } | null;
    }[];
  };
  fulfillments?: {
    createdAt: string;
    trackingInfo?: {
      company?: string | null;
      number?: string | null;
      url?: string | null;
    }[];
  }[];
};

/** "kingdo", "kingdo.myshopify.com", een admin-adres… → "kingdo.myshopify.com". */
export function normalizeShopDomain(input: string): string | null {
  const value = input.trim().toLowerCase();
  if (!value) return null;
  const admin = /admin\.shopify\.com\/store\/([a-z0-9][a-z0-9-]*)/.exec(value);
  if (admin) return `${admin[1]}.myshopify.com`;
  const host = value.replace(/^https?:\/\//, "").split(/[/?#]/)[0];
  if (/^[a-z0-9][a-z0-9-]{0,60}\.myshopify\.com$/.test(host)) return host;
  if (/^[a-z0-9][a-z0-9-]{0,60}$/.test(host)) return `${host}.myshopify.com`;
  return null;
}

export function mapShopifyStatus(o: ShopifyOrder): OrderStatus {
  if (o.cancelledAt) return "canceled";
  const financial = (o.displayFinancialStatus ?? "").toUpperCase();
  const fulfillment = (o.displayFulfillmentStatus ?? "").toUpperCase();
  if (financial === "REFUNDED") return "closed";
  if (fulfillment === "ON_HOLD") return "on_hold";
  if (fulfillment === "FULFILLED") return "complete";
  if (["PENDING", "AUTHORIZED", "EXPIRED"].includes(financial)) return "pending";
  return "processing";
}

const GATEWAYS: [RegExp, string][] = [
  [/ideal/i, "iDEAL"],
  [/bancontact/i, "Bancontact"],
  [/shopify_payments|shopify payments/i, "Shopify Payments"],
  [/paypal/i, "PayPal"],
  [/klarna/i, "Klarna"],
  [/mollie/i, "Mollie"],
  [/gift_card/i, "Cadeaubon"],
  [/manual|bank/i, "Handmatig / overboeking"],
];

export function gatewayName(names: string[] | undefined): string {
  const first = names?.[0];
  if (!first) return "Onbekend";
  for (const [re, label] of GATEWAYS) if (re.test(first)) return label;
  return first.replace(/[_-]+/g, " ");
}

const num = (m?: Money | null) => Number(m?.amount ?? 0);

export function mapShopifyOrder(
  o: ShopifyOrder,
  context: { shopCode: string; shopDomain: string },
): Order {
  const status = mapShopifyStatus(o);
  const financial = (o.displayFinancialStatus ?? "").toUpperCase();
  const address = o.shippingAddress ?? {};
  const handle = context.shopDomain.replace(/\.myshopify\.com$/, "");
  return {
    number: o.name,
    shopCode: context.shopCode,
    createdAt: new Date(o.createdAt),
    status,
    total: num(o.totalPriceSet?.shopMoney),
    currency: o.totalPriceSet?.shopMoney.currencyCode ?? "EUR",
    paymentMethod: gatewayName(o.paymentGatewayNames),
    paid:
      ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"].includes(financial) ||
      (financial !== "PENDING" &&
        num(o.totalOutstandingSet?.shopMoney) <= 0.005 &&
        !o.cancelledAt),
    items: (o.lineItems?.nodes ?? []).map((i, index) => ({
      sku: i.sku || `regel-${index + 1}`,
      name: i.name,
      qty: i.quantity,
      price: num(i.originalUnitPriceSet?.shopMoney),
    })),
    shippingAddress: {
      name: address.name ?? "",
      street: [address.address1, address.address2].filter(Boolean).join(" "),
      postcode: address.zip ?? "",
      city: address.city ?? "",
      country: address.countryCodeV2 ?? "",
    },
    shipments: (o.fulfillments ?? []).flatMap((f) =>
      (f.trackingInfo ?? [])
        .filter((t) => t.number)
        .map((t) => ({
          carrier: t.company || "Vervoerder",
          trackingNumber: t.number!,
          trackingUrl:
            t.url && /^https:\/\//i.test(t.url)
              ? t.url
              : trackingUrl(
                  t.company ?? "",
                  t.number!,
                  address.zip,
                  address.countryCodeV2,
                ),
          shippedAt: new Date(f.createdAt),
        })),
    ),
    invoices: [],
    creditMemos: [],
    adminUrl: `https://admin.shopify.com/store/${encodeURIComponent(handle)}/orders/${encodeURIComponent(o.legacyResourceId)}`,
  };
}

export function shopifyCustomer(email: string, orders: ShopifyOrder[]): Customer | null {
  const own = orders.filter((o) => o.email?.toLowerCase() === email.toLowerCase());
  if (own.length === 0) return null;
  const withCustomer = own.find((o) => o.customer);
  const c = withCustomer?.customer;
  const counted = own.filter((o) => !o.cancelledAt);
  return {
    magentoId: null,
    name:
      [c?.firstName, c?.lastName].filter(Boolean).join(" ") ||
      own[0].shippingAddress?.name ||
      email,
    email,
    group: c ? "Particulier" : "Gast",
    orderCount: c?.numberOfOrders != null ? Number(c.numberOfOrders) : counted.length,
    lifetimeValue:
      c?.amountSpent != null
        ? num(c.amountSpent)
        : Math.round(
            counted.reduce((s, o) => s + num(o.totalPriceSet?.shopMoney), 0) * 100,
          ) / 100,
  };
}
