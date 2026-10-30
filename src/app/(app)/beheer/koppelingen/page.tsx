import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import {
  IntegrationIcon,
  StatusDot,
} from "@/components/admin/integrations/integration-icon";
import { PageHeader, Panel, Skeleton } from "@/components/ui";
import {
  INTEGRATIONS,
  isActive,
  STATUS_LABELS,
  type IntegrationStatus,
} from "@/domain/integrations";
import { formatDateTime } from "@/lib/format";
import { listIntegrations } from "@/server/admin";

export const metadata = { title: "Koppelingen" };

export default function IntegrationsPage() {
  return (
    <>
      <PageHeader
        title="Koppelingen"
        description="Sluit Yuzu aan op de systemen die je al gebruikt. Sleutels vul je één keer in; Yuzu bewaart ze versleuteld en toont ze nooit meer."
      />
      <Suspense fallback={<Skeleton lines={10} />}>
        <Overview />
      </Suspense>
    </>
  );
}

function host(url: string | null) {
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

async function Overview() {
  const { integrations } = await listIntegrations();
  const statusOf = (kind: string): IntegrationStatus =>
    (integrations[kind]?.status as IntegrationStatus | undefined) ?? "not_configured";
  const active = INTEGRATIONS.filter((i) => isActive(statusOf(i.kind)));
  const available = INTEGRATIONS.filter((i) => !isActive(statusOf(i.kind)));

  return (
    <div className="space-y-9">
      <section>
        <h2 className="mb-3 text-[17px] font-semibold">Actieve koppelingen</h2>
        {active.length === 0 ? (
          <Panel className="px-5 py-6 text-[14.5px] text-muted">
            Nog geen koppelingen. Kies hieronder wat je wilt aansluiten.
          </Panel>
        ) : (
          <Panel className="divide-y divide-line">
            {active.map((i) => {
              const row = integrations[i.kind];
              const status = statusOf(i.kind);
              return (
                <Link
                  key={i.kind}
                  href={`/beheer/koppelingen/${i.kind}`}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-panel-sunk"
                >
                  <IntegrationIcon kind={i.kind} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                      <span className="font-semibold">{i.name}</span>
                      <StatusDot status={status} label={STATUS_LABELS[status]} />
                    </div>
                    <div className="mt-0.5 truncate text-[13.5px] text-muted">
                      {[
                        host(row?.summary ?? null),
                        row?.lastCheckedAt &&
                          `laatst getest ${formatDateTime(row.lastCheckedAt)}`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                    {status === "error" && row?.lastError && (
                      <div className="mt-1 line-clamp-2 text-[13px] text-alert">
                        {row.lastError}
                      </div>
                    )}
                  </div>
                  <span className="hidden text-[13.5px] font-medium text-ink-soft sm:inline">
                    Beheren
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                </Link>
              );
            })}
          </Panel>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-[17px] font-semibold">Beschikbare koppelingen</h2>
        {available.length === 0 ? (
          <p className="text-[14.5px] text-muted">Alles is aangesloten.</p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {available.map((i) => {
              const demo = statusOf(i.kind) === "demo";
              return (
                <li key={i.kind}>
                  <Panel className="flex h-full flex-col p-5">
                    <div className="flex items-start gap-3">
                      <IntegrationIcon kind={i.kind} />
                      <div className="min-w-0">
                        <h3 className="font-semibold">{i.name}</h3>
                        <div className="text-[13px] text-muted">{i.category}</div>
                      </div>
                      {!i.available && (
                        <span className="ml-auto shrink-0 rounded-full bg-panel-sunk px-2 py-0.5 text-[12px] font-medium text-ink-soft">
                          Binnenkort
                        </span>
                      )}
                    </div>
                    <p className="mt-3 flex-1 text-[14px] leading-relaxed text-ink-soft">
                      {i.description}
                    </p>
                    {demo && (
                      <p className="mt-2 text-[12.5px] text-muted">
                        Nu met voorbeelddata.
                      </p>
                    )}
                    <div className="mt-4">
                      <Link
                        href={`/beheer/koppelingen/${i.kind}`}
                        className={i.available ? "btn btn-primary" : "btn btn-secondary"}
                      >
                        {i.available ? "Koppelen" : "Meer informatie"}
                      </Link>
                    </div>
                  </Panel>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
