"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function TicketRowLink({ href, children }: { href: string; children: ReactNode }) {
  const active = usePathname() === href;
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`block border-b border-line px-4 py-3 transition-colors ${
        active ? "bg-hover" : "hover:bg-panel-sunk"
      }`}
    >
      {children}
    </Link>
  );
}
