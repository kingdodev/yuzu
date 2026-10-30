import { NextResponse, type NextRequest } from "next/server";
import { isPublicPath, SESSION_COOKIE } from "@/lib/auth-cookie";

/**
 * Twee sloten, in deze volgorde:
 *
 * 1. Demowachtwoord. Staat DEMO_PASSWORD ingesteld (bijv. in Vercel), dan
 *    vraagt de browser eerst om dat wachtwoord (gebruikersnaam maakt niet
 *    uit). Zonder DEMO_PASSWORD is dit slot open.
 * 2. Inloggen. Met een echte database (DATABASE_URL) moet je ingelogd zijn;
 *    zonder sessiecookie ga je naar /inloggen. Of de sessie geldig is,
 *    controleert de server daarna in de database (src/server/session.ts).
 */
export function proxy(request: NextRequest) {
  // Spaties of een regeleinde aan het begin of eind (bijv. door plakken) tellen niet mee.
  const password = process.env.DEMO_PASSWORD?.trim();
  if (password) {
    const given = passwordFromHeader(request.headers.get("authorization"));
    if (given === null || !timingSafeEqual(given.trim(), password)) {
      return new NextResponse("Voer het wachtwoord van de Yuzu-demo in.", {
        status: 401,
        headers: { "WWW-Authenticate": 'Basic realm="Yuzu demo", charset="UTF-8"' },
      });
    }
  }

  if (loginRequired() && !isPublicPath(request.nextUrl.pathname)) {
    if (!request.cookies.get(SESSION_COOKIE)?.value) {
      const url = request.nextUrl.clone();
      const next = `${request.nextUrl.pathname}${request.nextUrl.search}`;
      url.pathname = "/inloggen";
      url.search = next === "/" ? "" : `?volgende=${encodeURIComponent(next)}`;
      return NextResponse.redirect(url);
    }
  }
  return NextResponse.next();
}

/** Alleen met een echte database; de lokale demo is altijd Frank. */
function loginRequired(): boolean {
  return Boolean(process.env.DATABASE_URL);
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
