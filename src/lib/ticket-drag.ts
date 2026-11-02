/**
 * Tickets slepen naar een label. Het type is eigen aan Yuzu, zodat een
 * gesleept ticket niet als tekst in een invoerveld belandt en andere dingen
 * (tekst, bestanden) geen label-actie starten.
 */
export const TICKET_DRAG_TYPE = "application/x-yuzu-tickets";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX = 500;

export function encodeDraggedTickets(ids: readonly string[]): string {
  return JSON.stringify(ids.slice(0, MAX));
}

/** De ticket-ID's uit een drop; leeg bij alles wat niet klopt. */
export function decodeDraggedTickets(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    const ids = value.filter((v): v is string => typeof v === "string" && UUID.test(v));
    return [...new Set(ids)].slice(0, MAX);
  } catch {
    return [];
  }
}
