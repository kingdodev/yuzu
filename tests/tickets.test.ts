import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { upsertContact } from "@/db/repositories/contacts";
import {
  changeTicketStatus,
  createTicket,
  InvalidTransitionError,
} from "@/db/repositories/tickets";
import { ticketEvents, tickets } from "@/db/schema";
import { withTenant } from "@/db/tenant";
import type { Db } from "@/db/types";
import {
  canTransition,
  defaultStatusAfterReply,
  onInboundMessage,
} from "@/domain/tickets";
import { createTestDb, seedOrganization } from "./helpers/db";

let db: Db;
let close: () => Promise<void>;
let seed: Awaited<ReturnType<typeof seedOrganization>>;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
  seed = await seedOrganization(db, { slug: "shop" });
});
afterAll(async () => close());

async function newTicket(subject = "Waar blijft mijn bestelling?") {
  return withTenant(db, seed.org.id, async (t) => {
    const contact = await upsertContact(t, { email: "Jan@Example.com", name: "Jan" });
    return createTicket(
      t,
      { shopId: seed.shop.id, contactId: contact.id, subject },
      { type: "system" },
    );
  });
}

describe("ticketnummers", () => {
  it("lopen op per organisatie", async () => {
    const first = await newTicket();
    const second = await newTicket();
    expect(second.number).toBe(first.number + 1);
  });

  it("blijven uniek bij gelijktijdige aanmaak", async () => {
    const created = await Promise.all(Array.from({ length: 5 }, () => newTicket()));
    const numbers = created.map((t) => t.number);
    expect(new Set(numbers).size).toBe(numbers.length);
  });

  it("vullen een leeg onderwerp in", async () => {
    const t = await newTicket("   ");
    expect(t.subject).toBe("(geen onderwerp)");
  });
});

describe("contacten", () => {
  it("worden samengevoegd op genormaliseerd e-mailadres", async () => {
    const [a, b] = await withTenant(db, seed.org.id, async (t) => [
      await upsertContact(t, { email: "  PIET@example.com " }),
      await upsertContact(t, { email: "piet@example.com", name: "Piet" }),
    ]);
    expect(a.id).toBe(b.id);
    expect(b.email).toBe("piet@example.com");
    expect(b.name).toBe("Piet");
  });

  it("overschrijven een bestaande naam niet", async () => {
    const c = await withTenant(db, seed.org.id, async (t) => {
      await upsertContact(t, { email: "kees@example.com", name: "Kees" });
      return upsertContact(t, { email: "kees@example.com", name: "Iemand anders" });
    });
    expect(c.name).toBe("Kees");
  });
});

describe("statuswijzigingen", () => {
  it("leggen elke wijziging vast als event", async () => {
    const ticket = await newTicket();
    await withTenant(db, seed.org.id, async (t) => {
      await changeTicketStatus(t, ticket.id, "open", { type: "system" });
      await changeTicketStatus(t, ticket.id, "solved", { type: "ai" });
    });
    const events = await withTenant(db, seed.org.id, ({ tx }) =>
      tx.select().from(ticketEvents).where(eq(ticketEvents.ticketId, ticket.id)),
    );
    expect(events.map((e) => [e.type, e.fromValue, e.toValue, e.actorType])).toEqual([
      ["created", null, "new", "system"],
      ["status_changed", "new", "open", "system"],
      ["status_changed", "open", "solved", "ai"],
    ]);

    const [row] = await withTenant(db, seed.org.id, ({ tx }) =>
      tx.select().from(tickets).where(eq(tickets.id, ticket.id)),
    );
    expect(row.status).toBe("solved");
    expect(row.solvedAt).toBeInstanceOf(Date);
  });

  it("weigeren ongeldige overgangen", async () => {
    const ticket = await newTicket();
    await expect(
      withTenant(db, seed.org.id, (t) =>
        changeTicketStatus(t, ticket.id, "closed", { type: "system" }),
      ),
    ).rejects.toBeInstanceOf(InvalidTransitionError);
  });

  it("wissen de opgelost-tijd bij heropenen", async () => {
    const ticket = await newTicket();
    await withTenant(db, seed.org.id, async (t) => {
      await changeTicketStatus(t, ticket.id, "solved", { type: "system" });
      await changeTicketStatus(t, ticket.id, "open", { type: "system" });
    });
    const [row] = await withTenant(db, seed.org.id, ({ tx }) =>
      tx.select().from(tickets).where(eq(tickets.id, ticket.id)),
    );
    expect(row.solvedAt).toBeNull();
  });
});

describe("regels voor de levenscyclus", () => {
  it("heropent bij een reactie van de klant", () => {
    expect(onInboundMessage("pending_customer")).toEqual({
      action: "reopen",
      status: "open",
    });
    expect(onInboundMessage("solved")).toEqual({ action: "reopen", status: "open" });
    expect(onInboundMessage("open")).toEqual({ action: "keep", status: "open" });
  });

  it("maakt een nieuw ticket bij een reactie op een gesloten ticket", () => {
    expect(onInboundMessage("closed")).toEqual({ action: "new_ticket" });
  });

  it("zet na een antwoord standaard op wacht op klant", () => {
    expect(defaultStatusAfterReply("open")).toBe("pending_customer");
  });

  it("staat geen terugweg toe vanaf gesloten", () => {
    expect(canTransition("closed", "open")).toBe(false);
  });
});
