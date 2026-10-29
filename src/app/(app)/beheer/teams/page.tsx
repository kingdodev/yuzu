import { Suspense } from "react";
import { TeamMemberToggle } from "@/components/admin/team-controls";
import { ActionButton, ActionForm, Field } from "@/components/forms";
import { PageHeader, Panel, Skeleton } from "@/components/ui";
import { createTeam, deleteTeam } from "@/server/actions/admin";
import { listTeams } from "@/server/admin";

export const metadata = { title: "Teams" };

export default function TeamsPage() {
  return (
    <>
      <PageHeader
        title="Teams"
        description="Met teams verdeel je het werk, bijvoorbeeld één team voor retouren. Nu is er één team; meer teams worden handig als er meer collega's bijkomen."
      />
      <Suspense fallback={<Skeleton />}>
        <TeamList />
      </Suspense>
      <h2 className="mb-3 mt-10 text-[17px] font-semibold">Team aanmaken</h2>
      <Panel className="p-5">
        <ActionForm
          action={createTeam}
          submitLabel="Aanmaken"
          className="flex flex-wrap items-end gap-3"
        >
          <div className="min-w-[240px] flex-1">
            <Field label="Naam">
              <input
                className="field"
                name="name"
                placeholder="Bijvoorbeeld Retouren"
                required
              />
            </Field>
          </div>
        </ActionForm>
      </Panel>
    </>
  );
}

async function TeamList() {
  const { teams, users } = await listTeams();
  if (teams.length === 0) return <p className="text-muted">Nog geen teams.</p>;
  return (
    <div className="space-y-4">
      {teams.map((team) => {
        const memberIds = new Set(team.members.map((m) => m.userId));
        return (
          <Panel key={team.id} className="p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[16px] font-semibold">{team.name}</h2>
              <ActionButton
                onAction={deleteTeam.bind(null, team.id)}
                confirm={`Team ${team.name} verwijderen? Tickets van dit team blijven bestaan.`}
                className="btn btn-quiet text-[13.5px]"
              >
                Verwijderen
              </ActionButton>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {users.map((u) => (
                <TeamMemberToggle
                  key={u.id}
                  teamId={team.id}
                  userId={u.id}
                  name={u.name}
                  member={memberIds.has(u.id)}
                />
              ))}
            </div>
          </Panel>
        );
      })}
    </div>
  );
}
