import "server-only";
import { and, asc, count, desc, eq, inArray, ne, sql } from "drizzle-orm";
import * as s from "@/db/schema";
import { asAdmin, asOwner } from "./session";

export function listShops() {
  return asAdmin(({ tx }) =>
    tx
      .select()
      .from(s.shops)
      .orderBy(sql`${s.shops.magentoStoreId} asc nulls last`, asc(s.shops.name)),
  );
}

export function getShop(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Promise.resolve(null);
  return asAdmin(async ({ tx }) => {
    const [row] = await tx.select().from(s.shops).where(eq(s.shops.id, id));
    return row ?? null;
  });
}

export function listMembers() {
  return asAdmin(async ({ tx }) => {
    const rows = await tx
      .select({
        userId: s.users.id,
        name: s.users.name,
        email: s.users.email,
        role: s.memberships.role,
        allShops: s.memberships.allShops,
        active: s.memberships.active,
        since: s.memberships.createdAt,
        passwordSetAt: s.users.passwordSetAt,
        lastLoginAt: s.users.lastLoginAt,
      })
      .from(s.memberships)
      .innerJoin(s.users, eq(s.users.id, s.memberships.userId))
      .orderBy(asc(s.users.name));
    const shopLinks = await tx
      .select({ userId: s.memberShops.userId, code: s.shops.code })
      .from(s.memberShops)
      .innerJoin(s.shops, eq(s.shops.id, s.memberShops.shopId));
    return rows.map((r) => ({
      ...r,
      shops: shopLinks.filter((l) => l.userId === r.userId).map((l) => l.code),
    }));
  });
}

export function listTeams() {
  return asAdmin(async ({ tx }) => {
    const teams = await tx.select().from(s.teams).orderBy(asc(s.teams.name));
    const members = await tx
      .select({ teamId: s.teamMembers.teamId, userId: s.users.id, name: s.users.name })
      .from(s.teamMembers)
      .innerJoin(s.users, eq(s.users.id, s.teamMembers.userId));
    const users = await tx
      .select({ id: s.users.id, name: s.users.name })
      .from(s.memberships)
      .innerJoin(s.users, eq(s.users.id, s.memberships.userId))
      .orderBy(asc(s.users.name));
    return {
      teams: teams.map((t) => ({
        ...t,
        members: members.filter((m) => m.teamId === t.id),
      })),
      users,
    };
  });
}

export function listTags() {
  return asAdmin(async ({ tx }) =>
    tx
      .select({
        id: s.tags.id,
        name: s.tags.name,
        color: s.tags.color,
        uses: count(s.ticketTags.ticketId),
      })
      .from(s.tags)
      .leftJoin(s.ticketTags, eq(s.ticketTags.tagId, s.tags.id))
      .groupBy(s.tags.id)
      .orderBy(asc(s.tags.name)),
  );
}

export function listTemplates() {
  return asAdmin(async ({ tx }) => {
    const [templates, shops] = await Promise.all([
      tx
        .select({ template: s.templates, shopCode: s.shops.code })
        .from(s.templates)
        .leftJoin(s.shops, eq(s.shops.id, s.templates.shopId))
        .orderBy(asc(s.templates.language), asc(s.templates.name)),
      tx
        .select({ id: s.shops.id, code: s.shops.code, name: s.shops.name })
        .from(s.shops)
        .orderBy(sql`${s.shops.magentoStoreId} asc nulls last`, asc(s.shops.name)),
    ]);
    return { templates, shops };
  });
}

export function listKnowledge(shopCode: string) {
  return asAdmin(async ({ tx }) => {
    const shops = await tx
      .select({
        id: s.shops.id,
        code: s.shops.code,
        name: s.shops.name,
        domain: s.shops.domain,
      })
      .from(s.shops)
      .orderBy(sql`${s.shops.magentoStoreId} asc nulls last`, asc(s.shops.name));
    const shop = shops.find((sh) => sh.code === shopCode) ?? shops[0];
    if (!shop) return { shops, shop: null, sources: [], totals: [] };
    const [sources, totals] = await Promise.all([
      tx
        .select()
        .from(s.knowledgeSources)
        .where(eq(s.knowledgeSources.shopId, shop.id))
        .orderBy(asc(s.knowledgeSources.kind), asc(s.knowledgeSources.title)),
      tx
        .select({
          shopId: s.knowledgeSources.shopId,
          status: s.knowledgeSources.status,
          n: count(),
        })
        .from(s.knowledgeSources)
        .groupBy(s.knowledgeSources.shopId, s.knowledgeSources.status),
    ]);
    return { shops, shop, sources, totals };
  });
}

