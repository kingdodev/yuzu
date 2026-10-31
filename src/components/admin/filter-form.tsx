"use client";

import { Search } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { previewFilter, saveFilter } from "@/server/actions/filters";
import { ActionForm, Field } from "../forms";

type Option = { id: string; name: string };

export type FilterValues = {
  id: string;
  fromContains: string | null;
  subjectContains: string | null;
  hasWords: string | null;
  shopId: string | null;
  tagId: string | null;
  skipInbox: boolean;
};

/**
 * Filter maken of wijzigen, zoals in Gmail: eerst de voorwaarden (met een
 * knop om te zien welke tickets passen), dan wat er moet gebeuren.
 */
export function FilterForm({
  filter,
  shops,
  tags,
}: {
  filter?: FilterValues;
  shops: Option[];
  tags: Option[];
}) {
  const anchor = useRef<HTMLDivElement>(null);
  const [tagChoice, setTagChoice] = useState(filter?.tagId ?? "");
  const [preview, setPreview] = useState<
    { count: number; subjects: string[] } | { error: string } | null
  >(null);
  const [checking, start] = useTransition();
  const key = filter?.id ?? "nieuw";
  const initialTag = filter?.tagId ?? "";

  // Na opslaan zet React het formulier terug; de eigen keuzes dan ook.
  useEffect(() => {
    const el = anchor.current?.closest("form");
    if (!el) return;
    const onReset = () => {
      setTagChoice(initialTag);
      setPreview(null);
    };
    el.addEventListener("reset", onReset);
    return () => el.removeEventListener("reset", onReset);
  }, [initialTag]);

  function check() {
    const el = anchor.current?.closest("form") ?? null;
    if (!el) return;
    const data = new FormData(el);
    const get = (k: string) => String(data.get(k) ?? "");
    start(async () =>
      setPreview(
        await previewFilter({
          fromContains: get("fromContains"),
          subjectContains: get("subjectContains"),
          hasWords: get("hasWords"),
          shopId: get("shopId"),
        }),
      ),
    );
  }

  return (
    <ActionForm
      action={saveFilter}
      submitLabel={filter ? "Opslaan" : "Filter maken"}
      className="space-y-5"
    >
      <div ref={anchor} hidden />
      {filter && <input type="hidden" name="id" value={filter.id} />}

      <fieldset className="space-y-3">
        <legend className="mb-2 text-[13px] font-semibold text-ink">
          Als een mail binnenkomt die…
        </legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Van"
            hint="Adres of naam, bijv. @bol.com. Meerdere: met komma of OR."
          >
            <input
              className="field"
              name="fromContains"
              defaultValue={filter?.fromContains ?? ""}
              maxLength={200}
              id={`from-${key}`}
              placeholder="bijv. noreply@postnl.nl"
            />
          </Field>
          <Field label="Onderwerp bevat" hint="Meerdere mogelijkheden: met komma of OR.">
            <input
              className="field"
              name="subjectContains"
              defaultValue={filter?.subjectContains ?? ""}
              maxLength={200}
              placeholder="bijv. factuur"
            />
          </Field>
          <Field
            label="Bevat de woorden"
            hint='Allemaal in onderwerp of tekst. "Hele zin" tussen aanhalingstekens; -woord = mag er niet in staan.'
          >
            <input
              className="field"
              name="hasWords"
              defaultValue={filter?.hasWords ?? ""}
              maxLength={200}
              placeholder='bijv. retour "geld terug"'
            />
          </Field>
          <Field label="Shop">
            <select className="field" name="shopId" defaultValue={filter?.shopId ?? ""}>
              <option value="">Alle shops</option>
              {shops.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={check}
            disabled={checking}
          >
            <Search className="h-4 w-4" aria-hidden />
            {checking ? "Zoeken…" : "Welke tickets passen?"}
          </button>
          {preview && "error" in preview && (
            <span role="status" className="text-[13.5px] text-alert">
              {preview.error}
            </span>
          )}
          {preview && "count" in preview && (
            <span role="status" className="text-[13.5px] text-ink-soft">
              {preview.count === 0
                ? "Geen bestaande tickets passen hierop."
                : `${preview.count} bestaande ${preview.count === 1 ? "ticket past" : "tickets passen"}${
                    preview.subjects.length
                      ? `, zoals: ${preview.subjects.map((s) => `“${s}”`).join(", ")}`
                      : ""
                  }.`}
            </span>
          )}
        </div>
      </fieldset>

      <fieldset
        aria-label="Wat er moet gebeuren"
        className="space-y-3 border-t border-line pt-4"
      >
        <div className="text-[13px] font-semibold text-ink">…dan:</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Label toepassen">
            <select
              className="field"
              name="tagId"
              value={tagChoice}
              onChange={(e) => setTagChoice(e.target.value)}
            >
              <option value="">Geen label</option>
              {tags.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
              <option value="__new">Nieuw label…</option>
            </select>
          </Field>
          {tagChoice === "__new" && (
            <Field label="Naam van het nieuwe label">
              <input
                className="field"
                name="newTagName"
                maxLength={40}
                required
                autoFocus
              />
            </Field>
          )}
        </div>
        <label className="flex items-start gap-2.5 text-[14px]">
          <input
            type="checkbox"
            name="skipInbox"
            defaultChecked={filter?.skipInbox}
            className="mt-0.5 h-4 w-4 accent-[var(--primary)]"
          />
          <span>
            <span className="font-medium">Postvak overslaan (archiveren)</span>
            <span className="block text-[13px] text-muted">
              Het ticket komt niet in Te doen, maar staat wel onder het label en in
              Opgelost. Reageert de klant later, dan komt het gewoon terug.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-2.5 text-[14px]">
          <input
            type="checkbox"
            name="applyExisting"
            className="mt-0.5 h-4 w-4 accent-[var(--primary)]"
          />
          <span>
            <span className="font-medium">
              Ook toepassen op bestaande tickets die passen
            </span>
          </span>
        </label>
      </fieldset>
    </ActionForm>
  );
}
