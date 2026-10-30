import { Sparkles } from "lucide-react";
import type { TicketStatus } from "@/domain/tickets";
import { contactLabel, INTENT_LABELS, shortTime } from "@/lib/format";
import { ShopBadge, StatusPill } from "../ui";

export type TicketRowData = {
  number?: number;
  subject: string;
  status: TicketStatus;
  priority: string;
  intent: string | null;
  lastMessageAt: Date;
  shopCode: string;
  contactName: string | null;
  contactEmail: string;
  preview: string;
  hasDraft?: boolean;
};

/** De inhoud van één regel in een ticketlijst (inbox of zoekresultaten). */
export function TicketRowBody({
  t,
  showNumber = false,
}: {
  t: TicketRowData;
  showNumber?: boolean;
}) {
  const unread = t.status === "new";
  const urgent = t.priority === "high" || t.priority === "urgent";
  return (
    <>
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
      <div className={`mt-1 truncate text-[14.5px] ${unread ? "font-semibold" : ""}`}>
        {showNumber && t.number !== undefined && (
          <span className="tabular mr-1.5 font-normal text-muted">#{t.number}</span>
        )}
        {t.subject}
      </div>
      <p className="mt-0.5 line-clamp-1 text-[13.5px] text-muted">{t.preview}</p>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <StatusPill status={t.status} />
        {urgent && (
          <span className="text-[13px] font-semibold text-alert">Hoge prioriteit</span>
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
    </>
  );
}
