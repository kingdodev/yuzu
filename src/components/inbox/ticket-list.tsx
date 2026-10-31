import { canArchive } from "@/domain/tickets";
import { EMPTY_VIEW_TEXT, VIEW_LABELS, type InboxView } from "@/domain/views";
import { getBulkOptions, listTickets } from "@/server/inbox";
import { TicketRowBody } from "./ticket-row-body";
import { TicketRowLink } from "./ticket-row-link";
import { TicketCheckbox, TicketSelection } from "./ticket-selection";

export async function TicketList({ view }: { view: InboxView }) {
  const [tickets, options] = await Promise.all([listTickets(view), getBulkOptions()]);
  const archivableIds = tickets.filter((t) => canArchive(t.status)).map((t) => t.id);
  return (
    <TicketSelection
      ids={tickets.map((t) => t.id)}
      archivableIds={archivableIds}
      options={options}
      header={
        <header className="flex items-baseline gap-2.5">
          <h1 className="text-[17px] font-semibold tracking-[-0.01em]">
            {VIEW_LABELS[view]}
          </h1>
          <span className="tabular rounded-full bg-hover px-2 py-[1px] text-[12.5px] font-medium text-muted">
            {tickets.length}
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
                <div className="absolute left-4 top-[22px] z-10 flex">
                  <TicketCheckbox id={t.id} label={t.subject} />
                </div>
                <TicketRowLink href={`/inbox/${view}/${t.id}`} indent={options.canWork}>
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
