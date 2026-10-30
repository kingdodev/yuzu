"use server";

import { and, eq, inArray, isNotNull, ne, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db/client";
import { deleteAttachmentsOfTickets } from "@/db/repositories/attachments";
import { deleteSessionsIfInactive } from "@/db/repositories/auth";
import * as s from "@/db/schema";
import { getFileStore } from "@/integrations/storage";
import { withPrivileged, type TenantTx } from "@/db/tenant";
import { normalizeEmail } from "@/domain/contacts";
import { isOwner, requirePermission } from "@/domain/permissions";
import { asAdmin, asOwner, type Session } from "../session";

export type FormState =
  { ok: true; message: string } | { ok: false; error: string } | null;

const uuid = z.string().uuid();
const lang = z.enum(["nl", "fr", "es", "en", "de"]);

function fail(e: unknown): FormState {
  if (e instanceof z.ZodError)
    return { ok: false, error: e.issues[0]?.message ?? "Controleer de invoer" };
  // Databasefouten (met een `cause` van Postgres) niet letterlijk tonen.
  if (e instanceof Error && e.cause === undefined) return { ok: false, error: e.message };
  // Alleen de foutcode loggen: de melding bevat de queryparameters (bijv. e-mailadressen).
  if (e instanceof Error) {
    console.error(
      "Opslaan mislukt",
      (e.cause as { code?: string } | undefined)?.code ?? "onbekend",
    );
  }
  return { ok: false, error: "Opslaan mislukt. Probeer het opnieuw." };
}

/**
 * Controleer dat ID's uit een formulier bij de eigen organisatie horen. RLS
 * beschermt de rijen zelf, maar niet de verwijzingen ernaar: zonder deze
 * controle kun je een rij maken die naar een shop of team van een andere
 * organisatie wijst.
 */
async function assertOwn(
  tx: TenantTx["tx"],
  kind: "shop" | "team" | "member",
  ids: readonly (string | null)[],
) {
  const wanted = [...new Set(ids.filter((id): id is string => id !== null))];
  if (wanted.length === 0) return;
  const found =
    kind === "shop"
      ? await tx
          .select({ id: s.shops.id })
          .from(s.shops)
          .where(inArray(s.shops.id, wanted))
      : kind === "team"
        ? await tx
            .select({ id: s.teams.id })
            .from(s.teams)
            .where(inArray(s.teams.id, wanted))
        : await tx
            .select({ id: s.memberships.userId })
            .from(s.memberships)
            .where(inArray(s.memberships.userId, wanted));
  if (found.length !== wanted.length) {
    throw new Error(
      kind === "shop"
        ? "Onbekende shop"
        : kind === "team"
          ? "Onbekend team"
          : "Onbekende gebruiker",
    );
  }
}

async function audit(
  { tx, organizationId }: TenantTx,
  session: Session,
  action: string,
  entityType: string,
  entityId: string | null,
  metadata: Record<string, unknown> = {},
) {
  await tx.insert(s.auditLog).values({
    organizationId,
    actorType: "user",
    actorUserId: session.userId,
    action,
    entityType,
    entityId,
    metadata,
  });
}

const optionalInt = z.preprocess(
  (v) => (v === "" || v == null ? null : Number(v)),
  z.number().int().positive().nullable(),
);

// ---------------------------------------------------------------------------
// Shops
// ---------------------------------------------------------------------------

const shopSchema = z.object({
  id: uuid.optional().or(z.literal("")),
  code: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z]{2,5}$/, "Code: 2 tot 5 letters, bijv. nl"),
  name: z.string().trim().min(1, "Naam is verplicht"),
  domain: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/, "Vul een domein in zoals voorbeeldshop.nl"),
  language: lang,
  locale: z.string().trim().min(2),
  senderName: z.string().trim().min(1, "Afzendernaam is verplicht"),
  senderEmail: z.string().trim().email("Ongeldig afzenderadres"),
  signature: z.string(),
  magentoStoreId: optionalInt,
  orderNumberPrefix: z.string().trim(),
  openingHours: z.string().trim(),
  toneOfVoice: z.string().trim(),
  active: z.preprocess((v) => v === "on", z.boolean()),
});

