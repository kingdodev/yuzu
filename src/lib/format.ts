const rtf = new Intl.RelativeTimeFormat("nl", { numeric: "auto" });

/** "12 min geleden", "gisteren", "3 dagen geleden". */
export function timeAgo(date: Date, now = new Date()): string {
  const diff = (date.getTime() - now.getTime()) / 1000;
  const abs = Math.abs(diff);
  if (abs < 60) return "zojuist";
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 86400 * 7) return rtf.format(Math.round(diff / 86400), "day");
  return formatDate(date);
}

/** Compact voor lijsten: "14:05", "gisteren", "12 okt". */
export function shortTime(date: Date, now = new Date()): string {
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay)
    return date.toLocaleTimeString("nl-NL", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Amsterdam",
    });
  const yesterday = new Date(now.getTime() - 86400_000);
  if (date.toDateString() === yesterday.toDateString()) return "gisteren";
  return date.toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
    timeZone: "Europe/Amsterdam",
  });
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Amsterdam",
  });
}

export function formatDateTime(date: Date): string {
  return date.toLocaleString("nl-NL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Amsterdam",
  });
}

export function formatMoney(amount: number, currency = "EUR"): string {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency }).format(amount);
}

export const LANGUAGE_LABELS: Record<string, string> = {
  nl: "Nederlands",
  fr: "Frans",
  es: "Spaans",
  en: "Engels",
  de: "Duits",
};

export const INTENT_LABELS: Record<string, string> = {
  where_is_my_order: "Waar is mijn bestelling?",
  return: "Retourneren",
  delivery_time: "Levertijd",
  invoice: "Factuur",
  product_question: "Productvraag",
  address_change: "Adres wijzigen",
  damaged: "Beschadigd product",
  complaint: "Klacht",
  other: "Overig",
};

/** Naam van een contact zoals de agent hem ziet; verwijderde klanten tonen geen technisch adres. */
export function contactLabel(name: string | null, email: string): string {
  if (email.endsWith("@anoniem.invalid")) return "Verwijderde klant";
  return name ?? email;
}
