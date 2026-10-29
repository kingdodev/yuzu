import { and, eq, sql } from "drizzle-orm";
import { canTransition, type TicketStatus } from "@/domain/tickets";
import { organizations, ticketEvents, tickets } from "../schema";
import type { TenantTx } from "../tenant";

export type Actor =
  | { type: "user"; userId: string }
  | { type: "ai" }
  | { type: "system" };

function actorColumns(actor: Actor) {
  return {
    actorType: actor.type,
    actorUserId: actor.type === "user" ? actor.userId : null,
  } as const;
}

/** Volgend ticketnummer van deze organisatie; veilig bij gelijktijdige mails. */
export async function allocateTicketNumber({
  tx,
  organizationId,
}: TenantTx): Promise<number> {
  const [row] = await tx
    .update(organizations)
    .set({ ticketSeq: sql`${organizations.ticketSeq} + 1` })
    .where(eq(organizations.id, organizationId))
    .returning({ seq: organizations.ticketSeq });
  if (!row) throw new Error("Organisatie niet gevonden");
  return row.seq;
}

export type NewTicket = {
  shopId: string;
  contactId: string;
  subject: string;
  channel?: "email" | "form";
  language?: "nl" | "fr" | "es" | "en" | "de" | null;
};

export async function createTicket(t: TenantTx, input: NewTicket, actor: Actor) {
  const number = await allocateTicketNumber(t);
  const [ticket] = await t.tx
    .insert(tickets)
    .values({
      organizationId: t.organizationId,
      number,
      shopId: input.shopId,
      contactId: input.contactId,
      subject: input.subject.trim() || "(geen onderwerp)",
      channel: input.channel ?? "email",
      language: input.language ?? null,
    })
    .returning();

  await t.tx.insert(ticketEvents).values({
    organizationId: t.organizationId,
    ticketId: ticket.id,
    type: "created",
    toValue: ticket.status,
    ...actorColumns(actor),
  });

  return ticket;
}

export class InvalidTransitionError extends Error {
  constructor(from: TicketStatus, to: TicketStatus) {
    super(`Status ${from} → ${to} is niet toegestaan`);
    this.name = "InvalidTransitionError";
  }
}

/** Wijzig de status, met controle, tijdstempels en een event voor analytics. */
export async function changeTicketStatus(
  t: TenantTx,
  ticketId: string,
  to: TicketStatus,
  actor: Actor,
) {
  const [current] = await t.tx
    .select({ status: tickets.status })
    .from(tickets)
    .where(eq(tickets.id, ticketId))
    .for("update");
  if (!current) throw new Error("Ticket niet gevonden");

  const from = current.status;
  if (from === to) return;
  if (!canTransition(from, to)) throw new InvalidTransitionError(from, to);

  await t.tx
    .update(tickets)
    .set({
      status: to,
      updatedAt: sql`now()`,
      solvedAt: to === "solved" ? sql`now()` : from === "solved" ? null : undefined,
      closedAt: to === "closed" ? sql`now()` : undefined,
    })
    .where(and(eq(tickets.id, ticketId), eq(tickets.status, from)));

  await t.tx.insert(ticketEvents).values({
    organizationId: t.organizationId,
    ticketId,
    type: "status_changed",
    fromValue: from,
    toValue: to,
    ...actorColumns(actor),
  });
}
