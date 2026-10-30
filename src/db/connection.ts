import type { Options } from "postgres";

/**
 * Verbindingsinstellingen voor Postgres (Supabase).
 *
 * Gebruik in DATABASE_URL de "Transaction pooler" van Supabase (poort 6543).
 * Die werkt vanaf Vercel (de directe verbinding is alleen IPv6), maar kent
 * geen prepared statements; daarom staat `prepare` uit.
 */
export function postgresOptions(
  url: string,
  max: number,
): Options<Record<string, never>> {
  return {
    max,
    prepare: false,
    // Versleuteld verbinden, behalve met een database op deze computer.
    ssl: isLocal(url) ? false : "require",
    // Meldingen als "bestaat al, overgeslagen" zijn geen fouten.
    onnotice: () => {},
  };
}

function isLocal(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return false;
  }
}

/**
 * Is de ingelogde gebruiker altijd Frank (de demogebruiker)?
 *
 * Zolang inloggen nog niet gebouwd is, mag dat alleen als er geen echte
 * database is, of als de hele site achter het demowachtwoord zit
 * (DEMO_PASSWORD, zie src/proxy.ts). Zo staat een echte database nooit open.
 */
export function usesDemoSession(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return !env.DATABASE_URL || Boolean(env.DEMO_PASSWORD?.trim());
}
