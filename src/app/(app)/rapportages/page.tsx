import { Suspense } from "react";
import { PageHeader, Panel, ShopBadge, Skeleton } from "@/components/ui";
import { INTENT_LABELS } from "@/lib/format";
import { getReport } from "@/server/reports";

export const metadata = { title: "Rapportages" };

export default function ReportsPage() {
  return (
    <main className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl px-5 py-7 lg:px-10">
        <PageHeader
          title="Rapportages"
          description="Hoe druk het is, hoe snel klanten antwoord krijgen en hoeveel werk Yuzu je uit handen neemt."
        />
        <Suspense fallback={<Skeleton lines={12} />}>
          <Report />
        </Suspense>
      </div>
    </main>
  );
}

function formatMinutes(min: number | null) {
  if (min == null) return "Nog geen";
  if (min < 60) return `${Math.round(min)} min`;
  const h = min / 60;
  return h < 24
    ? `${h.toFixed(1).replace(".", ",")} uur`
    : `${(h / 24).toFixed(1).replace(".", ",")} dagen`;
}

function Stat({
  label,
  value,
  note,
}: {
  label: string;
  value: string | number;
  note?: string;
}) {
  return (
    <div className="px-5 py-4">
      <div className="text-[13.5px] text-muted">{label}</div>
      <div className="tabular mt-1 text-[1.9rem] font-semibold leading-none tracking-[-0.02em]">
        {value}
      </div>
      {note && <div className="mt-1.5 text-[12.5px] text-muted">{note}</div>}
    </div>
  );
}

/** Horizontale balken voor één reeks: lengte = aantal, label en waarde staan erbij. */
function Bars({
  items,
}: {
  items: { key: string; label: React.ReactNode; value: number; title: string }[];
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="space-y-2.5">
      {items.map((i) => (
        <li
          key={i.key}
          className="grid grid-cols-[minmax(120px,190px)_1fr_36px] items-center gap-3"
          title={i.title}
        >
          <span className="truncate text-[14px]">{i.label}</span>
          <span
            className="h-2.5 rounded-r-[4px] bg-pine"
            style={{ width: `${(i.value / max) * 100}%`, minWidth: i.value > 0 ? 4 : 0 }}
          />
          <span className="tabular text-right text-[14px] text-ink-soft">{i.value}</span>
        </li>
      ))}
    </ul>
  );
}

async function Report() {
  const { totals, perShop, perIntent, perDay, ai } = await getReport();
  const judged = ai.used + ai.discarded;
  const maxDay = Math.max(1, ...perDay.map((d) => d.n));

  return (
    <div className="space-y-6">
      <Panel className="grid grid-cols-2 divide-line max-md:[&>*:nth-child(n+3)]:border-t md:grid-cols-4 md:divide-x">
        <Stat
          label="Te doen"
          value={totals.open}
          note={`${totals.waiting} wachten op antwoord`}
        />
        <Stat label="Nieuw vandaag" value={totals.new_today} />
        <Stat
          label="Eerste reactie, mediaan"
          value={formatMinutes(totals.median_first_response_min)}
          note="Laatste 30 dagen"
        />
        <Stat label="Opgelost" value={totals.solved_week} note="Laatste 7 dagen" />
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel className="p-5">
          <h2 className="mb-4 text-[16px] font-semibold">Te doen per shop</h2>
          <Bars
            items={perShop.map((s) => ({
              key: s.code,
              label: (
                <span className="inline-flex items-center gap-2">
                  <ShopBadge code={s.code} />
                  {s.name}
                </span>
              ),
              value: s.open,
              title: `${s.name}: ${s.open} te doen, ${s.month} tickets in 30 dagen`,
            }))}
          />
        </Panel>
        <Panel className="p-5">
          <h2 className="mb-4 text-[16px] font-semibold">
            Soorten vragen, laatste 30 dagen
          </h2>
          <Bars
            items={perIntent.map((i) => ({
              key: i.intent,
              label: INTENT_LABELS[i.intent] ?? i.intent,
              value: i.n,
              title: `${INTENT_LABELS[i.intent] ?? i.intent}: ${i.n}`,
            }))}
          />
        </Panel>
      </div>

      <Panel className="p-5">
        <h2 className="mb-4 text-[16px] font-semibold">Nieuwe tickets per dag</h2>
        <div
          className="flex h-36 items-end gap-1.5"
          role="img"
          aria-label={`Nieuwe tickets per dag, laatste 14 dagen: ${perDay.map((d) => d.n).join(", ")}`}
        >
          {perDay.map((d) => {
            const date = new Date(`${d.day}T12:00:00`);
            return (
              <div
                key={d.day}
                className="group flex h-full flex-1 flex-col items-center justify-end gap-1"
                title={`${date.toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" })}: ${d.n}`}
              >
                <span className="tabular text-[11.5px] text-muted opacity-0 group-hover:opacity-100">
                  {d.n}
                </span>
                <span
                  className="w-full max-w-[28px] rounded-t-[4px] bg-pine"
                  style={{
                    height: `${(d.n / maxDay) * 100}%`,
                    minHeight: d.n > 0 ? 4 : 1,
                  }}
                />
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex justify-between text-[12.5px] text-muted">
          <span>
            {new Date(`${perDay[0]?.day}T12:00:00`).toLocaleDateString("nl-NL", {
              day: "numeric",
              month: "short",
            })}
          </span>
          <span>Vandaag</span>
        </div>
      </Panel>

      <Panel className="p-5">
        <h2 className="text-[16px] font-semibold">
          Concepten van Yuzu, laatste 30 dagen
        </h2>
        <p className="mt-1 text-[14px] text-ink-soft">
          {judged === 0
            ? `Nog geen concepten beoordeeld. ${ai.pending} ${ai.pending === 1 ? "concept wacht" : "concepten wachten"} op je.`
            : `${ai.used} van de ${judged} beoordeelde concepten gebruikt (${Math.round((ai.used / judged) * 100)}%). ${ai.pending} ${ai.pending === 1 ? "wacht" : "wachten"} nog op je.`}
        </p>
        <p className="mt-2 text-[13px] text-muted">
          Gebruikt telt ook concepten die je hebt aangepast. Zodra de koppeling met AI
          live is, meet Yuzu ook hoeveel er inhoudelijk gewijzigd is; dat bepaalt wanneer
          je een vraagtype op &ldquo;Zelf antwoorden&rdquo; kunt zetten.
        </p>
      </Panel>
    </div>
  );
}
