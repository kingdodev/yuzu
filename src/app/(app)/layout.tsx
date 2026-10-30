import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <Topbar menu={<MobileMenu />} />
      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-[240px] shrink-0 bg-nav md:block">
          <Sidebar />
        </aside>
        <div className="min-h-0 min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

/** Op een telefoon klapt het menu uit onder de bovenbalk. */
function MobileMenu() {
  return (
    <details className="group md:hidden">
      <summary className="cursor-pointer list-none rounded-lg px-2.5 py-1.5 text-[14px] font-medium text-white hover:bg-white/10">
        <span className="group-open:hidden">Menu</span>
        <span className="hidden group-open:inline">Sluiten</span>
      </summary>
      <div className="absolute left-0 right-0 top-14 z-30 max-h-[75vh] overflow-y-auto border-b border-line bg-nav shadow-lg">
        <Sidebar />
      </div>
    </details>
  );
}
