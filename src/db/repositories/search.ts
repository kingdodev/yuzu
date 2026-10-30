import { and, asc, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { likePattern, snippetAround, type SearchQuery } from "@/domain/search";
import { contacts, messages, shops, ticketOrders, tickets } from "../schema";
import type { TenantTx } from "../tenant";

export const SEARCH_LIMIT = 50;

/** Waar moet één zoekwoord in voorkomen? Ergens in het ticket is genoeg. */
function termCondition(term: string): SQL {
  const p = likePattern(term);
  const parts: SQL[] = [
    ilike(tickets.subject, p),
    ilike(contacts.email, p),
    ilike(contacts.name, p),
    sql`exists (select 1 from ${ticketOrders} where ${ticketOrders.ticketId} = ${tickets.id} and ${ticketOrders.orderNumber} ilike ${p})`,
    sql`exists (select 1 from ${messages} where ${messages.ticketId} = ${tickets.id} and (${messages.bodyText} ilike ${p} or ${messages.translatedText} ilike ${p}))`,
  ];
  const digits = /^\d{1,12}$/.test(term) ? Number(term) : null;
  if (digits !== null) parts.push(eq(tickets.number, digits));
  return or(...parts)!;
}

/**
 * Zoek tickets van deze organisatie, in alle statussen. Elk woord moet
 * ergens voorkomen: in het onderwerp, de naam of het e-mailadres van de
 * klant, een gekoppeld ordernummer, of de tekst van een bericht of notitie.
 */
export async function searchTickets(
  t: TenantTx,
  query: SearchQuery,
  /** Ook tickets van deze klanten (bijv. van een order die in de webshop gevonden is). */
  alsoEmails: readonly string[] = [],
) {
  const conditions = query.terms.map(termCondition);
  const emails = [...new Set(alsoEmails.map((e) => e.toLowerCase()))];
  const where = or(
    query.ticketNumber !== null ? eq(tickets.number, query.ticketNumber) : undefined,
    and(...conditions),
    emails.length ? inArray(sql`lower(${contacts.email})`, emails) : undefined,
  );
  if (!where) return [];

  const rows = await t.tx
    .select({
      id: tickets.id,
      number: tickets.number,
      subject: tickets.subject,
      status: tickets.status,
      priority: tickets.priority,
      intent: tickets.intent,
      lastMessageAt: tickets.lastMessageAt,
      shopCode: shops.code,
      contactName: contacts.name,
      contactEmail: contacts.email,
    })
    .from(tickets)
    .innerJoin(shops, eq(shops.id, tickets.shopId))
    .innerJoin(contacts, eq(contacts.id, tickets.contactId))
    .where(where)
    .orderBy(
      ...(query.ticketNumber !== null
        ? [sql`case when ${tickets.number} = ${query.ticketNumber} then 0 else 1 end`]
        : []),
      desc(tickets.lastMessageAt),
    )
    .limit(SEARCH_LIMIT);

  // Een stukje tekst rond de vondst, of anders het laatste bericht.
  const ids = rows.map((r) => r.id);
  const snippetBy = new Map<string, string>();
  const firstTerm = query.terms[0];
  if (ids.length > 0) {
    const bodies = await t.tx
      .select({
        ticketId: messages.ticketId,
        body: messages.bodyText,
        translated: messages.translatedText,
      })
      .from(messages)
      .where(inArray(messages.ticketId, ids))
      .orderBy(asc(messages.createdAt));
    const latest = new Map<string, string>();
    for (const m of bodies) {
      latest.set(m.ticketId, m.translated ?? m.body);
      if (firstTerm && !snippetBy.has(m.ticketId)) {
        const hit =
          snippetAround(m.body, firstTerm) ??
          (m.translated ? snippetAround(m.translated, firstTerm) : null);
        if (hit) snippetBy.set(m.ticketId, hit);
      }
    }
    for (const [ticketId, body] of latest) {
      if (!snippetBy.has(ticketId)) {
        snippetBy.set(ticketId, body.replace(/\s+/g, " ").trim().slice(0, 140));
      }
    }
  }

  return rows.map((r) => ({ ...r, snippet: snippetBy.get(r.id) ?? "" }));
}

export type SearchResult = Awaited<ReturnType<typeof searchTickets>>[number];