export async function saveShop(_: FormState, form: FormData): Promise<FormState> {
  let created: string | null = null;
  try {
    const data = shopSchema.parse(Object.fromEntries(form));
    await asAdmin(async (t, session) => {
      const values = {
        code: data.code,
        name: data.name,
        domain: data.domain,
        language: data.language,
        locale: data.locale,
        senderName: data.senderName,
        senderEmail: data.senderEmail,
        signature: data.signature,
        magentoStoreId: data.magentoStoreId,
        magentoWebsiteId: data.magentoStoreId,
        orderNumberPrefix: data.orderNumberPrefix || null,
        openingHours: data.openingHours,
        toneOfVoice: data.toneOfVoice,
        active: data.active,
      };
      if (data.id) {
        await t.tx
          .update(s.shops)
          .set({ ...values, updatedAt: sql`now()` })
          .where(eq(s.shops.id, data.id));
        await audit(t, session, "shop_updated", "shop", data.id);
      } else {
        const [row] = await t.tx
          .insert(s.shops)
          .values({ ...values, organizationId: t.organizationId })
          .returning();
        created = row.id;
        await audit(t, session, "shop_created", "shop", row.id, { code: data.code });
      }
    });
  } catch (e) {
    if (String(e).includes("shops_org_code_uq"))
      return { ok: false, error: "Er is al een shop met deze code" };
    return fail(e);
  }
  if (created) redirect(`/beheer/shops/${created}`);
  refresh();
  return { ok: true, message: "Shop opgeslagen" };
}

// ---------------------------------------------------------------------------
// Gebruikers en rollen
// ---------------------------------------------------------------------------

const roleSchema = z.enum(["owner", "admin", "teamlead", "agent", "viewer"]);

export async function inviteMember(_: FormState, form: FormData): Promise<FormState> {
  try {
    const name = z.string().trim().min(1, "Naam is verplicht").parse(form.get("name"));
    const email = normalizeEmail(z.string().parse(form.get("email")));
    const role = roleSchema.parse(form.get("role"));
    // Gebruikers zijn organisatie-overstijgend; aanmaken mag alleen via een beheerpad.
    const session = await asAdmin(async (_t, session) => session);
    requirePermission(
      role !== "owner" || isOwner(session.role),
      "Alleen een eigenaar kan iemand eigenaar maken.",
    );
    const db = await getDb();
    const userId = await withPrivileged(db, async (tx) => {
      const [existing] = await tx
        .select({ id: s.users.id })
        .from(s.users)
        .where(eq(s.users.email, email));
      if (existing) return existing.id;
      const [row] = await tx
        .insert(s.users)
        .values({ id: crypto.randomUUID(), email, name })
        .returning({ id: s.users.id });
      return row.id;
    });
    await asAdmin(async (t) => {
      // Bestaande leden niet aanraken: rol en status wijzig je in de lijst
      // (updateMember), met de controles die daar gelden.
      const added = await t.tx
        .insert(s.memberships)
        .values({ organizationId: t.organizationId, userId, role })
        .onConflictDoNothing()
        .returning({ userId: s.memberships.userId });
      if (added.length === 0) {
        throw new Error(
          "Deze persoon is al lid. Wijzig de rol of zet hem weer op actief in de lijst hierboven.",
        );
      }
      await audit(t, session, "member_invited", "user", userId, { role });
    });
  } catch (e) {
    return fail(e);
  }
  refresh();
  return {
    ok: true,
    message:
      "Gebruiker toegevoegd. Maak hierboven bij de gebruiker een uitnodigingslink en stuur die door.",
  };
}

