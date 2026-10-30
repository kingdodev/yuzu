import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { upsertContact } from "@/db/repositories/contacts";
import {
  addTagToTickets,
  assignTickets,
  changeTicketStatus,
  changeTicketStatuses,
  createTicket,
  InvalidAssigneeError,
} from "@/db/repositories/tickets";
import * as s from "@/db/schema";
import { withPrivileged, withTenant } from "@/db/tenant";
import type { Db } from "@/db/types";
import { createTestDb, seedOrganization } from "./helpers/db";

let db: Db;
let close: () => Promise<void>;
let org: Awaited<ReturnType<typeof seedOrganization>>;
let other: Awaited<ReturnType<typeof seedOrganization>>;
const frank = randomUUID();
const lezer = randomUUID();
const vreemde = randomUUID();
const actor = { type: "user", userId: frank } as const;

async function newTicket(o: typeof org) {
  return withTenant(db, o.org.id, async (t) => {
    const contact = await upsertContact(t, { email: `klant-${randomUUID()}@example.nl` });
    return createTicket(
      t,
      { shopId: o.shop.id, contactId: contact.id, subject: "Vraag" },
      { type: "system" },
    );
  });
}

beforeAll(async () => {
  ({ db, close } = await createTestDb());
  org = await seedOrganization(db, { slug: "bulk" });
  other = await seedOrganization(db, { slug: "bulk-ander" });
  await withPrivileged(db, async (tx) => {
    await tx.insert(s.users).values([
      { id: frank, email: "frank@example.nl", name: "Frank" },
      { id: lezer, email: "lezer@example.nl", name: "Lezer" },
      { id: vreemde, email: "vreemd@example.nl", name: "Vreemde" },
    ]);
    await tx.insert(s.memberships).values([
      { organizationId: org.org.id, userId: frank, role: "owner" },
      { organizationId: org.org.id, userId: lezer, role: "viewer" },
      { organizationId: other.org.id, userId: vreemde, role: "agent" },
    ]);
  });
});
afterAll(async () => close());

describe("meerdere tickets toewijzen", () => {
  it("wijst toe, met een event per ticket, en slaat over wat al klopt", async () => {
    const a = await newTicket(org);
    const b = await newTicket(org);
    await withTenant(db, org.org.id, (t) => assignTickets(t, [a.id], frank, actor));

    const result = await withTenant(db, org.org.id, (t) =>
      assignTickets(t, [a.id, b.id], frank, actor),
    );
    expect(result).toEqual({ changed: [b.id], unchanged: [a.id] });

    const events = await withTenant(db, org.org.id, ({ tx }) =>
      tx
        .select()
        .from(s.ticketEvents)
        .where(
          and(eq(s.ticketEvents.ticketId, b.id), eq(s.ticketEvents.type, "assigned")),
        ),
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ toValue: frank, actorUserId: frank });

    const cleared = await withTenant(db, org.org.id, (t) =>
      assignTickets(t, [a.id, b.id], null, actor),
    );
    expect(cleared.changed).toEqual([a.id, b.id]);
  });

  it("niet aan iemand van een andere organisatie of een meekijker", async () => {
    const a = await newTicket(org);
    await expect(
      withTenant(db, org.org.id, (t) => assignTickets(t, [a.id], vreemde, actor)),
    ).rejects.toThrow(InvalidAssigneeError);
    await expect(
      withTenant(db, org.org.id, (t) => assignTickets(t, [a.id], lezer, actor)),
    ).rejects.toThrow(InvalidAssigneeError);
  });

  it("raakt geen tickets van een andere organisatie", async () => {
    const foreign = await newTicket(other);
    const result = await withTenant(db, org.org.id, (t) =>
      assignTickets(t, [foreign.id], frank, actor),
    );
    expect(result.changed).toEqual([]);
  });
});

describe("meerdere tickets een status geven", () => {
  it("wijzigt wat mag en slaat de rest over", async () => {
    const a = await newTicket(org);
    const b = await newTicket(org);
    await withTenant(db, org.org.id, async (t) => {
      await changeTicketStatus(t, b.id, "solved", actor);
      await changeTicketStatus(t, b.id, "closed", actor);
    });
    const result = await withTenant(db, org.org.id, (t) =>
      changeTicketStatuses(t, [a.id, b.id], "pending_customer", actor),
    );
    expect(result).toEqual({ changed: [a.id], skipped: [b.id] });

    const again = await withTenant(db, org.org.id, (t) =>
      changeTicketStatuses(t, [a.id], "pending_customer", actor),
    );
    expect(again.skipped).toEqual([a.id]);
  });
});

describe("meerdere tickets een label geven", () => {
  it("voegt het label één keer toe", async () => {
    const a = await newTicket(org);
    const b = await newTicket(org);
    const [tag] = await withTenant(db, org.org.id, ({ tx, organizationId }) =>
      tx.insert(s.tags).values({ organizationId, name: "Retour" }).returning(),
    );
    const first = await withTenant(db, org.org.id, (t) =>
      addTagToTickets(t, [a.id], tag.id),
    );
    expect(first.added).toBe(1);
    const second = await withTenant(db, org.org.id, (t) =>
      addTagToTickets(t, [a.id, b.id], tag.id),
    );
    expect(second).toMatchObject({ added: 1, tag: { name: "Retour" } });
  });

  it("niet met een label of op tickets van een andere organisatie", async () => {
    const mine = await newTicket(org);
    const foreign = await newTicket(other);
    const [foreignTag] = await withTenant(db, other.org.id, ({ tx, organizationId }) =>
      tx.insert(s.tags).values({ organizationId, name: "Geheim" }).returning(),
    );
    await expect(
      withTenant(db, org.org.id, (t) => addTagToTickets(t, [mine.id], foreignTag.id)),
    ).rejects.toThrow(/bestaat niet/);

    const [myTag] = await withTenant(db, org.org.id, ({ tx, organizationId }) =>
      tx.insert(s.tags).values({ organizationId, name: "Zakelijk" }).returning(),
    );
    const result = await withTenant(db, org.org.id, (t) =>
      addTagToTickets(t, [foreign.id], myTag.id),
    );
    expect(result.added).toBe(0);
  });
});
