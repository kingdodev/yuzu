import Link from "next/link";
import type { ReactNode } from "react";
import { contactLabel, LANGUAGE_LABELS } from "@/lib/format";
import type { TicketDetail } from "@/server/inbox";
import { StatusPill } from "../ui";

/**
 * Rechterkolom van een ticket. De klantgegevens uit Yuzu staan er meteen;
 * de orders uit de webshop (`commerce`) komen er los van binnen.
 */
export function CustomerPanel({
  detail,
  view,
  canEmail,
  commerce,
}: {
  detail: TicketDetail;
  view: string;
  canEmail: boolean;
  commerce: ReactNode;
}) {
  const { contact, otherTickets } = detail;
  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-[13px] font-medium text-muted">Klant</h2>
        <div className="mt-1.5 text-[15px] font-semibold">
          {contactLabel(contact.name, contact.email)}
        </div>
        {!contact.email.endsWith("@anoniem.invalid") && (
          <>
            <div className="break-all text-[13.5px] text-ink-soft">{contact.email}</div>
            {canEmail && (
              <Link
                href={`/inbox/nieuw?${new URLSearchParams({
                  aan: contact.email,
                  naam: contact.name ?? "",
                  shop: detail.shop.code,
                })}`}
                className="mt-1 inline-block text-[13.5px] text-link hover:underline"
              >
                Nieuwe e-mail aan deze klant
              </Link>
            )}
          </>
        )}
        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[13.5px]">
          <dt className="text-muted">Taal</dt>
          <dd>{contact.language ? LANGUAGE_LABELS[contact.language] : "Onbekend"}</dd>
        </dl>
      </section>

      {commerce}

      {otherTickets.length > 0 && (
        <section>
          <h2 className="text-[13px] font-medium text-muted">Eerdere tickets</h2>
          <ul className="mt-2 space-y-1.5">
            {otherTickets.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/inbox/${view}/${t.id}`}
                  className="block rounded-md px-2 py-1.5 text-[13.5px] hover:bg-panel-sunk"
                >
                  <span className="tabular text-muted">#{t.number}</span> {t.subject}
                  <div className="mt-0.5">
                    <StatusPill status={t.status} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
