/**
 * Regels voor inloggen. Pure functies; de opslag staat in
 * src/db/repositories/auth.ts, het versleutelen in src/lib/password.ts.
 */

export const MIN_PASSWORD_LENGTH = 10;
export const MAX_PASSWORD_LENGTH = 200;

/** Te voorspelbaar, ook al zijn ze lang genoeg. */
const TOO_COMMON = new Set([
  "1234567890",
  "0123456789",
  "qwertyuiop",
  "wachtwoord",
  "wachtwoord1",
  "wachtwoord123",
  "password123",
  "passwordpassword",
  "welkom12345",
  "yuzuyuzuyuzu",
  "kingdokingdo",
]);

/** Een foutmelding als het wachtwoord niet goed genoeg is, anders null. */
export function passwordProblem(password: string, email?: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Kies een wachtwoord van minstens ${MIN_PASSWORD_LENGTH} tekens.`;
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return `Een wachtwoord mag maximaal ${MAX_PASSWORD_LENGTH} tekens zijn.`;
  }
  const lower = password.toLowerCase();
  if (TOO_COMMON.has(lower) || /^(.)\1+$/.test(password)) {
    return "Dit wachtwoord is te makkelijk te raden. Kies iets anders.";
  }
  if (email) {
    const local = email.split("@")[0]?.toLowerCase() ?? "";
    if (lower === email.toLowerCase() || (local.length >= 4 && lower.includes(local))) {
      return "Gebruik je e-mailadres niet in je wachtwoord.";
    }
  }
  return null;
}

/**
 * Waar je na inloggen heen gaat. Alleen paden binnen Yuzu, zodat een link
 * als /inloggen?volgende=https://kwaadaardig.example je niet wegstuurt.
 */
export function safeNextPath(raw: string | null | undefined): string {
  const fallback = "/inbox/open";
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) {
    return fallback;
  }
  if (raw.startsWith("/inloggen")) return fallback;
  if (/[\u0000-\u001f]/.test(raw)) return fallback;
  return raw;
}

/** Hoe lang dingen geldig zijn. */
export const SESSION_DAYS = 30;
export const SESSION_IDLE_DAYS = 7;
export const INVITE_DAYS = 7;
export const RESET_HOURS = 24;

/** Remmen op raden: zoveel mislukte pogingen per kwartier. */
export const LOGIN_WINDOW_MINUTES = 15;
export const MAX_FAILURES_PER_EMAIL = 8;
export const MAX_FAILURES_PER_IP = 40;
