"use client";

import { Reply, StickyNote } from "lucide-react";

export const COMPOSE_EVENT = "yuzu:compose";
export type ComposeMode = "reply" | "note";

/** "Antwoorden" en "Notitie" in de actiebalk: openen de editor onderaan in die stand. */
export function ComposeButtons({
  canReply,
  closed,
}: {
  canReply: boolean;
  closed: boolean;
}) {
  const open = (mode: ComposeMode) =>
    window.dispatchEvent(new CustomEvent<ComposeMode>(COMPOSE_EVENT, { detail: mode }));
  return (
    <>
      {canReply && (
        <button
          type="button"
          className="btn btn-primary"
          disabled={closed}
          onClick={() => open("reply")}
        >
          <Reply className="h-4 w-4" aria-hidden />
          Antwoorden
        </button>
      )}
      <button type="button" className="btn btn-secondary" onClick={() => open("note")}>
        <StickyNote className="h-4 w-4" aria-hidden />
        Notitie
      </button>
    </>
  );
}
