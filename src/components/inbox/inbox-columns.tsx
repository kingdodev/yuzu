import type { ReactNode } from "react";

/**
 * Indeling van de inbox, zoals in moderne helpdesks:
 * - geen ticket open: weergaven links, de ticketlijst over de volle breedte;
 * - ticket open: het ticket groot, met op brede schermen links een smalle
 *   lijst om snel naar het volgende ticket te gaan.
 * Puur CSS (`data-ticket` in het rechterdeel), zodat niets op de URL wacht.
 */
export function InboxColumns({
  views,
  list,
  children,
}: {
  views: ReactNode;
  list: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="inbox flex h-full min-h-0">
      <div className="inbox-views w-[232px] shrink-0 border-r border-line bg-nav">
        {views}
      </div>
      <div className="inbox-list @container min-w-0 flex-1 bg-panel">{list}</div>
      <div className="inbox-detail min-w-0 flex-1">{children}</div>
    </div>
  );
}
