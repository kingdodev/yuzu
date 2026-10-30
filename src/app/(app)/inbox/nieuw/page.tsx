import { Suspense } from "react";
import { NewTicketForm } from "@/components/inbox/new-ticket-form";
import { PageHeader, Skeleton } from "@/components/ui";
import { canWorkTickets } from "@/domain/permissions";
import { listSendingShops } from "@/server/inbox";
import { getSession } from "@/server/session";

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
  const session = await getSession();
  if (!canWorkTickets(session.role)) {
    return (
      <p className="text-muted">
        Als meelezer kun je geen mails sturen. Vraag een beheerder als je dat wel nodig
        hebt.
      </p>
    );
  }
  const [params, shops] = await Promise.all([searchParams, listSendingShops()]);
  const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");
  if (shops.length === 0) {
    return (
      <p className="text-muted">Er is geen actieve shop waar jij vanaf kunt mailen.</p>
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
