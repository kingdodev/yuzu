import { formatDateTime } from "@/lib/format";
import { getMagentoAdmin } from "@/server/admin";
import { MagentoActions, MagentoConnectForm, StoreViewMapping } from "./magento-forms";

/** Instellen en beheren van de Magento-koppeling (detailpagina). */
export async function MagentoSection() {
  const m = await getMagentoAdmin();
  const linked = m.hasSecrets && (m.status === "connected" || m.status === "error");

  return (
    <div className="space-y-5 text-[14px]">
      <p className="text-ink-soft">
        Bij elk ticket zie je de orders van de klant, met status en track &amp; trace.
        Yuzu leest alleen: het kan niets wijzigen in je shop.
      </p>

      {!m.encryptionReady && (
        <div className="rounded-lg border border-alert/40 bg-panel-sunk p-3 text-[13.5px]">
          <strong>Nog één instelling nodig bij de hosting:</strong>{" "}
          <code>YUZU_ENCRYPTION_KEY</code>, een willekeurige tekst van minstens 32 tekens.
          Daarmee versleutelt Yuzu de sleutels van Magento. Zonder die instelling kun je
          hieronder nog niets opslaan.
        </div>
      )}

      {m.status === "demo" && (
        <p className="rounded-lg bg-yuzu-soft px-3 py-2 text-[13.5px] text-yuzu-ink">
          Je ziet nu voorbeeldorders. Koppel hieronder je eigen shop om echte orders te
          zien.
        </p>
      )}

      {linked && (
        <section className="space-y-3">
          <dl className="grid gap-x-4 gap-y-1.5 text-[13.5px] sm:grid-cols-[160px_1fr]">
            <dt className="text-muted">Shop</dt>
            <dd className="break-all">{m.baseUrl}</dd>
            <dt className="text-muted">Laatst getest</dt>
            <dd>{m.lastCheckedAt ? formatDateTime(m.lastCheckedAt) : "Nog niet"}</dd>
          </dl>
          {m.lastError && (
            <p role="status" className="text-[13.5px] text-alert">
              {m.lastError}
            </p>
          )}
          <MagentoActions />
        </section>
      )}

      {linked && m.storeViews.length > 0 && (
        <section>
          <h3 className="mb-2 text-[14.5px] font-semibold">
            Store views koppelen aan shops
          </h3>
          <StoreViewMapping
            views={m.storeViews}
            shops={m.shops.map((s) => ({
              id: s.id,
              code: s.code,
              name: s.name,
              storeId: s.storeId,
            }))}
          />
        </section>
      )}

      {linked ? (
        <details className="rounded-lg border border-line">
          <summary className="cursor-pointer px-4 py-2.5 font-medium">
            Gegevens wijzigen
          </summary>
          <div className="border-t border-line p-4">
            <MagentoConnectForm
              baseUrl={m.baseUrl}
              adminUrl={m.adminUrl}
              editing
              disabled={!m.encryptionReady}
            />
          </div>
        </details>
      ) : (
        <>
          <Instructions />
          <MagentoConnectForm
            baseUrl={m.baseUrl}
            adminUrl={m.adminUrl}
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
        Zo maak je de koppeling aan in Magento (ongeveer 5 minuten)
      </summary>
      <ol className="list-decimal space-y-2 px-4 pb-4 pl-9 text-[13.5px] leading-relaxed text-ink-soft">
        <li>
          Log in op het beheer van je Magento-shop en ga naar{" "}
          <strong className="text-ink">System → Extensions → Integrations</strong>. Klik
          op <strong className="text-ink">Add New Integration</strong>.
        </li>
        <li>
          Vul bij <strong className="text-ink">Name</strong> &quot;Yuzu&quot; in en bij{" "}
          <strong className="text-ink">Your Password</strong> je eigen beheerwachtwoord.
          De rest laat je leeg.
        </li>
        <li>
          Open het tabblad <strong className="text-ink">API</strong>, zet{" "}
          <strong className="text-ink">Resource Access</strong> op{" "}
          <strong className="text-ink">Custom</strong> en vink alleen dit aan:
          <ul className="mt-1 list-disc pl-5">
            <li>Sales → Operations → Orders → Actions → View</li>
            <li>Sales → Operations → Shipments</li>
            <li>Stores → Settings → All Stores</li>
          </ul>
          Zet niets anders aan: meer heeft Yuzu niet nodig, en zo kan het alleen lezen.
        </li>
        <li>
          Klik op <strong className="text-ink">Save</strong>. Klik in de lijst bij Yuzu op{" "}
          <strong className="text-ink">Activate</strong> en daarna op{" "}
          <strong className="text-ink">Allow</strong>.
        </li>
        <li>
          Magento toont nu vier sleutels. Kopieer ze naar de velden hieronder en klik op{" "}
          <strong className="text-ink">Testen en opslaan</strong>. Yuzu bewaart ze
          versleuteld en toont ze daarna nooit meer.
        </li>
      </ol>
      <p className="px-4 pb-4 text-[13px] text-muted">
        De integratie kun je op elk moment weer verwijderen in hetzelfde Magento-scherm;
        dan werkt de koppeling direct niet meer.
      </p>
    </details>
  );
}
