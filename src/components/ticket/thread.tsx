import { Sparkles, StickyNote } from "lucide-react";
import { contactLabel, formatDateTime, LANGUAGE_LABELS, timeAgo } from "@/lib/format";
import type { TicketDetail } from "@/server/inbox";
import { AttachmentList, type AttachmentItem } from "../attachments/attachment-list";
import { Avatar } from "../ui";
import { Body, TranslatedText } from "./translated-text";

export function Thread({ detail }: { detail: TicketDetail }) {
  const languageName = (LANGUAGE_LABELS[detail.ticket.language ?? "nl"] ?? "")
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());
  const byMessage = new Map<string, AttachmentItem[]>();
  for (const a of detail.attachments) {
    if (!a.messageId) continue;
    byMessage.set(a.messageId, [...(byMessage.get(a.messageId) ?? []), a]);
  }
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
            <li key={m.id} className="flex gap-3">
              <Avatar
                name={ai ? "Yuzu" : (authorName ?? "Collega")}
                tone={ai ? "ai" : "team"}
                size={34}
              />
              <div className="min-w-0 flex-1 rounded-lg border border-note-line bg-note px-4 py-3">
                <div className="mb-1.5 flex flex-wrap items-center gap-x-2 text-[13.5px]">
                  <span className="font-semibold">
                    {ai ? "Yuzu" : (authorName ?? "Collega")}
                  </span>
                  <span className="inline-flex items-center gap-1 text-muted">
                    {ai ? (
                      <Sparkles className="h-3.5 w-3.5 text-yuzu-ink" aria-hidden />
                    ) : (
                      <StickyNote className="h-3.5 w-3.5" aria-hidden />
                    )}
                    {ai ? "heeft overgedragen" : "interne notitie"}
                  </span>
                  <span className="ml-auto">{when}</span>
                </div>
                <Body text={m.bodyText} />
                <AttachmentList items={byMessage.get(m.id) ?? []} />
              </div>
            </li>
          );
        }

        const inbound = m.direction === "inbound";
        const byAi = m.authorType === "ai";
        const name = inbound
          ? contactLabel(detail.contact.name, detail.contact.email)
          : byAi
            ? "Yuzu"
            : (authorName ?? "Klantenservice");
        return (
          <li key={m.id} className="flex gap-3">
            <Avatar
              name={name}
              tone={inbound ? undefined : byAi ? "ai" : "team"}
              size={34}
            />
            <div
              className={`min-w-0 flex-1 rounded-lg border px-4 py-3 shadow-card ${inbound ? "border-line bg-panel" : "border-info-line bg-info-tint"}`}
            >
              <div className="mb-2 flex flex-wrap items-center gap-x-2 text-[13.5px]">
                <span className="font-semibold">{name}</span>
                <span className="inline-flex items-center gap-1 text-muted">
                  {byAi && <Sparkles className="h-3 w-3 text-yuzu-ink" aria-hidden />}
                  {inbound ? "via e-mail" : byAi ? "automatisch verstuurd" : "antwoordde"}
                </span>
                <span className="ml-auto">{when}</span>
              </div>
              <TranslatedText
                original={m.bodyText}
                translation={m.translatedText}
                languageName={languageName}
              />
              <AttachmentList items={byMessage.get(m.id) ?? []} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