export async function updateMember(_: FormState, form: FormData): Promise<FormState> {
  try {
    const userId = uuid.parse(form.get("userId"));
    const role = roleSchema.parse(form.get("role"));
    const allShops = form.get("allShops") === "on";
    const active = form.get("active") === "on";
    const shopIds = z.array(uuid).parse(form.getAll("shops"));
    await asAdmin(async (t, session) => {
      const [before] = await t.tx
        .select()
        .from(s.memberships)
        .where(eq(s.memberships.userId, userId));
      if (!before) throw new Error("Gebruiker niet gevonden");
      requirePermission(
        isOwner(session.role) || (before.role !== "owner" && role !== "owner"),
        "Alleen een eigenaar kan eigenaars wijzigen of iemand eigenaar maken.",
      );
      if (before.role === "owner" && (role !== "owner" || !active)) {
        const owners = await t.tx
          .select({ id: s.memberships.userId })
          .from(s.memberships)
          .where(
            and(
              eq(s.memberships.role, "owner"),
              eq(s.memberships.active, true),
              ne(s.memberships.userId, userId),
            ),
          );
        if (owners.length === 0)
          throw new Error("Er moet altijd minstens één actieve eigenaar zijn");
      }
      await t.tx
        .update(s.memberships)
        .set({ role, allShops, active })
        .where(eq(s.memberships.userId, userId));
      await assertOwn(t.tx, "shop", shopIds);
      await t.tx.delete(s.memberShops).where(eq(s.memberShops.userId, userId));
      if (!allShops && shopIds.length > 0) {
        await t.tx.insert(s.memberShops).values(
          shopIds.map((shopId) => ({
            organizationId: t.organizationId,
            userId,
            shopId,
          })),
        );
      }
      await audit(t, session, "member_updated", "user", userId, {
        from: before.role,
        to: role,
        active,
        allShops,
      });
    });
    // Uitgeschakeld en nergens anders meer actief? Dan overal uitloggen.
    if (!active) await deleteSessionsIfInactive(await getDb(), userId);
  } catch (e) {
    return fail(e);
  }
  refresh();
  return { ok: true, message: "Opgeslagen" };
}

// ---------------------------------------------------------------------------
// Teams en labels
// ---------------------------------------------------------------------------

export async function createTeam(_: FormState, form: FormData): Promise<FormState> {
  try {
    const name = z
      .string()
      .trim()
      .min(1, "Geef het team een naam")
      .parse(form.get("name"));
    await asAdmin(({ tx, organizationId }) =>
      tx.insert(s.teams).values({ organizationId, name }),
    );
  } catch (e) {
    if (String(e).includes("teams_org_name_uq"))
      return { ok: false, error: "Er is al een team met deze naam" };
    return fail(e);
  }
  refresh();
  return { ok: true, message: "Team aangemaakt" };
}

export async function deleteTeam(teamId: string) {
  const id = uuid.parse(teamId);
  await asAdmin(({ tx }) => tx.delete(s.teams).where(eq(s.teams.id, id)));
  refresh();
}

export async function toggleTeamMember(teamId: string, userId: string) {
  const team = uuid.parse(teamId);
  const user = uuid.parse(userId);
  await asAdmin(async ({ tx, organizationId }) => {
    await assertOwn(tx, "team", [team]);
    await assertOwn(tx, "member", [user]);
    const removed = await tx
      .delete(s.teamMembers)
      .where(and(eq(s.teamMembers.teamId, team), eq(s.teamMembers.userId, user)))
      .returning();
    if (removed.length === 0)
      await tx
        .insert(s.teamMembers)
        .values({ organizationId, teamId: team, userId: user });
  });
  refresh();
}

