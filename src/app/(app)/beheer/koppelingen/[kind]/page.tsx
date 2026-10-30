import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AiDetails, MailgunDetails } from "@/components/admin/integrations/coming-soon";
import {
  IntegrationIcon,
  StatusDot,
} from "@/components/admin/integrations/integration-icon";
import { MagentoSection } from "@/components/admin/integrations/magento-section";
import { Panel, Skeleton } from "@/components/ui";
import {
  integrationInfo,
  STATUS_LABELS,
  type IntegrationInfo,
  type IntegrationStatus,
} from "@/domain/integrations";
import { listIntegrations } from "@/server/admin";

export default function IntegrationPage({
  params,
}: PageProps<"/beheer/koppelingen/[kind]">) {
  return (
    <>
      <Link
        href="/beheer/koppelingen"
        className="mb-4 inline-flex items-center gap-1.5 text-[13.5px] text-muted hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Koppelingen
      </Link>
      <Suspense fallback={<Skeleton lines={10} />}>
        <Detail params={params} />
      </Suspense>
    </>
  );
}

async function Detail({ params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  const info = integrationInfo(kind);
  if (!info) notFound();
  const { integrations } = await listIntegrations();
  const status =
    (integrations[kind]?.status as IntegrationStatus | undefined) ?? "not_configured";

  return (
    <div className="space-y-5">
      <Header info={info} status={status} />
      <Panel className="p-5">
        {info.kind === "magento" ? (
          <MagentoSection />
        ) : info.kind === "mailgun" ? (
          <MailgunDetails />
        ) : (
          <AiDetails />
        )}
      </Panel>
    </div>
  );
}

function Header({ info, status }: { info: IntegrationInfo; status: IntegrationStatus }) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <IntegrationIcon kind={info.kind} size="lg" />
      <div className="min-w-0 flex-1">
        <h1 className="text-[1.6rem] font-semibold leading-tight tracking-[-0.01em]">
          {info.name}
        </h1>
        <p className="mt-0.5 text-[14.5px] text-muted">{info.description}</p>
      </div>
      {info.available ? (
        <StatusDot status={status} label={STATUS_LABELS[status]} />
      ) : (
        <span className="rounded-full bg-panel-sunk px-2.5 py-1 text-[12.5px] font-medium text-ink-soft">
          Binnenkort zelf aan te sluiten
        </span>
      )}
    </div>
  );
}
