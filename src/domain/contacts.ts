/**
 * E-mailadressen normaliseren, zodat dezelfde klant altijd één contact is.
 *
 * Bewust géén Gmail-specifieke trucs (punten of +labels weghalen): bij andere
 * providers betekenen die iets anders, en een verkeerde samenvoeging zou
 * klantdata van twee mensen mengen.
 */
export function normalizeEmail(input: string): string {
  const email = input.trim().toLowerCase();
  if (!isPlausibleEmail(email)) {
    // Bewust zonder het adres zelf: foutmeldingen kunnen in logs belanden.
    throw new Error("Ongeldig e-mailadres");
  }
  return email;
}

export function isPlausibleEmail(value: string): boolean {
  // Eenvoudige controle; de echte test is of de mail aankomt.
  return /^[^\s@<>()",;]+@[^\s@<>()",;]+\.[^\s@<>()",;]{2,}$/.test(value);
}

/**
 * Haal naam en adres uit een From-header, bijv.
 * `"Jan de Vries" <jan@example.com>` → { name: "Jan de Vries", email: "jan@example.com" }.
 */
export function parseAddress(header: string): { name: string | null; email: string } {
  const match = header.match(/^\s*(?:"?([^"<]*?)"?\s*)?<([^>]+)>\s*$/);
  if (match) {
    const name = match[1]?.trim() || null;
    return { name, email: normalizeEmail(match[2]) };
  }
  return { name: null, email: normalizeEmail(header) };
}
