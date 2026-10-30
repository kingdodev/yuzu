/**
 * Regels voor zoeken in tickets. Pure functies; de query zelf staat in
 * src/db/repositories/search.ts.
 */

export const MAX_SEARCH_LENGTH = 200;
const MAX_TERMS = 6;

export type SearchQuery = {
  /** De zoekopdracht zoals getoond, opgeschoond. */
  text: string;
  /** Woorden die allemaal ergens in het ticket moeten voorkomen. */
  terms: string[];
  /** Als de hele zoekopdracht een ticketnummer is, zoals "1012" of "#1012". */
  ticketNumber: number | null;
};

/** Maak van wat de gebruiker typt een zoekopdracht, of null als er niets te zoeken is. */
export function parseSearchQuery(raw: string | null | undefined): SearchQuery | null {
  const text = (raw ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_SEARCH_LENGTH);
  if (!text) return null;

  const numberMatch = /^#?(\d{1,12})$/.exec(text);
  const ticketNumber = numberMatch ? Number(numberMatch[1]) : null;

  const terms = [
    ...new Set(
      text
        .split(" ")
        .map((w) => w.replace(/^["'#(]+|["'),.;:!?]+$/g, ""))
        .filter((w) => w.length >= 2 || /^\d$/.test(w))
        .map((w) => w.toLowerCase()),
    ),
  ].slice(0, MAX_TERMS);

  if (terms.length === 0 && ticketNumber === null) return null;
  return { text, terms, ticketNumber };
}

/**
 * Lijkt de zoekopdracht op een ordernummer? Dan zoekt Yuzu ook in de
 * webshop wie die order geplaatst heeft. Eén woord, minstens vier cijfers,
 * eventueel met # of een korte prefix ("#1001", "000012844", "NL-12844").
 */
export function orderNumberToLookup(query: SearchQuery): string | null {
  if (query.text.includes(" ")) return null;
  const m = /^#?([A-Za-z]{0,4}-?\d{4,12})$/.exec(query.text);
  return m ? m[1] : null;
}

/** Een LIKE-patroon dat de tekst letterlijk zoekt (% en _ tellen niet als joker). */
export function likePattern(term: string): string {
  return `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/** Een stukje tekst rond de eerste plek waar `term` voorkomt, voor in de resultaten. */
export function snippetAround(text: string, term: string, radius = 70): string | null {
  const flat = text.replace(/\s+/g, " ").trim();
  const at = flat.toLowerCase().indexOf(term.toLowerCase());
  if (at === -1) return null;
  const start = Math.max(0, at - radius);
  const end = Math.min(flat.length, at + term.length + radius);
  let snippet = flat.slice(start, end);
  // Niet midden in een woord beginnen of eindigen.
  if (start > 0) snippet = snippet.replace(/^\S*\s/, "");
  if (end < flat.length) snippet = snippet.replace(/\s\S*$/, "");
  return `${start > 0 ? "…" : ""}${snippet}${end < flat.length ? "…" : ""}`;
}
