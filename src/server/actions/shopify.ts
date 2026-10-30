"use server";

import { refresh } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { getIntegration, saveIntegration } from "@/db/repositories/integrations";
import * as s from "@/db/schema";
import type { TenantTx } from "@/db/tenant";
import {
  checkShopify,
  clearShopifyTokenCache,
  ShopifyError,
  type ShopifyCheck,
  type ShopifyConnection,
  type ShopifyCredentials,
} from "@/integrations/shopify/api";
import {
  shopifyConnectionFrom,
  shopifySecretContext,
  shopifyShopCodes,
} from "@/integrations/shopify/index";
import { normalizeShopDomain } from "@/integrations/shopify/mapping";
import { isEncryptionConfigured, sealSecret } from "@/lib/secrets";
import { asOwner, type Session } from "../session";
import type { FormState } from "./admin";

class UserError extends Error {}

function str(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === "string" ? v.trim() : "";
}

async function audit(t: TenantTx, session: Session, action: string, metadata = {}) {
  await t.tx.insert(s.auditLog).values({
    organizationId: t.organizationId,
    actorType: "user",
    actorUserId: session.userId,
    action,
    entityType: "integration",
    entityId: "shopify",
    metadata,
  });
}

function describe(e: unknown): string {
  if (e instanceof ShopifyError || e instanceof UserError) return e.message;
  return "Verbinden met Shopify is mislukt.";
}

function missingMessage(missing: string[]) {
  return missing.length ? `De app mist dit in Shopify: ${missing.join("; ")}.` : null;
}

function settingsFrom(
  connection: ShopifyConnection,
  check: ShopifyCheck,
  shopCodes: string,
): Record<string, string> {
  return {
    shopDomain: connection.shopDomain,
    authMode: connection.credentials.mode,
    shopName: check.shopName,
    primaryDomain: check.primaryDomain ?? "",
    shopCodes,
  };
}

const KEY = /^[A-Za-z0-9_-]{16,256}$/;

/** Uit het formulier: client-ID en -geheim, of een bestaand toegangstoken (shpat_…). */
function credentialsFrom(form: FormData): ShopifyCredentials | null {
  const clientId = str(form, "clientId");
  const clientSecret = str(form, "clientSecret");
  const accessToken = str(form, "accessToken");
  if (!clientId && !clientSecret && !accessToken) return null;
  if (accessToken) {
    if (!/^shp(at|ca|pa)_[A-Za-z0-9]{16,128}$/.test(accessToken)) {
      throw new UserError(
        "Het toegangstoken klopt niet. Het begint met shpat_ en bestaat verder uit letters en cijfers.",
      );
    }
    return { mode: "token", accessToken };
  }
  if (!KEY.test(clientId))
    throw new UserError("De Client ID ontbreekt of klopt niet. Kopieer hem opnieuw.");
  if (!KEY.test(clientSecret))
    throw new UserError(
      "Het Client secret ontbreekt of klopt niet. Kopieer het opnieuw.",
    );
  return { mode: "client_credentials", clientId, clientSecret };
}

/** Koppel Shopify (of wijzig de koppeling): testen, en pas bij succes opslaan. */
export async function connectShopify(_: FormState, form: FormData): Promise<FormState> {
  if (!isEncryptionConfigured()) {
    return {
      ok: false,
      error:
        "Stel eerst YUZU_ENCRYPTION_KEY in bij de hosting (minstens 32 willekeurige tekens); daarmee worden de sleutels versleuteld opgeslagen.",
    };
  }
  const shopDomain = normalizeShopDomain(str(form, "shopDomain"));
  if (!shopDomain) {
    return {
      ok: false,
      error:
        "Vul het myshopify-adres van je winkel in, bijv. jouwwinkel.myshopify.com. Je vindt het in Shopify onder Instellingen → Domeinen.",
    };
  }

  try {
    const result = await asOwner(async (t, session) => {
      const existing = await getIntegration(t, "shopify");
      let connection: ShopifyConnection;
      const given = credentialsFrom(form);
      if (given) {
        connection = { shopDomain, credentials: given };
      } else if (existing?.secrets && existing.settings.shopDomain === shopDomain) {
        // Sleutels leeg gelaten: de bestaande houden.
        try {
          connection = shopifyConnectionFrom(
            t.organizationId,
            existing.settings,
            existing.secrets,
          );
        } catch {
          throw new UserError(
            "De opgeslagen sleutels konden niet worden ontsleuteld. Vul ze opnieuw in.",
          );
        }
      } else {
        throw new UserError("Vul de Client ID en het Client secret van de app in.");
      }

      clearShopifyTokenCache();
      let check: ShopifyCheck;
      try {
        check = await checkShopify(connection);
      } catch (e) {
        throw new UserError(describe(e));
      }
      const lastError = missingMessage(check.missing);
      await saveIntegration(t, "shopify", {
        status: lastError ? "error" : "connected",
        settings: settingsFrom(connection, check, existing?.settings.shopCodes ?? "[]"),
        secrets: sealSecret(
          connection.credentials,
          shopifySecretContext(t.organizationId),
        ),
        lastError,
        checked: true,
      });
      await audit(t, session, "shopify_connected", {
        shop: shopDomain,
        mode: connection.credentials.mode,
        missing: check.missing.length,
      });
      return { lastError, shopName: check.shopName };
    });
    refresh();
    if (result.lastError)
      return { ok: false, error: `Verbonden, maar: ${result.lastError}` };
    return { ok: true, message: `Verbonden met ${result.shopName}.` };
  } catch (e) {
    unstable_rethrow(e);
    if (e instanceof UserError) return { ok: false, error: e.message };
    throw e;
  }
}

