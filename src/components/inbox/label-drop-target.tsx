"use client";

import {
  useEffect,
  useState,
  useTransition,
  type DragEvent,
  type ReactNode,
} from "react";
import { decodeDraggedTickets, TICKET_DRAG_TYPE } from "@/lib/ticket-drag";
import { bulkUpdateTickets } from "@/server/actions/tickets";

/**
 * Een label in het weergavenpaneel waar je tickets op kunt neerzetten, zoals
 * in Gmail. Gebruikt dezelfde actie als "Label…" in de werkbalk, dus met
 * dezelfde rechtencontrole op de server.
 */
export function LabelDropTarget({
  tagId,
  tagName,
  children,
}: {
  tagId: string;
  tagName: string;
  children: ReactNode;
}) {
  const [over, setOver] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  const accepts = (e: DragEvent) => e.dataTransfer.types.includes(TICKET_DRAG_TYPE);

  function onDragOver(e: DragEvent<HTMLDivElement>) {
    if (!accepts(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    if (!over) setOver(true);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    setOver(false);
    if (!accepts(e)) return;
    e.preventDefault();
    const ids = decodeDraggedTickets(e.dataTransfer.getData(TICKET_DRAG_TYPE));
    if (ids.length === 0) return;
    start(async () => {
      const result = await bulkUpdateTickets({
        ticketIds: ids,
        action: { type: "tag", tagId },
      });
      setToast(
        result.ok
          ? { ok: true, text: result.message ?? `Label ${tagName} toegevoegd` }
          : { ok: false, text: result.error },
      );
    });
  }

  return (
    <>
      <div
        onDragOver={onDragOver}
        onDragEnter={onDragOver}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        aria-busy={pending || undefined}
        className={`rounded-md transition-shadow ${
          over ? "bg-selected shadow-[inset_0_0_0_2px_var(--primary)]" : ""
        } ${pending ? "opacity-60" : ""}`}
      >
        {children}
      </div>
      {toast && (
        <div
          role="status"
          className={`fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-lg px-4 py-2.5 text-[13.5px] font-medium shadow-pop ${
            toast.ok ? "bg-[#0b1f2e] text-white" : "bg-alert-tint text-alert"
          }`}
        >
          {toast.text}
        </div>
      )}
    </>
  );
}
