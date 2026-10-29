/**
 * Ordernummers herkennen in onderwerp of tekst van een mail.
 *
 * Magento gebruikt standaard negen cijfers (bijv. 000012345), soms met een
 * prefix per shop. Een kandidaat is nog geen bewijs: Yuzu controleert elk
 * gevonden nummer daarna in Magento en koppelt alleen bestaande orders.
 */

export type OrderNumberOptions = {
  /** Prefixen van de shops, bijv. ["NL", "BE"]. Hoofdletterongevoelig. */
  prefixes?: readonly string[];
  /** Minimaal aantal cijfers zonder prefix. Standaard 6. */
  minDigits?: number;
};

export function extractOrderNumberCandidates(
  text: string,
  { prefixes = [], minDigits = 6 }: OrderNumberOptions = {},
): string[] {
  const found = new Set<string>();

  for (const prefix of prefixes) {
    const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(?<![A-Za-z0-9])(${escaped})[-\\s]?(\\d{4,12})(?!\\d)`, "gi");
    for (const m of text.matchAll(re)) {
      found.add(`${prefix.toUpperCase()}${m[2]}`);
    }
  }

  // Losse cijferreeksen, maar geen telefoonnummers, postcodes of bedragen
  // met scheidingstekens, en geen trackingcodes die met letters beginnen.
  const plain = new RegExp(
    `(?<![\\d.,+\\-/A-Za-z])(\\d{${minDigits},12})(?![\\d.,/])`,
    "g",
  );
  for (const m of withoutPhoneNumbers(text).matchAll(plain)) {
    found.add(m[1]);
  }

  return [...found];
}

/**
 * Haal herkenbare telefoonnummers weg: met landcode (+31, +32, +33, +34) of
 * een Nederlands/Belgisch/Frans nummer van tien cijfers dat met 0 begint.
 * Een Spaans mobiel nummer zonder +34 is niet van een ordernummer te
 * onderscheiden; dat vangt de controle in Magento op.
 */
function withoutPhoneNumbers(text: string): string {
  return text
    .replace(/\+\d{1,3}[\s.\-]?(?:\(0\))?(?:\d[\s.\-]?){6,12}\d/g, " ")
    .replace(/(?<!\d)0[1-9]\d{0,3}[\s\-]\d{6,8}(?!\d)/g, " ")
    .replace(/(?<!\d)0[1-9]\d{8}(?!\d)/g, " ");
}
