"use client";

import { Search } from "lucide-react";
import Form from "next/form";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { MAX_SEARCH_LENGTH } from "@/domain/search";

/** Zoekveld in de kopbalk. Sneltoets: / */
export function SearchBox() {
  const pathname = usePathname();
  const params = useSearchParams();
  const q = pathname === "/zoeken" ? (params.get("q") ?? "") : "";
  return <SearchField key={q} defaultValue={q} />;
}

/** Zonder de huidige zoekopdracht, voor zolang de pagina laadt. */
export function SearchField({ defaultValue = "" }: { defaultValue?: string }) {
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable ||
          target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          target instanceof HTMLSelectElement)
      )
        return;
      e.preventDefault();
      input.current?.focus();
      input.current?.select();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <Form action="/zoeken" role="search" className="relative w-full">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
        aria-hidden
      />
      <input
        ref={input}
        name="q"
        type="search"
        defaultValue={defaultValue}
        maxLength={MAX_SEARCH_LENGTH}
        placeholder="Zoeken op klant, ordernummer of tekst"
        aria-label="Zoeken in tickets"
        aria-keyshortcuts="/"
        autoComplete="off"
        className="peer h-9 w-full rounded-md border border-line bg-panel-sunk pl-9 pr-9 text-[14px] text-ink placeholder:text-muted hover:border-line-strong focus:border-focus focus:bg-panel focus:outline-none focus:ring-3 focus:ring-[color-mix(in_srgb,var(--focus)_18%,transparent)] [&::-webkit-search-cancel-button]:hidden"
      />
      <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-line-strong bg-panel px-1.5 text-[11px] text-muted peer-focus:hidden">
        /
      </kbd>
    </Form>
  );
}