export async function saveTag(_: FormState, form: FormData): Promise<FormState> {
  try {
    const id = form.get("id") ? uuid.parse(form.get("id")) : null;
    const name = z
      .string()
      .trim()
      .min(1, "Geef het label een naam")
      .max(40)
      .parse(form.get("name"));
    const color = z
      .enum(["gray", "green", "blue", "purple", "red"])
      .parse(form.get("color"));
    await asAdmin(({ tx, organizationId }) =>
      id
        ? tx.update(s.tags).set({ name, color }).where(eq(s.tags.id, id))
        : tx.insert(s.tags).values({ organizationId, name, color }),
    );
  } catch (e) {
    if (String(e).includes("tags_org_name_uq"))
      return { ok: false, error: "Er is al een label met deze naam" };
    return fail(e);
  }
  refresh();
  return { ok: true, message: "Label opgeslagen" };
}

export async function deleteTag(tagId: string) {
  const id = uuid.parse(tagId);
  await asAdmin(({ tx }) => tx.delete(s.tags).where(eq(s.tags.id, id)));
  refresh();
}

// ---------------------------------------------------------------------------
// Sjablonen
// ---------------------------------------------------------------------------

export async function saveTemplate(_: FormState, form: FormData): Promise<FormState> {
  try {
    const id = form.get("id") ? uuid.parse(form.get("id")) : null;
    const name = z
      .string()
      .trim()
      .min(1, "Geef het sjabloon een naam")
      .parse(form.get("name"));
    const language = lang.parse(form.get("language"));
    const shopId = form.get("shopId") ? uuid.parse(form.get("shopId")) : null;
    const body = z.string().trim().min(1, "Het sjabloon is leeg").parse(form.get("body"));
    await asAdmin(async ({ tx, organizationId }) => {
      await assertOwn(tx, "shop", [shopId]);
      return id
        ? tx
            .update(s.templates)
            .set({ name, language, shopId, body, updatedAt: sql`now()` })
            .where(eq(s.templates.id, id))
        : tx.insert(s.templates).values({ organizationId, name, language, shopId, body });
    });
  } catch (e) {
    return fail(e);
  }
  refresh();
  return { ok: true, message: "Sjabloon opgeslagen" };
}

export async function deleteTemplate(templateId: string) {
  const id = uuid.parse(templateId);
  await asAdmin(({ tx }) => tx.delete(s.templates).where(eq(s.templates.id, id)));
  refresh();
}

// ---------------------------------------------------------------------------
// Kennisbank
// ---------------------------------------------------------------------------

export async function addKnowledgeUrl(_: FormState, form: FormData): Promise<FormState> {
  try {
    const shopId = uuid.parse(form.get("shopId"));
    const url = z
      .string()
      .trim()
      .url("Vul een volledige URL in, met https://")
      // Alleen webpagina's: geen javascript:, file: of andere schema's.
      .refine((u) => /^https?:\/\//i.test(u), "Alleen adressen die met https:// beginnen")
      .parse(form.get("url"));
    await asAdmin(async ({ tx, organizationId }) => {
      const [shop] = await tx
        .select({ domain: s.shops.domain })
        .from(s.shops)
        .where(eq(s.shops.id, shopId));
      const host = new URL(url).hostname.replace(/^www\./, "");
      if (!shop || host !== shop.domain) {
        throw new Error(
          `Alleen pagina's van ${shop?.domain ?? "deze shop"} kunnen worden toegevoegd`,
        );
      }
      await tx
        .insert(s.knowledgeSources)
        .values({
          organizationId,
          shopId,
          kind: "page",
          title: new URL(url).pathname,
          url,
          status: "pending",
        })
        .onConflictDoUpdate({
          target: [s.knowledgeSources.shopId, s.knowledgeSources.url],
          set: { status: "pending" },
        });
    });
  } catch (e) {
    return fail(e);
  }
  refresh();
  return {
    ok: true,
    message: "Pagina toegevoegd; hij wordt bij de volgende crawl ingelezen",
  };
}

export async function addKnowledgeNote(_: FormState, form: FormData): Promise<FormState> {
  try {
    const shopId = uuid.parse(form.get("shopId"));
    const title = z
      .string()
      .trim()
      .min(1, "Geef de notitie een titel")
      .parse(form.get("title"));
    const contentText = z
      .string()
      .trim()
      .min(1, "De notitie is leeg")
      .parse(form.get("content"));
    await asAdmin(async ({ tx, organizationId }) => {
      await assertOwn(tx, "shop", [shopId]);
      return tx.insert(s.knowledgeSources).values({
        organizationId,
        shopId,
        kind: "note",
        title,
        contentText,
        status: "indexed",
        lastCrawledAt: new Date(),
      });
    });
  } catch (e) {
    return fail(e);
  }
  refresh();
  return { ok: true, message: "Werkinstructie toegevoegd" };
}

export async function uploadKnowledgeFile(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  try {
    const shopId = uuid.parse(form.get("shopId"));
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) throw new Error("Kies een bestand");
    if (file.size > 20 * 1024 * 1024)
      throw new Error("Bestanden mogen maximaal 20 MB zijn");
    if (!/\.(pdf|docx|txt|md|csv)$/i.test(file.name))
      throw new Error("Alleen PDF, DOCX, TXT, MD of CSV");
    await asAdmin(async ({ tx, organizationId }) => {
      await assertOwn(tx, "shop", [shopId]);
      return tx.insert(s.knowledgeSources).values({
        organizationId,
        shopId,
        kind: "upload",
        title: file.name,
        status: "pending",
      });
    });
  } catch (e) {
    return fail(e);
  }
  refresh();
  return {
    ok: true,
    message: "Bestand toegevoegd. In de demo wordt de inhoud nog niet verwerkt.",
  };
}

