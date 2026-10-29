import { ExternalLink, FileText, Globe, NotebookPen } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { ActionButton, ActionForm, Field } from "@/components/forms";
import { DemoNotice, PageHeader, Panel, ShopBadge, Skeleton } from "@/components/ui";
import { timeAgo } from "@/lib/format";
import {
  addKnowledgeNote,
  addKnowledgeUrl,
  recrawlShop,
  setKnowledgeStatus,
  uploadKnowledgeFile,
} from "@/server/actions/admin";
import { listKnowledge } from "@/server/admin";

export const metadata = { title: "Kennisbank" };

const STATUS: Record<string, { label: string; className: string }> = {
  indexed: { label: "Ingelezen", className: "text-pine" },
  pending: { label: "Wacht op crawl", className: "text-ink-soft" },
  excluded: { label: "Uitgesloten", className: "text-muted" },
  failed: { label: "Mislukt", className: "text-alert" },
};

export default function KnowledgePage({ searchParams }: PageProps<"/beheer/kennisbank">) {
  return (
    <>
      <PageHeader
        title="Kennisbank"
        description="Yuzu leest de pagina's van elke shop in en baseert zijn antwoorden daarop. Pas je iets aan op de site, dan volgt Yuzu bij de volgende crawl vanzelf."
      />
      <Suspense fallback={<Skeleton lines={10} />}>
        <Knowledge searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Knowledge({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const code = typeof params.shop === "string" ? params.shop : "nl";
  const { shops, shop, sources, totals } = await listKnowledge(code);
  if (!shop) return <p className="text-muted">Voeg eerst een shop toe.</p>;

  const pages = sources.filter((s) => s.kind === "page");
  const files = sources.filter((s) => s.kind !== "page");
  const indexedPerShop = (id: string) =>
    totals
      .filter((t) => t.shopId === id && t.status === "indexed")
      .reduce((n, t) => n + t.n, 0);
  const lastCrawl = pages
    .map((p) => p.lastCrawledAt)
    .filter(Boolean)
    .sort((a, b) => b!.getTime() - a!.getTime())[0];

  return (
    <>
      <div role="tablist" aria-label="Shop" className="mb-5 flex flex-wrap gap-2">
        {shops.map((s) => (
          <Link
            key={s.id}
            role="tab"
            aria-selected={s.id === shop.id}
            href={`/beheer/kennisbank?shop=${s.code}`}
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[14px] ${
              s.id === shop.id
                ? "border-pine/40 bg-pine-tint font-semibold"
                : "border-line bg-panel text-ink-soft hover:text-ink"
            }`}
          >
            <ShopBadge code={s.code} />
            {s.name}
            <span className="tabular text-[12.5px] text-muted">
              {indexedPerShop(s.id)}
            </span>
          </Link>
        ))}
      </div>

      <Panel>
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <div>
            <h2 className="text-[16px] font-semibold">Pagina&apos;s van {shop.domain}</h2>
            <p className="text-[13px] text-muted">
              Dagelijks worden gewijzigde pagina&apos;s opnieuw ingelezen, wekelijks
              alles.
              {lastCrawl && ` Laatste crawl ${timeAgo(lastCrawl)}.`}
            </p>
          </div>
          <ActionButton
            onAction={recrawlShop.bind(null, shop.id)}
            className="btn btn-secondary"
          >
            Nu opnieuw crawlen
          </ActionButton>
        </header>
        <ul className="divide-y divide-line">
          {pages.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3"
            >
              <Globe className="h-4 w-4 shrink-0 text-muted" aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="font-medium">{p.title}</div>
                {p.url && (
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 break-all text-[13px] text-muted hover:text-pine"
                  >
                    {p.url.replace(/^https?:\/\//, "")}
                    <ExternalLink className="h-3 w-3" aria-hidden />
                  </a>
                )}
                {p.error && <div className="text-[13px] text-alert">{p.error}</div>}
              </div>
              <span className={`text-[13.5px] ${STATUS[p.status].className}`}>
                {STATUS[p.status].label}
                {p.lastCrawledAt && p.status === "indexed" && (
                  <span className="text-muted">, {timeAgo(p.lastCrawledAt)}</span>
                )}
              </span>
              <ActionButton
                onAction={setKnowledgeStatus.bind(
                  null,
                  p.id,
                  p.status === "excluded" ? "pending" : "excluded",
                )}
                className="btn btn-quiet text-[13.5px]"
              >
                {p.status === "excluded" ? "Weer meenemen" : "Uitsluiten"}
              </ActionButton>
            </li>
          ))}
        </ul>
        <div className="border-t border-line px-5 py-4">
          <ActionForm
            action={addKnowledgeUrl}
            submitLabel="Pagina toevoegen"
            submitClassName="btn btn-secondary"
            className="flex flex-wrap items-end gap-3"
          >
            <input type="hidden" name="shopId" value={shop.id} />
            <div className="min-w-[260px] flex-1">
              <Field label="Pagina die de crawler mist">
                <input
                  className="field"
                  name="url"
                  type="url"
                  placeholder={`https://${shop.domain}/...`}
                  required
                />
              </Field>
            </div>
          </ActionForm>
        </div>
      </Panel>

      <h2 className="mb-3 mt-10 text-[17px] font-semibold">
        Documenten en werkinstructies
      </h2>
      <Panel>
        {files.length > 0 ? (
          <ul className="divide-y divide-line">
            {files.map((f) => (
              <li
                key={f.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3"
              >
                {f.kind === "upload" ? (
                  <FileText className="h-4 w-4 text-muted" aria-hidden />
                ) : (
                  <NotebookPen className="h-4 w-4 text-muted" aria-hidden />
                )}
                <div className="min-w-0 flex-1 font-medium">{f.title}</div>
                <span className={`text-[13.5px] ${STATUS[f.status].className}`}>
                  {STATUS[f.status].label}
                </span>
                <ActionButton
                  onAction={setKnowledgeStatus.bind(
                    null,
                    f.id,
                    f.status === "excluded" ? "pending" : "excluded",
                  )}
                  className="btn btn-quiet text-[13.5px]"
                >
                  {f.status === "excluded" ? "Weer meenemen" : "Uitsluiten"}
                </ActionButton>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-4 text-muted">Nog geen documenten voor deze shop.</p>
        )}
        <div className="grid gap-6 border-t border-line px-5 py-4 lg:grid-cols-2">
          <ActionForm
            action={uploadKnowledgeFile}
            submitLabel="Uploaden"
            submitClassName="btn btn-secondary"
            className="space-y-3"
          >
            <input type="hidden" name="shopId" value={shop.id} />
            <Field
              label="Document uploaden"
              hint="PDF, DOCX, TXT, MD of CSV, maximaal 20 MB. Bijvoorbeeld een maattabel of handleiding."
            >
              <input
                className="field"
                name="file"
                type="file"
                accept=".pdf,.docx,.txt,.md,.csv"
                required
              />
            </Field>
          </ActionForm>
          <ActionForm
            action={addKnowledgeNote}
            submitLabel="Toevoegen"
            submitClassName="btn btn-secondary"
            className="space-y-3"
          >
            <input type="hidden" name="shopId" value={shop.id} />
            <Field label="Werkinstructie schrijven">
              <input
                className="field"
                name="title"
                placeholder="Titel, bijv. Ruilen van maten"
                required
              />
            </Field>
            <textarea
              className="field min-h-[90px]"
              name="content"
              placeholder="Wat moet Yuzu weten dat niet op de site staat?"
              required
            />
          </ActionForm>
        </div>
      </Panel>

      <div className="mt-6">
        <DemoNotice>
          Demo-omgeving: de crawler en het verwerken van documenten zijn nog niet
          gekoppeld. &ldquo;Nu opnieuw crawlen&rdquo; markeert de pagina&apos;s alleen als
          ingelezen.
        </DemoNotice>
      </div>
    </>
  );
}
