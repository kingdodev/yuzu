import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { upsertContact } from "@/db/repositories/contacts";
import {
  applyFiltersToNewTicket,
  applyFilterToExisting,
  listFilters,
  saveFilter,
  type FilterInput,
} from "@/db/repositories/filters";
import { createTicket } from "@/db/repositories/tickets";
import * as s from "@/db/schema";
import { withTenant } from "@/db/tenant";
import type { Db } from "@/db/types";
import {
  applyFilterRules,
  filterMatches,
  hasAction,
  hasCondition,
  parseWords,
  type FilterRule,
} from "@/domain/filters";
import { isLabelView, isListView, labelIdOf, labelView } from "@/domain/views";
import { createTestDb, seedOrganization } from "./helpers/db";

const rule = (r: Partial<FilterRule>): FilterRule => ({
  id: "f1",
  fromContains: null,
  subjectContains: null,
  hasWords: null,
  shopId: null,
  tagId: "tag-1",
  skipInbox: false,
  enabled: true,
  ...r,
});

const mail = {
  fromEmail: "facturen@leverancier.example",
  fromName: "Leverancier BV",
  subject: "Factuur oktober 2026",
  body: "In de bijlage vind je de factuur. Betaal binnen 14 dagen.",
  shopId: "shop-nl",
};

describe("mailfilters: regels", () => {
  it("onderwerp, afzender en shop", () => {
    expect(filterMatches(rule({ subjectContains: "factuur" }), mail)).toBe(true);
    expect(filterMatches(rule({ subjectContains: "retour" }), mail)).toBe(false);
    expect(filterMatches(rule({ fromContains: "leverancier" }), mail)).toBe(true);
    expect(filterMatches(rule({ fromContains: "Leverancier BV" }), mail)).toBe(true);
    expect(filterMatches(rule({ fromContains: "@bol.com, @leverancier" }), mail)).toBe(
      true,
    );
    expect(filterMatches(rule({ fromContains: "@bol.com OR @amazon" }), mail)).toBe(
      false,
    );
    expect(
      filterMatches(rule({ subjectContains: "factuur", shopId: "shop-be" }), mail),
    ).toBe(false);
  });

  it("alle voorwaarden moeten kloppen", () => {
    expect(
      filterMatches(rule({ subjectContains: "factuur", fromContains: "@bol.com" }), mail),
    ).toBe(false);
  });

  it("woorden, zinnen tussen aanhalingstekens en -uitsluiten", () => {
    expect(parseWords('retour "geld terug" -klacht')).toEqual({
      must: ["retour", "geld terug"],
      mustNot: ["klacht"],
    });
    expect(filterMatches(rule({ hasWords: "betaal factuur" }), mail)).toBe(true);
    expect(filterMatches(rule({ hasWords: '"binnen 14 dagen"' }), mail)).toBe(true);
    expect(filterMatches(rule({ hasWords: '"binnen 30 dagen"' }), mail)).toBe(false);
    expect(filterMatches(rule({ hasWords: "factuur -bijlage" }), mail)).toBe(false);
  });

  it("zonder voorwaarde of uitgezet: nooit", () => {
    expect(filterMatches(rule({}), mail)).toBe(false);
    expect(
      filterMatches(rule({ subjectContains: "factuur", enabled: false }), mail),
    ).toBe(false);
    expect(
      hasCondition({
        fromContains: " ",
        subjectContains: null,
        hasWords: null,
        shopId: null,
      }),
    ).toBe(false);
    expect(hasAction({ tagId: null, skipInbox: false })).toBe(false);
    expect(hasAction({ tagId: null, skipInbox: true })).toBe(true);
  });

  it("meerdere filters: labels samen, postvak overslaan als één het zegt", () => {
    const outcome = applyFilterRules(
      [
        rule({ id: "a", subjectContains: "factuur", tagId: "t1" }),
        rule({ id: "b", fromContains: "leverancier", tagId: "t2", skipInbox: true }),
        rule({ id: "c", subjectContains: "retour", tagId: "t3" }),
      ],
      mail,
    );
    expect(outcome).toEqual({
      tagIds: ["t1", "t2"],
      skipInbox: true,
      filterIds: ["a", "b"],
    });
  });

  it("labelweergaven in de inbox", () => {
    const id = "0b0e3c1a-1111-4222-8333-444455556666";
    expect(isLabelView(labelView(id))).toBe(true);
    expect(labelIdOf(labelView(id))).toBe(id);
    expect(isListView("open")).toBe(true);
    expect(isListView("label-iets")).toBe(false);
  });
});

