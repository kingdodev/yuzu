import { ArrowRight, Archive } from "lucide-react";
import { Suspense } from "react";
import { FilterForm } from "@/components/admin/filter-form";
import { ActionButton } from "@/components/forms";
import { DemoNotice, PageHeader, Panel, Skeleton, TagChip } from "@/components/ui";
import { describeConditions } from "@/domain/filters";
import { deleteFilter, setFilterEnabled } from "@/server/actions/filters";
import { listFiltersAdmin } from "@/server/admin";

export const metadata = { title: "Filters" };

export default function FiltersPage() {
  return (
    <>
      <PageHeader
        title="Filters"
        description="Zoals in Gmail: mails die aan je voorwaarden voldoen, krijgen automatisch een label en kunnen de inbox overslaan."
      />
      <Suspense fallback={<Skeleton lines={8} />}>
        <Filters />
      </Suspense>
    </>
  );
}

async function Filters() {
  const { filters, shops, tags } = await listFiltersAdmin();
  const options = {
    shops: shops.map((s) => ({ id: s.id, name: s.name })),
    tags: tags.map((t) => ({ id: t.id, name: t.name })),
  };
  return (
    <div className="space-y-8">
      <DemoNotice>
        Filters werken op elke nieuwe mail zodra de mailkoppeling (Mailgun) aan staat. Tot
        die tijd kun je ze al toepassen op bestaande tickets.
      </DemoNotice>

      {filters.length > 0 ? (
        <Panel className="divide-y divide-line">
          {filters.map((f) => {
            const conditions = describeConditions(f, f.shopName);
            return (
              <div key={f.id} className={`p-4 ${f.enabled ? "" : "opacity-60"}`}>
                <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px]">
                      {conditions.map((c, i) => (
                        <span key={c}>
                          {i > 0 && <span className="mr-2 text-muted">en</span>}
                          <span className="font-medium">{c}</span>
                        </span>
                      ))}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[13.5px] text-ink-soft">
                      <ArrowRight className="h-3.5 w-3.5 text-muted" aria-hidden />
                      {f.tagName && f.tagColor && (
                        <TagChip name={f.tagName} color={f.tagColor} />
                      )}
                      {f.skipInbox && (
                        <span className="inline-flex items-center gap-1">
                          <Archive className="h-3.5 w-3.5 text-muted" aria-hidden />
                          Postvak overslaan
                        </span>
                      )}
                      {!f.tagName && !f.skipInbox && (
                        <span className="text-alert">
                          Doet niets meer (label verwijderd)
                        </span>
                      )}
                      {!f.enabled && <span className="text-muted">· Uitgezet</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <ActionButton
                      onAction={setFilterEnabled.bind(null, f.id, !f.enabled)}
                      className="btn btn-quiet text-[13.5px]"
                    >
                      {f.enabled ? "Uitzetten" : "Aanzetten"}
                    </ActionButton>
                    <ActionButton
                      onAction={deleteFilter.bind(null, f.id)}
                      confirm="Dit filter verwijderen? Labels op tickets blijven staan."
                      className="btn btn-quiet text-[13.5px]"
                    >
                      Verwijderen
                    </ActionButton>
                  </div>
                </div>
                <details className="mt-3">
                  <summary className="cursor-pointer text-[13.5px] text-link">
                    Wijzigen
                  </summary>
                  <div className="mt-3 rounded-lg border border-line p-4">
                    <FilterForm filter={f} {...options} />
                  </div>
                </details>
              </div>
            );
          })}
        </Panel>
      ) : (
        <p className="text-[14px] text-muted">Nog geen filters.</p>
      )}

      <section>
        <h2 className="mb-3 text-[17px] font-semibold">Nieuw filter</h2>
        <Panel className="p-5">
          <FilterForm {...options} />
        </Panel>
      </section>
    </div>
  );
}
