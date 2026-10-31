import { Menu, X } from "lucide-react";
import { Rail } from "@/components/rail";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex h-full min-h-0">
      <aside className="hidden shrink-0 md:block">
        <Rail />
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <Topbar menu={<MobileMenu />} />
        <div className="min-h-0 min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

/** Op een telefoon klapt het menu uit onder de kopbalk. */
function MobileMenu() {
  return (
    <details className="group md:hidden">
      <summary
        aria-label="Menu"
        className="flex cursor-pointer list-none items-center rounded-md p-1.5 text-ink-soft hover:bg-hover"
      >
        <Menu className="h-5 w-5 group-open:hidden" aria-hidden />
        <X className="hidden h-5 w-5 group-open:block" aria-hidden />
      </summary>
      <div className="absolute left-0 right-0 top-14 z-30 max-h-[80vh] overflow-y-auto border-b border-line bg-nav shadow-pop">
        <Sidebar />
      </div>
    </details>
  );
}
