import {
  BarChart3,
  CheckCheck,
  Clock,
  Inbox,
  Settings,
  SquarePen,
  User,
  UserX,
} from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { canSeeReports, canWorkTickets } from "@/domain/permissions";
import { SHOP_VIEWS, VIEW_LABELS, type InboxView } from "@/domain/views";
import { getViewCounts, getVisibleShopCodes } from "@/server/inbox";
import { canManage, getSession } from "@/server/session";
import { NavLink } from "./nav-link";
import { ShopBadge, Skeleton } from "./ui";

const ICON = { className: "h-[17px] w-[17px] shrink-0 text-muted", strokeWidth: 1.8 };

export function Sidebar() {
  return (
    <nav
      aria-label="Hoofdmenu"
      className="flex h-full flex-col gap-5 overflow-y-auto px-3 py-3"
    >
      <Suspense fallback={<Skeleton lines={9} />}>
        <SidebarWithData />
      </Suspense>
    </nav>
  );
}

async function SidebarWithData() {
  const [counts, session, shopCodes] = await Promise.all([
    getViewCounts(),
    getSession(),
    getVisibleShopCodes(),
  ]);
  return (
    <SidebarLinks
      counts={counts}
      admin={canManage(session.role)}
      reports={canSeeReports(session.role)}
      canEmail={canWorkTickets(session.role)}
      shopCodes={shopCodes}
    />
  );
}

function SidebarLinks({
  counts,
  admin,
  reports,
  canEmail,
  shopCodes,
}: {
  counts: Record<InboxView, number>;
  admin: boolean;
  reports: boolean;
  canEmail: boolean;
  shopCodes: string[];
}) {
  const c = (v: InboxView) => counts[v];
  const shops = SHOP_VIEWS.filter((code) => shopCodes.includes(code));
  return (
    <>
      {canEmail && (
        <Link href="/inbox/nieuw" className="btn btn-primary w-full justify-center">
          <SquarePen className="h-4 w-4" aria-hidden />
          Nieuwe e-mail
        </Link>
      )}
      <div className="space-y-0.5">
        <NavLink href="/inbox/open" count={c("open")} emphasize>
          <Inbox {...ICON} />
          {VIEW_LABELS.open}
        </NavLink>
        <NavLink href="/inbox/mine" count={c("mine")}>
          <User {...ICON} />
          {VIEW_LABELS.mine}
        </NavLink>
        <NavLink href="/inbox/unassigned" count={c("unassigned")}>
          <UserX {...ICON} />
          {VIEW_LABELS.unassigned}
        </NavLink>
        <NavLink href="/inbox/waiting" count={c("waiting")}>
          <Clock {...ICON} />
          {VIEW_LABELS.waiting}
        </NavLink>
        <NavLink href="/inbox/solved">
          <CheckCheck {...ICON} />
          {VIEW_LABELS.solved}
        </NavLink>
      </div>

      {shops.length > 0 && (
        <div className="space-y-0.5">
          <h2 className="px-2.5 pb-1 text-[12.5px] font-medium text-muted">Shops</h2>
          {shops.map((code) => (
            <NavLink key={code} href={`/inbox/${code}`} count={c(code)}>
              <ShopBadge code={code} />
              {VIEW_LABELS[code]}
            </NavLink>
          ))}
        </div>
      )}

      <div className="space-y-0.5">
        {reports && (
          <NavLink href="/rapportages">
            <BarChart3 {...ICON} />
            Rapportages
          </NavLink>
        )}
        {admin && (
          <NavLink href="/beheer/shops" match="/beheer">
            <Settings {...ICON} />
            Beheer
          </NavLink>
        )}
      </div>
    </>
  );
}