export async function setKnowledgeStatus(
  sourceId: string,
  status: "excluded" | "pending",
) {
  const id = uuid.parse(sourceId);
  await asAdmin(({ tx }) =>
    tx
      .update(s.knowledgeSources)
      .set({ status, updatedAt: sql`now()` })
      .where(eq(s.knowledgeSources.id, id)),
  );
  refresh();
}

/** Demo: doet alsof de crawler alle wachtende pagina's van een shop heeft ingelezen. */
export async function recrawlShop(shopId: string) {
  const id = uuid.parse(shopId);
  await asAdmin(({ tx }) =>
    tx
      .update(s.knowledgeSources)
      .set({ status: "indexed", lastCrawledAt: new Date(), error: null })
      .where(
        and(
          eq(s.knowledgeSources.shopId, id),
          inArray(s.knowledgeSources.status, ["pending", "indexed", "failed"]),
          eq(s.knowledgeSources.kind, "page"),
        ),
      ),
  );
  refresh();
}

// ---------------------------------------------------------------------------
// AI-instellingen
// ---------------------------------------------------------------------------

export async function saveAiIntent(_: FormState, form: FormData): Promise<FormState> {
  try {
    const intent = z.string().min(1).parse(form.get("intent"));
    const mode = z.enum(["off", "draft", "autopilot"]).parse(form.get("mode"));
    const threshold = z.coerce
      .number()
      .int()
      .min(50, "Minimaal 50")
      .max(100, "Maximaal 100")
      .parse(form.get("threshold"));
    await asAdmin(async (t, session) => {
      await t.tx
        .update(s.aiIntentSettings)
        .set({ mode, confidenceThreshold: threshold, updatedAt: sql`now()` })
        .where(eq(s.aiIntentSettings.intent, intent));
      await audit(t, session, "ai_setting_changed", "ai_intent", intent, {
        mode,
        threshold,
      });
    });
  } catch (e) {
    return fail(e);
  }
  refresh();
  return { ok: true, message: "Opgeslagen" };
}

// ---------------------------------------------------------------------------
// Privacy
// ---------------------------------------------------------------------------

