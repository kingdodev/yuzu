import { and, asc, eq, sql } from "drizzle-orm";
import type { IntegrationKind, IntegrationStatus } from "@/domain/integrations";
import { integrations, shops } from "../schema";
import type { TenantTx } from "../tenant";

export type { IntegrationKind, IntegrationStatus };

export async function getIntegration(t: TenantTx, kind: IntegrationKind) {
  const [row] = await t.tx.select().from(integrations).where(eq(integrations.kind, kind));
  return row ?? null;
}

export async function saveIntegration(
  t: TenantTx,
  kind: IntegrationKind,
  values: {
    status: IntegrationStatus;
    settings: Record<string, string>;
    /** undefined = ongewijzigd laten, null = wissen. */
    secrets?: string | null;
    lastError: string | null;
    checked: boolean;
  },
) {
  const set = {
    status: values.status,
    settings: values.settings,
    lastError: values.lastError,
    updatedAt: sql`now()`,
    ...(values.secrets !== undefined ? { secrets: values.secrets } : {}),
    ...(values.checked ? { lastCheckedAt: sql`now()` } : {}),
  };
  await t.tx
    .insert(integrations)
    .values({
      organizationId: t.organizationId,
      kind,
      status: values.status,
      settings: values.settings,
      secrets: values.secrets ?? null,
      lastError: values.lastError,
      lastCheckedAt: values.checked ? new Date() : null,
    })
    .onConflictDoUpdate({
      target: [integrations.organizationId, integrations.kind],
      set,
    });
}

/** Shopcode → Magento store-ID (null = niet gekoppeld). */
export async function shopStoreIds(t: TenantTx): Promise<Record<string, number | null>> {
  const rows = await t.tx
    .select({ code: shops.code, storeId: shops.magentoStoreId })
    .from(shops);
  return Object.fromEntries(rows.map((r) => [r.code, r.storeId]));
}

export async function listShopsForMapping(t: TenantTx) {
  return t.tx
    .select({
      id: shops.id,
      code: shops.code,
      name: shops.name,
      domain: shops.domain,
      storeId: shops.magentoStoreId,
    })
    .from(shops)
    .orderBy(sql`${shops.magentoStoreId} nulls last`, asc(shops.name));
}

/** Koppel een shop aan een store view (of los: null). Eén store view hoort bij één shop. */
export async function setShopStoreView(
  t: TenantTx,
  shopId: string,
  view: { id: number; websiteId: number } | null,
) {
  if (view) {
    await t.tx
      .update(shops)
      .set({ magentoStoreId: null, magentoWebsiteId: null })
      .where(and(eq(shops.magentoStoreId, view.id), sql`${shops.id} <> ${shopId}`));
  }
  const updated = await t.tx
    .update(shops)
    .set({ magentoStoreId: view?.id ?? null, magentoWebsiteId: view?.websiteId ?? null })
    .where(eq(shops.id, shopId))
    .returning({ id: shops.id });
  if (updated.length === 0) throw new Error("Onbekende shop");
}
