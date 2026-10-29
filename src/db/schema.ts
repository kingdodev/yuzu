/**
 * Yuzu datamodel.
 *
 * Regel 1: elke tabel met klant- of bedrijfsdata heeft een `organizationId`.
 * Nu is er één organisatie (het eigen bedrijf); later, als Yuzu SaaS wordt,
 * één per klant. Row Level Security in Postgres dwingt die scheiding af
 * (zie drizzle/*_rls.sql en src/db/tenant.ts).
 *
 * Regel 2: de shop is een kernbegrip. Tickets, sjablonen en kennisbank horen
 * bij een shop, zodat taal, afzender en Magento-store per shop kloppen.
 */
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const id = () =>
  uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`);
const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();
const organizationId = () =>
  uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" });

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const roleEnum = pgEnum("role", [
  "owner",
  "admin",
  "teamlead",
  "agent",
  "viewer",
]);

export const languageEnum = pgEnum("language", ["nl", "fr", "es", "en", "de"]);

export const ticketStatusEnum = pgEnum("ticket_status", [
  "new",
  "open",
  "pending_customer",
  "pending_third_party",
  "solved",
  "closed",
]);

export const ticketPriorityEnum = pgEnum("ticket_priority", [
  "low",
  "normal",
  "high",
  "urgent",
]);

export const channelEnum = pgEnum("channel", ["email", "form"]);

export const messageDirectionEnum = pgEnum("message_direction", [
  "inbound",
  "outbound",
  "note",
]);

export const authorTypeEnum = pgEnum("author_type", [
  "contact",
  "user",
  "ai",
  "system",
]);

export const scanStatusEnum = pgEnum("scan_status", [
  "pending",
  "clean",
  "infected",
  "failed",
]);

export const actorTypeEnum = pgEnum("actor_type", ["user", "ai", "system"]);

// ---------------------------------------------------------------------------
// Organisaties, shops, gebruikers
// ---------------------------------------------------------------------------

export const organizations = pgTable("organizations", {
  id: id(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  /** Teller voor ticketnummers; alleen ophogen via allocateTicketNumber(). */
  ticketSeq: bigint("ticket_seq", { mode: "number" }).notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const shops = pgTable(
  "shops",
  {
    id: id(),
    organizationId: organizationId(),
    /** Korte code, bijv. "nl", "be", "fr", "es". */
    code: text("code").notNull(),
    name: text("name").notNull(),
    domain: text("domain").notNull(),
    language: languageEnum("language").notNull(),
    /** BCP-47, bijv. "nl-BE". Bepaalt datum- en getalnotatie. */
    locale: text("locale").notNull(),
    timezone: text("timezone").notNull().default("Europe/Amsterdam"),
    senderName: text("sender_name").notNull(),
    senderEmail: text("sender_email").notNull(),
    signature: text("signature").notNull().default(""),
    /** Store-ID in Magento; alle shops draaien in één installatie. */
    magentoStoreId: integer("magento_store_id"),
    magentoWebsiteId: integer("magento_website_id"),
    /** Prefix van ordernummers, helpt bij herkennen in mailtekst. */
    orderNumberPrefix: text("order_number_prefix"),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("shops_org_code_uq").on(t.organizationId, t.code)],
);

/**
 * Gebruiker van Yuzu (agent, beheerder). `id` is gelijk aan de Supabase
 * Auth-gebruikers-ID. Een gebruiker kan later lid zijn van meerdere
 * organisaties; daarom staat de rol op `memberships`.
 */
export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  language: languageEnum("language").notNull().default("nl"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const memberships = pgTable(
  "memberships",
  {
    organizationId: organizationId(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: roleEnum("role").notNull().default("agent"),
    /** true = toegang tot alle shops; false = alleen shops in member_shops. */
    allShops: boolean("all_shops").notNull().default(true),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.organizationId, t.userId] })],
);

export const memberShops = pgTable(
  "member_shops",
  {
    organizationId: organizationId(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.shopId] })],
);

export const teams = pgTable(
  "teams",
  {
    id: id(),
    organizationId: organizationId(),
    name: text("name").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("teams_org_name_uq").on(t.organizationId, t.name)],
);

export const teamMembers = pgTable(
  "team_members",
  {
    organizationId: organizationId(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.teamId, t.userId] })],
);

// ---------------------------------------------------------------------------
// Klanten en tickets
// ---------------------------------------------------------------------------

export const contacts = pgTable(
  "contacts",
  {
    id: id(),
    organizationId: organizationId(),
    /** Altijd genormaliseerd via normalizeEmail(). */
    email: text("email").notNull(),
    name: text("name"),
    phone: text("phone"),
    language: languageEnum("language"),
    notes: text("notes").notNull().default(""),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("contacts_org_email_uq").on(t.organizationId, t.email)],
);

/** Koppeling klant ↔ Magento-klantaccount, per shop (gasten hebben er geen). */
export const contactMagentoLinks = pgTable(
  "contact_magento_links",
  {
    organizationId: organizationId(),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    magentoCustomerId: integer("magento_customer_id").notNull(),
  },
  (t) => [primaryKey({ columns: [t.contactId, t.shopId] })],
);

export const tickets = pgTable(
  "tickets",
  {
    id: id(),
    organizationId: organizationId(),
    /** Leesbaar nummer, oplopend per organisatie (bijv. #1042). */
    number: bigint("number", { mode: "number" }).notNull(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id),
    subject: text("subject").notNull(),
    status: ticketStatusEnum("status").notNull().default("new"),
    priority: ticketPriorityEnum("priority").notNull().default("normal"),
    channel: channelEnum("channel").notNull().default("email"),
    language: languageEnum("language"),
    assigneeId: uuid("assignee_id").references(() => users.id, {
      onDelete: "set null",
    }),
    teamId: uuid("team_id").references(() => teams.id, {
      onDelete: "set null",
    }),
    /** Door AI bepaald vraagtype, bijv. "where_is_my_order", "return". */
    intent: text("intent"),
    snoozedUntil: timestamp("snoozed_until", { withTimezone: true }),
    firstResponseAt: timestamp("first_response_at", { withTimezone: true }),
    solvedAt: timestamp("solved_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("tickets_org_number_uq").on(t.organizationId, t.number),
    index("tickets_org_status_idx").on(
      t.organizationId,
      t.status,
      t.lastMessageAt,
    ),
    index("tickets_org_assignee_idx").on(t.organizationId, t.assigneeId),
    index("tickets_contact_idx").on(t.contactId),
  ],
);

export const messages = pgTable(
  "messages",
  {
    id: id(),
    organizationId: organizationId(),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    direction: messageDirectionEnum("direction").notNull(),
    authorType: authorTypeEnum("author_type").notNull(),
    authorUserId: uuid("author_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    fromEmail: text("from_email"),
    toEmails: text("to_emails")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    ccEmails: text("cc_emails")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    subject: text("subject"),
    bodyText: text("body_text").notNull().default(""),
    /** Alleen opgeschoonde HTML; nooit de ruwe HTML uit een mail. */
    bodyHtml: text("body_html"),
    /** Message-ID-header, voor threading. */
    messageIdHeader: text("message_id_header"),
    inReplyTo: text("in_reply_to"),
    referencesHeader: text("references_header")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    /** Pad naar de ruwe .eml in objectopslag. */
    rawStorageKey: text("raw_storage_key"),
    /** Vertaling naar de taal van de agent, indien gemaakt. */
    translatedText: text("translated_text"),
    createdAt: createdAt(),
  },
  (t) => [
    index("messages_ticket_idx").on(t.ticketId, t.createdAt),
    uniqueIndex("messages_org_msgid_uq").on(t.organizationId, t.messageIdHeader),
  ],
);

export const attachments = pgTable(
  "attachments",
  {
    id: id(),
    organizationId: organizationId(),
    messageId: uuid("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    filename: text("filename").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    storageKey: text("storage_key").notNull(),
    scanStatus: scanStatusEnum("scan_status").notNull().default("pending"),
    createdAt: createdAt(),
  },
  (t) => [index("attachments_message_idx").on(t.messageId)],
);

export const tags = pgTable(
  "tags",
  {
    id: id(),
    organizationId: organizationId(),
    name: text("name").notNull(),
    color: text("color").notNull().default("gray"),
  },
  (t) => [uniqueIndex("tags_org_name_uq").on(t.organizationId, t.name)],
);

export const ticketTags = pgTable(
  "ticket_tags",
  {
    organizationId: organizationId(),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.ticketId, t.tagId] })],
);

/** Orders die bij een ticket horen (automatisch of door de agent gekoppeld). */
export const ticketOrders = pgTable(
  "ticket_orders",
  {
    organizationId: organizationId(),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    /** Het ordernummer zoals de klant het ziet (increment_id). */
    orderNumber: text("order_number").notNull(),
    linkedBy: actorTypeEnum("linked_by").notNull().default("system"),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.ticketId, t.orderNumber] })],
);

// ---------------------------------------------------------------------------
// Historie: events (voor analytics) en auditlog (voor AVG en beveiliging)
// ---------------------------------------------------------------------------

/**
 * Elke wijziging aan een ticket (status, toewijzing, prioriteit, reactie).
 * Analytics rekent hieruit reactie- en oplostijden; daarom vanaf dag één.
 */
export const ticketEvents = pgTable(
  "ticket_events",
  {
    id: id(),
    organizationId: organizationId(),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    fromValue: text("from_value"),
    toValue: text("to_value"),
    actorType: actorTypeEnum("actor_type").notNull(),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
  },
  (t) => [index("ticket_events_ticket_idx").on(t.ticketId, t.createdAt)],
);

/** Gevoelige acties: export, verwijdering, rolwijziging, inzage, AI-acties. */
export const auditLog = pgTable(
  "audit_log",
  {
    id: id(),
    organizationId: organizationId(),
    actorType: actorTypeEnum("actor_type").notNull(),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [index("audit_log_org_created_idx").on(t.organizationId, t.createdAt)],
);

/** Tabellen waarop Row Level Security per organisatie geldt. */
export const TENANT_TABLES = [
  "shops",
  "memberships",
  "member_shops",
  "teams",
  "team_members",
  "contacts",
  "contact_magento_links",
  "tickets",
  "messages",
  "attachments",
  "tags",
  "ticket_tags",
  "ticket_orders",
  "ticket_events",
  "audit_log",
] as const;
