import { Suspense } from "react";
import { MemberRow } from "@/components/admin/member-row";
import { ROLE_LABELS } from "@/lib/roles";
import { ActionForm, Field } from "@/components/forms";
import { DemoNotice, PageHeader, Panel, Skeleton } from "@/components/ui";
import { usesDemoSession } from "@/db/connection";
import { inviteMember } from "@/server/actions/admin";
import { listMembers, listShops } from "@/server/admin";

export const metadata = { title: "Gebruikers en rollen" };

export default function UsersPage() {
  return (
    <>
      <PageHeader
        title="Gebruikers en rollen"
        description="Wat iemand mag hangt af van de rol; waar, van de shops waar die toegang toe heeft."
      />
      <Suspense fallback={<Skeleton />}>
        <Members />
      </Suspense>

      <h2 className="mb-3 mt-10 text-[17px] font-semibold">Iemand toevoegen</h2>
      <Panel className="p-5">
        <ActionForm action={inviteMember} submitLabel="Toevoegen" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Naam">
              <input className="field" name="name" required />
            </Field>
            <Field label="E-mailadres">
              <input className="field" name="email" type="email" required />
            </Field>
            <Field label="Rol">
              <select className="field" name="role" defaultValue="agent">
                {Object.entries(ROLE_LABELS).map(([value, r]) => (
                  <option key={value} value={value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <DemoNotice>
            Na het toevoegen maak je bij de gebruiker een uitnodigingslink. Daarmee kiest
            die zelf een wachtwoord. Tot e-mail gekoppeld is, stuur je die link zelf door.
          </DemoNotice>
        </ActionForm>
      </Panel>

      <h2 className="mb-3 mt-10 text-[17px] font-semibold">Wat elke rol mag</h2>
      <Panel className="divide-y divide-line">
        {Object.entries(ROLE_LABELS).map(([value, r]) => (
          <div key={value} className="grid gap-1 px-5 py-3 sm:grid-cols-[160px_1fr]">
            <div className="font-medium">{r.label}</div>
            <div className="text-[14px] text-ink-soft">{r.text}</div>
          </div>
        ))}
      </Panel>
    </>
  );
}

async function Members() {
  const [members, shops] = await Promise.all([listMembers(), listShops()]);
  return (
    <Panel className="divide-y divide-line">
      {members.map((m) => (
        <MemberRow
          key={m.userId}
          member={m}
          shops={shops.map((s) => ({ id: s.id, code: s.code, name: s.name }))}
          showLogin={!usesDemoSession()}
        />
      ))}
    </Panel>
  );
}
