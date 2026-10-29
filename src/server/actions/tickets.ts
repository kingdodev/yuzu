"use server";

import { and, eq, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { changeTicketStatus, type Actor } from "@/db/repositories/tickets";
import * as s from "@/db/schema";
import { TICKET_STATUSES } from "@/domain/tickets";
import { asTenant } from "../session";

const uuid = z.string().uuid();
const statusSchema = z.enum(TICKET_STATUSES);

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

function me(userId: string): Actor {
  return { type: "user", userId };
}

export async function setTicketStatus(
  ticketId: string,
  status: string,
): Promise<ActionResult> {
  const id = uuid.parse(ticketId);
  const next = statusSchema.parse(status);
  try {
    await asTenant((t, session) => changeTicketStatus(t, id, next, me(session.userId)));
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Status wijzigen mislukt",
    };
  }
  refresh();
  return { ok: true };
}

export async function assignTicket(
  ticketId: string,
  userId: string | null,
): Promise<ActionResult> {
  const id = uuid.parse(ticketId);
  const assignee = userId ? uuid.parse(userId) : null;
  await asTenant(async ({ tx, organizationId }, session) => {
    const [before] = await tx
      .select({ a: s.tickets.assigneeId })
      .from(s.tickets)
      .where(eq(s.tickets.id, id));
    if (!before || before.a === assignee) return;
    await tx
      .update(s.tickets)
      .set({ assigneeId: assignee, updatedAt: sql`now()` })
      .where(eq(s.tickets.id, id));
    await tx.insert(s.ticketEvents).values({
      organizationId,
      ticketId: id,
      type: "assigned",
      fromValue: before.a,
      toValue: assignee,
      actorType: "user",
      actorUserId: session.userId,
    });
  });
  refresh();
  return { ok: true };
}

export async function setTicketPriority(
  ticketId: string,
  priority: string,
): Promise<ActionResult> {
  const id = uuid.parse(ticketId);
  const p = z.enum(["low", "normal", "high", "urgent"]).parse(priority);
  await asTenant(async ({ tx, organizationId }, session) => {
    const [before] = await tx
      .select({ p: s.tickets.priority })
      .from(s.tickets)
      .where(eq(s.tickets.id, id));
    if (!before || before.p === p) return;
    await tx
      .update(s.tickets)
      .set({ priority: p, updatedAt: sql`now()` })
      .where(eq(s.tickets.id, id));
    await tx.insert(s.ticketEvents).values({
      organizationId,
      ticketId: id,
      type: "priority_changed",
      fromValue: before.p,
      toValue: p,
      actorType: "user",
      actorUserId: session.userId,
    });
  });
  refresh();
  return { ok: true };
}

const replySchema = z.object({
  ticketId: uuid,
  body: z.string().trim().min(1, "Schrijf eerst een antwoord").max(20_000),
  nextStatus: statusSchema,
  draftId: uuid.nullable(),
});

/**
 * Antwoord aan de klant. In de demo wordt de mail niet echt verstuurd; het
 * bericht komt wel in het gesprek en de ticketstatus verandert.
 */
export async function sendReply(
  input: z.input<typeof replySchema>,
): Promise<ActionResult> {
  const parsed = replySchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Ongeldig antwoord" };
  const { ticketId, body, nextStatus, draftId } = parsed.data;

  try {
    await asTenant(async (t, session) => {
      const { tx, organizationId } = t;
      const [ticket] = await tx
        .select({ ticket: s.tickets, contactEmail: s.contacts.email })
        .from(s.tickets)
        .innerJoin(s.contacts, eq(s.contacts.id, s.tickets.contactId))
        .where(eq(s.tickets.id, ticketId));
      if (!ticket) throw new Error("Ticket niet gevonden");

      await tx.insert(s.messages).values({
        organizationId,
        ticketId,
        direction: "outbound",
        authorType: "user",
        authorUserId: session.userId,
        toEmails: [ticket.contactEmail],
        subject: `Re: ${ticket.ticket.subject}`,
        bodyText: body,
      });

      if (draftId) {
        await tx
          .update(s.aiDrafts)
          .set({ status: "used" })
          .where(and(eq(s.aiDrafts.id, draftId), eq(s.aiDrafts.ticketId, ticketId)));
      }

      await tx
        .update(s.tickets)
        .set({
          lastMessageAt: sql`now()`,
          updatedAt: sql`now()`,
          firstResponseAt: ticket.ticket.firstResponseAt ?? sql`now()`,
          assigneeId: ticket.ticket.assigneeId ?? session.userId,
        })
        .where(eq(s.tickets.id, ticketId));

      await tx.insert(s.ticketEvents).values({
        organizationId,
        ticketId,
        type: "replied",
        toValue: draftId ? "ai_draft" : "manual",
        actorType: "user",
        actorUserId: session.userId,
      });

      if (ticket.ticket.status !== nextStatus) {
        // "Nieuw" moet eerst open worden voordat het naar wachten of opgelost kan.
        await changeTicketStatus(t, ticketId, nextStatus, me(session.userId));
      }
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Versturen mislukt" };
  }
  refresh();
  return {
    ok: true,
    message: "Antwoord opgeslagen. In de demo wordt nog geen e-mail verstuurd.",
  };
}

export async function addNote(ticketId: string, body: string): Promise<ActionResult> {
  const id = uuid.parse(ticketId);
  const text = body.trim();
  if (!text) return { ok: false, error: "Schrijf eerst een notitie" };
  await asTenant(async ({ tx, organizationId }, session) => {
    await tx.insert(s.messages).values({
      organizationId,
      ticketId: id,
      direction: "note",
      authorType: "user",
      authorUserId: session.userId,
      bodyText: text,
    });
    await tx
      .update(s.tickets)
      .set({ updatedAt: sql`now()` })
      .where(eq(s.tickets.id, id));
  });
  refresh();
  return { ok: true };
}

export async function discardDraft(draftId: string): Promise<ActionResult> {
  const id = uuid.parse(draftId);
  await asTenant(({ tx }) =>
    tx.update(s.aiDrafts).set({ status: "discarded" }).where(eq(s.aiDrafts.id, id)),
  );
  refresh();
  return { ok: true };
}

export async function toggleTicketTag(
  ticketId: string,
  tagId: string,
): Promise<ActionResult> {
  const id = uuid.parse(ticketId);
  const tag = uuid.parse(tagId);
  await asTenant(async ({ tx, organizationId }) => {
    const removed = await tx
      .delete(s.ticketTags)
      .where(and(eq(s.ticketTags.ticketId, id), eq(s.ticketTags.tagId, tag)))
      .returning();
    if (removed.length === 0) {
      await tx.insert(s.ticketTags).values({ organizationId, ticketId: id, tagId: tag });
    }
  });
  refresh();
  return { ok: true };
}
