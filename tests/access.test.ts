import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPendingAttachment } from "@/db/repositories/attachments";
import { upsertContact } from "@/db/repositories/contacts";
import { ShopNotFoundError, startOutboundTicket } from "@/db/repositories/outbound";
import { createTicket } from "@/db/repositories/tickets";
import * as s from "@/db/schema";
import { withPrivileged, withTenant, type TenantTx } from "@/db/tenant";
import type { Db } from "@/db/types";
import {
  canAssign,
  canAssignOthers,
  canSeeReports,
  canWorkTickets,
  passwordLinkProblem,
} from "@/domain/permissions";
import { expectDbError } from "./helpers/errors";
import { createTestDb, seedOrganization } from "./helpers/db";

describe("regels per rol", () => {
  it("meelezer leest en plaatst notities, verder niets", () => {
    expect(canWorkTickets("viewer")).toBe(false);
    expect(canAssign("viewer", "a", "a")).toBe(false);
    expect(canWorkTickets("agent")).toBe(true);
  });

  it("agent wijst alleen aan zichzelf of niemand toe, teamleider aan iedereen", () => {
    expect(canAssign("agent", "a", "a")).toBe(true);
    expect(canAssign("agent", "a", null)).toBe(true);
    expect(canAssign("agent", "a", "b")).toBe(false);
    expect(canAssignOthers("agent")).toBe(false);
    expect(canAssign("teamlead", "a", "b")).toBe(true);
  });

  it("rapportages vanaf teamleider", () => {
    expect(canSeeReports("agent")).toBe(false);
    expect(canSeeReports("viewer")).toBe(false);
    expect(canSeeReports("teamlead")).toBe(true);
  });

  it("wachtwoordlinks: geen overname van bestaande accounts door een beheerder", () => {
    const base = { targetHasPassword: true, targetInOtherOrganization: false };
    // Bestaand account: alleen de eigenaar.
    for (const targetRole of ["agent", "admin", "viewer"] as const) {
      expect(passwordLinkProblem({ ...base, actorRole: "admin", targetRole })).toMatch(
        /eigenaar/,
      );
      expect(passwordLinkProblem({ ...base, actorRole: "owner", targetRole })).toBeNull();
    }
    // Uitnodiging (nog geen wachtwoord): ook een beheerder, maar niet voor een eigenaar.
    const invite = { targetHasPassword: false, targetInOtherOrganization: false };
    expect(
      passwordLinkProblem({ ...invite, actorRole: "admin", targetRole: "agent" }),
    ).toBeNull();
    expect(
      passwordLinkProblem({ ...invite, actorRole: "admin", targetRole: "admin" }),
    ).toBeNull();
    expect(
      passwordLinkProblem({ ...invite, actorRole: "admin", targetRole: "owner" }),
    ).toMatch(/eigenaar/);
    // Ook lid elders: nooit.
    expect(
      passwordLinkProblem({
        ...invite,
        targetInOtherOrganization: true,
        actorRole: "owner",
        targetRole: "agent",
      }),
    ).toMatch(/andere organisatie/);
    expect(
      passwordLinkProblem({ ...invite, actorRole: "agent", targetRole: "viewer" }),
    ).toMatch(/beheerders/);
  });
});

