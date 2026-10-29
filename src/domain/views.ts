/** De vaste weergaven in de inbox. */

export const SHOP_VIEWS = ["nl", "be", "fr", "es"] as const;

export const INBOX_VIEWS = [
  "open",
  "mine",
  "unassigned",
  "waiting",
  "solved",
  ...SHOP_VIEWS,
] as const;
export type InboxView = (typeof INBOX_VIEWS)[number];

export const VIEW_LABELS: Record<InboxView, string> = {
  open: "Te doen",
  mine: "Mijn tickets",
  unassigned: "Niet toegewezen",
  waiting: "Wacht op antwoord",
  solved: "Opgelost",
  nl: "Nederland",
  be: "België",
  fr: "Frankrijk",
  es: "Spanje",
};

export const EMPTY_VIEW_TEXT: Record<InboxView, string> = {
  open: "Niets te doen. Nieuwe mails verschijnen hier vanzelf.",
  mine: "Er staan geen open tickets op jouw naam.",
  unassigned: "Alle open tickets hebben een eigenaar.",
  waiting: "Er wacht niemand op een antwoord van een klant of vervoerder.",
  solved: "Nog geen opgeloste tickets.",
  nl: "Geen open tickets voor Nederland.",
  be: "Geen open tickets voor België.",
  fr: "Geen open tickets voor Frankrijk.",
  es: "Geen open tickets voor Spanje.",
};

export function isInboxView(value: string): value is InboxView {
  return (INBOX_VIEWS as readonly string[]).includes(value);
}

export function isShopView(view: InboxView): view is (typeof SHOP_VIEWS)[number] {
  return (SHOP_VIEWS as readonly string[]).includes(view);
}
