"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function TicketRowLink({
  href,
  indent = false,
  children,
}: {
  href: string;
  /** Ruimte links voor het selectievakje. */
  indent?: boolean;
  children: ReactNode;
}) {
  const active = usePathname() === href;
  return (
    <Link
      href={href}
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
