"use server";

import { and, eq, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import {
  addTagToTickets,
  archiveTickets as archiveTicketRows,
  assignTickets,
  changeTicketStatus,
  changeTicketStatuses,
  type Actor,
} from "@/db/repositories/tickets";
import { insertOutboundMessage, startOutboundTicket } from "@/db/repositories/outbound";
import * as s from "@/db/schema";
import { MAX_ATTACHMENTS_PER_MESSAGE } from "@/domain/attachments";
import {
  canAddNotes,
  canAssign,
  canWorkTickets,
  requirePermission,
} from "@/domain/permissions";
import { isPlausibleEmail } from "@/domain/contacts";
import {
  nextTicketAfter,
  TICKET_STATUS_LABELS,
  TICKET_STATUSES,
  type TicketStatus,
} from "@/domain/tickets";
import { isInboxView, viewForStatus } from "@/domain/views";
import { orderTemplateVars } from "@/domain/orders";
import { getTicketCommerce } from "@/server/inbox";
import { getFileStore } from "@/integrations/storage";
import { listTickets } from "../inbox";
import type { TenantTx } from "@/db/tenant";
import { asTenant, type Session } from "../session";

const uuid = z.string().uuid();
const statusSchema = z.enum(TICKET_STATUSES);

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

function me(userId: string): Actor {
  return { type: "user", userId };
}

const VIEWER_MESSAGE =
  "Als meelezer kun je tickets lezen en notities plaatsen, verder niets.";

/** Database-werk namens iemand die tickets mag behandelen (dus geen meelezer). */
function asWorker<T>(fn: (t: TenantTx, session: Session) => Promise<T>): Promise<T> {
  return asTenant((t, session) => {
    requirePermission(canWorkTickets(session.role), VIEWER_MESSAGE);
    return fn(t, session);
  });
}

function errorMessage(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : fallback;
}

export async function setTicketStatus(
  ticketId: string,
  status: string,
): Promise<ActionResult> {
  const id = uuid.parse(ticketId);
  const next = statusSchema.parse(status);
  try {
    await asWorker((t, session) => changeTicketStatus(t, id, next, me(session.userId)));
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
  try {
    await asWorker((t, session) => {
      requirePermission(
        canAssign(session.role, session.userId, assignee),
        "Je kunt tickets alleen aan jezelf toewijzen.",
      );
      return assignTickets(t, [id], assignee, me(session.userId));
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Toewijzen mislukt" };
  }
  refresh();
  return { ok: true };
}

export async function setTicketPriority(
  ticketId: string,
  priority: string,
): Promise<ActionResult> {
  const id = uuid.parse(ticketId);
  const p = z.enum(["low", "normal", "high", "urgent"]).parse(priority);
  try {
    await asWorker(async ({ tx, organizationId }, session) => {
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
  } catch (e) {
    return { ok: false, error: errorMessage(e, "Prioriteit wijzigen mislukt") };
  }
  refresh();
  return { ok: true };
}

const replySchema = z.object({
  ticketId: uuid,
  body: z.string().trim().min(1, "Schrijf eerst een antwoord").max(20_000),
  nextStatus: statusSchema,
  draftId: uuid.nullable(),
  attachmentIds: z.array(uuid).max(MAX_ATTACHMENTS_PER_MESSAGE).default([]),
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
  const { ticketId, body, nextStatus, draftId, attachmentIds } = parsed.data;
  const store = getFileStore();
  if (attachmentIds.length > 0 && !store) {
    return { ok: false, error: "Bijlagen zijn nog niet ingesteld." };
  }

  try {
    await asWorker(async (t, session) => {
      const { tx, organizationId } = t;
      const [ticket] = await tx
        .select({ ticket: s.tickets, contactEmail: s.contacts.email })
        .from(s.tickets)
        .innerJoin(s.contacts, eq(s.contacts.id, s.tickets.contactId))
        .where(eq(s.tickets.id, ticketId));
      if (!ticket) throw new Error("Ticket niet gevonden");

      await insertOutboundMessage(t, {
        ticketId,
        userId: session.userId,
        to: ticket.contactEmail,
        subject: `Re: ${ticket.ticket.subject}`,
        body,
        attachments: store
          ? { ids: attachmentIds, actualSize: (key) => store.size(key) }
          : undefined,
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

/** Een interne notitie. Mag iedereen, ook een meelezer. */
export async function addNote(ticketId: string, body: string): Promise<ActionResult> {
  const id = uuid.parse(ticketId);
  const text = body.trim();
  if (!text) return { ok: false, error: "Schrijf eerst een notitie" };
  if (text.length > 20_000) return { ok: false, error: "Deze notitie is te lang" };
  try {
    await asTenant(async ({ tx, organizationId }, session) => {
      requirePermission(canAddNotes(session.role));
      const [ticket] = await tx
        .select({ id: s.tickets.id })
        .from(s.tickets)
        .where(eq(s.tickets.id, id));
      if (!ticket) throw new Error("Ticket niet gevonden");
      await tx.insert(s.messages).values({
        organizationId,
        ticketId: id,
        direction: "note",
        authorType: "user",
        authorUserId: session.userId,
        bodyText: text,
      });
      if (canWorkTickets(session.role)) {
        await tx
          .update(s.tickets)
          .set({ updatedAt: sql`now()` })
          .where(eq(s.tickets.id, id));
      }
    });
  } catch (e) {
    return { ok: false, error: errorMessage(e, "Notitie toevoegen mislukt") };
  }
  refresh();
  return { ok: true };
}

export async function discardDraft(draftId: string): Promise<ActionResult> {
  const id = uuid.parse(draftId);
  try {
    await asWorker(({ tx }) =>
      tx.update(s.aiDrafts).set({ status: "discarded" }).where(eq(s.aiDrafts.id, id)),
    );
  } catch (e) {
    return { ok: false, error: errorMessage(e, "Verwerpen mislukt") };
  }
  refresh();
  return { ok: true };
}

export async function toggleTicketTag(
  ticketId: string,
  tagId: string,
): Promise<ActionResult> {
  const id = uuid.parse(ticketId);
  const tag = uuid.parse(tagId);
  try {
    await asWorker(async ({ tx, organizationId }) => {
      // Alleen labels van de eigen organisatie (RLS) en een zichtbaar ticket.
      const [ownTag] = await tx
        .select({ id: s.tags.id })
        .from(s.tags)
        .where(eq(s.tags.id, tag));
      if (!ownTag) throw new Error("Dit label bestaat niet (meer).");
      const removed = await tx
        .delete(s.ticketTags)
        .where(and(eq(s.ticketTags.ticketId, id), eq(s.ticketTags.tagId, tag)))
        .returning();
      if (removed.length === 0) {
        await tx
          .insert(s.ticketTags)
          .values({ organizationId, ticketId: id, tagId: tag });
      }
    });
  } catch (e) {
    return { ok: false, error: errorMessage(e, "Label wijzigen mislukt") };
  }
  refresh();
  return { ok: true };
}

export type ArchiveResult =
  { ok: true; archived: number; nextHref: string } | { ok: false; error: string };

/**
 * Archiveer één ticket (op "opgelost") en geef het adres van het volgende
 * ticket in dezelfde weergave terug, zodat je meteen verder kunt.
 */
export async function archiveTicket(
  ticketId: string,
  view: string,
): Promise<ArchiveResult> {
  const id = uuid.parse(ticketId);
  if (!isInboxView(view)) return { ok: false, error: "Onbekende weergave" };
  try {
    const listIds = (await listTickets(view)).map((t) => t.id);
    const nextId = nextTicketAfter(listIds, id);
    const { archived } = await asWorker((t, session) =>
      archiveTicketRows(t, [id], me(session.userId)),
    );
    refresh();
    return {
      ok: true,
      archived: archived.length,
      nextHref: nextId ? `/inbox/${view}/${nextId}` : `/inbox/${view}`,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Archiveren mislukt" };
  }
}

/** Archiveer meerdere tickets tegelijk, bijvoorbeeld vanuit de lijst. */
export async function archiveTickets(ticketIds: string[]): Promise<ActionResult> {
  const ids = z.array(uuid).min(1).max(500).parse(ticketIds);
  try {
    const { archived, skipped } = await asWorker((t, session) =>
      archiveTicketRows(t, ids, me(session.userId)),
    );
    refresh();
    const n = archived.length;
    const message =
      `${n} ${n === 1 ? "ticket" : "tickets"} gearchiveerd` +
      (skipped.length ? `, ${skipped.length} waren al opgelost` : "");
    return { ok: true, message };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Archiveren mislukt" };
  }
}

const bulkSchema = z.object({
  ticketIds: z.array(uuid).min(1).max(500),
  action: z.discriminatedUnion("type", [
    z.object({ type: z.literal("assign"), userId: uuid.nullable() }),
    z.object({ type: z.literal("status"), status: statusSchema }),
    z.object({ type: z.literal("tag"), tagId: uuid }),
  ]),
});

const tickets = (n: number) => `${n} ${n === 1 ? "ticket" : "tickets"}`;

/** Toewijzen, status wijzigen of een label geven aan meerdere tickets tegelijk. */
export async function bulkUpdateTickets(
  input: z.input<typeof bulkSchema>,
): Promise<ActionResult> {
  const parsed = bulkSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ongeldige selectie" };
  const { ticketIds, action } = parsed.data;
  try {
    const message = await asWorker(async (t, session) => {
      const actor = me(session.userId);
      switch (action.type) {
        case "assign": {
          requirePermission(
            canAssign(session.role, session.userId, action.userId),
            "Je kunt tickets alleen aan jezelf toewijzen.",
          );
          const { changed, unchanged } = await assignTickets(
            t,
            ticketIds,
            action.userId,
            actor,
          );
          let who = "niemand";
          if (action.userId) {
            const [u] = await t.tx
              .select({ name: s.users.name })
              .from(s.users)
              .where(eq(s.users.id, action.userId));
            who = action.userId === session.userId ? "jou" : (u?.name ?? "collega");
          }
          return (
            `${tickets(changed.length)} toegewezen aan ${who}` +
            (unchanged.length ? `, ${unchanged.length} hadden die eigenaar al` : "")
          );
        }
        case "status": {
          const { changed, skipped } = await changeTicketStatuses(
            t,
            ticketIds,
            action.status,
            actor,
          );
          return (
            `${tickets(changed.length)} op ${TICKET_STATUS_LABELS[action.status].toLowerCase()} gezet` +
            (skipped.length
              ? `, ${skipped.length} overgeslagen (kon niet of was al zo)`
              : "")
          );
        }
        case "tag": {
          const { tag, added } = await addTagToTickets(t, ticketIds, action.tagId);
          const already = ticketIds.length - added;
          return (
            `${tickets(added)} kregen het label ${tag.name}` +
            (already > 0 ? `, ${already} hadden het al` : "")
          );
        }
      }
    });
    refresh();
    return { ok: true, message };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Bijwerken mislukt" };
  }
}

const newTicketSchema = z.object({
  shopId: uuid,
  to: z
    .string()
    .trim()
    .toLowerCase()
    .refine(isPlausibleEmail, "Vul een geldig e-mailadres in"),
  name: z.string().trim().max(200).optional(),
  subject: z.string().trim().min(1, "Vul een onderwerp in").max(300),
  body: z.string().trim().min(1, "Schrijf eerst een bericht").max(20_000),
  nextStatus: z.enum(["pending_customer", "solved", "open"]),
  attachmentIds: z.array(uuid).max(MAX_ATTACHMENTS_PER_MESSAGE).default([]),
});

export type NewTicketResult = { ok: true; href: string } | { ok: false; error: string };

/**
 * Zelf een mail aan een klant beginnen. Dat wordt een nieuw ticket op jouw
 * naam. In de demo wordt de mail nog niet echt verstuurd.
 */
export async function createOutboundTicket(
  input: z.input<typeof newTicketSchema>,
): Promise<NewTicketResult> {
  const parsed = newTicketSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Ongeldig bericht" };
  const { attachmentIds, ...data } = parsed.data;
  const store = getFileStore();
  if (attachmentIds.length > 0 && !store) {
    return { ok: false, error: "Bijlagen zijn nog niet ingesteld." };
  }

  let created: { id: string; status: TicketStatus };
  try {
    created = await asWorker((t, session) =>
      startOutboundTicket(t, {
        ...data,
        name: data.name || null,
        userId: session.userId,
        attachments: store
          ? { ids: attachmentIds, actualSize: (key) => store.size(key) }
          : undefined,
      }),
    );
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Versturen mislukt" };
  }
  refresh();
  return { ok: true, href: `/inbox/${viewForStatus(created.status)}/${created.id}` };
}

/**
 * Ordergegevens voor een sjabloon ({{ordernummer}}, {{vervoerder}},
 * {{trackinglink}}). Apart opgehaald, zodat het ticket niet op de webshop wacht.
 */
export async function getOrderTemplateVars(
  ticketId: string,
): Promise<Record<string, string>> {
  const data = await getTicketCommerce(uuid.parse(ticketId));
  return orderTemplateVars(data?.orders ?? [], data?.linked ?? []);
}
