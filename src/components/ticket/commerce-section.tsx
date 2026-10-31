import { ExternalLink, Package, Truck } from "lucide-react";
import { ORDER_STATUS_LABELS } from "@/integrations/magento/types";
import { formatDate, formatMoney } from "@/lib/format";
import { getTicketCommerce } from "@/server/inbox";
import { Skeleton } from "../ui";

/** Orders en klantcijfers uit de webshop (Magento of Shopify). */
export async function CommerceSection({ ticketId }: { ticketId: string }) {
  const data = await getTicketCommerce(ticketId);
  if (!data) return null;
  const { customer, orders } = data;
  const linked = new Set(data.linked);
  return (
    <>
      <section>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-[13.5px]">
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
              <dt className="text-muted">{data.platform ?? "Webshop"}</dt>
              <dd>
                {data.state === "not_configured"
                  ? "Nog niet gekoppeld"
                  : data.state === "error"
                    ? "Niet bereikbaar"
                    : "Geen orders gevonden"}
              </dd>
            </>
          )}
        </dl>
        {data.error && (
          <p role="status" className="mt-2 text-[13px] text-alert">
            {data.error}
          </p>
        )}
      </section>

      {orders.length > 0 && (
        <section>
          <h2 className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-muted">
            Orders in deze shop
          </h2>
          <ul className="mt-2 space-y-3">
            {orders.map((o) => (
              <li
                key={o.number}
                className={`rounded-lg border p-3 ${linked.has(o.number.replace(/^#/, "")) ? "border-primary/40 bg-selected/50" : "border-line"}`}
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
                  {linked.has(o.number.replace(/^#/, "")) && (
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

                {o.shipments.map((sh) => {
                  const body = (
                    <>
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
                    </>
                  );
                  const box =
                    "mt-2 flex items-start gap-2 rounded-md bg-panel-sunk px-2 py-1.5 text-[13.5px]";
                  return sh.trackingUrl ? (
                    <a
                      key={sh.trackingNumber}
                      href={sh.trackingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`${box} hover:text-link`}
                    >
                      {body}
                      <ExternalLink
                        className="ml-auto mt-[2px] h-3.5 w-3.5 shrink-0"
                        aria-label="Open tracking"
                      />
                    </a>
                  ) : (
                    <div key={sh.trackingNumber} className={box}>
                      {body}
                    </div>
                  );
                })}
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
                {o.adminUrl && (
                  <a
                    href={o.adminUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-[13px] text-link underline-offset-2 hover:underline"
                  >
                    Open in {data.platform ?? "de webshop"}
                    <ExternalLink className="h-3 w-3" aria-hidden />
                  </a>
                )}
              </li>
            ))}
          </ul>
          {data.state === "demo" && (
            <p className="mt-3 text-[12.5px] leading-relaxed text-muted">
              Voorbeelddata. Zodra je webshop gekoppeld is, staan hier de echte orders.
            </p>
          )}
        </section>
      )}
    </>
  );
}

export function CommerceSkeleton() {
  return (
    <div aria-label="Orders laden" className="space-y-2">
      <Skeleton lines={5} />
    </div>
  );
}
