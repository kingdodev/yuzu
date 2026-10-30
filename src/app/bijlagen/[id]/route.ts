import { findAttachmentForUser } from "@/db/repositories/attachments";
import { contentDisposition, servingFor } from "@/domain/attachments";
import { getFileStore } from "@/integrations/storage";
import { asTenant } from "@/server/session";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Een bijlage bekijken of downloaden. Alleen binnen je eigen organisatie
 * (Row Level Security). Bijlagen van klanten zijn onbetrouwbaar: alleen
 * gewone afbeeldingen en pdf's tonen we in de browser, de rest is een
 * download, en de pagina mag geen scripts draaien.
 */
export async function GET(_: Request, ctx: RouteContext<"/bijlagen/[id]">) {
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) return notFound();

  const row = await asTenant((t, session) =>
    findAttachmentForUser(t, id, session.userId),
  );
  if (!row || row.scanStatus === "infected") return notFound();

  const store = getFileStore();
  if (!store) {
    return new Response("Bijlagen zijn nog niet ingesteld.", {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  const body = await store.read(row.storageKey);
  if (!body) return notFound();

  const serving = servingFor(row.filename, row.contentType);
  const headers: Record<string, string> = {
    "content-type": serving.contentType,
    "content-length": String(body.byteLength),
    "content-disposition": contentDisposition(serving.inline, row.filename),
    "x-content-type-options": "nosniff",
    "cache-control": "private, max-age=3600",
    "referrer-policy": "no-referrer",
  };
  // Afbeeldingen in een afgeschermde pagina; de pdf-viewer van de browser
  // werkt niet in een sandbox en draait zelf al afgeschermd.
  if (serving.isImage || !serving.inline) {
    headers["content-security-policy"] =
      "default-src 'none'; img-src 'self'; sandbox; frame-ancestors 'none'";
  }
  return new Response(body as BodyInit, { headers });
}

function notFound() {
  return new Response("Bijlage niet gevonden.", {
    status: 404,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
