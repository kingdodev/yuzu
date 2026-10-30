/** Opgeslagen Magento-koppeling van een organisatie → verbinding (zie ../commerce.ts). */
import { openSecret } from "@/lib/secrets";
import type { MagentoConnection } from "./api";
import type { OAuthCredentials, SignatureMethod } from "./oauth";

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
