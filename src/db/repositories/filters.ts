import { and, asc, desc, eq, inArray } from "drizzle-orm";
import {
  applyFilterRules,
  filterMatches,
  type FilterRule,
  type MailForFilter,
} from "@/domain/filters";
import { canArchive } from "@/domain/tickets";
import {
  contacts,
  mailFilters,
  messages,
  shops,
  tags,
  tickets,
  ticketTags,
} from "../schema";
import type { TenantTx } from "../tenant";
import { addTagToTickets, archiveTickets, type Actor } from "./tickets";

export type FilterInput = {
  fromContains: string | null;
  subjectContains: string | null;
  hasWords: string | null;
  shopId: string | null;
  tagId: string | null;
  skipInbox: boolean;
  enabled: boolean;
};

export async function listFilters(t: TenantTx) {
  return t.tx
    .select({
      id: mailFilters.id,
      fromContains: mailFilters.fromContains,
      subjectContains: mailFilters.subjectContains,
      hasWords: mailFilters.hasWords,
      shopId: mailFilters.shopId,
      tagId: mailFilters.tagId,
      skipInbox: mailFilters.skipInbox,
      enabled: mailFilters.enabled,
      shopName: shops.name,
      tagName: tags.name,
      tagColor: tags.color,
    })
    .from(mailFilters)
    .leftJoin(shops, eq(shops.id, mailFilters.shopId))
    .leftJoin(tags, eq(tags.id, mailFilters.tagId))
    .orderBy(asc(mailFilters.createdAt));
}

/** Controleer verwijzingen naar shop en label tegen de eigen organisatie (RLS). */
async function assertOwnRefs(t: TenantTx, input: FilterInput) {
  if (input.shopId) {
    const [shop] = await t.tx
      .select({ id: shops.id })
      .from(shops)
      .where(eq(shops.id, input.shopId));
    if (!shop) throw new Error("Onbekende shop.");
  }
  if (input.tagId) {
    const [tag] = await t.tx
      .select({ id: tags.id })
      .from(tags)
      .where(eq(tags.id, input.tagId));
    if (!tag) throw new Error("Dit label bestaat niet (meer).");
  }
}

export async function saveFilter(t: TenantTx, input: FilterInput, id?: string) {
  await assertOwnRefs(t, input);
  if (id) {
    const [row] = await t.tx
      .update(mailFilters)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(mailFilters.id, id))
      .returning();
    if (!row) throw new Error("Dit filter bestaat niet (meer).");
    return row;
  }
  const [row] = await t.tx
    .insert(mailFilters)
    .values({ organizationId: t.organizationId, ...input })
    .returning();
  return row;
}

export async function deleteFilter(t: TenantTx, id: string) {
  await t.tx.delete(mailFilters).where(eq(mailFilters.id, id));
}

async function enabledRules(t: TenantTx): Promise<FilterRule[]> {
  return t.tx
    .select({
      id: mailFilters.id,
      fromContains: mailFilters.fromContains,
      subjectContains: mailFilters.subjectContains,
      hasWords: mailFilters.hasWords,
      shopId: mailFilters.shopId,
      tagId: mailFilters.tagId,
      skipInbox: mailFilters.skipInbox,
      enabled: mailFilters.enabled,
    })
    .from(mailFilters)
    .where(eq(mailFilters.enabled, true));
}

/**
 * Pas de filters toe op een ticket dat net uit een binnenkomende mail is
 * ontstaan: labels erbij, en eventueel meteen archiveren ("postvak
 * overslaan"). Bedoeld voor de mailverwerking (Mailgun); schrijft via de
 * gewone functies, dus ook ticket_events.
 */
export async function applyFiltersToNewTicket(
  t: TenantTx,
  ticketId: string,
  mail: MailForFilter,
  actor: Actor = { type: "system" },
) {
  const outcome = applyFilterRules(await enabledRules(t), mail);
  for (const tagId of outcome.tagIds) await addTagToTickets(t, [ticketId], tagId);
  if (outcome.skipInbox) await archiveTickets(t, [ticketId], actor);
  return outcome;
}

/** Hoeveel bestaande tickets bekijken we hooguit bij "ook toepassen op bestaande"? */
export const EXISTING_LIMIT = 2000;

/**
 * De bestaande tickets waarop een filter past, op basis van de eerste mail
 * van de klant. De nieuwste eerst, hooguit EXISTING_LIMIT.
 */
export async function ticketsMatchingFilter(t: TenantTx, rule: FilterRule) {
  const rows = await t.tx
    .select({
      id: tickets.id,
      status: tickets.status,
      subject: tickets.subject,
      shopId: tickets.shopId,
      fromEmail: contacts.email,
      fromName: contacts.name,
    })
    .from(tickets)
    .innerJoin(contacts, eq(contacts.id, tickets.contactId))
    .orderBy(desc(tickets.createdAt))
    .limit(EXISTING_LIMIT);
  if (rows.length === 0) return [];

  const bodies = await t.tx
    .selectDistinctOn([messages.ticketId], {
      ticketId: messages.ticketId,
      body: messages.bodyText,
    })
    .from(messages)
    .where(
      and(
        inArray(
          messages.ticketId,
          rows.map((r) => r.id),
        ),
        eq(messages.direction, "inbound"),
      ),
    )
    .orderBy(messages.ticketId, asc(messages.createdAt));
  const bodyOf = new Map(bodies.map((b) => [b.ticketId, b.body]));

  return rows.filter((r) =>
    filterMatches(
      { ...rule, enabled: true },
      {
        fromEmail: r.fromEmail,
        fromName: r.fromName,
        subject: r.subject,
        body: bodyOf.get(r.id) ?? "",
        shopId: r.shopId,
      },
    ),
  );
}

/** Pas één filter toe op bestaande tickets (Gmail: "ook toepassen op … gesprekken"). */
export async function applyFilterToExisting(t: TenantTx, rule: FilterRule, actor: Actor) {
  const matching = await ticketsMatchingFilter(t, rule);
  const ids = matching.map((r) => r.id);
  let labeled = 0;
  if (rule.tagId && ids.length) {
    const before = new Set(
      (
        await t.tx
          .select({ ticketId: ticketTags.ticketId })
          .from(ticketTags)
          .where(and(eq(ticketTags.tagId, rule.tagId), inArray(ticketTags.ticketId, ids)))
      ).map((r) => r.ticketId),
    );
    await addTagToTickets(t, ids, rule.tagId);
    labeled = ids.filter((id) => !before.has(id)).length;
  }
  let archived = 0;
  if (rule.skipInbox) {
    const open = matching.filter((r) => canArchive(r.status)).map((r) => r.id);
    archived = (await archiveTickets(t, open, actor)).archived.length;
  }
  return { matched: ids.length, labeled, archived };
}
