import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  attachmentsForTicket,
  AttachmentError,
  claimAttachments,
  createPendingAttachment,
  deleteAttachmentsOfTickets,
  deletePendingAttachment,
  findAttachmentForUser,
} from "@/db/repositories/attachments";
import { upsertContact } from "@/db/repositories/contacts";
import { createTicket } from "@/db/repositories/tickets";
import * as s from "@/db/schema";
import { withPrivileged, withTenant } from "@/db/tenant";
import type { Db } from "@/db/types";
import {
  checkUpload,
  cleanFilename,
  contentDisposition,
  formatBytes,
  MAX_ATTACHMENT_BYTES,
  servingFor,
} from "@/domain/attachments";
import { localStore, verifyLocalUpload } from "@/integrations/storage/local";
import { createTestDb, seedOrganization } from "./helpers/db";

describe("regels voor bijlagen", () => {
  it("maakt bestandsnamen veilig", () => {
    expect(cleanFilename("../../etc/passwd")).toBe("passwd");
    expect(cleanFilename("C:\\Users\\x\\foto 1.JPG")).toBe("foto 1.JPG");
    expect(cleanFilename('a<b>:"c|?*.pdf')).toBe("abc.pdf");
    expect(cleanFilename("...")).toBe("bestand");
    const long = cleanFilename(`${"x".repeat(300)}.pdf`);
    expect(long.length).toBeLessThanOrEqual(120);
    expect(long.endsWith(".pdf")).toBe(true);
  });

  it("weigert programma's, lege en te grote bestanden", () => {
    expect(checkUpload({ filename: "factuur.exe", contentType: "", size: 10 }).ok).toBe(
      false,
    );
    expect(
      checkUpload({ filename: "x.svg", contentType: "image/svg+xml", size: 10 }).ok,
    ).toBe(false);
    expect(
      checkUpload({ filename: "x.pdf", contentType: "application/pdf", size: 0 }).ok,
    ).toBe(false);
    expect(
      checkUpload({
        filename: "x.pdf",
        contentType: "application/pdf",
        size: MAX_ATTACHMENT_BYTES + 1,
      }).ok,
    ).toBe(false);
    expect(checkUpload({ filename: "label.pdf", contentType: "", size: 10 })).toEqual({
      ok: true,
      filename: "label.pdf",
      contentType: "application/pdf",
    });
  });

  it("toont alleen gewone afbeeldingen en pdf's in de browser", () => {
    expect(servingFor("foto.jpg", "image/jpeg")).toEqual({
      contentType: "image/jpeg",
      inline: true,
      isImage: true,
    });
    expect(servingFor("label.pdf", "application/pdf").inline).toBe(true);
    // Klopt de extensie niet bij het type, dan is het een download.
    expect(servingFor("foto.jpg", "text/html").inline).toBe(false);
    expect(servingFor("pagina.html", "text/html")).toEqual({
      contentType: "application/octet-stream",
      inline: false,
      isImage: false,
    });
    expect(servingFor("tekening.svg", "image/svg+xml").inline).toBe(false);
  });

  it("zet de bestandsnaam goed in de header, ook met accenten", () => {
    expect(contentDisposition(true, "miroir-cassé.jpg")).toBe(
      `inline; filename="miroir-casse.jpg"; filename*=UTF-8''miroir-cass%C3%A9.jpg`,
    );
    expect(contentDisposition(false, 'a"b.pdf')).toContain("attachment;");
  });

  it("schrijft groottes leesbaar", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2 kB");
    expect(formatBytes(1572864)).toBe("1,5 MB");
  });
});

describe("lokale opslag", () => {
  let dir: string;
  beforeAll(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "yuzu-files-"));
  });
  afterAll(async () => rm(dir, { recursive: true, force: true }));

  const key = "00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000002";

  it("bewaart, leest en wist bestanden", async () => {
    const store = localStore(dir, "geheim");
    await store.put(key, new Uint8Array([1, 2, 3]), "image/png");
    expect(await store.size(key)).toBe(3);
    expect([...(await store.read(key))!]).toEqual([1, 2, 3]);
    await store.remove([key]);
    expect(await store.read(key)).toBeNull();
    expect(await store.size(key)).toBeNull();
  });

  it("accepteert alleen eigen, geldige uploadadressen", async () => {
    const store = localStore(dir, "geheim");
    const target = await store.createUpload(key, "image/png");
    const url = new URL(target.url, "http://localhost");
    const expires = Number(url.searchParams.get("expires"));
    const token = url.searchParams.get("token")!;
    expect(verifyLocalUpload("geheim", key, expires, token)).toBe(true);
    expect(verifyLocalUpload("ander-geheim", key, expires, token)).toBe(false);
    expect(verifyLocalUpload("geheim", key, expires, "00")).toBe(false);
    expect(verifyLocalUpload("geheim", key, expires, token, expires + 1)).toBe(false);
    expect(verifyLocalUpload("geheim", "../../etc/passwd", expires, token)).toBe(false);
    await expect(store.put("../evil", new Uint8Array([1]), "")).rejects.toThrow();
  });
});

