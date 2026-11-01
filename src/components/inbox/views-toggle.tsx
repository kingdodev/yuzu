"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useSyncExternalStore } from "react";
import { VIEWS_PANEL_ATTR, VIEWS_PANEL_STORAGE_KEY } from "@/lib/views-panel";

const listeners = new Set<() => void>();

function isOpen(): boolean {
  return document.documentElement.getAttribute(VIEWS_PANEL_ATTR) === "open";
}

function setOpen(open: boolean) {
  const root = document.documentElement;
  if (open) root.setAttribute(VIEWS_PANEL_ATTR, "open");
  else root.removeAttribute(VIEWS_PANEL_ATTR);
  try {
    if (open) localStorage.setItem(VIEWS_PANEL_STORAGE_KEY, "open");
    else localStorage.removeItem(VIEWS_PANEL_STORAGE_KEY);
  } catch {
    // Opslaan lukt niet (bijv. privévenster); de keuze geldt dan alleen nu.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Knop in de actiebalk van een ticket: weergaven tonen of verbergen.
 * Alleen op schermen waar het paneel past (vanaf 1024 pixels breed).
 */
export function ViewsToggle() {
  const open = useSyncExternalStore(subscribe, isOpen, () => false);
  const label = open ? "Weergaven verbergen" : "Weergaven tonen";
  const Icon = open ? PanelLeftClose : PanelLeftOpen;
  return (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      aria-pressed={open}
      aria-label={label}
      title={label}
      className="btn btn-quiet hidden px-2 lg:inline-flex"
    >
      <Icon className="h-[18px] w-[18px]" aria-hidden />
    </button>
  );
}
