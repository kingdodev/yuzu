import {
  BarChart3,
  CheckCheck,
  Clock,
  Inbox,
  Search,
  Settings,
  User,
  UserX,
} from "lucide-react";
import { Suspense } from "react";
import { canSeeReports } from "@/domain/permissions";
import { SHOP_VIEWS, VIEW_LABELS, type InboxView } from "@/domain/views";
import { labelView } from "@/domain/views";
import { getLabelCounts, getViewCounts, getVisibleShopCodes } from "@/server/inbox";
import { canManage, getSession } from "@/server/session";
import { NavLink } from "./nav-link";
import { ThemeSwitch } from "./theme-switch";
import { ShopBadge, Skeleton } from "./ui";

const ICON = { className: "h-[17px] w-[17px] shrink-0 opacity-75", strokeWidth: 1.8 };

/** Weergaven en shops: het paneel naast de ticketlijst. */
export function ViewsNav() {
  return (
    <nav
      aria-label="Weergaven"
      className="flex h-full flex-col overflow-y-auto px-3 py-4"
    >
      <div className="px-2.5 pb-3 text-[15px] font-semibold tracking-[-0.01em]">
        Tickets
      </div>
      <Suspense fallback={<Skeleton lines={9} />}>
        <ViewLinks />
      </Suspense>
    </nav>
  );
}

async function ViewLinks() {
  const [counts, shopCodes, labels] = await Promise.all([
    getViewCounts(),
    getVisibleShopCodes(),
    getLabelCounts(),
  ]);
  const c = (v: InboxView) => counts[v];
  const shops = SHOP_VIEWS.filter((code) => shopCodes.includes(code));
  return (
    <div className="space-y-5">
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
          <h2 className="px-2.5 pb-1 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-muted">
            Shops
          </h2>
          {shops.map((code) => (
            <NavLink key={code} href={`/inbox/${code}`} count={c(code)}>
              <ShopBadge code={code} />
              {VIEW_LABELS[code]}
            </NavLink>
          ))}
        </div>
      )}
      {labels.length > 0 && (
        <div className="space-y-0.5">
          <h2 className="px-2.5 pb-1 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-muted">
            Labels
          </h2>
          {labels.map((tag) => (
            <NavLink key={tag.id} href={`/inbox/${labelView(tag.id)}`} count={tag.open}>
              <span
                aria-hidden
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: TAG_DOT[tag.color] ?? TAG_DOT.gray }}
              />
              <span className="truncate">{tag.name}</span>
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

const TAG_DOT: Record<string, string> = {
  green: "#3aa56c",
  blue: "#4a8fe0",
  purple: "#8a63d2",
  red: "#e0443a",
  gray: "var(--muted)",
};

/** Menu op een telefoon: weergaven plus de onderdelen uit de linkerbalk. */
export function Sidebar() {
  return (
    <div className="space-y-4 pb-4">
      <ViewsNav />
      <Suspense fallback={null}>
        <MoreLinks />
      </Suspense>
      <div className="px-5">
        <ThemeSwitch alwaysVisible />
      </div>
    </div>
  );
}

async function MoreLinks() {
  const session = await getSession();
  return (
    <div className="space-y-0.5 border-t border-line px-3 pt-4">
      <NavLink href="/zoeken">
        <Search {...ICON} />
        Zoeken
      </NavLink>
      {canSeeReports(session.role) && (
        <NavLink href="/rapportages">
          <BarChart3 {...ICON} />
          Rapportages
        </NavLink>
      )}
      {canManage(session.role) && (
        <NavLink href="/beheer/shops" match="/beheer">
          <Settings {...ICON} />
          Beheer
        </NavLink>
      )}
    </div>
  );
}
