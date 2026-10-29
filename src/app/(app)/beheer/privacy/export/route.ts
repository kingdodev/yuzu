import { exportContact } from "@/server/admin";

/** Download met alle gegevens van één contact (AVG-inzageverzoek). */
export async function GET(request: Request) {
  const email = new URL(request.url).searchParams.get("email") ?? "";
  const data = await exportContact(email);
  if (!data) return new Response("Geen klant gevonden met dit adres.", { status: 404 });
  const filename = `gegevens-${email.replace(/[^a-z0-9]+/gi, "-")}.json`;
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
