import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { upsertContact } from "@/db/repositories/contacts";
import { searchTickets } from "@/db/repositories/search";
import { createTicket } from "@/db/repositories/tickets";
import * as s from "@/db/schema";
import { withTenant } from "@/db/tenant";
import type { Db } from "@/db/types";
import { likePattern, parseSearchQuery, snippetAround } from "@/domain/search";
import { createTestDb, seedOrganization } from "./helpers/db";

describe("zoekopdracht lezen", () => {
  it("haalt woorden en een ticketnummer uit de invoer", () => {
    expect(parseSearchQuery("  Plaid   retour ")).toEqual({
      text: "Plaid retour",
      terms: ["plaid", "retour"],
      ticketNumber: null,
    });
    expect(parseSearchQuery("#1012")).toMatchObject({
      ticketNumber: 1012,
      terms: ["1012"],
    });
    expect(parseSearchQuery("000012871")?.ticketNumber).toBe(12871);
  });

  it("negeert lege invoer en losse tekens", () => {
    expect(parseSearchQuery("")).toBeNull();
    expect(parseSearchQuery("   ")).toBeNull();
    expect(parseSearchQuery("a")).toBeNull();
    expect(parseSearchQuery('"x"')).toBeNull();
  });

  it("zoekt % en _ letterlijk", () => {
    expect(likePattern("50%_korting")).toBe("%50\\%\\_korting%");
    expect(likePattern("a\\b")).toBe("%a\\\\b%");
  });

  it("maakt een fragment rond de vondst", () => {
    const text = `Hallo,\n\n${"lorem ipsum ".repeat(20)}mijn pakket 3SVBS1234567 is niet aangekomen ${"dolor sit ".repeat(20)}`;
    const snippet = snippetAround(text, "3svbs1234567", 30)!;
    expect(snippet).toContain("3SVBS1234567");
    expect(snippet.startsWith("…")).toBe(true);
    expect(snippet.endsWith("…")).toBe(true);
    expect(snippetAround("kort", "lang")).toBeNull();
  });
});

describe("zoeken in tickets", () => {
  let db: Db;
  let close: () => Promise<void>;
  let org: Awaited<ReturnType<typeof seedOrganization>>;
  let other: Awaited<ReturnType<typeof seedOrganization>>;
  const ids: Record<string, string> = {};
  const numbers: Record<string, number> = {};

  async function ticket(
    o: typeof org,
    key: string,
    input: {
      email: string;
      name?: string;
      subject: string;
      body: string;
      order?: string;
      note?: string;
    },
  ) {
    await withTenant(db, o.org.id, async (t) => {
      const contact = await upsertContact(t, { email: input.email, name: input.name });
      const created = await createTicket(
        t,
        { shopId: o.shop.id, contactId: contact.id, subject: input.subject },
        { type: "system" },
      );
      await t.tx.insert(s.messages).values({
        organizationId: t.organizationId,
        ticketId: created.id,
        direction: "inbound",
        authorType: "contact",
        bodyText: input.body,
      });
      if (input.note) {
        await t.tx.insert(s.messages).values({
          organizationId: t.organizationId,
          ticketId: created.id,
          direction: "note",
          authorType: "system",
          bodyText: input.note,
        });
      }
      if (input.order) {
        await t.tx.insert(s.ticketOrders).values({
          organizationId: t.organizationId,
          ticketId: created.id,
          orderNumber: input.order,
        });
      }
      ids[key] = created.id;
      numbers[key] = created.number;
    });
  }

  const search = (o: typeof org, q: string) =>
    withTenant(db, o.org.id, (t) => searchTickets(t, parseSearchQuery(q)!));

  beforeAll(async () => {
    ({ db, close } = await createTestDb());
    org = await seedOrganization(db, { slug: "zoek" });
    other = await seedOrganization(db, { slug: "ander-zoek" });
    await ticket(org, "plaid", {
      email: "mark.jansen@example.nl",
      name: "Mark Jansen",
      subject: "Plaid retourneren",
      body: "De plaid is mooi, maar de kleur valt tegen. Hoe stuur ik hem terug?",
      order: "000012790",
    });
    await ticket(org, "pakket", {
      email: "lotte@example.nl",
      name: "Lotte Visser",
      subject: "Waar is mijn pakket?",
      body: "Track & trace 3SVBS1234567 zegt geleverd, maar ik heb niets.",
      note: "Navraag gedaan bij PostNL, 50%_korting aangeboden",
    });
    await ticket(other, "vreemd", {
      email: "mark@ander.example",
      name: "Mark Ander",
      subject: "Plaid van een andere organisatie",
      body: "Niet zichtbaar voor jou.",
    });
  });
  afterAll(async () => close());

  it("vindt op onderwerp, naam, e-mail, ordernummer en tekst", async () => {
    expect((await search(org, "plaid")).map((r) => r.id)).toEqual([ids.plaid]);
    expect((await search(org, "Jansen")).map((r) => r.id)).toEqual([ids.plaid]);
    expect((await search(org, "lotte@example")).map((r) => r.id)).toEqual([ids.pakket]);
    expect((await search(org, "12790")).map((r) => r.id)).toEqual([ids.plaid]);
    expect((await search(org, "3svbs1234567")).map((r) => r.id)).toEqual([ids.pakket]);
  });

  it("zoekt ook in interne notities, en % letterlijk", async () => {
    expect((await search(org, "postnl")).map((r) => r.id)).toEqual([ids.pakket]);
    expect((await search(org, "50%_korting")).map((r) => r.id)).toEqual([ids.pakket]);
    expect(await search(org, "50%")).toHaveLength(1);
  });

  it("vindt een ticket op nummer, ook met #", async () => {
    const found = await search(org, `#${numbers.pakket}`);
    expect(found[0].id).toBe(ids.pakket);
  });

  it("alle woorden moeten ergens voorkomen", async () => {
    expect((await search(org, "plaid kleur")).map((r) => r.id)).toEqual([ids.plaid]);
    expect(await search(org, "plaid postnl")).toEqual([]);
  });

  it("geeft een fragment rond de vondst", async () => {
    const [hit] = await search(org, "kleur");
    expect(hit.snippet).toContain("kleur valt tegen");
  });

  it("ziet geen tickets van een andere organisatie", async () => {
    expect((await search(org, "Mark")).map((r) => r.id)).toEqual([ids.plaid]);
    expect((await search(other, "plaid")).map((r) => r.id)).toEqual([ids.vreemd]);
  });
});
