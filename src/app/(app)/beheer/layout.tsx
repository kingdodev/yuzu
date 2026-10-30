import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { NavLink } from "@/components/nav-link";
import { isOwner } from "@/domain/permissions";
import { canManage, getSession } from "@/server/session";

const SECTIONS: { title: string; links: [string, string][] }[] = [
  {
    title: "Organisatie",
    links: [
      ["/beheer/shops", "Shops"],
      ["/beheer/gebruikers", "Gebruikers en rollen"],
      ["/beheer/teams", "Teams"],
      ["/beheer/labels", "Labels"],
    ],
  },
  {
    title: "Antwoorden",
    links: [
      ["/beheer/sjablonen", "Sjablonen"],
      ["/beheer/kennisbank", "Kennisbank"],
      ["/beheer/ai", "AI-instellingen"],
    ],
  },
  {
    title: "Systeem",
    links: [
      ["/beheer/koppelingen", "Koppelingen"],
      ["/beheer/privacy", "Privacy en AVG"],
      ["/beheer/auditlog", "Auditlog"],
    ],
  },
];

export default function BeheerLayout({ children }: LayoutProps<"/beheer">) {
  return (
    <Suspense fallback={null}>
      <AdminOnly>{children}</AdminOnly>
    </Suspense>
  );
}

/** Beheer is alleen voor eigenaars en beheerders; anderen gaan naar de inbox. */
async function AdminOnly({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!canManage(session.role)) redirect("/inbox/open");
  return <BeheerShell owner={isOwner(session.role)}>{children}</BeheerShell>;
}

/** Koppelingen en privacy zijn alleen voor de eigenaar. */
const OWNER_ONLY = new Set(["/beheer/koppelingen", "/beheer/privacy"]);

function BeheerShell({ children, owner }: { children: ReactNode; owner: boolean }) {
  return (
    <div className="flex h-full min-h-0 flex-col lg:flex-row">
      <nav
        aria-label="Beheer"
        className="shrink-0 border-b border-line bg-panel px-3 py-4 lg:w-[220px] lg:border-b-0 lg:border-r"
      >
        <div className="px-2.5 pb-3 text-lg font-semibold tracking-[-0.01em]">Beheer</div>
        <Suspense fallback={null}>
          <div className="flex gap-6 overflow-x-auto lg:block lg:space-y-5">
            {SECTIONS.map((section) => (
              <div key={section.title} className="shrink-0 space-y-0.5">
                <h2 className="px-2.5 pb-1 text-[12.5px] font-medium text-muted">
                  {section.title}
                </h2>
                {section.links
                  .filter(([href]) => owner || !OWNER_ONLY.has(href))
                  .map(([href, label]) => (
                    <NavLink key={href} href={href}>
                      {label}
                    </NavLink>
                  ))}
              </div>
            ))}
          </div>
        </Suspense>
      </nav>
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-5 py-7 lg:px-10">{children}</div>
      </main>
    </div>
  );
}
