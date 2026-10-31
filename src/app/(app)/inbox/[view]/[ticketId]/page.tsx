import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArchiveButton } from "@/components/ticket/archive-button";
import { ComposeButtons } from "@/components/ticket/compose-buttons";
import { Composer } from "@/components/ticket/composer";
import {
  AssigneeSelect,
  PrioritySelect,
  StatusSelect,
  TagPicker,
} from "@/components/ticket/controls";
import { CommerceSection, CommerceSkeleton } from "@/components/ticket/commerce-section";
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
  const closed = ticket.status === "closed";
  // Ordervariabelen haalt de editor zelf op (getOrderTemplateVars).
  const templateVars: Record<string, string> = {
    voornaam: (contact.name ?? "").split(" ")[0] || "",
    shopdomein: shop.domain,
    handtekening: shop.signature,
  };

  return (
    <div data-ticket className="flex h-full min-h-0 flex-col">
      {/* Actiebalk, zoals in moderne helpdesks. */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-line bg-panel px-4 py-2.5 lg:px-6">
        <Link
          href={`/inbox/${view}`}
          aria-label="Terug naar de lijst"
          title="Terug naar de lijst"
          className="btn btn-quiet px-2 2xl:hidden"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
        </Link>
        <ComposeButtons canReply={canWork} closed={closed} />
        {canWork && canArchive(ticket.status) && (
          <ArchiveButton key={ticket.id} ticketId={ticket.id} view={view} />
        )}
        <span className="tabular ml-auto text-[13px] text-muted">#{ticket.number}</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto xl:flex xl:overflow-hidden">
        <main className="min-w-0 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
          <div className="mx-auto max-w-[880px] px-4 py-5 lg:px-8">
            <header className="mb-5 flex gap-3">
              <div className="min-w-0 flex-1">
                <h1 className="text-[1.45rem] font-semibold leading-snug tracking-[-0.015em]">
                  {ticket.subject}
                </h1>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted">
                  <ShopBadge code={shop.code} />
                  <span>{shop.name}</span>
                  <span aria-hidden>·</span>
                  <span>{LANGUAGE_LABELS[language]}</span>
                  {ticket.intent && (
                    <>
                      <span aria-hidden>·</span>
                      <span>{INTENT_LABELS[ticket.intent] ?? ticket.intent}</span>
                    </>
                  )}
                </div>
              </div>
            </header>
            <div className="space-y-5">
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
                closed={closed}
                notesOnly={!canWork}
              />
            </div>
          </div>
        </main>

        <aside className="shrink-0 border-t border-line bg-panel xl:w-[340px] xl:overflow-y-auto xl:border-l xl:border-t-0">
          <section className="border-b border-line px-5 py-5">
            <h2 className="mb-3 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-muted">
              Eigenschappen
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 xl:grid-cols-1">
              <StatusSelect
                ticketId={ticket.id}
                status={ticket.status}
                readOnly={!canWork}
              />
              <PrioritySelect
                ticketId={ticket.id}
                priority={ticket.priority}
                readOnly={!canWork}
              />
              <AssigneeSelect
                ticketId={ticket.id}
                assigneeId={ticket.assigneeId}
                agents={detail.agents}
                assignableIds={
                  canAssignOthers(role) ? undefined : [detail.session.userId]
                }
                readOnly={!canWork}
              />
            </div>
            <div className="mt-3">
              <span className="mb-1 block text-[12.5px] font-medium text-muted">
                Labels
              </span>
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
          </section>
          <div className="px-5 py-5">
            <CustomerPanel
              detail={detail}
              view={view}
              canEmail={canWork}
              commerce={
                <Suspense key={ticket.id} fallback={<CommerceSkeleton />}>
                  <CommerceSection ticketId={ticket.id} />
                </Suspense>
              }
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
