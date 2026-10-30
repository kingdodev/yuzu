import { canArchive } from "@/domain/tickets";
import { EMPTY_VIEW_TEXT, VIEW_LABELS, type InboxView } from "@/domain/views";
import { listTickets } from "@/server/inbox";
import { TicketRowBody } from "./ticket-row-body";
import { TicketRowLink } from "./ticket-row-link";
import { TicketCheckbox, TicketSelection } from "./ticket-selection";

export async function TicketList({ view }: { view: InboxView }) {
  const tickets = await listTickets(view);
  const archivableIds = tickets.filter((t) => canArchive(t.status)).map((t) => t.id);
  const selectable = archivableIds.length > 0;
  return (
    <TicketSelection
      ids={tickets.map((t) => t.id)}
      archivableIds={archivableIds}
      header={
        <header className="flex items-baseline justify-between">
          <h1 className="text-lg font-semibold tracking-[-0.01em]">
            {VIEW_LABELS[view]}
          </h1>
          <span className="tabular text-sm text-muted">
            {tickets.length} {tickets.length === 1 ? "ticket" : "tickets"}
          </span>
        </header>
      }
    >
      {tickets.length === 0 ? (
        <p className="px-4 py-10 text-[15px] leading-relaxed text-muted">
          {EMPTY_VIEW_TEXT[view]}
        </p>
      ) : (
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {tickets.map((t) => {
            return (
              <li key={t.id} className="relative">
                {canArchive(t.status) && (
                  <div className="absolute left-4 top-3.5 z-10 flex">
                    <TicketCheckbox id={t.id} label={t.subject} />
                  </div>
                )}
                <TicketRowLink href={`/inbox/${view}/${t.id}`} indent={selectable}>
                  <TicketRowBody t={t} />
                </TicketRowLink>
              </li>
            );
          })}
        </ul>
      )}
    </TicketSelection>
  );
}
