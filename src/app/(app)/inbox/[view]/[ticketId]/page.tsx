import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArchiveButton } from "@/components/ticket/archive-button";
import { Composer } from "@/components/ticket/composer";
import {
  AssigneeSelect,
  PrioritySelect,
  StatusSelect,
  TagPicker,
} from "@/components/ticket/controls";
import { CustomerPanel } from "@/components/ticket/customer-panel";
import { Thread } from "@/components/ticket/thread";
import { ShopBadge, Skeleton } from "@/components/ui";
import { canAssignOthers, canWorkTickets } from "@/domain/permissions";
import { canArchive } from "@/domain/tickets";
import { INTENT_LABELS, LANGUAGE_LABELS } from "@/lib/format";
import { getTicketDetail, type TicketDetail } from "@/server/inbox";

export default function TicketPage({ params }: PageProps<"/inbox/[view]/[ticketId]">) {
  return (
    <Suspense
      fallback={
        <div data-ticket>
          <Skeleton lines={12} />
        </div>
      }
    >
      <TicketLoader params={params} />
    </Suspense>
  );
}

async function TicketLoader({
  params,
}: {
  params: Promise<{ view: string; ticketId: string }>;
}) {
  const { view, ticketId } = await params;
  const detail = await getTicketDetail(ticketId);
  if (!detail) notFound();
  return <TicketView detail={detail} view={view} />;
}

function TicketView({ detail, view }: { detail: TicketDetail; view: string }) {
  const { ticket, shop, contact } = detail;
  const role = detail.session.role;
  const canWork = canWorkTickets(role);
  const language = ticket.language ?? shop.language;
  const firstOrder =
    detail.orders.find((o) => detail.linkedOrders.includes(o.number)) ?? detail.orders[0];
  const shipment = firstOrder?.shipments[0];
  const templateVars: Record<string, string> = {
    voornaam: (contact.name ?? "").split(" ")[0] || "",
    ordernummer: firstOrder?.number ?? "",
    vervoerder: shipment?.carrier ?? "",
    trackinglink: shipment?.trackingUrl ?? "",
    shopdomein: shop.domain,
    handtekening: shop.signature,
  };

  return (
    <div
      data-ticket
      className="h-full overflow-y-auto xl:flex xl:min-h-0 xl:overflow-hidden"
    >
      <div className="min-w-0 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
        <header className="border-b border-line bg-panel px-5 pb-4 pt-4 lg:px-7">
          <Link
            href={`/inbox/${view}`}
            className="mb-3 inline-flex items-center gap-1.5 text-[13.5px] text-muted hover:text-ink lg:hidden"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Terug naar de lijst
          </Link>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13.5px] text-muted">
            <ShopBadge code={shop.code} size="md" />
            <span className="tabular">#{ticket.number}</span>
            <span>{shop.name}</span>
            <span>{LANGUAGE_LABELS[language]}</span>
            {ticket.intent && (
              <span>{INTENT_LABELS[ticket.intent] ?? ticket.intent}</span>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
            <h1 className="min-w-0 text-[1.45rem] font-semibold leading-snug tracking-[-0.01em]">
              {ticket.subject}
            </h1>
            {canWork && canArchive(ticket.status) && (
              <ArchiveButton key={ticket.id} ticketId={ticket.id} view={view} />
            )}
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3 lg:max-w-2xl">
            <StatusSelect
              ticketId={ticket.id}
              status={ticket.status}
              readOnly={!canWork}
            />
            <AssigneeSelect
              ticketId={ticket.id}
              assigneeId={ticket.assigneeId}
              agents={detail.agents}
              assignableIds={canAssignOthers(role) ? undefined : [detail.session.userId]}
              readOnly={!canWork}
            />
            <PrioritySelect
              ticketId={ticket.id}
              priority={ticket.priority}
              readOnly={!canWork}
            />
          </div>
          <div className="mt-3">
            <TagPicker
              ticketId={ticket.id}
              tags={detail.tags}
              allTags={detail.allTags}
              readOnly={!canWork}
            />
          </div>
          {!canWork && (
            <p className="mt-3 text-[13px] text-muted">
              Je leest mee: je kunt notities plaatsen, maar niets wijzigen of mailen.
            </p>
          )}
        </header>

        <div className="space-y-6 px-5 py-6 lg:px-7">
          <Thread detail={detail} />
          <Composer
            ticketId={ticket.id}
            draft={
              detail.draft
                ? {
                    id: detail.draft.id,
                    body: detail.draft.body,
                    translation: detail.draft.translation,
                    confidence: detail.draft.confidence,
                    sources: detail.draft.sources,
                  }
                : null
            }
            customerLanguage={language}
            customerLanguageName={LANGUAGE_LABELS[language]}
            templates={detail.templates}
            templateVars={templateVars}
            closed={ticket.status === "closed"}
            notesOnly={!canWork}
          />
        </div>
      </div>

      <aside className="shrink-0 border-t border-line bg-panel px-5 py-5 xl:w-[330px] xl:overflow-y-auto xl:border-l xl:border-t-0">
        <CustomerPanel detail={detail} view={view} canEmail={canWork} />
      </aside>
    </div>
  );
}
