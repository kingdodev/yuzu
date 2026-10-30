"use client";

import { useState, useTransition } from "react";
import type { FormState } from "@/server/actions/admin";
import {
  connectShopify,
  disconnectShopify,
  retestShopify,
  setShopifyShops,
} from "@/server/actions/shopify";
import { ActionForm, Field } from "../../forms";
import { ShopBadge } from "../../ui";

export function ShopifyConnectForm({
  shopDomain,
  editing,
  disabled,
}: {
  shopDomain: string;
  /** Er is al een koppeling: lege sleutelvelden = huidige sleutels houden. */
  editing: boolean;
  disabled: boolean;
}) {
  return (
    <ActionForm
      action={connectShopify}
      submitLabel="Testen en opslaan"
      className="space-y-4"
    >
      <fieldset disabled={disabled} className="space-y-4">
        <Field
          label="Adres van je winkel in Shopify"
          hint="Het adres dat eindigt op .myshopify.com (Instellingen → Domeinen). Ook goed: de link van je Shopify-beheer."
        >
          <input
            className="field"
            name="shopDomain"
            defaultValue={shopDomain}
            placeholder="jouwwinkel.myshopify.com"
            autoComplete="off"
            spellCheck={false}
            required
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Client ID"
            hint={editing ? "Leeg laten = huidige houden" : undefined}
          >
            <input
              className="field font-mono text-[13px]"
              name="clientId"
              autoComplete="off"
              spellCheck={false}
            />
          </Field>
          <Field
            label="Client secret"
            hint={editing ? "Leeg laten = huidige houden" : undefined}
          >
            <input
              className="field font-mono text-[13px]"
              name="clientSecret"
              type="password"
              autoComplete="off"
              spellCheck={false}
            />
          </Field>
        </div>
        <details className="rounded-lg border border-line">
          <summary className="cursor-pointer px-3 py-2 text-[13.5px] text-ink-soft">
            Heb je al een toegangstoken (begint met shpat_)?
          </summary>
          <div className="border-t border-line p-3">
            <Field
              label="Toegangstoken van een bestaande app"
              hint="Alleen voor oudere apps uit het Shopify-beheer. Laat Client ID en secret dan leeg."
            >
              <input
                className="field font-mono text-[13px]"
                name="accessToken"
                type="password"
                autoComplete="off"
                spellCheck={false}
              />
            </Field>
          </div>
        </details>
      </fieldset>
    </ActionForm>
  );
}

export function ShopifyActions() {
  const [result, setResult] = useState<FormState>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        className="btn btn-secondary"
        disabled={pending}
        onClick={() => start(async () => setResult(await retestShopify()))}
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
              "Shopify ontkoppelen? De sleutels worden gewist; in tickets zie je dan geen Shopify-orders meer.",
            )
          )
            return;
          start(async () => {
            await disconnectShopify();
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

type Shop = { code: string; name: string; domain: string; onMagento: boolean };

/** Welke shops in Yuzu halen hun orders uit deze Shopify-winkel? */
export function ShopifyShopPicker({
  shops,
  selected,
}: {
  shops: Shop[];
  selected: string[];
}) {
  const [codes, setCodes] = useState<string[]>(selected);
  const [result, setResult] = useState<FormState>(null);
  const [pending, start] = useTransition();
  const all = codes.length === 0;

  function save(next: string[]) {
    setCodes(next);
    setResult(null);
    start(async () => setResult(await setShopifyShops(next)));
  }

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-[13.5px]">
        <input
          type="checkbox"
          checked={all}
          disabled={pending}
          onChange={(e) =>
            save(
              e.target.checked
                ? []
                : shops.filter((s) => !s.onMagento).map((s) => s.code),
            )
          }
        />
        Alle shops (behalve shops die al aan Magento gekoppeld zijn)
      </label>
      {!all && (
        <ul className="space-y-1.5 pl-6">
          {shops.map((s) => (
            <li key={s.code}>
              <label className="flex items-center gap-2 text-[13.5px]">
                <input
                  type="checkbox"
                  checked={codes.includes(s.code)}
                  disabled={pending || s.onMagento}
                  onChange={(e) =>
                    save(
                      e.target.checked
                        ? [...codes, s.code]
                        : codes.filter((c) => c !== s.code),
                    )
                  }
                />
                <ShopBadge code={s.code} />
                <span>{s.name}</span>
                {s.onMagento && <span className="text-muted">gebruikt Magento</span>}
              </label>
            </li>
          ))}
        </ul>
      )}
      {result && (
        <p
          role="status"
          className={`text-[13px] ${result.ok ? "text-success" : "text-alert"}`}
        >
          {result.ok ? result.message : result.error}
        </p>
      )}
    </div>
  );
}
