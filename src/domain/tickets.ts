/**
 * Regels voor de levenscyclus van een ticket. Pure functies zonder database,
 * zodat ze makkelijk te testen zijn.
 *
 *   new ──► open ──► pending_customer / pending_third_party ──► solved ──► closed
 *            ▲                       │                            │
 *            └──── klant reageert ───┴──────── klant reageert ────┘
 *
 * Gesloten tickets worden niet heropend: een reactie daarop wordt een nieuw
 * ticket dat naar het oude verwijst.
 */

export const TICKET_STATUSES = [
  "new",
  "open",
  "pending_customer",
  "pending_third_party",
  "solved",
  "closed",
] as const;

export type TicketStatus = (typeof TICKET_STATUSES)[number];

/** Nederlandse labels voor de interface. */
export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  new: "Nieuw",
  open: "Open",
  pending_customer: "Wacht op klant",
  pending_third_party: "Wacht op derde",
  solved: "Opgelost",
  closed: "Gesloten",
};

const ALLOWED: Record<TicketStatus, readonly TicketStatus[]> = {
  new: ["open", "pending_customer", "pending_third_party", "solved"],
  open: ["pending_customer", "pending_third_party", "solved"],
  pending_customer: ["open", "pending_third_party", "solved"],
  pending_third_party: ["open", "pending_customer", "solved"],
  solved: ["open", "closed"],
  closed: [],
};

export function canTransition(from: TicketStatus, to: TicketStatus): boolean {
  return ALLOWED[from].includes(to);
}

export type InboundOutcome =
  | { action: "keep"; status: TicketStatus }
  | { action: "reopen"; status: "open" }
  | { action: "new_ticket" };

/** Wat er met een ticket gebeurt als de klant een nieuw bericht stuurt. */
export function onInboundMessage(current: TicketStatus): InboundOutcome {
  switch (current) {
    case "new":
    case "open":
      return { action: "keep", status: current };
    case "pending_customer":
    case "pending_third_party":
    case "solved":
      return { action: "reopen", status: "open" };
    case "closed":
      return { action: "new_ticket" };
  }
}

/**
 * Standaardstatus nadat een agent (of de AI) de klant heeft geantwoord.
 * De agent kan bij het versturen een andere status kiezen.
 */
export function defaultStatusAfterReply(current: TicketStatus): TicketStatus {
  return current === "closed" ? "closed" : "pending_customer";
}

/** Tickets waar nog werk aan is, voor de standaard inboxweergave. */
export function isActionable(status: TicketStatus): boolean {
  return status === "new" || status === "open";
}
