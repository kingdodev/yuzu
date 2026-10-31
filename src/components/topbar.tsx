import { LogOut, Plus, Search, UserRound } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { usesDemoSession } from "@/db/connection";
import { canWorkTickets } from "@/domain/permissions";
import { logout } from "@/server/actions/auth";
import { getSession } from "@/server/session";
import { SearchBox, SearchField } from "./search-box";
import { ThemeSwitch } from "./theme-switch";
import { Avatar, YuzuMark } from "./ui";

/** Witte kopbalk: zoeken links, "Nieuw" en de gebruiker rechts. */
export function Topbar({ menu }: { menu?: React.ReactNode }) {
  return (
    <header className="relative z-20 flex h-14 shrink-0 items-center gap-3 border-b border-line bg-topbar px-4 text-topbar-ink">
      <div className="flex shrink-0 items-center gap-2 md:hidden">
        {menu}
        <YuzuMark size={24} />
        <span className="text-[15px] font-semibold tracking-[-0.01em]">Yuzu</span>
      </div>
      <div className="hidden w-full max-w-[460px] sm:block">
        <Suspense fallback={<SearchField />}>
          <SearchBox />
        </Suspense>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <Link
          href="/zoeken"
          aria-label="Zoeken"
          className="rounded-md p-2 text-ink-soft hover:bg-hover sm:hidden"
        >
          <Search className="h-[18px] w-[18px]" aria-hidden />
        </Link>
        <Suspense fallback={null}>
          <NewButton />
        </Suspense>
        <ThemeSwitch />
        <Suspense fallback={<span className="h-8 w-8" />}>
          <CurrentUser />
        </Suspense>
      </div>
    </header>
  );
}

async function NewButton() {
  const session = await getSession();
  if (!canWorkTickets(session.role)) return null;
  return (
    <Link href="/inbox/nieuw" className="btn btn-primary py-[0.4rem]">
      <Plus className="h-4 w-4" strokeWidth={2.2} aria-hidden />
      <span className="hidden sm:inline">Nieuwe e-mail</span>
      <span className="sm:hidden">Nieuw</span>
    </Link>
  );
}

async function CurrentUser() {
  const session = await getSession();
  const demo = !process.env.DATABASE_URL || Boolean(process.env.DEMO_PASSWORD?.trim());
  return (
    <details className="group relative">
      <summary
        className="flex cursor-pointer list-none items-center gap-2 rounded-md p-1 hover:bg-hover"
        aria-label="Accountmenu"
      >
        <Avatar name={session.name} size={30} />
      </summary>
      <div className="absolute right-0 top-11 z-40 w-60 overflow-hidden rounded-lg bg-panel py-1 text-ink shadow-pop">
        <div className="border-b border-line px-3.5 py-2.5">
          <div className="truncate text-[13.5px] font-semibold">{session.name}</div>
          <div className="truncate text-[12.5px] text-muted">{session.email}</div>
          <div className="mt-1 truncate text-[12.5px] text-muted">
            {session.organizationName}
            {demo ? ", demo-omgeving" : ""}
          </div>
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
