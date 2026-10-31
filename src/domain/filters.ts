/**
 * Mailfilters, zoals in Gmail. Pure regels: wanneer komt een mail overeen,
 * en wat moet er dan gebeuren. De database en het toepassen staan in
 * src/db/repositories/filters.ts.
 */

export const FILTER_TEXT_MAX = 200;

export type FilterRule = {
  id: string;
  fromContains: string | null;
  subjectContains: string | null;
  hasWords: string | null;
  /** null = alle shops. */
  shopId: string | null;
  tagId: string | null;
  skipInbox: boolean;
  enabled: boolean;
};

/** Wat een filter van een mail bekijkt. */
export type MailForFilter = {
  fromEmail: string;
  fromName?: string | null;
  subject: string;
  body: string;
  shopId: string;
};

export type FilterOutcome = {
  tagIds: string[];
  skipInbox: boolean;
  /** Welke filters overeenkwamen. */
  filterIds: string[];
};

const norm = (s: string) => s.toLocaleLowerCase("nl").replace(/\s+/g, " ").trim();

/** "a, b" of "a OR b": één van de waarden is genoeg. */
function alternatives(value: string): string[] {
  return value
    .split(/,|\s+OR\s+|\|/)
    .map(norm)
    .filter(Boolean);
}

/**
 * Woorden die er allemaal in moeten staan. Tekst tussen aanhalingstekens is
 * één zin; een woord met een minteken ervoor mag er juist níet in staan.
 */
export function parseWords(value: string): { must: string[]; mustNot: string[] } {
  const must: string[] = [];
  const mustNot: string[] = [];
  for (const m of value.matchAll(/(-?)"([^"]+)"|(-?)(\S+)/g)) {
    const negative = (m[1] ?? m[3]) === "-";
    const word = norm(m[2] ?? m[4] ?? "");
    if (!word) continue;
    (negative ? mustNot : must).push(word);
  }
  return { must, mustNot };
}

/** Heeft een filter minstens één voorwaarde? Zonder voorwaarde zou alles overeenkomen. */
export function hasCondition(
  rule: Pick<FilterRule, "fromContains" | "subjectContains" | "hasWords" | "shopId">,
): boolean {
  return Boolean(
    rule.fromContains?.trim() ||
    rule.subjectContains?.trim() ||
    rule.hasWords?.trim() ||
    rule.shopId,
  );
}

/** Doet een filter iets? (een label, of de inbox overslaan) */
export function hasAction(rule: Pick<FilterRule, "tagId" | "skipInbox">): boolean {
  return Boolean(rule.tagId) || rule.skipInbox;
}

export function filterMatches(rule: FilterRule, mail: MailForFilter): boolean {
  if (!rule.enabled || !hasCondition(rule)) return false;
  if (rule.shopId && rule.shopId !== mail.shopId) return false;

  if (rule.fromContains?.trim()) {
    const from = norm(`${mail.fromName ?? ""} ${mail.fromEmail}`);
    if (!alternatives(rule.fromContains).some((a) => from.includes(a))) return false;
  }
  if (rule.subjectContains?.trim()) {
    const subject = norm(mail.subject);
    if (!alternatives(rule.subjectContains).some((a) => subject.includes(a)))
      return false;
  }
  if (rule.hasWords?.trim()) {
    const text = norm(`${mail.subject} ${mail.body}`);
    const { must, mustNot } = parseWords(rule.hasWords);
    if (!must.every((w) => text.includes(w))) return false;
    if (mustNot.some((w) => text.includes(w))) return false;
  }
  return true;
}

/** Alle filters op één mail: de labels van alle passende filters samen. */
export function applyFilterRules(
  rules: readonly FilterRule[],
  mail: MailForFilter,
): FilterOutcome {
  const matching = rules.filter((r) => filterMatches(r, mail));
  return {
    tagIds: [...new Set(matching.flatMap((r) => (r.tagId ? [r.tagId] : [])))],
    skipInbox: matching.some((r) => r.skipInbox),
    filterIds: matching.map((r) => r.id),
  };
}

/** Korte omschrijving voor de lijst met filters ("Onderwerp bevat …"). */
export function describeConditions(
  rule: Pick<FilterRule, "fromContains" | "subjectContains" | "hasWords">,
  shopName: string | null,
): string[] {
  const parts: string[] = [];
  if (rule.fromContains?.trim()) parts.push(`Van: ${rule.fromContains.trim()}`);
  if (rule.subjectContains?.trim())
    parts.push(`Onderwerp: ${rule.subjectContains.trim()}`);
  if (rule.hasWords?.trim()) parts.push(`Bevat: ${rule.hasWords.trim()}`);
  if (shopName) parts.push(`Shop: ${shopName}`);
  return parts;
}
