import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { aiDrafts, organizations, shops, tickets } from "@/db/schema";
import { DEMO_ORG_SLUG, seedDemo, seedMoreDemoTickets } from "@/db/seed/demo";
import { MORE_TICKETS } from "@/db/seed/demo-more";
import { contacts } from "@/db/schema";
import { inArray } from "drizzle-orm";
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
    const [org] = await withPrivileged(db, (tx) => tx.select().from(organizations));
    const count = () =>
      withTenant(db, org.id, async ({ tx }) => (await tx.select().from(tickets)).length);
    const before = await count();
    await seedDemo(db);
    const orgs = await withPrivileged(db, (tx) => tx.select().from(organizations));
    expect(orgs).toHaveLength(1);
    expect(await count()).toBe(before);
  });

  it("vult de extra voorbeeldtickets aan in een bestaande demo", async () => {
    const [org] = await withPrivileged(db, (tx) => tx.select().from(organizations));
    // Alsof de demo van vóór de extra tickets is: haal ze weg.
    const emails = MORE_TICKETS.map((d) => d.contact.email);
    await withTenant(db, org.id, async ({ tx }) => {
      const ids = (
        await tx
          .select({ id: contacts.id })
          .from(contacts)
          .where(inArray(contacts.email, emails))
      ).map((c) => c.id);
      await tx.delete(tickets).where(inArray(tickets.contactId, ids));
      await tx.delete(contacts).where(inArray(contacts.id, ids));
    });
    expect(await seedMoreDemoTickets(db, org.id)).toBe(MORE_TICKETS.length);
    expect(await seedMoreDemoTickets(db, org.id)).toBe(0);
    const statuses = await withTenant(
      db,
      org.id,
      async ({ tx }) => new Set((await tx.select().from(tickets)).map((t) => t.status)),
    );
    expect(statuses).toEqual(
      new Set(["new", "open", "pending_customer", "pending_third_party", "solved"]),
    );
  });
});
