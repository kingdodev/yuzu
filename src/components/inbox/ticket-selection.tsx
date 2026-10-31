"use client";

import { Archive, X } from "lucide-react";
import {
  createContext,
  useContext,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { TICKET_STATUS_LABELS, TICKET_STATUSES } from "@/domain/tickets";
import {
  archiveTickets,
  bulkUpdateTickets,
  type ActionResult,
} from "@/server/actions/tickets";

type Selection = {
  selected: ReadonlySet<string>;
  toggle: (id: string) => void;
};

const SelectionContext = createContext<Selection | null>(null);

export type BulkOptions = {
  meId: string;
  /** Mag tickets wijzigen (geen meelezer). */
  canWork: boolean;
  agents: { id: string; name: string }[];
  tags: { id: string; name: string }[];
};

/** Statussen die je met de hand kiest; "nieuw" krijgt een ticket alleen vanzelf. */
const BULK_STATUSES = TICKET_STATUSES.filter((s) => s !== "new");

/**
 * Houdt bij welke tickets in de lijst aangevinkt zijn en toont de werkbalk
 * om ze in één keer te archiveren, toe te wijzen, een label te geven of een
 * andere status te geven. De lijst zelf blijft op de server opgebouwd;
 * alleen de vinkjes en de werkbalk draaien in de browser.
 */
export function TicketSelection({
  ids,
  archivableIds,
  options,
  header,
  children,
}: {
  ids: string[];
  archivableIds: string[];
  options: BulkOptions;
  header: ReactNode;
  children: ReactNode;
}) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const enabled = options.canWork;
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  // Na een actie kunnen tickets uit de lijst verdwijnen; vergeet die selectie.
  const visible = new Set(ids);
  const current = [...selected].filter((id) => visible.has(id));
  const allSelected = ids.length > 0 && current.length === ids.length;
  const archivable = new Set(archivableIds);
  const canArchiveSome = current.some((id) => archivable.has(id));

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
    setSelected(allSelected ? new Set() : new Set(ids));
  }

  function run(action: () => Promise<ActionResult>) {
    setFeedback(null);
    start(async () => {
      const result = await action();
      setFeedback(
        result.ok
          ? { ok: true, text: result.message ?? "Bijgewerkt" }
          : { ok: false, text: result.error },
      );
      if (result.ok) setSelected(new Set());
    });
  }

  const selectClass =
    "field w-auto min-w-0 flex-1 py-1.5 text-[13.5px] @2xl:w-44 @2xl:flex-none";

  return (
    <SelectionContext.Provider value={enabled ? { selected, toggle } : null}>
      <div className="flex h-full flex-col">
        <div className="border-b border-line bg-panel px-4 py-3">
          <div className="flex items-center gap-3">
            {enabled && ids.length > 0 && (
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
            <div
              role="toolbar"
              aria-label="Acties voor geselecteerde tickets"
              className="mt-3 space-y-2 @2xl:flex @2xl:flex-wrap @2xl:items-center @2xl:gap-2 @2xl:space-y-0"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13.5px] font-medium">
                  {current.length} geselecteerd
                </span>
                {canArchiveSome && (
                  <button
                    type="button"
                    className="btn btn-primary py-1.5"
                    disabled={pending}
                    onClick={() => run(() => archiveTickets(current))}
                  >
                    <Archive className="h-4 w-4" aria-hidden />
                    Archiveren
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-quiet ml-auto px-2 py-1.5"
                  disabled={pending}
                  onClick={() => setSelected(new Set())}
                  aria-label="Selectie wissen"
                >
                  <X className="h-4 w-4" aria-hidden />
                  Wissen
                </button>
              </div>
              <div className="flex gap-2 @2xl:order-1">
                <select
                  className={selectClass}
                  value=""
                  disabled={pending}
                  aria-label="Toewijzen aan"
                  onChange={(e) => {
                    const v = e.target.value;
                    if (!v) return;
                    run(() =>
                      bulkUpdateTickets({
                        ticketIds: current,
                        action: { type: "assign", userId: v === "none" ? null : v },
                      }),
                    );
                  }}
                >
                  <option value="">Toewijzen…</option>
                  {options.agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.id === options.meId ? `${a.name} (ik)` : a.name}
                    </option>
                  ))}
                  <option value="none">Niemand</option>
                </select>
                {options.tags.length > 0 && (
                  <select
                    className={selectClass}
                    value=""
                    disabled={pending}
                    aria-label="Label geven"
                    onChange={(e) => {
                      const v = e.target.value;
                      if (!v) return;
                      run(() =>
                        bulkUpdateTickets({
                          ticketIds: current,
                          action: { type: "tag", tagId: v },
                        }),
                      );
                    }}
                  >
                    <option value="">Label…</option>
                    {options.tags.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                )}
                <select
                  className={selectClass}
                  value=""
                  disabled={pending}
                  aria-label="Status wijzigen"
                  onChange={(e) => {
                    const v = e.target.value as (typeof BULK_STATUSES)[number] | "";
                    if (!v) return;
                    run(() =>
                      bulkUpdateTickets({
                        ticketIds: current,
                        action: { type: "status", status: v },
                      }),
                    );
                  }}
                >
                  <option value="">Status…</option>
                  {BULK_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {TICKET_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
          {pending && <p className="mt-2 text-[13px] text-muted">Bezig…</p>}
          {feedback && !pending && (
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
