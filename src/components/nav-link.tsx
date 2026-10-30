"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** Navigatielink die zichzelf markeert als je op die pagina (of een subpagina) bent. */
export function NavLink({
  href,
  match,
  children,
  count,
  emphasize,
}: {
  href: string;
  /** Pad-prefix die als "actief" telt; standaard `href`. */
  match?: string;
  children: ReactNode;
  count?: number;
  emphasize?: boolean;
}) {
  const pathname = usePathname();
  const prefix = match ?? href;
  const active = pathname === prefix || pathname.startsWith(`${prefix}/`);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`group flex items-center gap-2.5 rounded-lg px-2.5 py-[6px] text-[14px] transition-colors ${
        active
          ? "bg-selected font-semibold text-ink shadow-card"
          : "text-ink-soft hover:bg-hover hover:text-ink"
      }`}
    >
      <span className="flex min-w-0 flex-1 items-center gap-2.5 truncate">
        {children}
      </span>
      {count !== undefined && count > 0 && (
        <span
          className={`tabular min-w-[22px] rounded-full px-1.5 text-center text-xs font-semibold ${
            emphasize ? "bg-line-strong text-ink" : "text-muted"
          }`}
        >
          {count}
        </span>
      )}
    </Link>
  );
}
