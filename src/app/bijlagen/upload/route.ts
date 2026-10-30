import { MAX_ATTACHMENT_BYTES } from "@/domain/attachments";
import { getFileStore } from "@/integrations/storage";
import { verifyLocalUpload } from "@/integrations/storage/local";

/**
 * Uploadadres voor de lokale demo (zonder Supabase). Werkt alleen met een
 * adres dat de server zelf heeft ondertekend, voor één bestand.
 */
export async function PUT(request: Request) {
  const store = getFileStore();
  if (!store || store.kind !== "local" || !("secret" in store)) {
    return new Response(null, { status: 404 });
  }
  const url = new URL(request.url);
  const key = url.searchParams.get("key") ?? "";
  const expires = Number(url.searchParams.get("expires"));
  const token = url.searchParams.get("token") ?? "";
  if (!verifyLocalUpload(String(store.secret), key, expires, token)) {
    return new Response("Ongeldig of verlopen uploadadres.", { status: 403 });
  }
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_ATTACHMENT_BYTES) {
    return new Response("Bestand te groot.", { status: 413 });
  }
  const body = new Uint8Array(await request.arrayBuffer());
  if (body.byteLength === 0 || body.byteLength > MAX_ATTACHMENT_BYTES) {
    return new Response("Bestand leeg of te groot.", { status: 413 });
  }
  await store.put(key, body, request.headers.get("content-type") ?? "");
  return new Response(null, { status: 200 });
}
