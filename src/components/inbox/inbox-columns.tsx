import type { ReactNode } from "react";

/**
 * Lijst links, ticket rechts. Op een telefoon zie je één van de twee: zodra
 * het rechterdeel een ticket bevat (`data-ticket`), verdwijnt de lijst.
 * Puur CSS, zodat er niets op de URL hoeft te wachten.
 */
export function InboxColumns({
  list,
  children,
}: {
  list: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="inbox flex h-full min-h-0">
      <div className="inbox-list w-full shrink-0 border-r border-line bg-panel lg:w-[380px]">
        {list}
      </div>
      <div className="inbox-detail min-w-0 flex-1">{children}</div>
    </div>
  );
}
