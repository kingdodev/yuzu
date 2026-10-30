"use server";

import { refresh } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import {
  getIntegration,
  listShopsForMapping,
  saveIntegration,
  setShopStoreView,
} from "@/db/repositories/integrations";
import * as s from "@/db/schema";
import type { TenantTx } from "@/db/tenant";
import {
  checkConnection,
  MagentoError,
  type ConnectionCheck,
  type MagentoConnection,
} from "@/integrations/magento/api";
import { connectionFrom, magentoSecretContext } from "@/integrations/magento/index";
import {
  normalizeShopUrl,
  suggestStoreView,
  type StoreView,
} from "@/integrations/magento/mapping";
import type { OAuthCredentials, SignatureMethod } from "@/integrations/magento/oauth";
import { parsePublicHttpsUrl, UnsafeUrlError } from "@/lib/safe-url";
import { isEncryptionConfigured, openSecret, sealSecret } from "@/lib/secrets";
import { asOwner, type Session } from "../session";
import type { FormState } from "./admin";

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
    entityId: "magento",
    metadata,
  });
}

/**
 * Probeer de verbinding. Magento-installaties verschillen: soms werkt alleen
 * HMAC-SHA1, soms staat de API onder /index.php/rest. Probeer die varianten,
 * en onthoud wat werkt.
 */
async function tryConnect(
  base: Omit<MagentoConnection, "signatureMethod" | "restPath">,
): Promise<{ connection: MagentoConnection; check: ConnectionCheck }> {
  let lastError: unknown;
  for (const restPath of ["/rest/V1", "/index.php/rest/V1"]) {
    for (const signatureMethod of ["HMAC-SHA256", "HMAC-SHA1"] as SignatureMethod[]) {
      const connection = { ...base, restPath, signatureMethod };
      try {
        return { connection, check: await checkConnection(connection) };
      } catch (e) {
        lastError = e;
        if (!(e instanceof MagentoError)) throw e;
        if (e.kind === "auth") continue; // andere handtekeningmethode proberen
        if (e.kind === "not_found") break; // ander pad proberen
        throw e; // onbereikbaar, time-out, ongeldig adres: proberen heeft geen zin
      }
    }
  }
  throw lastError;
}

function describe(e: unknown): string {
  if (e instanceof MagentoError || e instanceof UnsafeUrlError) return e.message;
  return "Verbinden met Magento is mislukt.";
}

function settingsFrom(
  connection: MagentoConnection,
  storeViews: StoreView[],
): Record<string, string> {
  return {
    baseUrl: connection.baseUrl,
    adminUrl: connection.adminUrl ?? "",
    restPath: connection.restPath,
    signatureMethod: connection.signatureMethod,
    storeViews: JSON.stringify(storeViews),
  };
}

function missingMessage(missing: string[]) {
  return missing.length
    ? `De integratie mist deze rechten in Magento: ${missing.join("; ")}.`
    : null;
}

/** Koppel Magento (of wijzig de koppeling): testen, en pas bij succes opslaan. */
export async function connectMagento(_: FormState, form: FormData): Promise<FormState> {
  if (!isEncryptionConfigured()) {
    return {
      ok: false,
      error:
        "Stel eerst YUZU_ENCRYPTION_KEY in bij de hosting (minstens 32 willekeurige tekens); daarmee worden de sleutels versleuteld opgeslagen.",
    };
  }
  let baseUrl: string;
  let adminUrl: string | null;
  try {
    baseUrl = parsePublicHttpsUrl(normalizeShopUrl(str(form, "baseUrl")))
      .toString()
      .replace(/\/+$/, "");
    const admin = str(form, "adminUrl");
    adminUrl = admin ? parsePublicHttpsUrl(admin).toString().replace(/\/+$/, "") : null;
  } catch (e) {
    return { ok: false, error: describe(e) };
  }

  const fields = {
    consumerKey: str(form, "consumerKey"),
    consumerSecret: str(form, "consumerSecret"),
    accessToken: str(form, "accessToken"),
    accessTokenSecret: str(form, "accessTokenSecret"),
  };
  const valid = z.string().regex(/^[A-Za-z0-9]{16,128}$/);

  try {
    const result = await asOwner(async (t, session) => {
      // Leeg gelaten sleutels: de bestaande houden (bij wijzigen van het adres).
      const existing = await getIntegration(t, "magento");
      let credentials: OAuthCredentials;
      const anyGiven = Object.values(fields).some(Boolean);
      if (!anyGiven && existing?.secrets) {
        credentials = openSecret<OAuthCredentials>(
          existing.secrets,
          magentoSecretContext(t.organizationId),
        );
      } else {
        for (const [key, value] of Object.entries(fields)) {
          if (!valid.safeParse(value).success) {
            throw new UserError(
              `${LABELS[key as keyof typeof LABELS]} ontbreekt of klopt niet. Kopieer hem opnieuw uit Magento (alleen letters en cijfers).`,
            );
          }
        }
        credentials = fields;
      }

      let connected: Awaited<ReturnType<typeof tryConnect>>;
      try {
        connected = await tryConnect({ baseUrl, adminUrl, credentials });
      } catch (e) {
        throw new UserError(describe(e));
      }
      const { connection, check } = connected;
      const lastError = missingMessage(check.missing);
      await saveIntegration(t, "magento", {
        status: lastError ? "error" : "connected",
        settings: settingsFrom(connection, check.storeViews),
        secrets: sealSecret(credentials, magentoSecretContext(t.organizationId)),
        lastError,
        checked: true,
      });

      // Shops zonder store view koppelen als de domeinnaam overeenkomt.
      const shops = await listShopsForMapping(t);
      let mapped = 0;
      for (const shop of shops) {
        if (shop.storeId !== null) continue;
        const view = suggestStoreView(shop.domain, check.storeViews);
        if (view && !shops.some((x) => x.storeId === view.id)) {
          await setShopStoreView(t, shop.id, view);
          shop.storeId = view.id;
          mapped++;
        }
      }
      await audit(t, session, "magento_connected", {
        host: new URL(baseUrl).host,
        storeViews: check.storeViews.length,
        missing: check.missing.length,
      });
      return { lastError, views: check.storeViews.length, mapped };
    });
    refresh();
    if (result.lastError)
      return { ok: false, error: `Verbonden, maar: ${result.lastError}` };
    return {
      ok: true,
      message: `Verbonden. ${result.views} store views gevonden${result.mapped ? `, ${result.mapped} automatisch aan een shop gekoppeld` : ""}.`,
    };
  } catch (e) {
    if (e instanceof UserError) return { ok: false, error: e.message };
    throw e;
  }
}

