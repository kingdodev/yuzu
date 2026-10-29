/**
 * Wat Yuzu van Magento gebruikt. De echte REST-koppeling en de demoversie
 * implementeren allebei `MagentoClient`, zodat de rest van de app niet weet
 * welke van de twee draait.
 */

export type MagentoOrderStatus =
  "pending" | "processing" | "complete" | "canceled" | "closed";

export const ORDER_STATUS_LABELS: Record<MagentoOrderStatus, string> = {
  pending: "In afwachting van betaling",
  processing: "In behandeling",
  complete: "Verzonden",
  canceled: "Geannuleerd",
  closed: "Terugbetaald",
};

export type MagentoShipment = {
  carrier: string;
  trackingNumber: string;
  trackingUrl: string;
  shippedAt: Date;
};

export type MagentoOrder = {
  number: string;
  shopCode: string;
  createdAt: Date;
  status: MagentoOrderStatus;
  total: number;
  currency: "EUR";
  paymentMethod: string;
  paid: boolean;
  items: { sku: string; name: string; qty: number; price: number }[];
  shippingAddress: {
    name: string;
    street: string;
    postcode: string;
    city: string;
    country: string;
  };
  shipments: MagentoShipment[];
  invoices: { number: string; createdAt: Date }[];
  creditMemos: { number: string; amount: number; createdAt: Date }[];
  /** Link naar deze order in de Magento-admin. */
  adminUrl: string;
};

export type MagentoCustomer = {
  magentoId: number | null;
  name: string;
  email: string;
  group: "Gast" | "Particulier" | "Zakelijk";
  orderCount: number;
  lifetimeValue: number;
};

export type CustomerContext = {
  customer: MagentoCustomer | null;
  orders: MagentoOrder[];
};

export interface MagentoClient {
  /** Klant en laatste orders bij een e-mailadres, binnen één shop. */
  getCustomerContext(shopCode: string, email: string): Promise<CustomerContext>;
}
