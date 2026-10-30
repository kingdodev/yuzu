import { Suspense } from "react";
import { NewTicketForm } from "@/components/inbox/new-ticket-form";
import { PageHeader, Skeleton } from "@/components/ui";
import { listSendingShops } from "@/server/inbox";

export const metadata = { title: "Nieuwe e-mail" };

export default function NewTicketPage({ searchParams }: PageProps<"/inbox/nieuw">) {
  return (
    <main className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-5 py-7 lg:px-10">
        <PageHeader
          title="Nieuwe e-mail"
          description="Mail een klant zelf. Er komt een nieuw ticket op jouw naam; reageert de klant, dan komt dat bij hetzelfde ticket."
        />
        <Suspense fallback={<Skeleton lines={10} />}>
          <Form searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}

async function Form({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [params, shops] = await Promise.all([searchParams, listSendingShops()]);
  const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");
  if (shops.length === 0) {
    return (
      <p className="text-muted">
        Er is nog geen actieve shop. Voeg er een toe onder Beheer.
      </p>
    );
  }
  return (
    <NewTicketForm
      shops={shops}
      initial={{
        shopCode: one(params.shop),
        to: one(params.aan),
        name: one(params.naam),
      }}
    />
  );
}
