import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { upsertContact } from "@/db/repositories/contacts";
import {
  archiveTickets,
  changeTicketStatus,
  createTicket,
} from "@/db/repositories/tickets";
import { ticketEvents, tickets } from "@/db/schema";
import { withTenant } from "@/db/tenant";
import type { Db } from "@/db/types";
import { canArchive, nextTicketAfter } from "@/domain/tickets";
import { createTestDb, seedOrganization } from "./helpers/db";

let db: Db;
let close: () => Promise<void>;
let seed: Awaited<ReturnType<typeof seedOrganization>>;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
  seed = await seedOrganization(db, { slug: "archief" });
});
afterAll(async () => close());

function newTicket() {
  return withTenant(db, seed.org.id, async (t) => {
    const contact = await upsertContact(t, { email: "klant@example.nl" });
    return createTicket(
      t,
      { shopId: seed.shop.id, contactId: contact.id, subject: "Vraag" },
      { type: "system" },
    );
  });
}

const frank = { type: "system" } as const;

describe("archiveren", () => {
  it("zet nieuwe, open en wachtende tickets op opgelost, met een event", async () => {
    const a = await newTicket();
    const b = await newTicket();
    const c = await newTicket();
    await withTenant(db, seed.org.id, async (t) => {
      await changeTicketStatus(t, b.id, "open", frank);
      await changeTicketStatus(t, c.id, "pending_customer", frank);
    });

    const result = await withTenant(db, seed.org.id, (t) =>
      archiveTickets(t, [a.id, b.id, c.id], frank),
    );
    expect(result.archived).toEqual([a.id, b.id, c.id]);
    expect(result.skipped).toEqual([]);

    const rows = await withTenant(db, seed.org.id, ({ tx }) => tx.select().from(tickets));
    for (const id of [a.id, b.id, c.id]) {
      const row = rows.find((r) => r.id === id)!;
      expect(row.status).toBe("solved");
      expect(row.solvedAt).toBeInstanceOf(Date);
    }

    const events = await withTenant(db, seed.org.id, ({ tx }) =>
      tx.select().from(ticketEvents).where(eq(ticketEvents.ticketId, a.id)),
    );
    expect(events.map((e) => e.toValue)).toContain("solved");
  });

  it("slaat al opgeloste of onbekende tickets over", async () => {
    const a = await newTicket();
    await withTenant(db, seed.org.id, (t) => archiveTickets(t, [a.id], frank));
    const unknown = "00000000-0000-4000-8000-000000000099";
    const result = await withTenant(db, seed.org.id, (t) =>
      archiveTickets(t, [a.id, unknown], frank),
    );
    expect(result.archived).toEqual([]);
    expect(result.skipped).toEqual([a.id, unknown]);
  });

  it("kan geen tickets van een andere organisatie archiveren", async () => {
    const other = await seedOrganization(db, { slug: "ander" });
    const foreign = await withTenant(db, other.org.id, async (t) => {
      const contact = await upsertContact(t, { email: "x@example.nl" });
      return createTicket(
        t,
        { shopId: other.shop.id, contactId: contact.id, subject: "Niet van jou" },
        { type: "system" },
      );
    });
    const result = await withTenant(db, seed.org.id, (t) =>
      archiveTickets(t, [foreign.id], frank),
    );
    expect(result.archived).toEqual([]);
    const [row] = await withTenant(db, other.org.id, ({ tx }) =>
      tx.select().from(tickets).where(eq(tickets.id, foreign.id)),
    );
    expect(row.status).toBe("new");
  });
});

describe("regels", () => {
  it("archiveert niet wat al klaar is", () => {
    expect(canArchive("new")).toBe(true);
    expect(canArchive("pending_third_party")).toBe(true);
    expect(canArchive("solved")).toBe(false);
    expect(canArchive("closed")).toBe(false);
  });

  it("gaat na archiveren naar het volgende ticket, of het vorige als het laatste", () => {
    expect(nextTicketAfter(["a", "b", "c"], "a")).toBe("b");
    expect(nextTicketAfter(["a", "b", "c"], "c")).toBe("b");
    expect(nextTicketAfter(["a"], "a")).toBeNull();
    expect(nextTicketAfter(["a", "b"], "x")).toBe("a");
    expect(nextTicketAfter([], "x")).toBeNull();
  });
});
