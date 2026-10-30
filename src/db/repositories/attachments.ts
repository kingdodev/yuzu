import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray, isNotNull, isNull, or } from "drizzle-orm";
import {
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS_PER_MESSAGE,
  MAX_TOTAL_ATTACHMENT_BYTES,
} from "@/domain/attachments";
import { storageKeyFor } from "@/integrations/storage/types";
import { attachments, messages } from "../schema";
import type { TenantTx } from "../tenant";

export type AttachmentRow = typeof attachments.$inferSelect;

/**
 * Een bijlage die een agent gaat uploaden. Hij hoort nog bij geen bericht;
 * dat gebeurt pas bij versturen (claimAttachments).
 */
export async function createPendingAttachment(
  t: TenantTx,
  input: {
    filename: string;
    contentType: string;
    sizeBytes: number;
    uploadedById: string;
  },
) {
  const id = randomUUID();
  const [row] = await t.tx
    .insert(attachments)
    .values({
      id,
      organizationId: t.organizationId,
      messageId: null,
      uploadedById: input.uploadedById,
      filename: input.filename,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
      storageKey: storageKeyFor(t.organizationId, id),
      // Door een collega geüpload, niet door een klant.
      scanStatus: "clean",
    })
    .returning();
  return row;
}

export class AttachmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AttachmentError";
  }
}

/**
 * Koppel geüploade bijlagen aan een verstuurd bericht. Alleen bijlagen die
 * deze gebruiker zelf uploadde en die nog nergens aan hangen. `actualSize`
 * vraagt de opslag hoe groot het bestand echt is; zo weten we zeker dat de
 * upload klaar is en rekenen we niet met wat de browser beweerde.
 */
export async function claimAttachments(
  t: TenantTx,
  input: {
    ids: readonly string[];
    userId: string;
    messageId: string;
    actualSize: (storageKey: string) => Promise<number | null>;
  },
) {
  const ids = [...new Set(input.ids)];
  if (ids.length === 0) return [];
  if (ids.length > MAX_ATTACHMENTS_PER_MESSAGE) {
    throw new AttachmentError(
      `Maximaal ${MAX_ATTACHMENTS_PER_MESSAGE} bijlagen per bericht.`,
    );
  }

  const rows = await t.tx
    .select()
    .from(attachments)
    .where(
      and(
        inArray(attachments.id, ids),
        isNull(attachments.messageId),
        eq(attachments.uploadedById, input.userId),
      ),
    );
  if (rows.length !== ids.length) {
    throw new AttachmentError(
      "Een bijlage is niet meer beschikbaar. Haal hem weg en voeg hem opnieuw toe.",
    );
  }

  let total = 0;
  for (const row of rows) {
    const size = await input.actualSize(row.storageKey);
    if (size === null || size === 0) {
      throw new AttachmentError(`${row.filename} is nog niet helemaal geüpload.`);
    }
    if (size > MAX_ATTACHMENT_BYTES) {
      throw new AttachmentError(`${row.filename} is te groot.`);
    }
    total += size;
    row.sizeBytes = size;
  }
  if (total > MAX_TOTAL_ATTACHMENT_BYTES) {
    throw new AttachmentError("De bijlagen zijn samen te groot voor één e-mail.");
  }

  for (const row of rows) {
    await t.tx
      .update(attachments)
      .set({ messageId: input.messageId, sizeBytes: row.sizeBytes })
      .where(eq(attachments.id, row.id));
  }
  return rows;
}

/** Alle bijlagen bij de berichten van een ticket. */
export async function attachmentsForTicket(t: TenantTx, ticketId: string) {
  return t.tx
    .select({
      id: attachments.id,
      messageId: attachments.messageId,
      filename: attachments.filename,
      contentType: attachments.contentType,
      sizeBytes: attachments.sizeBytes,
      scanStatus: attachments.scanStatus,
    })
    .from(attachments)
    .innerJoin(messages, eq(messages.id, attachments.messageId))
    .where(eq(messages.ticketId, ticketId))
    .orderBy(asc(attachments.createdAt), asc(attachments.filename));
}

/**
 * Een bijlage om te downloaden: verstuurd of ontvangen, of door deze
 * gebruiker geüpload en nog niet verstuurd.
 */
export async function findAttachmentForUser(t: TenantTx, id: string, userId: string) {
  const [row] = await t.tx
    .select()
    .from(attachments)
    .where(
      and(
        eq(attachments.id, id),
        or(isNotNull(attachments.messageId), eq(attachments.uploadedById, userId)),
      ),
    );
  return row ?? null;
}

/** Haal een nog niet verstuurde bijlage weg. Geeft de opslagsleutel terug. */
export async function deletePendingAttachment(t: TenantTx, id: string, userId: string) {
  const [row] = await t.tx
    .delete(attachments)
    .where(
      and(
        eq(attachments.id, id),
        isNull(attachments.messageId),
        eq(attachments.uploadedById, userId),
      ),
    )
    .returning({ storageKey: attachments.storageKey });
  return row?.storageKey ?? null;
}

/**
 * Verwijder alle bijlagen van deze tickets uit de database (bijvoorbeeld bij
 * anonimiseren). Geeft de opslagsleutels terug, zodat de bestanden daarna
 * ook gewist kunnen worden.
 */
export async function deleteAttachmentsOfTickets(
  t: TenantTx,
  ticketIds: readonly string[],
) {
  if (ticketIds.length === 0) return [];
  const rows = await t.tx
    .select({ id: attachments.id, storageKey: attachments.storageKey })
    .from(attachments)
    .innerJoin(messages, eq(messages.id, attachments.messageId))
    .where(inArray(messages.ticketId, [...ticketIds]));
  if (rows.length > 0) {
    await t.tx.delete(attachments).where(
      inArray(
        attachments.id,
        rows.map((r) => r.id),
      ),
    );
  }
  return rows.map((r) => r.storageKey);
}
