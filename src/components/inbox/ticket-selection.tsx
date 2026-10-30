"use client";

import { Archive } from "lucide-react";
import {
  createContext,
  useContext,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { archiveTickets } from "@/server/actions/tickets";

type Selection = {
  selected: ReadonlySet<string>;
  toggle: (id: string) => void;
};

const SelectionContext = createContext<Selection | null>(null);

/**
 * Houdt bij welke tickets in de lijst aangevinkt zijn en toont de werkbalk
 * om ze in één keer te archiveren. De lijst zelf blijft op de server
 * opgebouwd; alleen de vinkjes en de werkbalk draaien in de browser.
 */
export function TicketSelection({
  ids,
  archivableIds,
  header,
  children,
}: {
  ids: string[];
  archivableIds: string[];
  header: ReactNode;
  children: ReactNode;
}) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  // Na archiveren verdwijnen tickets uit de lijst; vergeet die selectie.
  const visible = new Set(ids);
  const current = [...selected].filter((id) => visible.has(id));
  const allSelected = archivableIds.length > 0 && current.length === archivableIds.length;

  function toggle(id: string) {
    setFeedback(null);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setFeedback(null);
    setSelected(allSelected ? new Set() : new Set(archivableIds));
  }

  function archiveSelected() {
    start(async () => {
      const result = await archiveTickets(current);
      setFeedback(
        result.ok
          ? { ok: true, text: result.message ?? "Gearchiveerd" }
          : { ok: false, text: result.error },
      );
      if (result.ok) setSelected(new Set());
    });
  }

  return (
    <SelectionContext.Provider value={{ selected, toggle }}>
      <div className="flex h-full flex-col">
        <div className="border-b border-line px-4 pb-3 pt-4">
          <div className="flex items-center gap-3">
            {archivableIds.length > 0 && (
              <input
                type="checkbox"
                aria-label="Alle tickets selecteren"
                checked={allSelected}
                ref={(el) => {
                  if (el) el.indeterminate = current.length > 0 && !allSelected;
                }}
                onChange={toggleAll}
                className="h-4 w-4 shrink-0 accent-[var(--primary)]"
              />
            )}
            <div className="min-w-0 flex-1">{header}</div>
          </div>
          {current.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="btn btn-primary"
                disabled={pending}
                onClick={archiveSelected}
              >
                <Archive className="h-4 w-4" aria-hidden />
                {pending ? "Bezig…" : `${current.length} archiveren`}
              </button>
              <button
                type="button"
                className="btn btn-quiet"
                disabled={pending}
                onClick={() => setSelected(new Set())}
              >
                Selectie wissen
              </button>
            </div>
          )}
          {feedback && (
            <p
              role="status"
              className={`mt-2 text-[13px] ${feedback.ok ? "text-success" : "text-alert"}`}
            >
              {feedback.text}
            </p>
          )}
        </div>
        {children}
      </div>
    </SelectionContext.Provider>
  );
}

/** Het vinkje voor één ticket in de lijst. */
export function TicketCheckbox({ id, label }: { id: string; label: string }) {
  const ctx = useContext(SelectionContext);
  if (!ctx) return null;
  return (
    <input
      type="checkbox"
      aria-label={`${label} selecteren`}
      checked={ctx.selected.has(id)}
      onChange={() => ctx.toggle(id)}
      className="h-4 w-4 shrink-0 accent-[var(--primary)]"
    />
  );
}
