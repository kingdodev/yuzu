/**
 * Welke Magento-koppeling hoort bij een organisatie: de echte (met de
 * versleutelde sleutels uit de database), de nagebootste demo, of geen.
 */
import { getIntegration, shopStoreIds } from "@/db/repositories/integrations";
import type { TenantTx } from "@/db/tenant";
import { openSecret } from "@/lib/secrets";
import { createMagentoClient, MagentoError, type MagentoConnection } from "./api";
import { demoMagento } from "./demo";
import type { OAuthCredentials, SignatureMethod } from "./oauth";
import type { CustomerContext, MagentoClient } from "./types";

export type MagentoAccess =
  | { state: "connected"; client: MagentoClient }
  | { state: "demo"; client: MagentoClient }
  | { state: "not_configured" }
  | { state: "error"; message: string };

export const magentoSecretContext = (organizationId: string) =>
  `magento:${organizationId}`;

/** De verbinding uit de opgeslagen instellingen en (ontsleutelde) sleutels. */
export function connectionFrom(
  organizationId: string,
  settings: Record<string, string>,
  secrets: string,
): MagentoConnection {
  return {
    baseUrl: settings.baseUrl,
    restPath: settings.restPath || "/rest/V1",
    signatureMethod: (settings.signatureMethod as SignatureMethod) || "HMAC-SHA256",
    adminUrl: settings.adminUrl || null,
    credentials: openSecret<OAuthCredentials>(
      secrets,
      magentoSecretContext(organizationId),
    ),
  };
}

export async function magentoFor(t: TenantTx): Promise<MagentoAccess> {
  const row = await getIntegration(t, "magento");
  if (!row || row.status === "not_configured") return { state: "not_configured" };
  if (row.status === "demo") return { state: "demo", client: demoMagento };
  if (!row.secrets || !row.settings.baseUrl) return { state: "not_configured" };
  let connection: MagentoConnection;
  try {
    connection = connectionFrom(t.organizationId, row.settings, row.secrets);
  } catch {
    return {
      state: "error",
      message:
        "De Magento-sleutels konden niet worden ontsleuteld. Koppel Magento opnieuw.",
    };
  }
  return {
    state: "connected",
    client: createMagentoClient(connection, await shopStoreIds(t)),
  };
}

// --- Korte cache ----------------------------------------------------------
// Bij heen en weer klikken tussen tickets niet steeds opnieuw naar Magento.
// Alleen in het geheugen van deze serverinstantie, een minuut lang.

const TTL_MS = 60_000;
const MAX_ENTRIES = 200;
const cache = new Map<string, { at: number; value: CustomerContext }>();

export async function customerContext(
  organizationId: string,
  access: MagentoAccess,
  shopCode: string,
  email: string,
  linkedOrderNumbers: readonly string[],
): Promise<
  | { state: "connected" | "demo"; context: CustomerContext }
  | { state: "not_configured" }
  | { state: "error"; message: string }
> {
  if (access.state === "not_configured" || access.state === "error") return access;
  const key = [
    organizationId,
    shopCode,
    email,
    [...linkedOrderNumbers].sort().join(","),
  ].join("|");
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS)
    return { state: access.state, context: hit.value };
  try {
    const context = await access.client.getCustomerContext(
      shopCode,
      email,
      linkedOrderNumbers,
    );
    cache.set(key, { at: Date.now(), value: context });
    if (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value!);
    return { state: access.state, context };
  } catch (e) {
    return {
      state: "error",
      message:
        e instanceof MagentoError
          ? e.message
          : "Orders konden niet worden opgehaald uit Magento.",
    };
  }
}
