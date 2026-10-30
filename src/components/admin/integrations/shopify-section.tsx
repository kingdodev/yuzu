import { formatDateTime } from "@/lib/format";
import { getShopifyAdmin } from "@/server/admin";
import { ShopifyActions, ShopifyConnectForm, ShopifyShopPicker } from "./shopify-forms";

/** Instellen en beheren van de Shopify-koppeling (detailpagina). */
export async function ShopifySection() {
  const m = await getShopifyAdmin();
  const linked = m.hasSecrets && (m.status === "connected" || m.status === "error");

  return (
    <div className="space-y-5 text-[14px]">
      <p className="text-ink-soft">
        Bij elk ticket zie je de orders van de klant uit je Shopify-winkel, met status en
        track &amp; trace. Yuzu leest alleen: het kan niets wijzigen in je winkel.
      </p>

      {!m.encryptionReady && (
        <div className="rounded-lg border border-alert/40 bg-panel-sunk p-3 text-[13.5px]">
          <strong>Nog één instelling nodig bij de hosting:</strong>{" "}
          <code>YUZU_ENCRYPTION_KEY</code>, een willekeurige tekst van minstens 32 tekens.
          Zonder die instelling kun je hieronder nog niets opslaan.
        </div>
      )}

      {linked && (
        <section className="space-y-3">
          <dl className="grid gap-x-4 gap-y-1.5 text-[13.5px] sm:grid-cols-[160px_1fr]">
            <dt className="text-muted">Winkel</dt>
            <dd className="break-all">
              {m.shopName || m.shopDomain}
              {m.primaryDomain && (
                <span className="text-muted">
                  {" "}
                  · {m.primaryDomain.replace(/^https?:\/\//, "")}
                </span>
              )}
            </dd>
            <dt className="text-muted">Shopify-adres</dt>
            <dd className="break-all">{m.shopDomain}</dd>
            <dt className="text-muted">Laatst getest</dt>
            <dd>{m.lastCheckedAt ? formatDateTime(m.lastCheckedAt) : "Nog niet"}</dd>
          </dl>
          {m.lastError && (
            <p role="status" className="text-[13.5px] text-alert">
              {m.lastError}
            </p>
          )}
          <ShopifyActions />
        </section>
      )}

      {linked && m.shops.length > 0 && (
        <section>
          <h3 className="mb-1 text-[14.5px] font-semibold">
            Welke shops gebruiken deze winkel?
          </h3>
          <p className="mb-2 text-[13px] text-muted">
            Tickets van deze shops tonen orders uit Shopify.
          </p>
          <ShopifyShopPicker shops={m.shops} selected={m.shopCodes} />
        </section>
      )}

      {linked ? (
        <details className="rounded-lg border border-line">
          <summary className="cursor-pointer px-4 py-2.5 font-medium">
            Gegevens wijzigen
          </summary>
          <div className="border-t border-line p-4">
            <ShopifyConnectForm
              shopDomain={m.shopDomain}
              editing
              disabled={!m.encryptionReady}
            />
          </div>
        </details>
      ) : (
        <>
          <Instructions />
          <ShopifyConnectForm
            shopDomain={m.shopDomain}
            editing={false}
            disabled={!m.encryptionReady}
          />
        </>
      )}
      {linked && <Instructions collapsed />}
    </div>
  );
}

function Instructions({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <details className="rounded-lg border border-line bg-panel-sunk" open={!collapsed}>
      <summary className="cursor-pointer px-4 py-2.5 font-medium">
        Zo maak je de koppeling aan in Shopify (ongeveer 5 minuten)
      </summary>
      <ol className="list-decimal space-y-2 px-4 pb-4 pl-9 text-[13.5px] leading-relaxed text-ink-soft">
        <li>
          Ga naar <strong className="text-ink">dev.shopify.com/dashboard</strong> en log
          in met het account van de eigenaar van de winkel.
        </li>
        <li>
          Klik op <strong className="text-ink">Create app</strong> en noem hem
          &quot;Yuzu&quot;.
        </li>
        <li>
          Kies in de nieuwe versie van de app bij{" "}
          <strong className="text-ink">Scopes</strong> alleen{" "}
          <strong className="text-ink">read_orders</strong> en{" "}
          <strong className="text-ink">read_customers</strong>. Zet niets anders aan: zo
          kan Yuzu alleen lezen.
        </li>
        <li>
          Vraag onder <strong className="text-ink">Protected customer data</strong>{" "}
          toegang aan voor <strong className="text-ink">naam, e-mail en adres</strong>.
          Zonder dat kan Yuzu de orders niet bij het e-mailadres van de klant vinden.
        </li>
        <li>
          Klik op <strong className="text-ink">Release</strong> en daarna op{" "}
          <strong className="text-ink">Install app</strong>; kies je winkel en geef
          akkoord.
        </li>
        <li>
          Kopieer onder <strong className="text-ink">Settings</strong> de{" "}
          <strong className="text-ink">Client ID</strong> en het{" "}
          <strong className="text-ink">Client secret</strong> naar de velden hieronder en
          klik op <strong className="text-ink">Testen en opslaan</strong>. Yuzu bewaart ze
          versleuteld en toont ze daarna nooit meer.
        </li>
      </ol>
      <p className="px-4 pb-4 text-[13px] text-muted">
        Let op: Shopify geeft apps standaard alleen orders van de laatste 60 dagen. De app
        kun je op elk moment verwijderen in je winkel; dan werkt de koppeling direct niet
        meer.
      </p>
    </details>
  );
}
