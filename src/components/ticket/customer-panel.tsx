import { ExternalLink, Package, Truck } from "lucide-react";
import Link from "next/link";
import { ORDER_STATUS_LABELS } from "@/integrations/magento/types";
import { contactLabel, formatDate, formatMoney, LANGUAGE_LABELS } from "@/lib/format";
import type { TicketDetail } from "@/server/inbox";
import { StatusPill } from "../ui";

export function CustomerPanel({ detail, view }: { detail: TicketDetail; view: string }) {
  const { contact, customer, orders, linkedOrders, otherTickets } = detail;
  const linked = new Set(linkedOrders);
  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-[13px] font-medium text-muted">Klant</h2>
        <div className="mt-1.5 text-[15px] font-semibold">
          {contactLabel(contact.name, contact.email)}
        </div>
        {!contact.email.endsWith("@anoniem.invalid") && (
          <div className="break-all text-[13.5px] text-ink-soft">{contact.email}</div>
        )}
        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[13.5px]">
          <dt className="text-muted">Taal</dt>
          <dd>{contact.language ? LANGUAGE_LABELS[contact.language] : "Onbekend"}</dd>
          {customer ? (
            <>
              <dt className="text-muted">Account</dt>
              <dd>{customer.group}</dd>
              <dt className="text-muted">Orders</dt>
              <dd className="tabular">{customer.orderCount}</dd>
              <dt className="text-muted">Totaal besteed</dt>
              <dd className="tabular">{formatMoney(customer.lifetimeValue)}</dd>
            </>
          ) : (
            <>
              <dt className="text-muted">Magento</dt>
              <dd>Geen orders gevonden</dd>
            </>
          )}
        </dl>
      </section>

      {orders.length > 0 && (
        <section>
          <h2 className="text-[13px] font-medium text-muted">Orders in deze shop</h2>
          <ul className="mt-2 space-y-3">
            {orders.map((o) => (
              <li
                key={o.number}
                className={`rounded-lg border p-3 ${linked.has(o.number) ? "border-line-strong bg-panel-sunk" : "border-line"}`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="tabular font-semibold">{o.number}</span>
                  <span className="tabular text-[13.5px]">{formatMoney(o.total)}</span>
                </div>
                <div className="mt-0.5 flex flex-wrap gap-x-2 text-[13px] text-muted">
                  <span>{formatDate(o.createdAt)}</span>
                  <span
                    className={
                      o.status === "complete" ? "text-ink-soft" : "font-medium text-ink"
                    }
                  >
                    {ORDER_STATUS_LABELS[o.status]}
                  </span>
                  {linked.has(o.number) && (
                    <span className="text-success">gekoppeld aan dit ticket</span>
                  )}
                </div>

                <ul className="mt-2 space-y-0.5 text-[13.5px]">
                  {o.items.map((item) => (
                    <li key={item.sku} className="flex gap-2">
                      <Package
                        className="mt-[3px] h-3.5 w-3.5 shrink-0 text-muted"
                        aria-hidden
                      />
                      <span className="min-w-0">
                        {item.qty > 1 && <span className="tabular">{item.qty}× </span>}
                        {item.name}
                      </span>
                    </li>
                  ))}
                </ul>

                {o.shipments.map((sh) => (
                  <a
                    key={sh.trackingNumber}
                    href={sh.trackingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 flex items-start gap-2 rounded-md bg-panel-sunk px-2 py-1.5 text-[13.5px] hover:text-link"
                  >
                    <Truck
                      className="mt-[2px] h-3.5 w-3.5 shrink-0 text-muted"
                      aria-hidden
                    />
                    <span className="min-w-0">
                      {sh.carrier}, verzonden {formatDate(sh.shippedAt)}
                      <span className="block break-all text-[12.5px] text-muted">
                        {sh.trackingNumber}
                      </span>
                    </span>
                    <ExternalLink
                      className="ml-auto mt-[2px] h-3.5 w-3.5 shrink-0"
                      aria-label="Open tracking"
                    />
                  </a>
                ))}
                {o.shipments.length === 0 && o.status === "processing" && (
                  <p className="mt-2 text-[13px] text-muted">Nog niet verzonden.</p>
                )}
                {o.creditMemos.map((cm) => (
                  <p key={cm.number} className="mt-2 text-[13px] text-ink-soft">
                    Terugbetaald:{" "}
                    <span className="tabular">{formatMoney(cm.amount)}</span> op{" "}
                    {formatDate(cm.createdAt)}
                  </p>
                ))}

                <div className="mt-2 flex flex-wrap gap-x-3 text-[13px] text-muted">
                  <span>
                    {o.paymentMethod}
                    {o.paid ? ", betaald" : ", niet betaald"}
                  </span>
                  <span>
                    {o.shippingAddress.postcode} {o.shippingAddress.city}
                  </span>
                </div>
                <a
                  href={o.adminUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-[13px] text-link underline-offset-2 hover:underline"
                >
                  Open in Magento
                  <ExternalLink className="h-3 w-3" aria-hidden />
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[12.5px] leading-relaxed text-muted">
            Voorbeelddata. Zodra Magento gekoppeld is, staan hier de echte orders.
          </p>
        </section>
      )}

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