export async function saveRetention(_: FormState, form: FormData): Promise<FormState> {
  try {
    const shopId = uuid.parse(form.get("shopId"));
    const tickets = z.coerce
      .number()
      .int()
      .min(30, "Minimaal 30 dagen")
      .max(3650)
      .parse(form.get("tickets"));
    const attachments = z.coerce
      .number()
      .int()
      .min(7, "Minimaal 7 dagen")
      .max(3650)
      .parse(form.get("attachments"));
    await asOwner(async (t, session) => {
      await t.tx
        .update(s.shops)
        .set({
          retentionDaysTickets: tickets,
          retentionDaysAttachments: attachments,
          updatedAt: sql`now()`,
        })
        .where(eq(s.shops.id, shopId));
      await audit(t, session, "retention_changed", "shop", shopId, {
        tickets,
        attachments,
      });
    });
  } catch (e) {
    return fail(e);
  }
  refresh();
  return { ok: true, message: "Bewaartermijnen opgeslagen" };
}

/**
 * Recht op vergetelheid (AVG art. 17): naam, e-mail, telefoon en berichttekst
 * van één contact worden onherroepelijk weggehaald. Ticketnummers en
 * tijdstippen blijven, zodat de statistieken kloppen.
 */
export async function anonymizeContact(_: FormState, form: FormData): Promise<FormState> {
  try {
    const contactId = uuid.parse(form.get("contactId"));
    if (form.get("confirm") !== "VERWIJDER")
      throw new Error("Typ VERWIJDER om te bevestigen");
    const fileKeys = await asOwner(async (t, session) => {
      const ticketIds = (
        await t.tx
          .select({ id: s.tickets.id })
          .from(s.tickets)
          .where(eq(s.tickets.contactId, contactId))
      ).map((r) => r.id);
      // Bijlagen en de ruwe mails kunnen ook persoonsgegevens bevatten.
      const keys = await deleteAttachmentsOfTickets(t, ticketIds);
      if (ticketIds.length > 0) {
        const raw = await t.tx
          .select({ key: s.messages.rawStorageKey })
          .from(s.messages)
          .where(
            and(
              inArray(s.messages.ticketId, ticketIds),
              isNotNull(s.messages.rawStorageKey),
            ),
          );
        keys.push(...raw.map((r) => r.key!));
      }
      await t.tx
        .update(s.contacts)
        .set({
          email: `verwijderd-${contactId}@anoniem.invalid`,
          name: null,
          phone: null,
          notes: "",
          updatedAt: sql`now()`,
        })
        .where(eq(s.contacts.id, contactId));
      if (ticketIds.length > 0) {
        await t.tx
          .update(s.messages)
          .set({
            subject: null,
            bodyText: "[verwijderd op verzoek van de klant]",
            bodyHtml: null,
            translatedText: null,
            fromEmail: null,
            toEmails: [],
            ccEmails: [],
            rawStorageKey: null,
          })
          .where(inArray(s.messages.ticketId, ticketIds));
        // Ordernummers zijn via Magento terug te voeren op de klant.
        await t.tx
          .delete(s.ticketOrders)
          .where(inArray(s.ticketOrders.ticketId, ticketIds));
        await t.tx
          .update(s.tickets)
          .set({ subject: "[verwijderd]" })
          .where(inArray(s.tickets.id, ticketIds));
        await t.tx.delete(s.aiDrafts).where(inArray(s.aiDrafts.ticketId, ticketIds));
      }
      await t.tx
        .delete(s.contactMagentoLinks)
        .where(eq(s.contactMagentoLinks.contactId, contactId));
      await audit(t, session, "contact_anonymized", "contact", contactId, {
        tickets: ticketIds.length,
        attachments: keys.length,
      });
      return keys;
    });
    // Pas na de transactie de bestanden wissen; mislukt dat, dan staan ze
    // nergens meer in de database en ruimt een onderhoudsjob ze later op.
    if (fileKeys.length > 0) {
      try {
        await getFileStore()?.remove(fileKeys);
      } catch (e) {
        console.error(
          "Bijlagen wissen na anonimiseren mislukt",
          e instanceof Error ? e.message : e,
        );
      }
    }
  } catch (e) {
    return fail(e);
  }
  // Het zoekadres bestaat niet meer; toon een bevestiging in plaats van "niet gevonden".
  redirect("/beheer/privacy?verwijderd=1");
}
