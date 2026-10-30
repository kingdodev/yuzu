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
  // Spaties of een regeleinde aan het begin of eind (bijv. door plakken) tellen niet mee.
  const password = process.env.DEMO_PASSWORD?.trim();
  if (!password) return NextResponse.next();

  const given = passwordFromHeader(request.headers.get("authorization"));
  if (given !== null && timingSafeEqual(given.trim(), password)) {
    return NextResponse.next();
  }

  return new NextResponse("Voer het wachtwoord van de Yuzu-demo in.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Yuzu demo", charset="UTF-8"' },
  });
}

/** Haalt het wachtwoord uit een Basic-authenticatieheader; null als die ontbreekt of ongeldig is. */
export function passwordFromHeader(header: string | null): string | null {
  const match = header?.match(/^\s*basic\s+(\S+)\s*$/i);
  if (!match) return null;
  let decoded: string;
  try {
    // Browsers versturen UTF-8; atob geeft losse bytes, dus eerst terugvertalen
    // zodat ook é, ë of € in een wachtwoord werken.
    const bytes = Uint8Array.from(atob(match[1]), (c) => c.charCodeAt(0));
    decoded = new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
  const colon = decoded.indexOf(":");
  return colon === -1 ? null : decoded.slice(colon + 1);
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
