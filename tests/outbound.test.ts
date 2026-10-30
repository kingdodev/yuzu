import { randomUUID } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPendingAttachment } from "@/db/repositories/attachments";
import { ShopNotFoundError, startOutboundTicket } from "@/db/repositories/outbound";
import * as s from "@/db/schema";
import { withPrivileged, withTenant } from "@/db/tenant";
import type { Db } from "@/db/types";
import { createTestDb, seedOrganization } from "./helpers/db";

let db: Db;
let close: () => Promise<void>;
let seed: Awaited<ReturnType<typeof seedOrganization>>;
let frank: string;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
  seed = await seedOrganization(db, { slug: "uitgaand" });
  [frank] = await withPrivileged(db, async (tx) =>
    (
      await tx
        .insert(s.users)
        .values({ id: randomUUID(), email: "frank@example.nl", name: "Frank" })
        .returning({ id: s.users.id })
    ).map((r) => r.id),
  );
});
afterAll(async () => close());

describe("zelf een mail beginnen", () => {
  it("maakt een ticket op jouw naam dat wacht op de klant", async () => {
    const a = await withTenant(db, seed.org.id, (t) =>
      createPendingAttachment(t, {
        filename: "retourlabel.pdf",
        contentType: "application/pdf",
        sizeBytes: 100,
        uploadedById: frank,
      }),
    );
    const created = await withTenant(db, seed.org.id, (t) =>
      startOutboundTicket(t, {
        shopId: seed.shop.id,
        userId: frank,
        to: "Nieuwe.Klant@Example.nl",
        name: "Nieuwe Klant",
        subject: "Je retourlabel",
        body: "Hoi, hierbij je retourlabel.",
        nextStatus: "pending_customer",
        attachments: { ids: [a.id], actualSize: async () => 4321 },
      }),
    );

    const [ticket] = await withTenant(db, seed.org.id, ({ tx }) =>
      tx
        .select({ ticket: s.tickets, contact: s.contacts })
        .from(s.tickets)
        .innerJoin(s.contacts, eq(s.contacts.id, s.tickets.contactId))
        .where(eq(s.tickets.id, created.id)),
    );
    expect(ticket.ticket).toMatchObject({
      status: "pending_customer",
      assigneeId: frank,
      subject: "Je retourlabel",
      language: "nl",
    });
    expect(ticket.contact).toMatchObject({
      email: "nieuwe.klant@example.nl",
      name: "Nieuwe Klant",
    });

    const messages = await withTenant(db, seed.org.id, ({ tx }) =>
      tx.select().from(s.messages).where(eq(s.messages.ticketId, created.id)),
    );
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      direction: "outbound",
      authorUserId: frank,
      toEmails: ["nieuwe.klant@example.nl"],
    });

    const [attachment] = await withTenant(db, seed.org.id, ({ tx }) =>
      tx.select().from(s.attachments).where(eq(s.attachments.id, a.id)),
    );
    expect(attachment).toMatchObject({ messageId: messages[0].id, sizeBytes: 4321 });

    const events = await withTenant(db, seed.org.id, ({ tx }) =>
      tx
        .select({ type: s.ticketEvents.type, to: s.ticketEvents.toValue })
        .from(s.ticketEvents)
        .where(eq(s.ticketEvents.ticketId, created.id))
        .orderBy(asc(s.ticketEvents.createdAt)),
    );
    expect(events.map((e) => e.type)).toEqual(
      expect.arrayContaining(["created", "assigned", "replied", "status_changed"]),
    );
  });

  it("kan niet vanaf een uitgeschakelde shop", async () => {
    await withPrivileged(db, (tx) =>
      tx.update(s.shops).set({ active: false }).where(eq(s.shops.id, seed.shop.id)),
    );
    await expect(
      withTenant(db, seed.org.id, (t) =>
        startOutboundTicket(t, {
          shopId: seed.shop.id,
          userId: frank,
          to: "klant@example.nl",
          subject: "Hallo",
          body: "Test",
          nextStatus: "open",
        }),
      ),
    ).rejects.toThrow(ShopNotFoundError);
  });
});
