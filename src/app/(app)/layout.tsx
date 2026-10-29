import { Sidebar } from "@/components/sidebar";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex h-full min-h-0">
      <aside className="hidden w-[236px] shrink-0 border-r border-line bg-panel md:block">
        <Sidebar />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileBar />
        <div className="min-h-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

/** Op een telefoon klapt het menu in achter een knop. */
function MobileBar() {
  return (
    <details className="group border-b border-line bg-panel md:hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 font-semibold">
        Yuzu
        <span className="text-sm font-normal text-muted group-open:hidden">Menu</span>
        <span className="hidden text-sm font-normal text-muted group-open:inline">
          Sluiten
        </span>
      </summary>
      <div className="max-h-[70vh] overflow-y-auto border-t border-line">
        <Sidebar />
      </div>
    </details>
  );
}
