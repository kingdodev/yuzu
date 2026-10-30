"use client";

import { Check, Plus } from "lucide-react";
import { useState, useTransition } from "react";
import {
  TICKET_STATUS_LABELS,
  TICKET_STATUSES,
  canTransition,
  type TicketStatus,
} from "@/domain/tickets";
import {
  assignTicket,
  setTicketPriority,
  setTicketStatus,
  toggleTicketTag,
} from "@/server/actions/tickets";
import { TagChip } from "../ui";

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[12.5px] font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}

export function StatusSelect({
  ticketId,
  status,
  readOnly = false,
}: {
  ticketId: string;
  status: TicketStatus;
  readOnly?: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const options = TICKET_STATUSES.filter((s) => s === status || canTransition(status, s));
  return (
    <Labeled label="Status">
      <select
        className="field py-1.5"
        value={status}
        disabled={readOnly || pending || options.length === 1}
        onChange={(e) =>
          start(async () => {
            const r = await setTicketStatus(ticketId, e.target.value);
            setError(r.ok ? null : r.error);
          })
        }
      >
        {options.map((s) => (
          <option key={s} value={s}>
            {TICKET_STATUS_LABELS[s]}
          </option>
        ))}
      </select>
      {error && <span className="text-xs text-alert">{error}</span>}
    </Labeled>
  );
}

export function AssigneeSelect({
  ticketId,
  assigneeId,
  agents,
  assignableIds,
  readOnly = false,
}: {
  ticketId: string;
  assigneeId: string | null;
  agents: { id: string; name: string }[];
  /** Aan wie jij mag toewijzen; leeg = iedereen. */
  assignableIds?: string[];
  readOnly?: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const allowed = (id: string) => !assignableIds || assignableIds.includes(id);
  return (
    <Labeled label="Eigenaar">
      <select
        className="field py-1.5"
        value={assigneeId ?? ""}
        disabled={readOnly || pending}
        onChange={(e) =>
          start(async () => {
            const r = await assignTicket(ticketId, e.target.value || null);
            setError(r.ok ? null : r.error);
          })
        }
      >
        <option value="">Niemand</option>
        {agents.map((a) => (
          <option key={a.id} value={a.id} disabled={!allowed(a.id)}>
            {a.name}
          </option>
        ))}
      </select>
      {error && <span className="text-xs text-alert">{error}</span>}
    </Labeled>
  );
}

const PRIORITIES = [
  ["low", "Laag"],
  ["normal", "Normaal"],
  ["high", "Hoog"],
  ["urgent", "Spoed"],
] as const;

export function PrioritySelect({
  ticketId,
  priority,
  readOnly = false,
}: {
  ticketId: string;
  priority: string;
  readOnly?: boolean;
}) {
  const [pending, start] = useTransition();
  return (
    <Labeled label="Prioriteit">
      <select
        className="field py-1.5"
        value={priority}
        disabled={readOnly || pending}
        onChange={(e) =>
          start(async () => void (await setTicketPriority(ticketId, e.target.value)))
        }
      >
        {PRIORITIES.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </Labeled>
  );
}

export function TagPicker({
  ticketId,
  tags,
  allTags,
  readOnly = false,
}: {
  ticketId: string;
  tags: { id: string; name: string; color: string }[];
  allTags: { id: string; name: string; color: string }[];
  readOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const active = new Set(tags.map((t) => t.id));
  return (
    <div className="relative flex flex-wrap items-center gap-1.5">
      {tags.map((t) => (
        <TagChip key={t.id} name={t.name} color={t.color} />
      ))}
      {!readOnly && (
        <button
          type="button"
          className="btn btn-quiet px-2 py-0.5 text-[13px]"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Label
        </button>
      )}
      {open && !readOnly && (
        <ul className="absolute left-0 top-full z-10 mt-1 w-52 rounded-lg border border-line bg-panel p-1 shadow-lg">
          {allTags.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                disabled={pending}
                className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-panel-sunk"
                onClick={() =>
                  start(async () => void (await toggleTicketTag(ticketId, t.id)))
                }
              >
                <TagChip name={t.name} color={t.color} />
                {active.has(t.id) && (
                  <Check className="h-4 w-4 text-ink" aria-label="Actief" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