/** Test de opgeslagen koppeling opnieuw (bijv. na het aanpassen van rechten). */
export async function retestShopify(): Promise<FormState> {
  const message = await asOwner(async (t) => {
    const row = await getIntegration(t, "shopify");
    if (!row?.secrets || !row.settings.shopDomain)
      return { ok: false as const, error: "Shopify is nog niet gekoppeld." };
    let connection: ShopifyConnection;
    try {
      connection = shopifyConnectionFrom(t.organizationId, row.settings, row.secrets);
    } catch {
      return {
        ok: false as const,
        error: "De sleutels konden niet worden ontsleuteld. Koppel Shopify opnieuw.",
      };
    }
    clearShopifyTokenCache();
    try {
      const check = await checkShopify(connection);
      const lastError = missingMessage(check.missing);
      await saveIntegration(t, "shopify", {
        status: lastError ? "error" : "connected",
        settings: settingsFrom(connection, check, row.settings.shopCodes ?? "[]"),
        lastError,
        checked: true,
      });
      return lastError
        ? { ok: false as const, error: lastError }
        : { ok: true as const, message: "De verbinding werkt." };
    } catch (e) {
      const error = describe(e);
      await saveIntegration(t, "shopify", {
        status: "error",
        settings: row.settings,
        lastError: error,
        checked: true,
      });
      return { ok: false as const, error };
    }
  });
  refresh();
  return message;
}

/** Ontkoppelen: sleutels wissen. */
export async function disconnectShopify(): Promise<void> {
  await asOwner(async (t, session) => {
    await saveIntegration(t, "shopify", {
      status: "not_configured",
      settings: {},
      secrets: null,
      lastError: null,
      checked: false,
    });
    await audit(t, session, "shopify_disconnected");
  });
  clearShopifyTokenCache();
  refresh();
}

/** Welke shops in Yuzu deze Shopify-winkel gebruiken (leeg = alle). */
export async function setShopifyShops(codes: string[]): Promise<FormState> {
  const wanted = z.array(z.string().min(1).max(32)).max(100).parse(codes);
  try {
    await asOwner(async (t, session) => {
      const row = await getIntegration(t, "shopify");
      if (!row?.settings.shopDomain)
        throw new UserError("Shopify is nog niet gekoppeld.");
      const known = new Set(
        (await t.tx.select({ code: s.shops.code }).from(s.shops)).map((r) => r.code),
      );
      const unknown = wanted.filter((c) => !known.has(c));
      if (unknown.length) throw new UserError("Onbekende shop.");
      const unique = [...new Set(wanted)].sort();
      await saveIntegration(t, "shopify", {
        status: row.status,
        settings: { ...row.settings, shopCodes: JSON.stringify(unique) },
        lastError: row.lastError,
        checked: false,
      });
      await audit(t, session, "shopify_shops_changed", {
        before: shopifyShopCodes(row.settings),
        after: unique,
      });
    });
  } catch (e) {
    unstable_rethrow(e);
    return { ok: false, error: e instanceof Error ? e.message : "Opslaan mislukt" };
  }
  refresh();
  return { ok: true, message: "Opgeslagen" };
}
