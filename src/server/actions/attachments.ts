"use server";

import { z } from "zod";
import {
  createPendingAttachment,
  deletePendingAttachment,
} from "@/db/repositories/attachments";
import { checkUpload } from "@/domain/attachments";
import { canWorkTickets, PermissionError, requirePermission } from "@/domain/permissions";
import { getFileStore, type UploadTarget } from "@/integrations/storage";
import { asTenant } from "../session";

export type StartUploadResult =
  { ok: true; id: string; upload: UploadTarget } | { ok: false; error: string };

const NOT_CONFIGURED =
  "Bijlagen zijn nog niet ingesteld: de opslag (Supabase Storage) is nog niet gekoppeld.";

const startSchema = z.object({
  filename: z.string().max(500),
  contentType: z.string().max(200),
  size: z.number().int().nonnegative(),
});

/**
 * Bereid een upload voor: controleer het bestand, leg het vast en geef een
 * adres terug waar de browser het rechtstreeks naartoe stuurt. Zo gaan grote
 * bestanden niet door onze serverfunctie (Vercel staat maar 4,5 MB toe).
 */
export async function startAttachmentUpload(
  input: z.input<typeof startSchema>,
): Promise<StartUploadResult> {
  const parsed = startSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ongeldig bestand" };
  const store = getFileStore();
  if (!store) return { ok: false, error: NOT_CONFIGURED };

  const check = checkUpload(parsed.data);
  if (!check.ok) return check;

  try {
    const row = await asTenant((t, session) => {
      requirePermission(
        canWorkTickets(session.role),
        "Als meelezer kun je geen bijlagen versturen.",
      );
      return createPendingAttachment(t, {
        filename: check.filename,
        contentType: check.contentType,
        sizeBytes: parsed.data.size,
        uploadedById: session.userId,
      });
    });
    const upload = await store.createUpload(row.storageKey, check.contentType);
    return { ok: true, id: row.id, upload };
  } catch (e) {
    if (e instanceof PermissionError) return { ok: false, error: e.message };
    // Geen melding loggen: die kan de bestandsnaam bevatten.
    console.error(
      "Upload voorbereiden mislukt",
      (e as { cause?: { code?: string } })?.cause?.code ??
        (e instanceof Error ? e.name : "onbekend"),
    );
    return { ok: false, error: "Upload voorbereiden mislukt. Probeer het opnieuw." };
  }
}

/** Haal een bijlage weg die nog niet verstuurd is. */
export async function cancelAttachmentUpload(id: string): Promise<void> {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return;
  const key = await asTenant((t, session) =>
    deletePendingAttachment(t, parsed.data, session.userId),
  );
  if (key) await getFileStore()?.remove([key]);
}
