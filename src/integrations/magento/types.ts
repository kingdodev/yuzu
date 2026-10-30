/**
 * Wat Yuzu van Magento gebruikt. De echte REST-koppeling en de demoversie
 * implementeren allebei `MagentoClient`, zodat de rest van de app niet weet
 * welke van de twee draait.
 */

export type MagentoOrderStatus =
  "pending" | "processing" | "on_hold" | "complete" | "canceled" | "closed";

export const ORDER_STATUS_LABELS: Record<MagentoOrderStatus, string> = {
  pending: "In afwachting van betaling",
  processing: "In behandeling",
  on_hold: "In de wacht",
  complete: "Verzonden",
  canceled: "Geannuleerd",
  closed: "Terugbetaald",
};

export type MagentoShipment = {
  carrier: string;
  trackingNumber: string;
  /** Null als we de vervoerder niet kennen; dan tonen we alleen het nummer. */
  trackingUrl: string | null;
  shippedAt: Date;
};

export type MagentoOrder = {
  number: string;
  shopCode: string;
  createdAt: Date;
  status: MagentoOrderStatus;
  total: number;
  currency: string;
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
  /** Link naar deze order in de Magento-admin, als die bekend is. */
  adminUrl: string | null;
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

/** Een order gevonden op nummer: van wie is hij? */
export type OrderMatch = {
  number: string;
  email: string | null;
  /** Shop in Yuzu, als die bekend is. */
  shopCode: string | null;
};

export interface MagentoClient {
  /** Orders met dit nummer (voor zoeken). Leeg als er geen is. */
  findOrders(number: string): Promise<OrderMatch[]>;

  /**
   * Klant en laatste orders bij een e-mailadres, binnen één shop. Orders die
   * aan het ticket gekoppeld zijn (bijv. een ordernummer uit de mail) komen
   * er ook bij, ook als de klant met een ander adres besteld heeft.
   */
  getCustomerContext(
    shopCode: string,
    email: string,
    linkedOrderNumbers?: readonly string[],
  ): Promise<CustomerContext>;
}
