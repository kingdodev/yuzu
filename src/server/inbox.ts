import "server-only";
import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  isNull,
  ne,
  notInArray,
  sql,
  type SQL,
} from "drizzle-orm";
import { attachmentsForTicket } from "@/db/repositories/attachments";
import { searchTickets } from "@/db/repositories/search";
import * as s from "@/db/schema";
import { parseSearchQuery } from "@/domain/search";
import type { TenantTx } from "@/db/tenant";
import { isShopView, type InboxView, INBOX_VIEWS } from "@/domain/views";
import { cache } from "react";
import { demoMagento } from "@/integrations/magento/demo";
import { asTenant } from "./session";

import type { TicketStatus } from "@/domain/tickets";

const ACTIONABLE: TicketStatus[] = ["new", "open"];
const WAITING: TicketStatus[] = ["pending_customer", "pending_third_party"];
const DONE: TicketStatus[] = ["solved", "closed"];

function viewCondition(
  view: InboxView,
  userId: string,
  shopIds: Record<string, string>,
): SQL {
  if (isShopView(view)) {
    return and(
      eq(s.tickets.shopId, shopIds[view] ?? "00000000-0000-4000-8000-000000000000"),
      inArray(s.tickets.status, ACTIONABLE),
    )!;
  }
  switch (view) {
    case "open":
      return inArray(s.tickets.status, ACTIONABLE);
    case "mine":
      return and(eq(s.tickets.assigneeId, userId), notInArray(s.tickets.status, DONE))!;
    case "unassigned":
      return and(isNull(s.tickets.assigneeId), inArray(s.tickets.status, ACTIONABLE))!;
    case "waiting":
      return inArray(s.tickets.status, WAITING);
    case "solved":
      return inArray(s.tickets.status, DONE);
  }
}

async function shopIdsByCode({ tx }: TenantTx) {
  const rows = await tx.select({ id: s.shops.id, code: s.shops.code }).from(s.shops);
  return Object.fromEntries(rows.map((r) => [r.code, r.id]));
}

export const getViewCounts = cache(async (): Promise<Record<InboxView, number>> => {
  return asTenant(async (t, session) => {
    const shopIds = await shopIdsByCode(t);
    const entries = await Promise.all(
      INBOX_VIEWS.map(async (view) => {
        const [row] = await t.tx
          .select({ n: count() })
          .from(s.tickets)
          .where(viewCondition(view, session.userId, shopIds));
        return [view, row.n] as const;
      }),
    );
    return Object.fromEntries(entries) as Record<InboxView, number>;
  });
});

export type TicketListItem = Awaited<ReturnType<typeof listTickets>>[number];

export async function listTickets(view: InboxView) {
  return asTenant(async (t, session) => {
    const shopIds = await shopIdsByCode(t);
    const rows = await t.tx
      .select({
        id: s.tickets.id,
        number: s.tickets.number,
        subject: s.tickets.subject,
        status: s.tickets.status,
        priority: s.tickets.priority,
        intent: s.tickets.intent,
        language: s.tickets.language,
        lastMessageAt: s.tickets.lastMessageAt,
        shopCode: s.shops.code,
        contactName: s.contacts.name,
        contactEmail: s.contacts.email,
        assigneeName: s.users.name,
      })
      .from(s.tickets)
      .innerJoin(s.shops, eq(s.shops.id, s.tickets.shopId))
      .innerJoin(s.contacts, eq(s.contacts.id, s.tickets.contactId))
      .leftJoin(s.users, eq(s.users.id, s.tickets.assigneeId))
      .where(viewCondition(view, session.userId, shopIds))
      .orderBy(
        sql`case when ${s.tickets.priority} in ('high','urgent') and ${s.tickets.status} in ('new','open') then 0 else 1 end`,
        desc(s.tickets.lastMessageAt),
      )
      .limit(200);

    const ids = rows.map((r) => r.id);
    if (ids.length === 0) return [];

    const [previews, drafts] = await Promise.all([
      t.tx
        .selectDistinctOn([s.messages.ticketId], {
          ticketId: s.messages.ticketId,
          body: s.messages.bodyText,
          translated: s.messages.translatedText,
        })
        .from(s.messages)
        .where(and(inArray(s.messages.ticketId, ids), ne(s.messages.direction, "note")))
        .orderBy(s.messages.ticketId, desc(s.messages.createdAt)),
      t.tx
        .select({ ticketId: s.aiDrafts.ticketId })
        .from(s.aiDrafts)
        .where(and(inArray(s.aiDrafts.ticketId, ids), eq(s.aiDrafts.status, "pending"))),
    ]);
    const previewBy = new Map(previews.map((p) => [p.ticketId, p.translated ?? p.body]));
    const draftSet = new Set(drafts.map((d) => d.ticketId));

    return rows.map((r) => ({
      ...r,
      preview: (previewBy.get(r.id) ?? "").replace(/\s+/g, " ").trim().slice(0, 140),
      hasDraft: draftSet.has(r.id),
    }));
  });
}

