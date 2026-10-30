import type { TenantTx } from "@/db/tenant";
import { getIntegration } from "@/db/repositories/integrations";
import { openSecret } from "@/lib/secrets";
import {
  createShopifyClient,
  type ShopifyConnection,
  type ShopifyCredentials,
} from "./api";

export const shopifySecretContext = (organizationId: string) =>
  `shopify:${organizationId}`;

export function shopifyConnectionFrom(
  organizationId: string,
  settings: Record<string, string>,
  secrets: string,
): ShopifyConnection {
  return {
    shopDomain: settings.shopDomain,
    credentials: openSecret<ShopifyCredentials>(
      secrets,
      shopifySecretContext(organizationId),
    ),
  };
}

/** Shopcodes in Yuzu die deze Shopify-winkel gebruiken; leeg = alle shops. */
export function shopifyShopCodes(settings: Record<string, string>): string[] {
  try {
    const codes = JSON.parse(settings.shopCodes ?? "[]");
    return Array.isArray(codes) ? codes.filter((c) => typeof c === "string") : [];
  } catch {
    return [];
  }
}

export async function shopifyRow(t: TenantTx) {
  return getIntegration(t, "shopify");
}

export { createShopifyClient };
