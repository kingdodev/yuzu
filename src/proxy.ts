import { NextResponse, type NextRequest } from "next/server";

/**
 * Wachtwoord voor de demo-omgeving. Staat DEMO_PASSWORD ingesteld (bijv. in
 * Vercel), dan vraagt de browser om een gebruikersnaam (maakt niet uit) en
 * dat wachtwoord. Zonder DEMO_PASSWORD is de site open, zoals lokaal.
 *
 * Dit is een tijdelijk slot voor de demo; echte gebruikers loggen straks in
 * met Google.
 */
export function proxy(request: NextRequest) {
  const password = process.env.DEMO_PASSWORD;
  if (!password) return NextResponse.next();

  const header = request.headers.get("authorization") ?? "";
  const [scheme, encoded] = header.split(" ");
  if (scheme === "Basic" && encoded) {
    const decoded = atob(encoded);
    const given = decoded.slice(decoded.indexOf(":") + 1);
    if (timingSafeEqual(given, password)) return NextResponse.next();
  }

  return new NextResponse("Voer het wachtwoord van de Yuzu-demo in.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Yuzu demo", charset="UTF-8"' },
  });
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
