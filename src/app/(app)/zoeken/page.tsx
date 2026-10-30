import { Suspense } from "react";
import { TicketRowBody } from "@/components/inbox/ticket-row-body";
import { SearchField } from "@/components/search-box";
import { PageHeader, Panel, Skeleton } from "@/components/ui";
import { viewForStatus } from "@/domain/views";
import { SEARCH_LIMIT } from "@/db/repositories/search";
import { searchInbox } from "@/server/inbox";
import Link from "next/link";

export const metadata = { title: "Zoeken" };

export default function SearchPage({ searchParams }: PageProps<"/zoeken">) {
  return (
    <main className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl px-5 py-7 lg:px-10">
        <Suspense fallback={<Skeleton lines={10} />}>
          <Results searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}

async function Results({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { q } = await searchParams;
  const raw = typeof q === "string" ? q : "";
  const found = await searchInbox(raw);

  return (
    <>
      <PageHeader
        title={found ? `Zoeken: ${found.query.text}` : "Zoeken"}
        description={
          found
            ? found.results.length === 0
              ? "Niets gevonden. Probeer een deel van de naam, het e-mailadres of het ordernummer."
              : found.results.length >= SEARCH_LIMIT
                ? `De ${SEARCH_LIMIT} meest recente tickets. Maak je zoekopdracht specifieker om minder resultaten te zien.`
                : `${found.results.length} ${found.results.length === 1 ? "ticket" : "tickets"}, in alle statussen.`
            : "Zoek op naam of e-mailadres van de klant, ticketnummer, ordernummer, onderwerp of tekst uit een mail of notitie."
        }
      />
      {/* Op een telefoon staat het zoekveld niet in de bovenbalk. */}
      <div className="mb-5 rounded-lg bg-topbar p-2 sm:hidden">
        <SearchField key={raw} defaultValue={raw} />
      </div>
      {found && found.results.length > 0 && (
        <Panel className="overflow-hidden">
          <ul>
            {found.results.map((t) => (
              <li key={t.id} className="border-b border-line last:border-b-0">
                <Link
                  href={`/inbox/${viewForStatus(t.status)}/${t.id}`}
                  className="block px-4 py-3 hover:bg-panel-sunk"
                >
                  <TicketRowBody t={{ ...t, preview: t.snippet }} showNumber />
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </>
  );
}
