/**
 * Voorbeeldbijlagen voor de demo: twee foto's en een pdf van klanten. Draait
 * alleen als de demo-organisatie nog geen bijlagen heeft.
 */
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { and, asc, count, eq } from "drizzle-orm";
import { storageKeyFor, type FileStore } from "@/integrations/storage/types";
import * as s from "../schema";
import { withPrivileged, withTenant } from "../tenant";
import type { Db } from "../types";
import { DEMO_ORG_SLUG } from "./demo";

const DEMO_ATTACHMENTS = [
  {
    subject: "Verkeerde maat badjas",
    file: "badjas-label.jpg",
    filename: "label badjas.jpg",
    contentType: "image/jpeg",
  },
  {
    subject: "Miroir cassé à la livraison",
    file: "spiegel-kapot.jpg",
    filename: "miroir-cassé.jpg",
    contentType: "image/jpeg",
  },
  {
    subject: "Factuur op bedrijfsnaam",
    file: "bedrijfsgegevens.pdf",
    filename: "Bedrijfsgegevens Bakker Interieur.pdf",
    contentType: "application/pdf",
  },
] as const;

export async function seedDemoAttachments(db: Db, store: FileStore): Promise<number> {
  const [org] = await withPrivileged(db, (tx) =>
    tx
      .select({ id: s.organizations.id })
      .from(s.organizations)
      .where(eq(s.organizations.slug, DEMO_ORG_SLUG)),
  );
  if (!org) return 0;

  return withTenant(db, org.id, async ({ tx, organizationId }) => {
    const [{ n }] = await tx.select({ n: count() }).from(s.attachments);
    if (n > 0) return 0;

    let added = 0;
    for (const a of DEMO_ATTACHMENTS) {
      const [message] = await tx
        .select({ id: s.messages.id })
        .from(s.messages)
        .innerJoin(s.tickets, eq(s.tickets.id, s.messages.ticketId))
        .where(and(eq(s.tickets.subject, a.subject), eq(s.messages.direction, "inbound")))
        .orderBy(asc(s.messages.createdAt))
        .limit(1);
      if (!message) continue;

      const body = new Uint8Array(
        await readFile(path.join(process.cwd(), "src/db/seed/files", a.file)),
      );
      const id = randomUUID();
      const storageKey = storageKeyFor(organizationId, id);
      await store.put(storageKey, body, a.contentType);
      await tx.insert(s.attachments).values({
        id,
        organizationId,
        messageId: message.id,
        filename: a.filename,
        contentType: a.contentType,
        sizeBytes: body.byteLength,
        storageKey,
        scanStatus: "clean",
      });
      added++;
    }
    return added;
  });
}
