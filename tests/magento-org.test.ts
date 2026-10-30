import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  getIntegration,
  saveIntegration,
  setShopStoreView,
  shopStoreIds,
} from "@/db/repositories/integrations";
import * as s from "@/db/schema";
import { withPrivileged, withTenant } from "@/db/tenant";
import type { Db } from "@/db/types";
import { commerceFor } from "@/integrations/commerce";
import { magentoSecretContext } from "@/integrations/magento";
import { shopifySecretContext } from "@/integrations/shopify";
import { sealSecret } from "@/lib/secrets";
import { createTestDb, seedOrganization } from "./helpers/db";

const KEY = "een-lange-willekeurige-sleutel-voor-tests-1234567890";
const credentials = {
  consumerKey: "ck1234567890abcdef",
  consumerSecret: "cs1234567890abcdef",
  accessToken: "at1234567890abcdef",
  accessTokenSecret: "ats1234567890abcde",
};

let db: Db;
let close: () => Promise<void>;
let a: Awaited<ReturnType<typeof seedOrganization>>;
let b: Awaited<ReturnType<typeof seedOrganization>>;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
  a = await seedOrganization(db, { slug: "mag-a" });
  b = await seedOrganization(db, { slug: "mag-b" });
  process.env.YUZU_ENCRYPTION_KEY = KEY;
});
afterAll(async () => close());
afterEach(() => {
  process.env.YUZU_ENCRYPTION_KEY = KEY;
});

const settings = {
  baseUrl: "https://www.voorbeeldshop.nl",
  restPath: "/rest/V1",
  signatureMethod: "HMAC-SHA256",
  adminUrl: "",
  storeViews: "[]",
};

describe("Magento per organisatie", () => {
  it("zonder koppeling: niet gekoppeld", async () => {
    const access = await withTenant(db, a.org.id, (t) => commerceFor(t, "nl"));
    expect(access.state).toBe("not_configured");
  });

  it("bewaart de sleutels versleuteld en maakt er een client van", async () => {
    await withTenant(db, a.org.id, (t) =>
      saveIntegration(t, "magento", {
        status: "connected",
        settings,
        secrets: sealSecret(credentials, magentoSecretContext(a.org.id)),
        lastError: null,
        checked: true,
      }),
    );
    const [row] = await withPrivileged(db, (tx) =>
      tx.select().from(s.integrations).where(eq(s.integrations.organizationId, a.org.id)),
    );
    expect(row.secrets).not.toContain("cs1234567890abcdef");
    expect(row.lastCheckedAt).toBeInstanceOf(Date);
    const access = await withTenant(db, a.org.id, (t) => commerceFor(t, "nl"));
    expect(access.state).toBe("connected");
  });

  it("andere organisatie ziet de koppeling niet, en gekopieerde sleutels werken daar niet", async () => {
    expect(
      await withTenant(db, b.org.id, (t) => getIntegration(t, "magento")),
    ).toBeNull();

    // Iemand kopieert het versleutelde geheim naar organisatie B.
    const [row] = await withPrivileged(db, (tx) =>
      tx.select().from(s.integrations).where(eq(s.integrations.organizationId, a.org.id)),
    );
    await withTenant(db, b.org.id, (t) =>
      saveIntegration(t, "magento", {
        status: "connected",
        settings,
        secrets: row.secrets,
        lastError: null,
        checked: false,
      }),
    );
    const access = await withTenant(db, b.org.id, (t) => commerceFor(t, "nl"));
    expect(access.state).toBe("error");
  });

  it("zonder de juiste sleutel in de omgeving: nette fout, geen crash", async () => {
    process.env.YUZU_ENCRYPTION_KEY = `${KEY}-anders`;
    const access = await withTenant(db, a.org.id, (t) => commerceFor(t, "nl"));
    expect(access).toMatchObject({ state: "error" });
  });

  it("koppelt een store view aan één shop tegelijk", async () => {
    const [second] = await withPrivileged(db, (tx) =>
      tx
        .insert(s.shops)
        .values({
          organizationId: a.org.id,
          code: "be",
          name: "Shop BE",
          domain: "voorbeeldshop.be",
          language: "nl",
          locale: "nl-BE",
          senderName: "Klantenservice",
          senderEmail: "support@voorbeeldshop.be",
        })
        .returning(),
    );
    await withTenant(db, a.org.id, (t) =>
      setShopStoreView(t, a.shop.id, { id: 1, websiteId: 1 }),
    );
    expect(await withTenant(db, a.org.id, (t) => shopStoreIds(t))).toEqual({
      nl: 1,
      be: null,
    });
    // Dezelfde store view naar de andere shop: de eerste raakt hem kwijt.
    await withTenant(db, a.org.id, (t) =>
      setShopStoreView(t, second.id, { id: 1, websiteId: 1 }),
    );
    expect(await withTenant(db, a.org.id, (t) => shopStoreIds(t))).toEqual({
      nl: null,
      be: 1,
    });
    // Een shop van een andere organisatie kun je niet koppelen.
    await expect(
      withTenant(db, a.org.id, (t) =>
        setShopStoreView(t, b.shop.id, { id: 2, websiteId: 1 }),
      ),
    ).rejects.toThrow(/Onbekende shop/);
  });

  it("kiest per shop: Magento met store view, anders Shopify, anders Magento", async () => {
    // Organisatie A heeft Magento; de "be"-shop heeft store view 1 (vorige test).
    await withTenant(db, a.org.id, (t) =>
      saveIntegration(t, "shopify", {
        status: "connected",
        settings: {
          shopDomain: "voorbeeld.myshopify.com",
          shopCodes: JSON.stringify(["nl"]),
        },
        secrets: sealSecret(
          { mode: "token", accessToken: "shpat_test1234567890" },
          shopifySecretContext(a.org.id),
        ),
        lastError: null,
        checked: true,
      }),
    );
    const pick = (code: string) =>
      withTenant(db, a.org.id, async (t) => {
        const access = await commerceFor(t, code);
        return access.state === "not_configured" ? null : access.platform;
      });
    expect(await pick("be")).toBe("Magento"); // store view gekoppeld
    expect(await pick("nl")).toBe("Shopify"); // gekozen bij Shopify
    expect(await pick("fr")).toBe("Magento"); // niet bij Shopify: Magento voor alles

    // Zonder keuze gebruiken alle shops zonder store view Shopify.
    await withTenant(db, a.org.id, async (t) => {
      const row = await getIntegration(t, "shopify");
      await saveIntegration(t, "shopify", {
        status: "connected",
        settings: { ...row!.settings, shopCodes: "[]" },
        secrets: row!.secrets,
        lastError: null,
        checked: false,
      });
    });
    expect(await pick("fr")).toBe("Shopify");
    expect(await pick("be")).toBe("Magento");
  });

  it("Shopify-sleutels werken niet in een andere organisatie", async () => {
    const shopifyRow = (
      await withPrivileged(db, (tx) => tx.select().from(s.integrations))
    ).find((r) => r.organizationId === a.org.id && r.kind === "shopify");
    await withPrivileged(db, (tx) =>
      tx.delete(s.integrations).where(eq(s.integrations.organizationId, b.org.id)),
    );
    await withTenant(db, b.org.id, (t) =>
      saveIntegration(t, "shopify", {
        status: "connected",
        settings: shopifyRow!.settings as Record<string, string>,
        secrets: shopifyRow!.secrets,
        lastError: null,
        checked: false,
      }),
    );
    const access = await withTenant(db, b.org.id, (t) => commerceFor(t, "nl"));
    expect(access).toMatchObject({ state: "error", platform: "Shopify" });
  });
});
