import { Sparkles, UserRound } from "lucide-react";
import type { TicketStatus } from "@/domain/tickets";
import { contactLabel, INTENT_LABELS, shortTime } from "@/lib/format";
import { Avatar, PriorityTag, ShopBadge, StatusPill } from "../ui";

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
  /** Undefined = niet bekend in deze lijst (dan geen regel "eigenaar"). */
  assigneeName?: string | null;
};

/**
 * Eén ticket in een lijst, als kaart: avatar, labels, onderwerp en klant,
 * en op brede lijsten rechts prioriteit, eigenaar en status. De lijst is
 * een container (`@container`): in de smalle lijst naast een open ticket
 * valt de rechterkolom weg.
 */
export function TicketRowBody({
  t,
  showNumber = true,
}: {
  t: TicketRowData;
  showNumber?: boolean;
}) {
  const unread = t.status === "new";
  const urgent = t.priority === "high" || t.priority === "urgent";
  const who = contactLabel(t.contactName, t.contactEmail);
  return (
    <div className="flex gap-3">
      <div className="pt-0.5">
        <Avatar name={who} size={34} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          {unread && (
            <span className="rounded-[4px] bg-selected px-1.5 py-[1px] text-[11.5px] font-semibold text-selected-ink">
              Nieuw
            </span>
          )}
          {t.hasDraft && (
            <span className="inline-flex items-center gap-1 rounded-[4px] bg-yuzu-soft px-1.5 py-[1px] text-[11.5px] font-semibold text-yuzu-ink">
              <Sparkles className="h-3 w-3" strokeWidth={2} aria-hidden />
              Concept klaar
            </span>
          )}
          {urgent && (
            <span className="rounded-[4px] bg-alert-tint px-1.5 py-[1px] text-[11.5px] font-semibold text-alert">
              {t.priority === "urgent" ? "Spoed" : "Hoge prioriteit"}
            </span>
          )}
          <time
            className="tabular ml-auto shrink-0 text-[12px] text-muted @2xl:hidden"
            dateTime={t.lastMessageAt.toISOString()}
          >
            {shortTime(t.lastMessageAt)}
          </time>
        </div>
        <div
          className={`mt-1 truncate text-[14.5px] leading-snug ${unread ? "font-semibold text-ink" : "font-medium text-ink"}`}
        >
          {t.subject}
          {showNumber && t.number !== undefined && (
            <span className="tabular ml-1.5 font-normal text-muted">#{t.number}</span>
          )}
        </div>
        <div className="mt-1 flex min-w-0 items-center gap-1.5 text-[13px] text-muted">
          <ShopBadge code={t.shopCode} />
          <span className="truncate text-ink-soft">{who}</span>
          <span aria-hidden className="hidden @2xl:inline">
            ·
          </span>
          <time
            className="tabular hidden shrink-0 @2xl:inline"
            dateTime={t.lastMessageAt.toISOString()}
          >
            {shortTime(t.lastMessageAt)}
          </time>
          {t.intent && (
            <>
              <span aria-hidden className="hidden @lg:inline">
                ·
              </span>
              <span className="hidden truncate @lg:inline">
                {INTENT_LABELS[t.intent] ?? t.intent}
              </span>
            </>
          )}
        </div>
        <p className="mt-1 line-clamp-1 text-[13px] text-muted @2xl:max-w-[640px]">
          {t.preview}
        </p>
        {!unread && (
          <div className="mt-1.5 @2xl:hidden">
            <StatusPill status={t.status} />
          </div>
        )}
      </div>
      <dl className="hidden w-[168px] shrink-0 content-start gap-y-1.5 border-l border-line pl-4 text-[13px] @2xl:grid">
        <dt className="sr-only">Prioriteit</dt>
        <dd>
          <PriorityTag priority={t.priority} />
        </dd>
        {t.assigneeName !== undefined && (
          <>
            <dt className="sr-only">Eigenaar</dt>
            <dd className="flex min-w-0 items-center gap-1.5 text-ink-soft">
              <UserRound className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />
              <span className="truncate">{t.assigneeName ?? "Niemand"}</span>
            </dd>
          </>
        )}
        <dt className="sr-only">Status</dt>
        <dd>
          <StatusPill status={t.status} />
        </dd>
      </dl>
    </div>
  );
}
