"use client";

import { Archive } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { archiveTicket } from "@/server/actions/tickets";

/** Is de gebruiker aan het typen? Dan mag een sneltoets niet afgaan. */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

/**
 * Archiveert het ticket (op "opgelost") en opent het volgende ticket in de
 * lijst. Sneltoets: E, zoals in Gmail.
 */
export function ArchiveButton({ ticketId, view }: { ticketId: string; view: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const archive = useCallback(() => {
    if (pending) return;
    setError(null);
    start(async () => {
      const result = await archiveTicket(ticketId, view);
      if (result.ok) router.push(result.nextHref);
      else setError(result.error);
    });
  }, [pending, router, ticketId, view]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "e" && e.key !== "E") return;
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat || isTyping(e.target)) return;
      e.preventDefault();
      archive();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [archive]);

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={archive}
        disabled={pending}
        className="btn btn-secondary"
        title="Archiveren (sneltoets E)"
        aria-keyshortcuts="E"
      >
        <Archive className="h-4 w-4" aria-hidden />
        {pending ? "Bezig…" : "Archiveren"}
        <kbd className="ml-1 hidden rounded border border-line-strong px-1 text-[11px] font-medium text-muted sm:inline">
          E
        </kbd>
      </button>
      {error && (
        <span role="status" className="text-[13px] text-alert">
          {error}
        </span>
      )}
    </div>
  );
}
