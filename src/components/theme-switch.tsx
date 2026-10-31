"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import { THEME_STORAGE_KEY, type Theme } from "@/lib/theme";

const OPTIONS: { value: Theme; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: "Licht", Icon: Sun },
  { value: "dark", label: "Donker", Icon: Moon },
  { value: "system", label: "Zoals je computer", Icon: Monitor },
];

const listeners = new Set<() => void>();

function readTheme(): Theme {
  try {
    const t = localStorage.getItem(THEME_STORAGE_KEY);
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
  try {
    if (theme === "system") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Opslaan lukt niet (bijv. privévenster); de keuze geldt dan alleen nu.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Drie knoppen in de kopbalk: licht, donker of zoals de computer. */
export function ThemeSwitch({ alwaysVisible = false }: { alwaysVisible?: boolean }) {
  const theme = useSyncExternalStore(subscribe, readTheme, () => "system" as Theme);
  return (
    <div
      role="radiogroup"
      aria-label="Weergave"
      className={`items-center rounded-md border border-line bg-panel-sunk p-0.5 ${alwaysVisible ? "inline-flex" : "hidden sm:flex"}`}
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => applyTheme(value)}
            className={`flex h-7 w-7 items-center justify-center rounded transition-colors ${
              active ? "bg-panel text-ink shadow-card" : "text-muted hover:text-ink"
            }`}
          >
            <Icon className="h-[15px] w-[15px]" strokeWidth={2} aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
