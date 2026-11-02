"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { DragEvent, ReactNode } from "react";
import { encodeDraggedTickets, TICKET_DRAG_TYPE } from "@/lib/ticket-drag";
import { useTicketSelection } from "./ticket-selection";

export function TicketRowLink({
  href,
  ticketId,
  indent = false,
  children,
}: {
  href: string;
  ticketId: string;
  /** Ruimte links voor het selectievakje. */
  indent?: boolean;
  children: ReactNode;
}) {
  const active = usePathname() === href;
  const selection = useTicketSelection();

  // Slepen naar een label (links); meelezers kunnen niet slepen.
  function onDragStart(e: DragEvent<HTMLAnchorElement>) {
    if (!selection) return;
    const ids = selection.dragIds(ticketId);
    e.dataTransfer.setData(TICKET_DRAG_TYPE, encodeDraggedTickets(ids));
    e.dataTransfer.effectAllowed = "copy";
    // Een eigen sleepbeeld: "3 tickets" in plaats van een doorzichtige kaart.
    const ghost = document.createElement("div");
    ghost.textContent = ids.length === 1 ? "1 ticket" : `${ids.length} tickets`;
    ghost.style.cssText =
      "position:fixed;top:-100px;left:-100px;padding:6px 12px;border-radius:999px;background:var(--primary);color:#fff;font:600 13px/1.2 var(--font-sans);box-shadow:var(--pop-shadow)";
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 12, 12);
    requestAnimationFrame(() => ghost.remove());
  }

  return (
    <Link
      href={href}
      draggable={Boolean(selection)}
      onDragStart={onDragStart}
      aria-current={active ? "page" : undefined}
      className={`relative block border-b border-line py-3 pr-4 transition-colors ${indent ? "pl-11" : "pl-4"} ${
        active
          ? "bg-selected before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-primary"
          : "hover:bg-hover"
      }`}
    >
      {children}
    </Link>
  );
}
