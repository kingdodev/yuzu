import { Suspense } from "react";
import { ActionForm, Field } from "@/components/forms";
import { PageHeader, Panel, ShopBadge, Skeleton } from "@/components/ui";
import { anonymizeContact, saveRetention } from "@/server/actions/admin";
import { findContact, listRetention } from "@/server/admin";

export const metadata = { title: "Privacy en AVG" };

export default function PrivacyPage({ searchParams }: PageProps<"/beheer/privacy">) {
  return (
    <>
      <PageHeader
        title="Privacy en AVG"
        description="Hoe lang Yuzu gegevens bewaart, en wat je doet als een klant om inzage of verwijdering vraagt. Je hebt een maand om op zo'n verzoek te reageren."
      />

      <h2 className="mb-3 text-[17px] font-semibold">
        Inzage of verwijdering voor één klant
      </h2>
      <Panel className="p-5">
        <form className="flex flex-wrap items-end gap-3" action="/beheer/privacy">
          <div className="min-w-[260px] flex-1">
            <Field label="E-mailadres van de klant">
              <input
                className="field"
                name="email"
                type="email"
                required
                placeholder="klant@example.nl"
              />
            </Field>
          </div>
          <button className="btn btn-secondary" type="submit">
            Zoeken
          </button>
        </form>
        <Suspense fallback={<Skeleton lines={3} />}>
          <ContactResult searchParams={searchParams} />
        </Suspense>
      </Panel>

      <h2 className="mb-3 mt-10 text-[17px] font-semibold">Bewaartermijnen</h2>
      <p className="mb-3 max-w-3xl text-[14px] leading-relaxed text-ink-soft">
        Na deze termijnen verwijdert Yuzu de gegevens automatisch. Tickets tellen vanaf
        het moment van sluiten; bijlagen en de originele mail vanaf ontvangst. Facturen
        bewaar je in Magento en de boekhouding, niet hier.
      </p>
      <Suspense fallback={<Skeleton />}>
        <Retention />
      </Suspense>
    </>
  );
}

async function ContactResult({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  if (params.verwijderd) {
    return (
      <p role="status" className="mt-4 text-[14px] text-success">
        De gegevens van deze klant zijn verwijderd. Dit staat in het auditlog.
      </p>
    );
  }
  const email = typeof params.email === "string" ? params.email : "";
  if (!email) return null;
  const found = await findContact(email);
  if (!found) {
    return (
      <p className="mt-4 text-[14px] text-ink-soft">
        Geen klant gevonden met dit adres. Er zijn dus ook geen gegevens om te tonen of te
        verwijderen.
      </p>
    );
  }
  const { contact, ticketCount } = found;
  return (
    <div className="mt-5 grid gap-5 border-t border-line pt-5 lg:grid-cols-2">
      <div>
        <div className="font-medium">{contact.name ?? contact.email}</div>
        <div className="text-[13.5px] text-muted">
          {contact.email}, {ticketCount} {ticketCount === 1 ? "ticket" : "tickets"}
        </div>
        <a
          href={`/beheer/privacy/export?email=${encodeURIComponent(contact.email)}`}
          className="btn btn-secondary mt-4"
        >
          Gegevens downloaden
        </a>
        <p className="mt-2 text-[13px] text-muted">
          Een bestand met alle tickets en berichten, om naar de klant te sturen. Wordt
          vastgelegd in het auditlog.
        </p>
      </div>
      <ActionForm
        action={anonymizeContact}
        submitLabel="Gegevens verwijderen"
        submitClassName="btn btn-secondary border-alert/50 text-alert"
        className="space-y-3"
      >
        <input type="hidden" name="contactId" value={contact.id} />
        <p className="text-[14px] text-ink-soft">
          Verwijdert naam, e-mailadres, telefoonnummer en de tekst van alle berichten.
          Ticketnummers en tijdstippen blijven voor de statistiek. Dit kan niet ongedaan
          worden gemaakt.
        </p>
        <Field label="Typ VERWIJDER om te bevestigen">
          <input className="field" name="confirm" autoComplete="off" required />
        </Field>
      </ActionForm>
    </div>
  );
}

async function Retention() {
  const shops = await listRetention();
  return (
    <Panel className="divide-y divide-line">
      {shops.map((s) => (
        <ActionForm
          key={s.id}
          action={saveRetention}
          submitLabel="Opslaan"
          submitClassName="btn btn-secondary"
          className="grid gap-4 px-5 py-4 md:grid-cols-[1fr_180px_180px_auto] md:items-end"
        >
          <input type="hidden" name="shopId" value={s.id} />
          <div className="flex items-center gap-2.5 pb-2">
            <ShopBadge code={s.code} />
            <span className="font-medium">{s.name}</span>
          </div>
          <Field label="Tickets (dagen)">
            <input
              className="field tabular"
              type="number"
              name="tickets"
              min={30}
              max={3650}
              defaultValue={s.retentionDaysTickets}
            />
          </Field>
          <Field label="Bijlagen (dagen)">
            <input
              className="field tabular"
              type="number"
              name="attachments"
              min={7}
              max={3650}
              defaultValue={s.retentionDaysAttachments}
            />
          </Field>
        </ActionForm>
      ))}
    </Panel>
  );
}
