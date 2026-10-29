import { Sparkles, StickyNote } from "lucide-react";
import { contactLabel, formatDateTime, LANGUAGE_LABELS, timeAgo } from "@/lib/format";
import type { TicketDetail } from "@/server/inbox";
import { Body, TranslatedText } from "./translated-text";

export function Thread({ detail }: { detail: TicketDetail }) {
  const languageName = (LANGUAGE_LABELS[detail.ticket.language ?? "nl"] ?? "")
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());
  return (
    <ol className="space-y-4">
      {detail.thread.map(({ message: m, authorName }) => {
        const when = (
          <time
            dateTime={m.createdAt.toISOString()}
            title={formatDateTime(m.createdAt)}
            className="text-[13px] text-muted"
          >
            {timeAgo(m.createdAt)}
          </time>
        );

        if (m.direction === "note") {
          const ai = m.authorType === "ai";
          return (
            <li
              key={m.id}
              className="rounded-xl border border-dashed border-note-line bg-note px-4 py-3"
            >
              <div className="mb-1.5 flex items-center gap-2 text-[13.5px]">
                {ai ? (
                  <Sparkles className="h-3.5 w-3.5 text-yuzu-ink" aria-hidden />
                ) : (
                  <StickyNote className="h-3.5 w-3.5 text-muted" aria-hidden />
                )}
                <span className="font-semibold">
                  {ai ? "Yuzu" : (authorName ?? "Collega")}
                </span>
                <span className="text-muted">
                  {ai ? "heeft overgedragen" : "interne notitie"}
                </span>
                <span className="ml-auto">{when}</span>
              </div>
              <Body text={m.bodyText} />
            </li>
          );
        }

        const inbound = m.direction === "inbound";
        const byAi = m.authorType === "ai";
        return (
          <li
            key={m.id}
            className={`rounded-xl border px-4 py-3 ${inbound ? "border-line bg-panel" : "border-pine/20 bg-pine-tint/50 md:ml-10"}`}
          >
            <div className="mb-2 flex flex-wrap items-center gap-x-2 text-[13.5px]">
              <span className="font-semibold">
                {inbound
                  ? contactLabel(detail.contact.name, detail.contact.email)
                  : byAi
                    ? "Yuzu"
                    : (authorName ?? "Klantenservice")}
              </span>
              {!inbound && (
                <span className="inline-flex items-center gap-1 text-muted">
                  {byAi && <Sparkles className="h-3 w-3 text-yuzu-ink" aria-hidden />}
                  {byAi ? "automatisch verstuurd" : "aan klant"}
                </span>
              )}
              <span className="ml-auto">{when}</span>
            </div>
            <TranslatedText
              original={m.bodyText}
              translation={m.translatedText}
              languageName={languageName}
            />
          </li>
        );
      })}
    </ol>
  );
}
