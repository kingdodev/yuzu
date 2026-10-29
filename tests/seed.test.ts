import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { aiDrafts, organizations, shops, tickets } from "@/db/schema";
import { DEMO_ORG_SLUG, seedDemo } from "@/db/seed/demo";
import { withPrivileged, withTenant } from "@/db/tenant";
import type { Db } from "@/db/types";
import { createTestDb } from "./helpers/db";

let db: Db;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
  await seedDemo(db);
});
afterAll(async () => close());

describe("demodata", () => {
  it("maakt vier shops en tickets in drie talen", async () => {
    const [org] = await withPrivileged(db, (tx) => tx.select().from(organizations));
    expect(org.slug).toBe(DEMO_ORG_SLUG);

    const { shopRows, ticketRows, drafts } = await withTenant(
      db,
      org.id,
      async ({ tx }) => ({
        shopRows: await tx.select().from(shops),
        ticketRows: await tx.select().from(tickets),
        drafts: await tx.select().from(aiDrafts),
      }),
    );
    expect(shopRows.map((s) => s.code).sort()).toEqual(["be", "es", "fr", "nl"]);
    expect(new Set(ticketRows.map((t) => t.language))).toEqual(
      new Set(["nl", "fr", "es"]),
    );
    expect(ticketRows.map((t) => t.number).sort()).toEqual(
      Array.from({ length: ticketRows.length }, (_, i) => 1001 + i),
    );
    expect(drafts.length).toBeGreaterThan(0);
  });

  it("draait maar één keer", async () => {
    await seedDemo(db);
    const orgs = await withPrivileged(db, (tx) => tx.select().from(organizations));
    expect(orgs).toHaveLength(1);
  });
});
