"use client";

import { useState, useTransition } from "react";
import {
  connectMagento,
  disconnectMagento,
  mapShopToStoreView,
  retestMagento,
} from "@/server/actions/integrations";
import type { FormState } from "@/server/actions/admin";
import { ActionForm, Field } from "../forms";
import { ShopBadge } from "../ui";

const SECRET_FIELDS = [
  ["consumerKey", "Consumer Key"],
  ["consumerSecret", "Consumer Secret"],
  ["accessToken", "Access Token"],
  ["accessTokenSecret", "Access Token Secret"],
] as const;

export function MagentoConnectForm({
  baseUrl,
  adminUrl,
  editing,
  disabled,
}: {
  baseUrl: string;
  adminUrl: string;
  /** Er is al een koppeling: lege sleutelvelden = huidige sleutels houden. */
  editing: boolean;
  disabled: boolean;
}) {
  return (
    <ActionForm
      action={connectMagento}
      submitLabel="Testen en opslaan"
      className="space-y-4"
    >
      <fieldset disabled={disabled} className="space-y-4">
        <Field label="Adres van je webshop" hint="Bijvoorbeeld https://www.jouwshop.nl">
          <input
            className="field"
            name="baseUrl"
            defaultValue={baseUrl}
            placeholder="https://www.jouwshop.nl"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            required
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          {SECRET_FIELDS.map(([name, label]) => (
            <Field
              key={name}
              label={label}
              hint={editing ? "Leeg laten = huidige houden" : undefined}
            >
              <input
                className="field font-mono text-[13px]"
                name={name}
                type="password"
                autoComplete="off"
                spellCheck={false}
                required={!editing}
              />
            </Field>
          ))}
        </div>
        <Field
          label="Adres van je Magento-beheer (niet verplicht)"
          hint="Dan krijgt elke order een link 'Open in Magento'. Bijvoorbeeld https://www.jouwshop.nl/admin"
        >
          <input
            className="field"
            name="adminUrl"
            defaultValue={adminUrl}
            placeholder="https://www.jouwshop.nl/admin"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
          />
        </Field>
      </fieldset>
    </ActionForm>
  );
}

export function MagentoActions() {
  const [result, setResult] = useState<FormState>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        className="btn btn-secondary"
        disabled={pending}
        onClick={() => start(async () => setResult(await retestMagento()))}
      >
        {pending ? "Bezig…" : "Opnieuw testen"}
      </button>
      <button
        type="button"
        className="btn btn-quiet"
        disabled={pending}
        onClick={() => {
          if (
            !window.confirm(
              "Magento ontkoppelen? De sleutels worden gewist; in tickets zie je dan geen orders meer.",
            )
          )
            return;
          start(async () => {
            await disconnectMagento();
            setResult({ ok: true, message: "Ontkoppeld." });
          });
        }}
      >
        Ontkoppelen
      </button>
      {result && (
        <span
          role="status"
          className={`text-[13.5px] ${result.ok ? "text-success" : "text-alert"}`}
        >
          {result.ok ? result.message : result.error}
        </span>
      )}
    </div>
  );
}

type View = {
  id: number;
  code: string;
  name: string;
  url: string | null;
  active: boolean;
};
type Shop = { id: string; code: string; name: string; storeId: number | null };

/** Per store view uit Magento: bij welke shop in Yuzu hoort hij? */
export function StoreViewMapping({ views, shops }: { views: View[]; shops: Shop[] }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const shopFor = (viewId: number) => shops.find((s) => s.storeId === viewId) ?? null;

  function change(view: View, shopId: string) {
    setError(null);
    start(async () => {
      const current = shopFor(view.id);
      const result = shopId
        ? await mapShopToStoreView(shopId, view.id)
        : current
          ? await mapShopToStoreView(current.id, null)
          : null;
      if (result && !result.ok) setError(result.error);
    });
  }

  const unmapped = shops.filter((s) => s.storeId === null);
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-[13.5px]">
          <thead className="text-muted">
            <tr>
              <th className="py-1.5 pr-4 font-medium">Store view in Magento</th>
              <th className="py-1.5 pr-4 font-medium">Adres</th>
              <th className="py-1.5 font-medium">Shop in Yuzu</th>
            </tr>
          </thead>
          <tbody>
            {views.map((v) => {
              const shop = shopFor(v.id);
              return (
                <tr key={v.id} className="border-t border-line">
                  <td className="py-2 pr-4">
                    <div className="font-medium">{v.name}</div>
                    <div className="text-[12.5px] text-muted">
                      {v.code}, ID {v.id}
                      {!v.active && ", uitgeschakeld"}
                    </div>
                  </td>
                  <td className="break-all py-2 pr-4 text-ink-soft">{v.url ?? "–"}</td>
                  <td className="py-2">
                    <div className="flex items-center gap-2">
                      {shop && <ShopBadge code={shop.code} />}
                      <select
                        className="field w-auto py-1.5"
                        value={shop?.id ?? ""}
                        disabled={pending}
                        aria-label={`Shop voor ${v.name}`}
                        onChange={(e) => change(v, e.target.value)}
                      >
                        <option value="">Niet gebruiken</option>
                        {shops.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {error && (
        <p role="status" className="text-[13px] text-alert">
          {error}
        </p>
      )}
      {unmapped.length > 0 && (
        <p className="text-[13px] text-muted">
          Nog niet gekoppeld: {unmapped.map((s) => s.name).join(", ")}. Voor die shops
          zoekt Yuzu orders in alle store views.
        </p>
      )}
    </div>
  );
}