const LABELS = {
  consumerKey: "Consumer Key",
  consumerSecret: "Consumer Secret",
  accessToken: "Access Token",
  accessTokenSecret: "Access Token Secret",
};

class UserError extends Error {}

/** Test de opgeslagen koppeling opnieuw (bijv. na het aanpassen van rechten in Magento). */
export async function retestMagento(): Promise<FormState> {
  const message = await asOwner(async (t) => {
    const row = await getIntegration(t, "magento");
    if (!row?.secrets || !row.settings.baseUrl)
      return { ok: false as const, error: "Magento is nog niet gekoppeld." };
    let connection: MagentoConnection;
    try {
      connection = connectionFrom(t.organizationId, row.settings, row.secrets);
    } catch {
      return {
        ok: false as const,
        error: "De sleutels konden niet worden ontsleuteld. Koppel Magento opnieuw.",
      };
    }
    try {
      const check = await checkConnection(connection);
      const lastError = missingMessage(check.missing);
      await saveIntegration(t, "magento", {
        status: lastError ? "error" : "connected",
        settings: settingsFrom(connection, check.storeViews),
        lastError,
        checked: true,
      });
      return lastError
        ? { ok: false as const, error: lastError }
        : { ok: true as const, message: "De verbinding werkt." };
    } catch (e) {
      const error = describe(e);
      await saveIntegration(t, "magento", {
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

/** Ontkoppelen: sleutels wissen. De koppeling van shops aan store views blijft staan. */
export async function disconnectMagento(): Promise<void> {
  await asOwner(async (t, session) => {
    await saveIntegration(t, "magento", {
      status: "not_configured",
      settings: {},
      secrets: null,
      lastError: null,
      checked: false,
    });
    await audit(t, session, "magento_disconnected");
  });
  refresh();
}

/** Koppel een shop aan een store view uit Magento (of los). */
export async function mapShopToStoreView(
  shopId: string,
  storeViewId: number | null,
): Promise<FormState> {
  const id = z.string().uuid().parse(shopId);
  const viewId =
    storeViewId === null ? null : z.number().int().positive().parse(storeViewId);
  try {
    await asOwner(async (t, session) => {
      const row = await getIntegration(t, "magento");
      const views: StoreView[] = row?.settings.storeViews
        ? JSON.parse(row.settings.storeViews)
        : [];
      const view = viewId === null ? null : views.find((v) => v.id === viewId);
      if (viewId !== null && !view)
        throw new UserError("Deze store view bestaat niet (meer) in Magento.");
      await setShopStoreView(
        t,
        id,
        view ? { id: view.id, websiteId: view.websiteId } : null,
      );
      await audit(t, session, "magento_store_view_mapped", {
        shopId: id,
        storeViewId: viewId,
      });
    });
  } catch (e) {
    unstable_rethrow(e); // redirect() van asOwner niet opvangen
    return { ok: false, error: e instanceof Error ? e.message : "Opslaan mislukt" };
  }
  refresh();
  return { ok: true, message: "Opgeslagen" };
}
