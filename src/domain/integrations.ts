/**
 * De koppelingen die Yuzu kent. Een nieuwe koppeling toevoegen: zet hem hier
 * in de lijst en maak een detailscherm (src/components/admin/integrations/).
 */

export type IntegrationKind = "magento" | "shopify" | "mailgun" | "ai";
export type IntegrationStatus = "not_configured" | "connected" | "error" | "demo";

export type IntegrationInfo = {
  kind: IntegrationKind;
  name: string;
  category: string;
  description: string;
  /** Kan een organisatie hem zelf aansluiten? Anders: binnenkort. */
  available: boolean;
};

export const INTEGRATIONS: IntegrationInfo[] = [
  {
    kind: "magento",
    name: "Magento 2",
    category: "Webshop",
    description: "Orders, betalingen en track & trace bij elk ticket. Alleen lezen.",
    available: true,
  },
  {
    kind: "shopify",
    name: "Shopify",
    category: "Webshop",
    description: "Orders, betalingen en track & trace bij elk ticket. Alleen lezen.",
    available: true,
  },
  {
    kind: "mailgun",
    name: "E-mail via Mailgun",
    category: "E-mail",
    description:
      "Klantmail van je shops komt binnen als ticket; antwoorden gaan vanaf het adres van de shop.",
    available: false,
  },
  {
    kind: "ai",
    name: "AI-model (Claude)",
    category: "AI",
    description: "Conceptantwoorden en vertalingen, via AWS Bedrock in de EU.",
    available: false,
  },
];

export function integrationInfo(kind: string): IntegrationInfo | null {
  return INTEGRATIONS.find((i) => i.kind === kind) ?? null;
}

/** Actief = echt aangesloten (ook als de laatste test een probleem gaf). */
export function isActive(status: IntegrationStatus): boolean {
  return status === "connected" || status === "error";
}

export const STATUS_LABELS: Record<IntegrationStatus, string> = {
  connected: "Verbonden",
  error: "Probleem",
  demo: "Demo",
  not_configured: "Niet gekoppeld",
};
