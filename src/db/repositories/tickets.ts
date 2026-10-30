import { and, eq, inArray, sql } from "drizzle-orm";
import { canArchive, canTransition, type TicketStatus } from "@/domain/tickets";
import {
  memberships,
  organizations,
  tags,
  ticketEvents,
  tickets,
  ticketTags,
} from "../schema";
import type { TenantTx } from "../tenant";

export type Actor =
  { type: "user"; userId: string } | { type: "ai" } | { type: "system" };

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

/**
 * Archiveer tickets: zet ze op "opgelost" met een event per ticket. Tickets
 * die al opgelost of gesloten zijn, of niet bestaan, worden overgeslagen.
 */
export async function archiveTickets(
  t: TenantTx,
  ticketIds: readonly string[],
  actor: Actor,
) {
  const archived: string[] = [];
  const skipped: string[] = [];
  for (const id of ticketIds) {
    const [row] = await t.tx
      .select({ status: tickets.status })
      .from(tickets)
      .where(eq(tickets.id, id));
    if (!row || !canArchive(row.status)) {
      skipped.push(id);
      continue;
    }
    await changeTicketStatus(t, id, "solved", actor);
    archived.push(id);
  }
  return { archived, skipped };
}

export class InvalidAssigneeError extends Error {
  constructor() {
    super("Deze collega kan geen tickets krijgen.");
    this.name = "InvalidAssigneeError";
  }
}

/**
 * Wijs tickets toe aan een collega (of aan niemand). Alleen actieve leden
 * van de organisatie die tickets mogen behandelen. Tickets die al bij die
 * persoon liggen, slaan we over.
 */
export async function assignTickets(
  t: TenantTx,
  ticketIds: readonly string[],
  assigneeId: string | null,
  actor: Actor,
) {
  if (assigneeId) {
    const [member] = await t.tx
      .select({ role: memberships.role })
      .from(memberships)
      .where(and(eq(memberships.userId, assigneeId), eq(memberships.active, true)));
    if (!member || member.role === "viewer") throw new InvalidAssigneeError();
  }
  const changed: string[] = [];
  const unchanged: string[] = [];
  for (const id of new Set(ticketIds)) {
    const [before] = await t.tx
      .select({ assigneeId: tickets.assigneeId })
      .from(tickets)
      .where(eq(tickets.id, id))
      .for("update");
    if (!before || before.assigneeId === assigneeId) {
      unchanged.push(id);
      continue;
    }
    await t.tx
      .update(tickets)
      .set({ assigneeId, updatedAt: sql`now()` })
      .where(eq(tickets.id, id));
    await t.tx.insert(ticketEvents).values({
      organizationId: t.organizationId,
      ticketId: id,
      type: "assigned",
      fromValue: before.assigneeId,
      toValue: assigneeId,
      ...actorColumns(actor),
    });
    changed.push(id);
  }
  return { changed, unchanged };
}

/**
 * Zet meerdere tickets op een status. Tickets waarvoor die overgang niet
 * mag (bijv. gesloten → open) of die die status al hebben, slaan we over.
 */
export async function changeTicketStatuses(
  t: TenantTx,
  ticketIds: readonly string[],
  to: TicketStatus,
  actor: Actor,
) {
  const changed: string[] = [];
  const skipped: string[] = [];
  for (const id of new Set(ticketIds)) {
    const [row] = await t.tx
      .select({ status: tickets.status })
      .from(tickets)
      .where(eq(tickets.id, id));
    if (!row || !canTransition(row.status, to)) {
      skipped.push(id);
      continue;
    }
    await changeTicketStatus(t, id, to, actor);
    changed.push(id);
  }
  return { changed, skipped };
}

/** Geef meerdere tickets een label. Tickets die het al hebben, blijven gelijk. */
export async function addTagToTickets(
  t: TenantTx,
  ticketIds: readonly string[],
  tagId: string,
) {
  const [tag] = await t.tx
    .select({ id: tags.id, name: tags.name })
    .from(tags)
    .where(eq(tags.id, tagId));
  if (!tag) throw new Error("Dit label bestaat niet (meer).");
  const ids = [...new Set(ticketIds)];
  // Alleen tickets die deze organisatie echt heeft (RLS filtert de rest).
  const existing = ids.length
    ? await t.tx.select({ id: tickets.id }).from(tickets).where(inArray(tickets.id, ids))
    : [];
  if (existing.length === 0) return { tag, added: 0 };
  const added = await t.tx
    .insert(ticketTags)
    .values(
      existing.map((r) => ({ organizationId: t.organizationId, ticketId: r.id, tagId })),
    )
    .onConflictDoNothing()
    .returning({ ticketId: ticketTags.ticketId });
  return { tag, added: added.length };
}
