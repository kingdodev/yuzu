import { LogOut, Search, UserRound } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { usesDemoSession } from "@/db/connection";
import { logout } from "@/server/actions/auth";
import { getSession } from "@/server/session";
import { SearchBox, SearchField } from "./search-box";
import { ThemeSwitch } from "./theme-switch";
import { YuzuMark } from "./ui";

/** Donkere balk bovenin: logo links, zoeken in het midden, gebruiker rechts. */
export function Topbar({ menu }: { menu?: React.ReactNode }) {
  return (
    <header className="relative flex h-14 shrink-0 items-center gap-3 bg-topbar px-4 text-topbar-ink">
      <div className="flex shrink-0 items-center gap-2.5">
        <YuzuMark size={24} />
        <span className="text-[16px] font-semibold tracking-[-0.01em] text-white">
          Yuzu
        </span>
      </div>
      <div className="mx-auto hidden w-full max-w-[560px] px-4 sm:block">
        <Suspense fallback={<SearchField />}>
          <SearchBox />
        </Suspense>
      </div>
      <div className="ml-auto flex items-center gap-3 sm:ml-0">
        <Link
          href="/zoeken"
          aria-label="Zoeken"
          className="rounded-lg p-2 text-white hover:bg-white/10 sm:hidden"
        >
          <Search className="h-[18px] w-[18px]" aria-hidden />
        </Link>
        <ThemeSwitch />
        <Suspense fallback={null}>
          <CurrentUser />
        </Suspense>
        {menu}
      </div>
    </header>
  );
}

async function CurrentUser() {
  const session = await getSession();
  const initials = session.name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const demo = !process.env.DATABASE_URL || Boolean(process.env.DEMO_PASSWORD?.trim());
  return (
    <details className="group relative">
      <summary
        className="flex cursor-pointer list-none items-center gap-2.5 rounded-lg px-1.5 py-1 hover:bg-white/10"
        aria-label="Accountmenu"
      >
        <div className="hidden text-right leading-tight sm:block">
          <div className="text-[13px] font-medium text-white">{session.name}</div>
          <div className="text-[12px] text-topbar-ink/70">
            {session.organizationName}
            {demo ? ", demo-omgeving" : ""}
          </div>
        </div>
        <span
          aria-hidden
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#5c6ac4] text-[12.5px] font-semibold text-white"
        >
          {initials}
        </span>
      </summary>
      <div className="absolute right-0 top-11 z-40 w-56 overflow-hidden rounded-xl bg-panel py-1 text-ink shadow-lg ring-1 ring-line">
        <div className="border-b border-line px-3.5 py-2.5">
          <div className="truncate text-[13.5px] font-medium">{session.name}</div>
          <div className="truncate text-[12.5px] text-muted">{session.email}</div>
        </div>
        <Link
          href="/account"
          className="flex items-center gap-2 px-3.5 py-2 text-[14px] hover:bg-hover"
        >
          <UserRound className="h-4 w-4 text-muted" aria-hidden />
          Mijn account
        </Link>
        {!usesDemoSession() && (
          <form action={logout}>
            <button
              type="submit"
              className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-[14px] hover:bg-hover"
            >
              <LogOut className="h-4 w-4 text-muted" aria-hidden />
              Uitloggen
            </button>
          </form>
        )}
      </div>
    </details>
  );
}
