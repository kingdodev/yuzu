"use client";

import { useState } from "react";
import { ActionButton, ActionForm, Field } from "@/components/forms";
import { Panel, ShopBadge } from "@/components/ui";
import { deleteTemplate, saveTemplate } from "@/server/actions/admin";

type Template = {
  id: string;
  name: string;
  language: string;
  shopId: string | null;
  shopCode: string | null;
  body: string;
};
type Shop = { id: string; code: string; name: string };

const LANGS: [string, string][] = [
  ["nl", "Nederlands"],
  ["fr", "Frans"],
  ["es", "Spaans"],
];

const VARIABLES = [
  "voornaam",
  "ordernummer",
  "vervoerder",
  "trackinglink",
  "shopdomein",
  "handtekening",
];

export function TemplateEditor({
  templates,
  shops,
}: {
  templates: Template[];
  shops: Shop[];
}) {
  const [selected, setSelected] = useState<string | "new">(templates[0]?.id ?? "new");
  const current =
    selected === "new" ? null : (templates.find((t) => t.id === selected) ?? null);

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <Panel className="h-fit p-2">
        <button
          type="button"
          onClick={() => setSelected("new")}
          className={`mb-1 w-full rounded-lg px-3 py-2 text-left text-[14px] font-medium ${selected === "new" ? "bg-pine-tint" : "text-pine hover:bg-panel-sunk"}`}
        >
          Nieuw sjabloon
        </button>
        {LANGS.map(([code, label]) => {
          const list = templates.filter((t) => t.language === code);
          if (list.length === 0) return null;
          return (
            <div key={code} className="mt-2">
              <h3 className="px-3 pb-1 pt-1 text-[12.5px] font-medium text-muted">
                {label}
              </h3>
              {list.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  aria-current={selected === t.id}
                  onClick={() => setSelected(t.id)}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[14px] ${selected === t.id ? "bg-pine-tint font-semibold" : "hover:bg-panel-sunk"}`}
                >
                  <span className="min-w-0 flex-1 truncate">{t.name}</span>
                  {t.shopCode && <ShopBadge code={t.shopCode} />}
                </button>
              ))}
            </div>
          );
        })}
      </Panel>

      <Panel className="p-5">
        <ActionForm
          key={current?.id ?? "new"}
          action={saveTemplate}
          className="space-y-4"
          footer={
            current && (
              <ActionButton
                onAction={async () => {
                  await deleteTemplate(current.id);
                  setSelected("new");
                }}
                confirm={`Sjabloon ${current.name} verwijderen?`}
                className="btn btn-quiet ml-auto"
              >
                Verwijderen
              </ActionButton>
            )
          }
        >
          {current && <input type="hidden" name="id" value={current.id} />}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-3">
              <Field label="Naam">
                <input
                  className="field"
                  name="name"
                  defaultValue={current?.name}
                  required
                />
              </Field>
            </div>
            <Field label="Taal">
              <select
                className="field"
                name="language"
                defaultValue={current?.language ?? "nl"}
              >
                {LANGS.map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Shop">
                <select
                  className="field"
                  name="shopId"
                  defaultValue={current?.shopId ?? ""}
                >
                  <option value="">Alle shops in deze taal</option>
                  {shops.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </div>
          <Field
            label="Tekst"
            hint={
              <>
                Deze velden vult Yuzu zelf in:{" "}
                {VARIABLES.map((v, i) => (
                  <span key={v}>
                    <code className="rounded bg-panel-sunk px-1 py-px text-[12px]">{`{{${v}}}`}</code>
                    {i < VARIABLES.length - 1 ? " " : ""}
                  </span>
                ))}
              </>
            }
          >
            <textarea
              className="field min-h-[240px]"
              name="body"
              defaultValue={current?.body}
              required
            />
          </Field>
        </ActionForm>
      </Panel>
    </div>
  );
}
