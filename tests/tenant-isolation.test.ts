import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { upsertContact } from "@/db/repositories/contacts";
import { createTicket } from "@/db/repositories/tickets";
import { contacts, organizations, tickets, TENANT_TABLES } from "@/db/schema";
import { withPrivileged, withTenant } from "@/db/tenant";
import type { Db } from "@/db/types";
import { createTestDb, seedOrganization } from "./helpers/db";
import { expectDbError } from "./helpers/errors";

let db: Db;
let close: () => Promise<void>;
let orgA: Awaited<ReturnType<typeof seedOrganization>>;
let orgB: Awaited<ReturnType<typeof seedOrganization>>;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
  orgA = await seedOrganization(db, { slug: "a" });
  orgB = await seedOrganization(db, { slug: "b" });

  for (const { org, shop } of [orgA, orgB]) {
    await withTenant(db, org.id, async (t) => {
      const contact = await upsertContact(t, { email: `klant@${org.slug}.example` });
      await createTicket(
        t,
        { shopId: shop.id, contactId: contact.id, subject: `Vraag van ${org.slug}` },
        { type: "system" },
      );
    });
  }
});

afterAll(async () => close());

describe("scheiding tussen organisaties", () => {
  it("toont alleen tickets van de eigen organisatie, ook zonder WHERE", async () => {
    const seenByA = await withTenant(db, orgA.org.id, ({ tx }) =>
      tx.select().from(tickets),
    );
    expect(seenByA).toHaveLength(1);
    expect(seenByA[0].subject).toBe("Vraag van a");
  });

  it("toont niets als de organisatie niet bestaat", async () => {
    const seen = await withTenant(
      db,
      "00000000-0000-4000-8000-000000000000",
      ({ tx }) => tx.select().from(contacts),
    );
    expect(seen).toHaveLength(0);
  });

  it("blokkeert schrijven met het organisatie-ID van een ander", async () => {
    await expectDbError(
      withTenant(db, orgA.org.id, ({ tx }) =>
        tx.insert(contacts).values({
          organizationId: orgB.org.id,
          email: "inbreker@example.com",
        }),
      ),
      /row-level security/i,
    );
  });

  it("kan geen rijen van een ander wijzigen", async () => {
    const changed = await withTenant(db, orgA.org.id, ({ tx }) =>
      tx
        .update(tickets)
        .set({ subject: "gekaapt" })
        .where(sql`${tickets.organizationId} = ${orgB.org.id}`)
        .returning(),
    );
    expect(changed).toHaveLength(0);

    const bTickets = await withTenant(db, orgB.org.id, ({ tx }) =>
      tx.select().from(tickets),
    );
    expect(bTickets[0].subject).toBe("Vraag van b");
  });

  it("ziet alleen de eigen organisatie", async () => {
    const orgs = await withTenant(db, orgA.org.id, ({ tx }) =>
      tx.select().from(organizations),
    );
    expect(orgs.map((o) => o.slug)).toEqual(["a"]);
  });

  it("mag het auditlog niet wijzigen of wissen", async () => {
    await expectDbError(
      withTenant(db, orgA.org.id, ({ tx }) =>
        tx.execute(sql`delete from audit_log`),
      ),
      /permission denied/i,
    );
  });

  it("weigert een ongeldig organisatie-ID", async () => {
    await expect(
      withTenant(db, "'; drop table tickets; --", async () => null),
    ).rejects.toThrow(/ongeldig/);
  });
});

describe("beveiliging van het schema", () => {
  it("heeft RLS op elke tabel met een organization_id-kolom", async () => {
    type Row = { table_name: string; rls: boolean };
    const result: unknown = await withPrivileged(db, (tx) =>
      tx.execute(sql`
        select c.table_name, cls.relrowsecurity as rls
        from information_schema.columns c
        join pg_class cls on cls.relname = c.table_name
        where c.table_schema = 'public' and c.column_name = 'organization_id'
        order by c.table_name
      `),
    );
    // PGlite geeft { rows }, postgres.js een array.
    const list = (
      Array.isArray(result) ? result : (result as { rows: Row[] }).rows
    ) as Row[];

    expect(new Set(list.map((r) => r.table_name))).toEqual(new Set(TENANT_TABLES));
    for (const r of list) {
      expect(r.rls, `RLS uit op ${r.table_name}`).toBe(true);
    }
  });
});
