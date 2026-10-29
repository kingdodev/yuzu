import { Suspense } from "react";
import { ActionButton, ActionForm, Field } from "@/components/forms";
import { PageHeader, Panel, Skeleton, TAG_COLOR_NAMES, TagChip } from "@/components/ui";
import { deleteTag, saveTag } from "@/server/actions/admin";
import { listTags } from "@/server/admin";

export const metadata = { title: "Labels" };

const COLOR_LABELS: Record<string, string> = {
  gray: "Grijs",
  green: "Groen",
  blue: "Blauw",
  purple: "Paars",
  red: "Rood",
};

export default function LabelsPage() {
  return (
    <>
      <PageHeader
        title="Labels"
        description="Labels helpen bij zoeken, filteren en rapporteren, bijvoorbeeld op retouren of problemen met een vervoerder."
      />
      <Suspense fallback={<Skeleton />}>
        <TagList />
      </Suspense>
      <h2 className="mb-3 mt-10 text-[17px] font-semibold">Label toevoegen</h2>
      <Panel className="p-5">
        <TagForm />
      </Panel>
    </>
  );
}

function TagForm({ tag }: { tag?: { id: string; name: string; color: string } }) {
  return (
    <ActionForm
      action={saveTag}
      submitLabel={tag ? "Opslaan" : "Toevoegen"}
      submitClassName={tag ? "btn btn-secondary" : "btn btn-primary"}
      className="flex flex-wrap items-end gap-3"
    >
      {tag && <input type="hidden" name="id" value={tag.id} />}
      <div className="min-w-[200px] flex-1">
        <Field label="Naam">
          <input className="field" name="name" defaultValue={tag?.name} required />
        </Field>
      </div>
      <div className="w-40">
        <Field label="Kleur">
          <select className="field" name="color" defaultValue={tag?.color ?? "gray"}>
            {TAG_COLOR_NAMES.map((c) => (
              <option key={c} value={c}>
                {COLOR_LABELS[c] ?? c}
              </option>
            ))}
          </select>
        </Field>
      </div>
    </ActionForm>
  );
}

async function TagList() {
  const tags = await listTags();
  return (
    <Panel className="divide-y divide-line">
      {tags.map((tag) => (
        <div
          key={tag.id}
          className="grid gap-3 p-4 md:grid-cols-[180px_1fr_auto] md:items-end"
        >
          <div className="pb-2">
            <TagChip name={tag.name} color={tag.color} />
            <div className="mt-1.5 text-[13px] text-muted">
              {tag.uses} {tag.uses === 1 ? "ticket" : "tickets"}
            </div>
          </div>
          <TagForm tag={tag} />
          <ActionButton
            onAction={deleteTag.bind(null, tag.id)}
            confirm={`Label ${tag.name} verwijderen? Het verdwijnt ook van tickets.`}
            className="btn btn-quiet text-[13.5px]"
          >
            Verwijderen
          </ActionButton>
        </div>
      ))}
    </Panel>
  );
}
