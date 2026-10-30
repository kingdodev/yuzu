import { Sparkles } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { ActionForm } from "@/components/forms";
import { PageHeader, Panel, ShopBadge, Skeleton } from "@/components/ui";
import { saveAiIntent } from "@/server/actions/admin";
import { listAiSettings } from "@/server/admin";

export const metadata = { title: "AI-instellingen" };

export default function AiPage() {
  return (
    <>
      <PageHeader
        title="AI-instellingen"
        description="Per soort vraag bepaal je wat Yuzu mag: niets, een concept klaarzetten dat jij goedkeurt, of zelf antwoorden. Zelf antwoorden zet je pas aan als de concepten bewezen goed zijn."
      />
      <Suspense fallback={<Skeleton lines={10} />}>
        <Settings />
      </Suspense>
    </>
  );
}

const MODES: [string, string][] = [
  ["off", "Altijd een mens"],
  ["draft", "Concept klaarzetten"],
  ["autopilot", "Zelf antwoorden"],
];

async function Settings() {
  const { intents, shops, usage } = await listAiSettings();
  const stat = (intent: string, status: string) =>
    usage.find((u) => u.intent === intent && u.status === status)?.n ?? 0;

  return (
    <>
      <Panel className="divide-y divide-line">
        <div className="hidden grid-cols-[1.3fr_1fr_1.6fr] gap-4 px-5 py-2.5 text-[13px] text-muted md:grid">
          <span>Soort vraag</span>
          <span>Concepten tot nu toe</span>
          <span>Wat Yuzu mag</span>
        </div>
        {intents.map((i) => {
          const used = stat(i.intent, "used");
          const discarded = stat(i.intent, "discarded");
          const open = stat(i.intent, "pending");
          const judged = used + discarded;
          return (
            <div
              key={i.intent}
              className="grid gap-3 px-5 py-4 md:grid-cols-[1.3fr_1fr_1.6fr] md:items-center"
            >
              <div className="font-medium">{i.label}</div>
              <div className="text-[13.5px] text-ink-soft">
                {judged === 0 ? (
                  <span className="text-muted">
                    {open > 0 ? `${open} wacht op beoordeling` : "Nog geen"}
                  </span>
                ) : (
                  <>
                    <span className="tabular font-medium">
                      {Math.round((used / judged) * 100)}%
                    </span>{" "}
                    gebruikt
                    <span className="text-muted">
                      {" "}
                      ({used} van {judged})
                    </span>
                  </>
                )}
              </div>
              <ActionForm
                action={saveAiIntent}
                submitLabel="Opslaan"
                submitClassName="btn btn-secondary"
                className="flex flex-wrap items-center gap-2"
              >
                <input type="hidden" name="intent" value={i.intent} />
                <select
                  className="field w-auto"
                  name="mode"
                  defaultValue={i.mode}
                  aria-label={`Wat Yuzu mag bij ${i.label}`}
                >
                  {MODES.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-1.5 text-[13.5px] text-muted">
                  vanaf
                  <input
                    className="field tabular w-[4.5rem]"
                    name="threshold"
                    type="number"
                    min={50}
                    max={100}
                    defaultValue={i.confidenceThreshold}
                    aria-label="Minimale zekerheid in procent"
                  />
                  % zeker
                </label>
              </ActionForm>
            </div>
          );
        })}
      </Panel>
      <p className="mt-3 max-w-3xl text-[13.5px] leading-relaxed text-muted">
        Advies: laat een soort vraag minstens twee weken op &ldquo;Concept
        klaarzetten&rdquo; staan. Zet hem pas op &ldquo;Zelf antwoorden&rdquo; als je
        minstens 95% van de concepten zonder inhoudelijke wijziging verstuurt. Twijfelt
        Yuzu, ligt de zekerheid onder de drempel, of is de klant boos, dan krijg jij het
        ticket altijd zelf.
      </p>

      <h2 className="mb-3 mt-10 text-[17px] font-semibold">Toon per shop</h2>
      <Panel className="divide-y divide-line">
        {shops.map((s) => (
          <div key={s.id} className="flex flex-wrap items-start gap-4 px-5 py-4">
            <ShopBadge code={s.code} size="md" />
            <div className="min-w-0 flex-1">
              <div className="font-medium">{s.name}</div>
              <p className="mt-0.5 text-[14px] text-ink-soft">
                {s.toneOfVoice || "Nog geen schrijfstijl ingesteld."}
              </p>
            </div>
            <Link
              href={`/beheer/shops/${s.id}`}
              className="text-[14px] text-link underline-offset-2 hover:underline"
            >
              Aanpassen
            </Link>
          </div>
        ))}
      </Panel>

      <h2 className="mb-3 mt-10 text-[17px] font-semibold">
        Melding in automatische antwoorden
      </h2>
      <Panel className="p-5">
        <p className="max-w-3xl text-[14px] leading-relaxed text-ink-soft">
          Sinds 2 augustus 2026 moeten klanten weten dat ze met AI te maken hebben (AI
          Act, artikel 50). Elk antwoord dat Yuzu zelf verstuurt, krijgt daarom onderaan
          deze regel, in de taal van de klant:
        </p>
        <ul className="mt-3 space-y-1.5 text-[14px]">
          <li className="flex gap-2">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-yuzu-ink" aria-hidden />
            Dit antwoord is opgesteld door onze AI-assistent. Antwoord op deze mail als je
            een medewerker wilt spreken.
          </li>
          <li className="flex gap-2">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-yuzu-ink" aria-hidden />
            Cette réponse a été rédigée par notre assistant IA. Répondez à ce message pour
            parler à un conseiller.
          </li>
          <li className="flex gap-2">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-yuzu-ink" aria-hidden />
            Esta respuesta ha sido redactada por nuestro asistente de IA. Responde a este
            correo si quieres hablar con una persona.
          </li>
        </ul>
        <p className="mt-3 text-[13px] text-muted">
          Antwoorden die jij verstuurt, ook op basis van een concept, krijgen deze regel
          niet.
        </p>
      </Panel>
    </>
  );
}
