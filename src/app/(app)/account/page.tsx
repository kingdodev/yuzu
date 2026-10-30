import { LogOut } from "lucide-react";
import { Suspense } from "react";
import { ChangePasswordForm } from "@/components/auth-forms";
import { PageHeader, Panel, Skeleton } from "@/components/ui";
import { usesDemoSession } from "@/db/connection";
import { ROLE_LABELS } from "@/lib/roles";
import { logout } from "@/server/actions/auth";
import { getSession } from "@/server/session";

export const metadata = { title: "Mijn account" };

export default function AccountPage() {
  return (
    <main className="h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl px-5 py-7 lg:px-10">
        <PageHeader title="Mijn account" />
        <Suspense fallback={<Skeleton lines={8} />}>
          <Account />
        </Suspense>
      </div>
    </main>
  );
}

async function Account() {
  const session = await getSession();
  const demo = usesDemoSession();
  return (
    <div className="space-y-6">
      <Panel className="p-5">
        <dl className="grid grid-cols-[140px_1fr] gap-y-2 text-[14.5px]">
          <dt className="text-muted">Naam</dt>
          <dd>{session.name}</dd>
          <dt className="text-muted">E-mailadres</dt>
          <dd className="break-all">{session.email}</dd>
          <dt className="text-muted">Organisatie</dt>
          <dd>{session.organizationName}</dd>
          <dt className="text-muted">Rol</dt>
          <dd>{ROLE_LABELS[session.role]?.label ?? session.role}</dd>
        </dl>
      </Panel>

      {demo ? (
        <p className="text-[14px] text-muted">
          In de lokale demo is er geen wachtwoord: je bent altijd Frank.
        </p>
      ) : (
        <>
          <section>
            <h2 className="mb-3 text-[17px] font-semibold">Wachtwoord wijzigen</h2>
            <Panel className="p-5">
              <ChangePasswordForm email={session.email} />
            </Panel>
          </section>
          <form action={logout}>
            <button type="submit" className="btn btn-secondary">
              <LogOut className="h-4 w-4" aria-hidden />
              Uitloggen
            </button>
          </form>
        </>
      )}
    </div>
  );
}