describe("toegang per shop (database)", () => {
  let db: Db;
  let close: () => Promise<void>;
  let org: Awaited<ReturnType<typeof seedOrganization>>;
  let frShopId: string;
  const owner = randomUUID();
  const agentNl = randomUUID();
  const agentAll = randomUUID();
  const viewerFr = randomUUID();
  const ticket: Record<"nl" | "fr", string> = { nl: "", fr: "" };

  const as = <T>(userId: string | undefined, fn: (t: TenantTx) => Promise<T>) =>
    withTenant(db, org.org.id, fn, userId ? { userId } : {});

  beforeAll(async () => {
    ({ db, close } = await createTestDb());
    org = await seedOrganization(db, { slug: "toegang" });
    await withPrivileged(db, async (tx) => {
      const [fr] = await tx
        .insert(s.shops)
        .values({
          organizationId: org.org.id,
          code: "fr",
          name: "Boutique",
          domain: "boutique.example",
          language: "fr",
          locale: "fr-FR",
          senderName: "Service client",
          senderEmail: "service@boutique.example",
        })
        .returning();
      frShopId = fr.id;
      await tx.insert(s.users).values([
        { id: owner, email: "eigenaar@example.nl", name: "Eigenaar" },
        { id: agentNl, email: "nl@example.nl", name: "Agent NL" },
        { id: agentAll, email: "alles@example.nl", name: "Agent alles" },
        { id: viewerFr, email: "lezer@example.nl", name: "Lezer FR" },
      ]);
      await tx.insert(s.memberships).values([
        { organizationId: org.org.id, userId: owner, role: "owner", allShops: false },
        { organizationId: org.org.id, userId: agentNl, role: "agent", allShops: false },
        { organizationId: org.org.id, userId: agentAll, role: "agent", allShops: true },
        { organizationId: org.org.id, userId: viewerFr, role: "viewer", allShops: false },
      ]);
      await tx.insert(s.memberShops).values([
        { organizationId: org.org.id, userId: agentNl, shopId: org.shop.id },
        { organizationId: org.org.id, userId: viewerFr, shopId: frShopId },
      ]);
    });
    for (const [code, shopId] of [
      ["nl", org.shop.id],
      ["fr", frShopId],
    ] as const) {
      ticket[code] = await as(undefined, async (t) => {
        const contact = await upsertContact(t, { email: `klant-${code}@example.nl` });
        const created = await createTicket(
          t,
          { shopId, contactId: contact.id, subject: `Vraag ${code}` },
          { type: "system" },
        );
        const [message] = await t.tx
          .insert(s.messages)
          .values({
            organizationId: t.organizationId,
            ticketId: created.id,
            direction: "inbound",
            authorType: "contact",
            bodyText: `Bericht ${code}`,
          })
          .returning();
        await t.tx.insert(s.attachments).values({
          organizationId: t.organizationId,
          messageId: message.id,
          filename: `${code}.pdf`,
          contentType: "application/pdf",
          sizeBytes: 10,
          storageKey: `${t.organizationId}/${randomUUID()}`,
          scanStatus: "clean",
        });
        return created.id;
      });
    }
  });
  afterAll(async () => close());

  const visibleTickets = (userId?: string) =>
    as(userId, ({ tx }) => tx.select({ id: s.tickets.id }).from(s.tickets)).then((r) =>
      r.map((x) => x.id).sort(),
    );

  it("een agent met alleen NL ziet alleen NL, met alles erbij", async () => {
    expect(await visibleTickets(agentNl)).toEqual([ticket.nl]);
    const messages = await as(agentNl, ({ tx }) => tx.select().from(s.messages));
    expect(messages.map((m) => m.bodyText)).toEqual(["Bericht nl"]);
    const files = await as(agentNl, ({ tx }) => tx.select().from(s.attachments));
    expect(files.map((f) => f.filename)).toEqual(["nl.pdf"]);
    const events = await as(agentNl, ({ tx }) => tx.select().from(s.ticketEvents));
    expect(new Set(events.map((e) => e.ticketId))).toEqual(new Set([ticket.nl]));
  });

  it("eigenaar en 'alle shops' zien alles; zonder gebruiker (systeem) ook", async () => {
    const all = [ticket.nl, ticket.fr].sort();
    expect(await visibleTickets(owner)).toEqual(all);
    expect(await visibleTickets(agentAll)).toEqual(all);
    expect(await visibleTickets(undefined)).toEqual(all);
  });

  it("kan niets doen met tickets van een andere shop", async () => {
    const updated = await as(agentNl, ({ tx }) =>
      tx
        .update(s.tickets)
        .set({ priority: "urgent" })
        .where(eq(s.tickets.id, ticket.fr))
        .returning(),
    );
    expect(updated).toEqual([]);
    await expectDbError(
      as(agentNl, ({ tx, organizationId }) =>
        tx.insert(s.messages).values({
          organizationId,
          ticketId: ticket.fr,
          direction: "note",
          authorType: "user",
          bodyText: "stiekem",
        }),
      ),
      /row-level security/,
    );
    await expectDbError(
      as(agentNl, async (t) => {
        const contact = await upsertContact(t, { email: "x@example.nl" });
        return createTicket(
          t,
          { shopId: frShopId, contactId: contact.id, subject: "Niet mijn shop" },
          { type: "system" },
        );
      }),
      /row-level security/,
    );
    await expect(
      as(agentNl, (t) =>
        startOutboundTicket(t, {
          shopId: frShopId,
          userId: agentNl,
          to: "klant@example.nl",
          subject: "Hallo",
          body: "Test",
          nextStatus: "open",
        }),
      ),
    ).rejects.toThrow(ShopNotFoundError);
  });

  it("nog niet verstuurde bijlagen ziet alleen wie ze uploadde", async () => {
    const pending = await as(agentAll, (t) =>
      createPendingAttachment(t, {
        filename: "concept.pdf",
        contentType: "application/pdf",
        sizeBytes: 5,
        uploadedById: agentAll,
      }),
    );
    const mine = await as(agentAll, ({ tx }) =>
      tx.select().from(s.attachments).where(eq(s.attachments.id, pending.id)),
    );
    const other = await as(owner, ({ tx }) =>
      tx.select().from(s.attachments).where(eq(s.attachments.id, pending.id)),
    );
    expect(mine).toHaveLength(1);
    expect(other).toHaveLength(0);
  });

  it("wie uitgeschakeld is, ziet geen tickets meer", async () => {
    await withPrivileged(db, (tx) =>
      tx
        .update(s.memberships)
        .set({ active: false })
        .where(sql`${s.memberships.userId} = ${agentAll}`),
    );
    expect(await visibleTickets(agentAll)).toEqual([]);
  });

  it("een meelezer met alleen FR ziet alleen FR", async () => {
    expect(await visibleTickets(viewerFr)).toEqual([ticket.fr]);
  });
});

describe("gebruikers per organisatie", () => {
  it("de app-rol ziet alleen gebruikers van de eigen organisatie", async () => {
    const { db, close } = await createTestDb();
    try {
      const a = await seedOrganization(db, { slug: "org-a" });
      const b = await seedOrganization(db, { slug: "org-b" });
      const [ua, ub] = [randomUUID(), randomUUID()];
      await withPrivileged(db, async (tx) => {
        await tx.insert(s.users).values([
          { id: ua, email: "a@example.nl", name: "A" },
          { id: ub, email: "b@example.nl", name: "B" },
        ]);
        await tx.insert(s.memberships).values([
          { organizationId: a.org.id, userId: ua, role: "agent" },
          { organizationId: b.org.id, userId: ub, role: "agent" },
        ]);
      });
      const seen = await withTenant(db, a.org.id, ({ tx }) =>
        tx.select({ email: s.users.email }).from(s.users),
      );
      expect(seen.map((u) => u.email)).toEqual(["a@example.nl"]);
    } finally {
      await close();
    }
  });
});
