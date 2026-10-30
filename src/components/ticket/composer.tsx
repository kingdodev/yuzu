"use client";

import { ExternalLink, Sparkles } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { usesOrderVars } from "@/domain/orders";
import {
  addNote,
  discardDraft,
  getOrderTemplateVars,
  sendReply,
} from "@/server/actions/tickets";
import { AttachmentPicker, type PickerState } from "../attachments/attachment-picker";

type Draft = {
  id: string;
  body: string;
  translation: string | null;
  confidence: number;
  sources: { title: string; url: string | null }[];
};

type Props = {
  ticketId: string;
  draft: Draft | null;
  customerLanguage: string;
  customerLanguageName: string;
  templates: { id: string; name: string; body: string }[];
  templateVars: Record<string, string>;
  closed: boolean;
  /** Meelezers mogen alleen notities plaatsen. */
  notesOnly?: boolean;
};

export function Composer(props: Props) {
  const {
    ticketId,
    draft,
    customerLanguage,
    customerLanguageName,
    templates,
    templateVars,
    closed,
    notesOnly = false,
  } = props;
  const [mode, setMode] = useState<"reply" | "note">(notesOnly ? "note" : "reply");
  const [text, setText] = useState("");
  const [usedDraftId, setUsedDraftId] = useState<string | null>(null);
  const [nextStatus, setNextStatus] = useState<"pending_customer" | "solved" | "open">(
    "pending_customer",
  );
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [files, setFiles] = useState<PickerState>({ ids: [], busy: false });
  // Na versturen een nieuwe, lege bijlagenlijst.
  const [pickerKey, setPickerKey] = useState(0);
  const [pending, start] = useTransition();
  const area = useRef<HTMLTextAreaElement>(null);

  function applyDraft() {
    if (!draft) return;
    setMode("reply");
    setText(draft.body);
    setUsedDraftId(draft.id);
    requestAnimationFrame(() => area.current?.focus());
  }

  async function insertTemplate(id: string) {
    const tpl = templates.find((t) => t.id === id);
    if (!tpl) return;
    let vars = templateVars;
    if (usesOrderVars(tpl.body)) {
      // Ordergegevens pas ophalen als een sjabloon ze nodig heeft.
      try {
        vars = { ...templateVars, ...(await getOrderTemplateVars(ticketId)) };
      } catch {
        // Webshop niet bereikbaar: de {{velden}} blijven staan om zelf in te vullen.
      }
    }
    const filled = tpl.body.replace(
      /\{\{(\w+)\}\}/g,
      (_, key: string) => vars[key] || `{{${key}}}`,
    );
    setText((current) => (current.trim() ? `${current}\n\n${filled}` : filled));
    area.current?.focus();
  }

  function submit() {
    setFeedback(null);
    start(async () => {
      const result =
        mode === "note"
          ? await addNote(ticketId, text)
          : await sendReply({
              ticketId,
              body: text,
              nextStatus,
              draftId: usedDraftId,
              attachmentIds: files.ids,
            });
      if (result.ok) {
        setText("");
        setUsedDraftId(null);
        if (mode === "reply") {
          setPickerKey((k) => k + 1);
          setFiles({ ids: [], busy: false });
        }
        setFeedback(
          mode === "note"
            ? { ok: true, text: "Notitie toegevoegd." }
            : { ok: true, text: result.message ?? "Verstuurd." },
        );
      } else {
        setFeedback({ ok: false, text: result.error });
      }
    });
  }

  const foreign = customerLanguage !== "nl";

  return (
    <div className="space-y-4">
      {draft && !usedDraftId && !notesOnly && (
        <section
          aria-label="Concept van Yuzu"
          className="overflow-hidden rounded-xl border border-yuzu bg-yuzu-soft"
        >
          <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-yuzu/60 px-4 py-2.5">
            <span className="inline-flex items-center gap-1.5 font-semibold text-yuzu-ink">
              <Sparkles className="h-4 w-4" aria-hidden />
              Concept van Yuzu
            </span>
            <span className="text-[13px] text-yuzu-ink/80">
              {draft.confidence}% zeker
            </span>
            {draft.sources.length > 0 && (
              <span className="flex flex-wrap items-center gap-x-2 text-[13px] text-yuzu-ink/80">
                Gebaseerd op
                {draft.sources.map((src) =>
                  // Bronnen komen uit de AI (te beïnvloeden via klantmail): alleen webadressen als link.
                  src.url && /^https?:\/\//i.test(src.url) ? (
                    <a
                      key={src.title}
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-0.5 underline underline-offset-2"
                    >
                      {src.title}
                      <ExternalLink className="h-3 w-3" aria-hidden />
                    </a>
                  ) : (
                    <span key={src.title}>{src.title}</span>
                  ),
                )}
              </span>
            )}
          </header>
          <div
            className={`grid gap-0 ${foreign && draft.translation ? "2xl:grid-cols-2" : ""}`}
          >
            <div className="px-4 py-3">
              {foreign && draft.translation && (
                <div className="mb-1.5 text-[12.5px] font-medium text-yuzu-ink/80">
                  Gaat naar de klant, in het {customerLanguageName}
                </div>
              )}
              <p className="whitespace-pre-wrap text-[14.5px] leading-[1.6] text-ink [overflow-wrap:anywhere]">
                {draft.body}
              </p>
            </div>
            {foreign && draft.translation && (
              <div className="border-t border-yuzu/60 px-4 py-3 2xl:border-l 2xl:border-t-0">
                <div className="mb-1.5 text-[12.5px] font-medium text-yuzu-ink/80">
                  Wat er staat, in het Nederlands
                </div>
                <p className="whitespace-pre-wrap text-[14.5px] leading-[1.6] text-ink-soft [overflow-wrap:anywhere]">
                  {draft.translation}
                </p>
              </div>
            )}
          </div>
          <footer className="flex flex-wrap gap-2 border-t border-yuzu/60 px-4 py-2.5">
            <button type="button" className="btn btn-primary" onClick={applyDraft}>
              Gebruik dit concept
            </button>
            <button
              type="button"
              className="btn btn-quiet"
              disabled={pending}
              onClick={() => start(async () => void (await discardDraft(draft.id)))}
            >
              Verwerp
            </button>
          </footer>
        </section>
      )}

      <section className="rounded-xl border border-line bg-panel">
        <div role="tablist" className="flex gap-1 border-b border-line px-2 pt-2">
          {(
            [
              ["reply", "Antwoord aan klant"],
              ["note", "Interne notitie"],
            ] as const
          )
            .filter(([value]) => !(notesOnly && value === "reply"))
            .map(([value, label]) => (
              <button
                key={value}
                role="tab"
                type="button"
                aria-selected={mode === value}
                disabled={value === "reply" && (closed || notesOnly)}
                onClick={() => setMode(value)}
                className={`-mb-px rounded-t-md border-b-2 px-3 py-2 text-[14px] ${
                  mode === value
                    ? "border-ink font-semibold text-ink"
                    : "border-transparent text-muted hover:text-ink"
                }`}
              >
                {label}
              </button>
            ))}
        </div>

        <div className={`p-3 ${mode === "note" ? "bg-note" : ""}`}>
          {usedDraftId && mode === "reply" && (
            <p className="mb-2 inline-flex items-center gap-1.5 text-[13px] text-muted">
              <Sparkles className="h-3.5 w-3.5 text-yuzu-ink" aria-hidden />
              Concept van Yuzu geplaatst. Pas het gerust aan voordat je verstuurt.
            </p>
          )}
          <label className="sr-only" htmlFor={`composer-${ticketId}`}>
            {mode === "note" ? "Interne notitie" : "Antwoord"}
          </label>
          <textarea
            id={`composer-${ticketId}`}
            ref={area}
            className="field min-h-[150px]"
            placeholder={
              mode === "note"
                ? "Alleen zichtbaar voor collega's."
                : closed
                  ? "Dit ticket is gesloten."
                  : foreign
                    ? draft
                      ? `Schrijf in het ${customerLanguageName}, of gebruik het concept van Yuzu.`
                      : `Schrijf in het ${customerLanguageName}. Een sjabloon in die taal kan helpen.`
                    : "Schrijf je antwoord."
            }
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (
                (e.metaKey || e.ctrlKey) &&
                e.key === "Enter" &&
                text.trim() &&
                !files.busy
              )
                submit();
            }}
          />

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className={mode === "reply" ? "contents" : "hidden"}>
              <AttachmentPicker key={pickerKey} onChange={setFiles} disabled={closed} />
            </div>
            {mode === "reply" && templates.length > 0 && (
              <select
                className="field w-auto py-1.5"
                value=""
                onChange={(e) => insertTemplate(e.target.value)}
                aria-label="Sjabloon invoegen"
              >
                <option value="">Sjabloon invoegen</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            )}
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {mode === "reply" && (
                <select
                  className="field w-auto py-1.5"
                  value={nextStatus}
                  onChange={(e) => setNextStatus(e.target.value as typeof nextStatus)}
                  aria-label="Status na versturen"
                >
                  <option value="pending_customer">Daarna: wacht op klant</option>
                  <option value="solved">Daarna: opgelost</option>
                  <option value="open">Daarna: open laten</option>
                </select>
              )}
              <button
                type="button"
                className="btn btn-primary"
                disabled={
                  pending || !text.trim() || (mode === "reply" && (closed || files.busy))
                }
                onClick={submit}
              >
                {pending
                  ? "Bezig…"
                  : mode === "note"
                    ? "Notitie toevoegen"
                    : files.busy
                      ? "Bijlagen uploaden…"
                      : "Versturen"}
              </button>
            </div>
          </div>
          {feedback && (
            <p
              role="status"
              className={`mt-2 text-[13.5px] ${feedback.ok ? "text-success" : "text-alert"}`}
            >
              {feedback.text}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
