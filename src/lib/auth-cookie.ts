/** Naam van de sessiecookie; gedeeld door de proxy en de server. */
export const SESSION_COOKIE = "yuzu_session";

/** Pagina's die zonder inloggen bereikbaar zijn. */
export function isPublicPath(pathname: string): boolean {
  return pathname === "/inloggen" || pathname.startsWith("/inloggen/");
}