describe("bijlagen in de database", () => {
  let db: Db;
  let close: () => Promise<void>;
  let seed: Awaited<ReturnType<typeof seedOrganization>>;
  let other: Awaited<ReturnType<typeof seedOrganization>>;
  let frank: string;
  let collega: string;
  let ticketId: string;
  let messageId: string;
  const uploaded = new Map<string, number>();
  const actualSize = async (key: string) => uploaded.get(key) ?? null;

  beforeAll(async () => {
    ({ db, close } = await createTestDb());
    seed = await seedOrganization(db, { slug: "bijlage" });
    other = await seedOrganization(db, { slug: "bijlage-ander" });
    [frank, collega] = await withPrivileged(db, async (tx) => {
      const rows = await tx
        .insert(s.users)
        .values([
          { id: randomUUID(), email: "frank@example.nl", name: "Frank" },
          { id: randomUUID(), email: "collega@example.nl", name: "Collega" },
        ])
        .returning({ id: s.users.id });
      return rows.map((r) => r.id);
    });
    ({ ticketId, messageId } = await withTenant(db, seed.org.id, async (t) => {
      const contact = await upsertContact(t, { email: "klant@example.nl" });
      const ticket = await createTicket(
        t,
        { shopId: seed.shop.id, contactId: contact.id, subject: "Retour" },
        { type: "system" },
      );
      const [message] = await t.tx
        .insert(s.messages)
        .values({
          organizationId: t.organizationId,
          ticketId: ticket.id,
          direction: "outbound",
          authorType: "user",
          authorUserId: frank,
          bodyText: "Hierbij het retourlabel.",
        })
        .returning();
      return { ticketId: ticket.id, messageId: message.id };
    }));
  });
  afterAll(async () => close());

  const pending = (userId: string, filename = "label.pdf") =>
    withTenant(db, seed.org.id, (t) =>
      createPendingAttachment(t, {
        filename,
        contentType: "application/pdf",
        sizeBytes: 1000,
        uploadedById: userId,
      }),
    );

  it("koppelt een geüploade bijlage aan het verstuurde bericht", async () => {
    const a = await pending(frank);
    expect(a.storageKey).toBe(`${seed.org.id}/${a.id}`);
    uploaded.set(a.storageKey, 1234);

    await withTenant(db, seed.org.id, (t) =>
      claimAttachments(t, { ids: [a.id], userId: frank, messageId, actualSize }),
    );
    const list = await withTenant(db, seed.org.id, (t) =>
      attachmentsForTicket(t, ticketId),
    );
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: a.id, messageId, sizeBytes: 1234 });
  });

  it("weigert een bijlage die nog niet (helemaal) geüpload is", async () => {
    const a = await pending(frank);
    await expect(
      withTenant(db, seed.org.id, (t) =>
        claimAttachments(t, { ids: [a.id], userId: frank, messageId, actualSize }),
      ),
    ).rejects.toThrow(AttachmentError);
  });

  it("weigert bijlagen van een collega of die al verstuurd zijn", async () => {
    const vanCollega = await pending(collega);
    uploaded.set(vanCollega.storageKey, 10);
    await expect(
      withTenant(db, seed.org.id, (t) =>
        claimAttachments(t, {
          ids: [vanCollega.id],
          userId: frank,
          messageId,
          actualSize,
        }),
      ),
    ).rejects.toThrow(/niet meer beschikbaar/);
  });

  it("toont een nog niet verstuurde bijlage alleen aan wie hem uploadde", async () => {
    const a = await pending(collega, "concept.pdf");
    const asFrank = await withTenant(db, seed.org.id, (t) =>
      findAttachmentForUser(t, a.id, frank),
    );
    const asCollega = await withTenant(db, seed.org.id, (t) =>
      findAttachmentForUser(t, a.id, collega),
    );
    expect(asFrank).toBeNull();
    expect(asCollega?.id).toBe(a.id);

    // Weghalen kan alleen door die collega zelf.
    expect(
      await withTenant(db, seed.org.id, (t) => deletePendingAttachment(t, a.id, frank)),
    ).toBeNull();
    expect(
      await withTenant(db, seed.org.id, (t) => deletePendingAttachment(t, a.id, collega)),
    ).toBe(a.storageKey);
  });

  it("is onzichtbaar voor een andere organisatie", async () => {
    const [sent] = await withTenant(db, seed.org.id, (t) =>
      attachmentsForTicket(t, ticketId),
    );
    const foreign = await withTenant(db, other.org.id, (t) =>
      findAttachmentForUser(t, sent.id, frank),
    );
    expect(foreign).toBeNull();
    const deleted = await withTenant(db, other.org.id, (t) =>
      deleteAttachmentsOfTickets(t, [ticketId]),
    );
    expect(deleted).toEqual([]);
  });

  it("verwijdert bijlagen van tickets en geeft de bestanden terug om te wissen", async () => {
    const keys = await withTenant(db, seed.org.id, (t) =>
      deleteAttachmentsOfTickets(t, [ticketId]),
    );
    expect(keys).toHaveLength(1);
    const rest = await withTenant(db, seed.org.id, ({ tx }) =>
      tx.select().from(s.attachments).where(eq(s.attachments.messageId, messageId)),
    );
    expect(rest).toEqual([]);
  });
});
