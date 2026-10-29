import { Suspense } from "react";
import { PageHeader, Panel, Skeleton } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { listAudit } from "@/server/admin";

export const metadata = { title: "Auditlog" };

const ACTIONS: Record<string, string> = {
  shop_created: "Shop aangemaakt",
  shop_updated: "Shop gewijzigd",
  member_invited: "Gebruiker toegevoegd",
  member_updated: "Rol of toegang gewijzigd",
  ai_setting_changed: "AI-instelling gewijzigd",
  retention_changed: "Bewaartermijn gewijzigd",
  contact_exported: "Klantgegevens gedownload",
  contact_anonymized: "Klantgegevens verwijderd",
};

export default function AuditPage() {
  return (
    <>
      <PageHeader
        title="Auditlog"
        description="Wie wat heeft gedaan met gevoelige instellingen en klantgegevens. Dit log kan niemand wijzigen of wissen, ook Yuzu zelf niet."
      />
      <Suspense fallback={<Skeleton lines={8} />}>
        <AuditList />
      </Suspense>
    </>
  );
}

async function AuditList() {
  const rows = await listAudit();
  if (rows.length === 0) {
    return (
      <p className="text-[15px] text-muted">
        Nog niets vastgelegd. Zodra iemand een rol, AI-instelling of bewaartermijn
        wijzigt, staat het hier.
      </p>
    );
  }
  return (
    <Panel className="overflow-x-auto">
      <table className="w-full min-w-[620px] text-left text-[14px]">
        <thead className="border-b border-line text-[13px] text-muted">
          <tr>
            <th className="px-4 py-2.5 font-medium">Wanneer</th>
            <th className="px-4 py-2.5 font-medium">Wie</th>
            <th className="px-4 py-2.5 font-medium">Wat</th>
            <th className="px-4 py-2.5 font-medium">Details</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ entry, actorName }) => (
            <tr key={entry.id} className="border-b border-line last:border-0">
              <td className="tabular whitespace-nowrap px-4 py-2.5 text-ink-soft">
                {formatDateTime(entry.createdAt)}
              </td>
              <td className="px-4 py-2.5">
                {entry.actorType === "user"
                  ? (actorName ?? "Onbekend")
                  : entry.actorType === "ai"
                    ? "Yuzu"
                    : "Systeem"}
              </td>
              <td className="px-4 py-2.5">{ACTIONS[entry.action] ?? entry.action}</td>
              <td className="px-4 py-2.5 text-[13px] text-muted">
                {Object.entries(entry.metadata as Record<string, unknown>)
                  .map(([k, v]) => `${k}: ${String(v)}`)
                  .join(", ")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}