export async function getTicketDetail(ticketId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(ticketId)) return null;
  return asTenant(async (t, session) => {
    const { tx } = t;
    const [ticket] = await tx
      .select({
        ticket: s.tickets,
        shop: s.shops,
        contact: s.contacts,
      })
      .from(s.tickets)
      .innerJoin(s.shops, eq(s.shops.id, s.tickets.shopId))
      .innerJoin(s.contacts, eq(s.contacts.id, s.tickets.contactId))
      .where(eq(s.tickets.id, ticketId));
    if (!ticket) return null;

    const [
      thread,
      draftRows,
      tagRows,
      allTags,
      orderRows,
      agents,
      templateRows,
      otherTickets,
      attachmentRows,
    ] = await Promise.all([
      tx
        .select({ message: s.messages, authorName: s.users.name })
        .from(s.messages)
        .leftJoin(s.users, eq(s.users.id, s.messages.authorUserId))
        .where(eq(s.messages.ticketId, ticketId))
        .orderBy(asc(s.messages.createdAt)),
      tx
        .select()
        .from(s.aiDrafts)
        .where(and(eq(s.aiDrafts.ticketId, ticketId), eq(s.aiDrafts.status, "pending")))
        .orderBy(desc(s.aiDrafts.createdAt))
        .limit(1),
      tx
        .select({ id: s.tags.id, name: s.tags.name, color: s.tags.color })
        .from(s.ticketTags)
        .innerJoin(s.tags, eq(s.tags.id, s.ticketTags.tagId))
        .where(eq(s.ticketTags.ticketId, ticketId)),
      tx.select().from(s.tags).orderBy(asc(s.tags.name)),
      tx.select().from(s.ticketOrders).where(eq(s.ticketOrders.ticketId, ticketId)),
      tx
        .select({ id: s.users.id, name: s.users.name })
        .from(s.memberships)
        .innerJoin(s.users, eq(s.users.id, s.memberships.userId))
        .where(and(eq(s.memberships.active, true), ne(s.memberships.role, "viewer"))),
      tx
        .select({ id: s.templates.id, name: s.templates.name, body: s.templates.body })
        .from(s.templates)
        .where(
          and(
            eq(s.templates.language, ticket.ticket.language ?? ticket.shop.language),
            sql`(${s.templates.shopId} is null or ${s.templates.shopId} = ${ticket.shop.id})`,
          ),
        )
        .orderBy(asc(s.templates.name)),
      tx
        .select({
          id: s.tickets.id,
          number: s.tickets.number,
          subject: s.tickets.subject,
          status: s.tickets.status,
          createdAt: s.tickets.createdAt,
        })
        .from(s.tickets)
        .where(
          and(eq(s.tickets.contactId, ticket.contact.id), ne(s.tickets.id, ticketId)),
        )
        .orderBy(desc(s.tickets.createdAt))
        .limit(5),
      attachmentsForTicket(t, ticketId),
    ]);

    const magento = await demoMagento.getCustomerContext(
      ticket.shop.code,
      ticket.contact.email,
    );
    const linked = new Set(orderRows.map((o) => o.orderNumber));
    const orders = [...magento.orders].sort((a, b) => {
      const la = linked.has(a.number) ? 0 : 1;
      const lb = linked.has(b.number) ? 0 : 1;
      return la - lb || b.createdAt.getTime() - a.createdAt.getTime();
    });

    return {
      ...ticket,
      session,
      thread,
      draft: draftRows[0] ?? null,
      tags: tagRows,
      allTags,
      linkedOrders: [...linked],
      customer: magento.customer,
      orders,
      agents,
      templates: templateRows,
      otherTickets,
      attachments: attachmentRows,
    };
  });
}

/** Zoek in alle tickets van de organisatie. Null als er niets te zoeken is. */
export async function searchInbox(raw: string | null | undefined) {
  const query = parseSearchQuery(raw);
  if (!query) return null;
  const results = await asTenant((t) => searchTickets(t, query));
  return { query, results };
}

export type TicketDetail = NonNullable<Awaited<ReturnType<typeof getTicketDetail>>>;

/** Actieve shops, om een nieuwe mail vanaf te sturen. */
export async function listSendingShops() {
  return asTenant(({ tx }) =>
    tx
      .select({
        id: s.shops.id,
        code: s.shops.code,
        name: s.shops.name,
        senderName: s.shops.senderName,
        senderEmail: s.shops.senderEmail,
        signature: s.shops.signature,
      })
      .from(s.shops)
      .where(eq(s.shops.active, true))
      .orderBy(sql`${s.shops.magentoStoreId} nulls last`, asc(s.shops.name)),
  );
}

/** Collega's en labels voor de bulkacties in de ticketlijst. */
export async function getBulkOptions() {
  return asTenant(async ({ tx }, session) => {
    const [agents, tags] = await Promise.all([
      tx
        .select({ id: s.users.id, name: s.users.name })
        .from(s.memberships)
        .innerJoin(s.users, eq(s.users.id, s.memberships.userId))
        .where(and(eq(s.memberships.active, true), ne(s.memberships.role, "viewer")))
        .orderBy(asc(s.users.name)),
      tx
        .select({ id: s.tags.id, name: s.tags.name })
        .from(s.tags)
        .orderBy(asc(s.tags.name)),
    ]);
    return { meId: session.userId, agents, tags };
  });
}
