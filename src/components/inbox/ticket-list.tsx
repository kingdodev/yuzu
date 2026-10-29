import { Sparkles } from "lucide-react";
import { EMPTY_VIEW_TEXT, VIEW_LABELS, type InboxView } from "@/domain/views";
import { contactLabel, INTENT_LABELS, shortTime } from "@/lib/format";
import { listTickets } from "@/server/inbox";
import { ShopBadge, StatusPill } from "../ui";
import { TicketRowLink } from "./ticket-row-link";

export async function TicketList({ view }: { view: InboxView }) {
  const tickets = await listTickets(view);
  return (
    <div className="flex h-full flex-col">
      <header className="flex items-baseline justify-between border-b border-line px-4 pb-3 pt-4">
        <h1 className="text-lg font-semibold tracking-[-0.01em]">{VIEW_LABELS[view]}</h1>
        <span className="tabular text-sm text-muted">
          {tickets.length} {tickets.length === 1 ? "ticket" : "tickets"}
        </span>
      </header>

      {tickets.length === 0 ? (
        <p className="px-4 py-10 text-[15px] leading-relaxed text-muted">
          {EMPTY_VIEW_TEXT[view]}
        </p>
      ) : (
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {tickets.map((t) => {
            const unread = t.status === "new";
            const urgent = t.priority === "high" || t.priority === "urgent";
            return (
              <li key={t.id}>
                <TicketRowLink href={`/inbox/${view}/${t.id}`}>
                  <div className="flex items-center gap-2">
                    <ShopBadge code={t.shopCode} />
                    <span
                      className={`min-w-0 flex-1 truncate text-[14px] ${unread ? "font-semibold" : "text-ink-soft"}`}
                    >
                      {contactLabel(t.contactName, t.contactEmail)}
                    </span>
                    <time
                      className="tabular shrink-0 text-xs text-muted"
                      dateTime={t.lastMessageAt.toISOString()}
                    >
                      {shortTime(t.lastMessageAt)}
                    </time>
                  </div>
                  <div
                    className={`mt-1 truncate text-[14.5px] ${unread ? "font-semibold" : ""}`}
                  >
                    {t.subject}
                  </div>
                  <p className="mt-0.5 line-clamp-1 text-[13.5px] text-muted">
                    {t.preview}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <StatusPill status={t.status} />
                    {urgent && (
                      <span className="text-[13px] font-semibold text-alert">
                        Hoge prioriteit
                      </span>
                    )}
                    {t.hasDraft && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-yuzu-soft px-2 py-[1px] text-[12.5px] font-medium text-yuzu-ink">
                        <Sparkles className="h-3 w-3" strokeWidth={2} aria-hidden />
                        Concept klaar
                      </span>
                    )}
                    {t.intent && (
                      <span className="text-[13px] text-muted">
                        {INTENT_LABELS[t.intent] ?? t.intent}
                      </span>
                    )}
                  </div>
                </TicketRowLink>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
