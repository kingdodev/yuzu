import { Suspense } from "react";
import { getSession } from "@/server/session";
import { ThemeSwitch } from "./theme-switch";
import { YuzuMark } from "./ui";

/** Donkere balk bovenin, met het logo links en de ingelogde gebruiker rechts. */
export function Topbar({ menu }: { menu?: React.ReactNode }) {
  return (
    <header className="relative flex h-14 shrink-0 items-center gap-3 bg-topbar px-4 text-topbar-ink">
      <div className="flex items-center gap-2.5">
        <YuzuMark size={24} />
        <span className="text-[16px] font-semibold tracking-[-0.01em] text-white">
          Yuzu
        </span>
      </div>
      <div className="ml-auto flex items-center gap-3">
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
  return (
    <div className="flex items-center gap-2.5">
      <div className="hidden text-right leading-tight sm:block">
        <div className="text-[13px] font-medium text-white">{session.name}</div>
        <div className="text-[12px] text-topbar-ink/70">
          {session.organizationName}, demo-omgeving
        </div>
      </div>
      <span
        aria-hidden
        className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#5c6ac4] text-[12.5px] font-semibold text-white"
      >
        {initials}
      </span>
    </div>
  );
}
