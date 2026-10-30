import { BarChart3, CheckCheck, Clock, Inbox, Settings, User, UserX } from "lucide-react";
import { Suspense } from "react";
import { VIEW_LABELS, type InboxView } from "@/domain/views";
import { getViewCounts } from "@/server/inbox";
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
  const [counts, session] = await Promise.all([getViewCounts(), getSession()]);
  return <SidebarLinks counts={counts} admin={canManage(session.role)} />;
}

function SidebarLinks({
  counts,
  admin,
}: {
  counts: Record<InboxView, number>;
  admin: boolean;
}) {
  const c = (v: InboxView) => counts[v];
  return (
    <>
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

      <div className="space-y-0.5">
        <h2 className="px-2.5 pb-1 text-[12.5px] font-medium text-muted">Shops</h2>
        {(["nl", "be", "fr", "es"] as const).map((code) => (
          <NavLink key={code} href={`/inbox/${code}`} count={c(code)}>
            <ShopBadge code={code} />
            {VIEW_LABELS[code]}
          </NavLink>
        ))}
      </div>

      <div className="space-y-0.5">
        <NavLink href="/rapportages">
          <BarChart3 {...ICON} />
          Rapportages
        </NavLink>
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