export function listAiSettings() {
  return asAdmin(async ({ tx }) => {
    const [intents, shops, usage] = await Promise.all([
      tx.select().from(s.aiIntentSettings).orderBy(asc(s.aiIntentSettings.label)),
      tx
        .select({
          id: s.shops.id,
          code: s.shops.code,
          name: s.shops.name,
          toneOfVoice: s.shops.toneOfVoice,
        })
        .from(s.shops)
        .orderBy(sql`${s.shops.magentoStoreId} asc nulls last`, asc(s.shops.name)),
      tx
        .select({ intent: s.tickets.intent, status: s.aiDrafts.status, n: count() })
        .from(s.aiDrafts)
        .innerJoin(s.tickets, eq(s.tickets.id, s.aiDrafts.ticketId))
        .groupBy(s.tickets.intent, s.aiDrafts.status),
    ]);
    return { intents, shops, usage };
  });
}

export function listIntegrations() {
  return asOwner(async ({ tx }) => {
    const [rows, shops] = await Promise.all([
      tx.select().from(s.integrations),
      tx
        .select({
          code: s.shops.code,
          domain: s.shops.domain,
          senderEmail: s.shops.senderEmail,
          store: s.shops.magentoStoreId,
          name: s.shops.name,
        })
        .from(s.shops)
        .orderBy(sql`${s.shops.magentoStoreId} asc nulls last`, asc(s.shops.name)),
    ]);
    return { integrations: Object.fromEntries(rows.map((r) => [r.kind, r])), shops };
  });
}

export function listRetention() {
  return asOwner(({ tx }) =>
    tx
      .select({
        id: s.shops.id,
        code: s.shops.code,
        name: s.shops.name,
        retentionDaysTickets: s.shops.retentionDaysTickets,
        retentionDaysAttachments: s.shops.retentionDaysAttachments,
      })
      .from(s.shops)
      .orderBy(sql`${s.shops.magentoStoreId} asc nulls last`, asc(s.shops.name)),
  );
}

export function findContact(email: string) {
  const q = email.trim().toLowerCase();
  if (!q) return Promise.resolve(null);
  return asOwner(async ({ tx }) => {
    const [contact] = await tx.select().from(s.contacts).where(eq(s.contacts.email, q));
    if (!contact) return null;
    const [{ n }] = await tx
      .select({ n: count() })
      .from(s.tickets)
      .where(eq(s.tickets.contactId, contact.id));
    return { contact, ticketCount: n };
  });
}

export function listAudit() {
  return asAdmin(({ tx }) =>
    tx
      .select({ entry: s.auditLog, actorName: s.users.name })
      .from(s.auditLog)
      .leftJoin(s.users, eq(s.users.id, s.auditLog.actorUserId))
      .orderBy(desc(s.auditLog.createdAt))
      .limit(200),
  );
}

/** Alles wat Yuzu over één contact bewaart, voor een inzageverzoek (AVG art. 15). */
export function exportContact(email: string) {
  return asOwner(async ({ tx, organizationId }, session) => {
    const [contact] = await tx
      .select()
      .from(s.contacts)
      .where(eq(s.contacts.email, email.trim().toLowerCase()));
    if (!contact) return null;
    const tickets = await tx
      .select()
      .from(s.tickets)
      .where(eq(s.tickets.contactId, contact.id));
    const messages = tickets.length
      ? await tx
          .select({
            ticketId: s.messages.ticketId,
            direction: s.messages.direction,
            createdAt: s.messages.createdAt,
            subject: s.messages.subject,
            body: s.messages.bodyText,
          })
          .from(s.messages)
          .where(
            and(
              inArray(
                s.messages.ticketId,
                tickets.map((t) => t.id),
              ),
              ne(s.messages.direction, "note"),
            ),
          )
          .orderBy(asc(s.messages.createdAt))
      : [];
    await tx.insert(s.auditLog).values({
      organizationId,
      actorType: "user",
      actorUserId: session.userId,
      action: "contact_exported",
      entityType: "contact",
      entityId: contact.id,
    });
    return {
      exportedAt: new Date().toISOString(),
      contact: {
        email: contact.email,
        name: contact.name,
        phone: contact.phone,
        language: contact.language,
        createdAt: contact.createdAt,
      },
      tickets: tickets.map((t) => ({
        number: t.number,
        subject: t.subject,
        status: t.status,
        createdAt: t.createdAt,
        messages: messages
          .filter((m) => m.ticketId === t.id)
          .map((m) => ({
            direction: m.direction,
            createdAt: m.createdAt,
            subject: m.subject,
            body: m.body,
          })),
      })),
    };
  });
}
