/**
 * Welke webshop hoort bij een shop in Yuzu: Magento, Shopify, de demo, of
 * geen. Het ticketpaneel gebruikt alleen deze module.
 *
 * Volgorde per shop:
 * 1. Magento verbonden én de shop is aan een store view gekoppeld → Magento.
 * 2. Shopify verbonden én de shop hoort bij die winkel (of er is niets
 *    gekozen: dan alle shops) → Shopify.
 * 3. Magento verbonden (shop zonder store view: alle stores) → Magento.
 * 4. Voorbeeldorders (demo) → demo.
 */
import { getIntegration, shopStoreIds } from "@/db/repositories/integrations";
import type { TenantTx } from "@/db/tenant";
import { createMagentoClient, MagentoError } from "./magento/api";
import { demoMagento } from "./magento/demo";
import { connectionFrom as magentoConnectionFrom } from "./magento/index";
import type {
  CustomerContext,
  MagentoClient as CommerceClient,
  OrderMatch,
} from "./magento/types";
import { ShopifyError } from "./shopify/api";
import {
  createShopifyClient,
  shopifyConnectionFrom,
  shopifyShopCodes,
} from "./shopify/index";

export type Platform = "Magento" | "Shopify";

export type CommerceAccess =
  | { state: "connected" | "demo"; platform: Platform; client: CommerceClient }
  | { state: "not_configured" }
  | { state: "error"; platform: Platform; message: string };

const linked = (status?: string) => status === "connected" || status === "error";

export async function commerceFor(
  t: TenantTx,
  shopCode: string,
): Promise<CommerceAccess> {
  const [magento, shopify] = await Promise.all([
    getIntegration(t, "magento"),
    getIntegration(t, "shopify"),
  ]);

  const magentoReady =
    magento && linked(magento.status) && magento.secrets && magento.settings.baseUrl;
  const storeIds = magentoReady ? await shopStoreIds(t) : {};
  const magentoAccess = async (): Promise<CommerceAccess> => {
    try {
      const connection = magentoConnectionFrom(
        t.organizationId,
        magento!.settings,
        magento!.secrets!,
      );
      return {
        state: "connected",
        platform: "Magento",
        client: createMagentoClient(connection, storeIds),
      };
    } catch {
      return {
        state: "error",
        platform: "Magento",
        message:
          "De Magento-sleutels konden niet worden ontsleuteld. Koppel Magento opnieuw.",
      };
    }
  };

  if (magentoReady && storeIds[shopCode] != null) return magentoAccess();

  if (
    shopify &&
    linked(shopify.status) &&
    shopify.secrets &&
    shopify.settings.shopDomain
  ) {
    const codes = shopifyShopCodes(shopify.settings);
    if (codes.length === 0 || codes.includes(shopCode)) {
      try {
        const connection = shopifyConnectionFrom(
          t.organizationId,
          shopify.settings,
          shopify.secrets,
        );
        return {
          state: "connected",
          platform: "Shopify",
          client: createShopifyClient(connection),
        };
      } catch {
        return {
          state: "error",
          platform: "Shopify",
          message:
            "De Shopify-sleutels konden niet worden ontsleuteld. Koppel Shopify opnieuw.",
        };
      }
    }
  }

  if (magentoReady) return magentoAccess();
  if (magento?.status === "demo")
    return { state: "demo", platform: "Magento", client: demoMagento };
  return { state: "not_configured" };
}

/**
 * Alle gekoppelde webshops van de organisatie (voor zoeken op ordernummer).
 * Zonder echte koppeling: de demo, als die aan staat.
 */
export async function commerceClients(
  t: TenantTx,
): Promise<{ platform: Platform; client: CommerceClient }[]> {
  const [magento, shopify] = await Promise.all([
    getIntegration(t, "magento"),
    getIntegration(t, "shopify"),
  ]);
  const out: { platform: Platform; client: CommerceClient }[] = [];
  if (magento && linked(magento.status) && magento.secrets && magento.settings.baseUrl) {
    try {
      const connection = magentoConnectionFrom(
        t.organizationId,
        magento.settings,
        magento.secrets,
      );
      out.push({
        platform: "Magento",
        client: createMagentoClient(connection, await shopStoreIds(t)),
      });
    } catch {
      // Niet te ontsleutelen: overslaan; het ticketpaneel meldt dit al.
    }
  } else if (magento?.status === "demo") {
    out.push({ platform: "Magento", client: demoMagento });
  }
  if (
    shopify &&
    linked(shopify.status) &&
    shopify.secrets &&
    shopify.settings.shopDomain
  ) {
    try {
      const connection = shopifyConnectionFrom(
        t.organizationId,
        shopify.settings,
        shopify.secrets,
      );
      out.push({ platform: "Shopify", client: createShopifyClient(connection) });
    } catch {
      // idem
    }
  }
  return out;
}

export type OrderLookup = {
  matches: (OrderMatch & { platform: Platform })[];
  /** Webshops die niet antwoordden. */
  failed: Platform[];
};

/** Zoek een ordernummer in alle gekoppelde webshops tegelijk. */
export async function lookupOrder(
  clients: { platform: Platform; client: CommerceClient }[],
  number: string,
): Promise<OrderLookup> {
  const results = await Promise.allSettled(
    clients.map(async ({ platform, client }) =>
      (await client.findOrders(number)).map((m) => ({ ...m, platform })),
    ),
  );
  return {
    matches: results.flatMap((r) => (r.status === "fulfilled" ? r.value : [])),
    failed: clients
      .filter((_, i) => results[i].status === "rejected")
      .map((c) => c.platform),
  };
}

// --- Korte cache ----------------------------------------------------------
// Bij heen en weer klikken tussen tickets niet steeds opnieuw naar de shop.
// Alleen in het geheugen van deze serverinstantie, een minuut lang.

const TTL_MS = 60_000;
const MAX_ENTRIES = 200;
const cache = new Map<string, { at: number; value: CustomerContext }>();

export type OrderContextResult =
  | { state: "connected" | "demo"; platform: Platform; context: CustomerContext }
  | { state: "not_configured" }
  | { state: "error"; platform: Platform; message: string };

export async function orderContext(
  organizationId: string,
  access: CommerceAccess,
  shopCode: string,
  email: string,
  linkedOrderNumbers: readonly string[],
): Promise<OrderContextResult> {
  if (access.state === "not_configured" || access.state === "error") return access;
  const key = [
    organizationId,
    access.platform,
    shopCode,
    email,
    [...linkedOrderNumbers].sort().join(","),
  ].join("|");
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) {
    return { state: access.state, platform: access.platform, context: hit.value };
  }
  try {
    const context = await access.client.getCustomerContext(
      shopCode,
      email,
      linkedOrderNumbers,
    );
    cache.set(key, { at: Date.now(), value: context });
    if (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value!);
    return { state: access.state, platform: access.platform, context };
  } catch (e) {
    return {
      state: "error",
      platform: access.platform,
      message:
        e instanceof MagentoError || e instanceof ShopifyError
          ? e.message
          : `Orders konden niet worden opgehaald uit ${access.platform}.`,
    };
  }
}
