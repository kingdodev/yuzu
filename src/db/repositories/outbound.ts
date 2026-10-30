import { and, eq, sql } from "drizzle-orm";
import type { TicketStatus } from "@/domain/tickets";
import { messages, shops, ticketEvents, tickets } from "../schema";
import type { TenantTx } from "../tenant";
import { claimAttachments } from "./attachments";
import { upsertContact } from "./contacts";
import { changeTicketStatus, createTicket } from "./tickets";

type AttachmentInput = {
  ids: readonly string[];
  actualSize: (storageKey: string) => Promise<number | null>;
};

/** Een bericht aan de klant opslaan, met de bijlagen die de agent uploadde. */
export async function insertOutboundMessage(
  t: TenantTx,
  input: {
    ticketId: string;
    userId: string;
    to: string;
    subject: string;
    body: string;
    attachments?: AttachmentInput;
  },
) {
  const [message] = await t.tx
    .insert(messages)
    .values({
      organizationId: t.organizationId,
      ticketId: input.ticketId,
      direction: "outbound",
      authorType: "user",
      authorUserId: input.userId,
      toEmails: [input.to],
      subject: input.subject,
      bodyText: input.body,
    })
    .returning({ id: messages.id });
  if (input.attachments && input.attachments.ids.length > 0) {
    await claimAttachments(t, {
      ids: input.attachments.ids,
      userId: input.userId,
      messageId: message.id,
      actualSize: input.attachments.actualSize,
    });
  }
  return message;
}

export class ShopNotFoundError extends Error {
  constructor() {
    super("Deze shop bestaat niet (meer).");
    this.name = "ShopNotFoundError";
  }
}

/**
 * Een nieuw ticket dat begint met een mail van ons aan de klant, bijvoorbeeld
 * om zelf contact op te nemen. Het ticket staat op naam van de agent.
 */
export async function startOutboundTicket(
  t: TenantTx,
  input: {
    shopId: string;
    userId: string;
    to: string;
    name?: string | null;
    subject: string;
    body: string;
    nextStatus: Extract<TicketStatus, "pending_customer" | "solved" | "open">;
    attachments?: AttachmentInput;
  },
) {
  const [shop] = await t.tx
    .select({ id: shops.id, language: shops.language, active: shops.active })
    .from(shops)
    .where(and(eq(shops.id, input.shopId), sql`app_visible_shop(${shops.id})`));
  if (!shop || !shop.active) throw new ShopNotFoundError();

  const actor = { type: "user", userId: input.userId } as const;
  const contact = await upsertContact(t, { email: input.to, name: input.name ?? null });
  const ticket = await createTicket(
    t,
    {
      shopId: shop.id,
      contactId: contact.id,
      subject: input.subject,
      language: shop.language,
    },
    actor,
  );

  await insertOutboundMessage(t, {
    ticketId: ticket.id,
    userId: input.userId,
    to: contact.email,
    subject: ticket.subject,
    body: input.body,
    attachments: input.attachments,
  });

  await t.tx
    .update(tickets)
    .set({ assigneeId: input.userId, lastMessageAt: sql`now()`, updatedAt: sql`now()` })
    .where(eq(tickets.id, ticket.id));
  await t.tx.insert(ticketEvents).values([
    {
      organizationId: t.organizationId,
      ticketId: ticket.id,
      type: "assigned",
      toValue: input.userId,
      actorType: "user",
      actorUserId: input.userId,
    },
    {
      organizationId: t.organizationId,
      ticketId: ticket.id,
      type: "replied",
      toValue: "outbound_new",
      actorType: "user",
      actorUserId: input.userId,
    },
  ]);

  await changeTicketStatus(t, ticket.id, input.nextStatus, actor);

  return { id: ticket.id, number: ticket.number, status: input.nextStatus };
}
