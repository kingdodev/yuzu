import { BarChart3, Inbox, Search, Settings } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { canSeeReports } from "@/domain/permissions";
import { canManage, getSession } from "@/server/session";
import { RailLink } from "./rail-link";
import { YuzuMark } from "./ui";

/** Smalle donkere balk links met de hoofdonderdelen, zoals in moderne helpdesks. */
export function Rail() {
  return (
    <nav
      aria-label="Hoofdmenu"
      className="flex h-full w-[60px] flex-col items-center gap-1 bg-rail py-3"
    >
      <Link
        href="/inbox/open"
        aria-label="Yuzu, naar de inbox"
        className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg hover:bg-rail-hover"
      >
        <YuzuMark size={28} />
      </Link>
      {/* RailLink leest de URL: binnen een Suspense-grens (Cache Components). */}
      <Suspense fallback={null}>
        <RailLink href="/inbox/open" match="/inbox" label="Tickets">
          <Inbox className="h-5 w-5" strokeWidth={1.8} aria-hidden />
        </RailLink>
        <RailLink href="/zoeken" label="Zoeken">
          <Search className="h-5 w-5" strokeWidth={1.8} aria-hidden />
        </RailLink>
        <RoleLinks />
      </Suspense>
    </nav>
  );
}

async function RoleLinks() {
  const session = await getSession();
  return (
    <>
      {canSeeReports(session.role) && (
        <RailLink href="/rapportages" label="Rapportages">
          <BarChart3 className="h-5 w-5" strokeWidth={1.8} aria-hidden />
        </RailLink>
      )}
      {canManage(session.role) && (
        <RailLink href="/beheer/shops" match="/beheer" label="Beheer">
          <Settings className="h-5 w-5" strokeWidth={1.8} aria-hidden />
        </RailLink>
      )}
    </>
  );
}
