import { canArchive } from "@/domain/tickets";
import { EMPTY_VIEW_TEXT, isLabelView, VIEW_LABELS, type ListView } from "@/domain/views";
import { getBulkOptions, listTickets } from "@/server/inbox";
import { TagChip } from "../ui";
import { TicketRowBody } from "./ticket-row-body";
import { TicketRowLink } from "./ticket-row-link";
import { TicketCheckbox, TicketSelection } from "./ticket-selection";

export async function TicketList({
  view,
  label,
}: {
  view: ListView;
  /** Bij een labelweergave: het label zelf. */
  label?: { name: string; color: string } | null;
}) {
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
            {isLabelView(view) ? (
              <span className="inline-flex items-center gap-2">
                <span className="sr-only">Label</span>
                <TagChip name={label?.name ?? "Label"} color={label?.color ?? "gray"} />
              </span>
            ) : (
              VIEW_LABELS[view]
            )}
          </h1>
          <span className="tabular rounded-full bg-hover px-2 py-[1px] text-[12.5px] font-medium text-muted">
            {tickets.length}
          </span>
        </header>
      }
    >
      {tickets.length === 0 ? (
        <p className="px-4 py-10 text-[15px] leading-relaxed text-muted">
          {isLabelView(view) ? "Nog geen tickets met dit label." : EMPTY_VIEW_TEXT[view]}
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
