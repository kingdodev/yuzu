"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** Icoon in de linkerbalk, met het label als tooltip. */
export function RailLink({
  href,
  match,
  label,
  children,
}: {
  href: string;
  match?: string;
  label: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const prefix = match ?? href;
  const active = pathname === prefix || pathname.startsWith(`${prefix}/`);
  return (
    <Link
      href={href}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={`group relative flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${
        active
          ? "bg-rail-active text-white"
          : "text-rail-ink hover:bg-rail-hover hover:text-white"
      }`}
    >
      {active && (
        <span
          aria-hidden
          className="absolute -left-[10px] top-2 bottom-2 w-[3px] rounded-r bg-white"
        />
      )}
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute left-full z-50 ml-3 whitespace-nowrap rounded-md bg-[#0b1f2e] px-2 py-1 text-[12.5px] font-medium text-white opacity-0 shadow-pop transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
      >
        {label}
      </span>
    </Link>
  );
}
