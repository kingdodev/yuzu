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
      className={`block border-b border-line py-3 pr-4 transition-colors ${indent ? "pl-11" : "pl-4"} ${
        active ? "bg-hover" : "hover:bg-panel-sunk"
      }`}
    >
      {children}
    </Link>
  );
}