describe("mailfilters: toepassen", () => {
  let db: Db;
  let close: () => Promise<void>;
  let org: Awaited<ReturnType<typeof seedOrganization>>;
  let other: Awaited<ReturnType<typeof seedOrganization>>;
  let tagId: string;
  let otherTagId: string;

  async function ticketFrom(email: string, subject: string, body: string) {
    return withTenant(db, org.org.id, async (t) => {
      const contact = await upsertContact(t, { email });
      const ticket = await createTicket(
        t,
        { shopId: org.shop.id, contactId: contact.id, subject },
        { type: "system" },
      );
      await t.tx.insert(s.messages).values({
        organizationId: t.organizationId,
        ticketId: ticket.id,
        direction: "inbound",
        authorType: "contact",
        bodyText: body,
      });
      return ticket;
    });
  }

  const input = (r: Partial<FilterInput>): FilterInput => ({
    fromContains: null,
    subjectContains: null,
    hasWords: null,
    shopId: null,
    tagId: null,
    skipInbox: false,
    enabled: true,
    ...r,
  });

  beforeAll(async () => {
    ({ db, close } = await createTestDb());
    org = await seedOrganization(db, { slug: "filter" });
    other = await seedOrganization(db, { slug: "filter-ander" });
    [{ id: tagId }] = await withTenant(db, org.org.id, (t) =>
      t.tx
        .insert(s.tags)
        .values({ organizationId: org.org.id, name: "Facturen" })
        .returning(),
    );
    [{ id: otherTagId }] = await withTenant(db, other.org.id, (t) =>
      t.tx
        .insert(s.tags)
        .values({ organizationId: other.org.id, name: "Van een ander" })
        .returning(),
    );
  });
  afterAll(async () => close());

  it("nieuwe mail: label erbij en postvak overslaan (met ticket_events)", async () => {
    await withTenant(db, org.org.id, (t) =>
      saveFilter(t, input({ subjectContains: "factuur", tagId, skipInbox: true })),
    );
    const ticket = await ticketFrom(
      "boekhouding@example.nl",
      "Factuur 123",
      "Zie bijlage",
    );
    const outcome = await withTenant(db, org.org.id, (t) =>
      applyFiltersToNewTicket(t, ticket.id, {
        fromEmail: "boekhouding@example.nl",
        subject: "Factuur 123",
        body: "Zie bijlage",
        shopId: org.shop.id,
      }),
    );
    expect(outcome.tagIds).toEqual([tagId]);
    const after = await withTenant(db, org.org.id, async ({ tx }) => ({
      ticket: (await tx.select().from(s.tickets).where(eq(s.tickets.id, ticket.id)))[0],
      tags: await tx
        .select()
        .from(s.ticketTags)
        .where(eq(s.ticketTags.ticketId, ticket.id)),
      events: await tx
        .select()
        .from(s.ticketEvents)
        .where(eq(s.ticketEvents.ticketId, ticket.id)),
    }));
    expect(after.ticket.status).toBe("solved");
    expect(after.tags.map((r) => r.tagId)).toEqual([tagId]);
    expect(after.events.some((e) => e.toValue === "solved")).toBe(true);
  });

  it("ook toepassen op bestaande tickets", async () => {
    await ticketFrom(
      "klant@example.nl",
      "Retour plaid",
      'Ik wil mijn "geld terug" graag',
    );
    await ticketFrom("klant2@example.nl", "Vraag", "Waar blijft mijn pakket?");
    const result = await withTenant(db, org.org.id, async (t) => {
      const row = await saveFilter(t, input({ hasWords: '"geld terug"', tagId }));
      return applyFilterToExisting(t, { ...row, enabled: true }, { type: "system" });
    });
    expect(result).toEqual({ matched: 1, labeled: 1, archived: 0 });
  });

  it("geen labels of shops van een andere organisatie", async () => {
    await expect(
      withTenant(db, org.org.id, (t) =>
        saveFilter(t, input({ subjectContains: "x", tagId: otherTagId })),
      ),
    ).rejects.toThrow(/label/);
    await expect(
      withTenant(db, org.org.id, (t) =>
        saveFilter(t, input({ subjectContains: "x", shopId: other.shop.id, tagId })),
      ),
    ).rejects.toThrow(/shop/);
    // En de filters van de ene organisatie zijn onzichtbaar voor de andere.
    expect(await withTenant(db, other.org.id, (t) => listFilters(t))).toEqual([]);
    expect((await withTenant(db, org.org.id, (t) => listFilters(t))).length).toBe(2);
  });
});
