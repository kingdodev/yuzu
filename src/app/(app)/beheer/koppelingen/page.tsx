import { Bot, Mail, ShoppingBag } from "lucide-react";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { PageHeader, Panel, ShopBadge, Skeleton } from "@/components/ui";
import { listIntegrations } from "@/server/admin";

export const metadata = { title: "Koppelingen" };

const STATUS: Record<string, { label: string; dot: string }> = {
  demo: { label: "Demo, nagebootst", dot: "var(--yuzu)" },
  connected: { label: "Verbonden", dot: "var(--success)" },
  error: { label: "Fout", dot: "var(--alert)" },
  not_configured: { label: "Niet ingesteld", dot: "var(--line-strong)" },
};

export default function IntegrationsPage() {
  return (
    <>
      <PageHeader
        title="Koppelingen"
        description="Yuzu praat met drie systemen: Mailgun voor e-mail, Magento voor orders en een AI-model voor concepten. Wachtwoorden en sleutels staan nooit in dit scherm; die zet je in de hostingomgeving."
      />
      <Suspense fallback={<Skeleton lines={12} />}>
        <Integrations />
      </Suspense>
    </>
  );
}

function Card({
  icon,
  title,
  status,
  children,
}: {
  icon: ReactNode;
  title: string;
  status: string;
  children: ReactNode;
}) {
  const st = STATUS[status] ?? STATUS.not_configured;
  return (
    <Panel className="p-5">
      <div className="flex flex-wrap items-center gap-3">
        {icon}
        <h2 className="text-[17px] font-semibold">{title}</h2>
        <span className="ml-auto inline-flex items-center gap-1.5 text-[13.5px] text-ink-soft">
          <span
            aria-hidden
            className="h-2 w-2 rounded-full"
            style={{ background: st.dot }}
          />
          {st.label}
        </span>
      </div>
      <div className="mt-4 space-y-4 text-[14px]">{children}</div>
    </Panel>
  );
}

function EnvList({ vars }: { vars: [string, string][] }) {
  return (
    <div>
      <h3 className="mb-1.5 text-[13px] font-medium text-muted">Nodig om te koppelen</h3>
      <ul className="space-y-1">
        {vars.map(([name, text]) => (
          <li key={name} className="grid gap-x-3 sm:grid-cols-[260px_1fr]">
            <code className="text-[13px] text-ink">{name}</code>
            <span className="text-[13.5px] text-ink-soft">{text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

async function Integrations() {
  const { integrations, shops } = await listIntegrations();
  const icon = "h-5 w-5 text-muted";
  return (
    <div className="space-y-5">
      <Card
        icon={<Mail className={icon} aria-hidden />}
        title="E-mail via Mailgun (EU)"
        status={integrations.mailgun?.status ?? "not_configured"}
      >
        <p className="text-ink-soft">
          Klanten blijven mailen naar het adres van de shop. Google Workspace stuurt die
          mail door naar Mailgun, Mailgun levert hem af bij Yuzu, en antwoorden gaan via
          Mailgun weer naar buiten.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-[13.5px]">
            <thead className="text-muted">
              <tr>
                <th className="py-1.5 pr-4 font-medium">Shop</th>
                <th className="py-1.5 pr-4 font-medium">Adres</th>
                <th className="py-1.5 pr-4 font-medium">SPF</th>
                <th className="py-1.5 pr-4 font-medium">DKIM</th>
                <th className="py-1.5 font-medium">DMARC</th>
              </tr>
            </thead>
            <tbody>
              {shops.map((s) => (
                <tr key={s.code} className="border-t border-line">
                  <td className="py-2 pr-4">
                    <ShopBadge code={s.code} />
                  </td>
                  <td className="py-2 pr-4">{s.senderEmail}</td>
                  <td className="py-2 pr-4 text-muted">Nog niet gecontroleerd</td>
                  <td className="py-2 pr-4 text-muted">Nog niet gecontroleerd</td>
                  <td className="py-2 text-muted">Nog niet gecontroleerd</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <EnvList
          vars={[
            ["MAILGUN_API_KEY", "API-sleutel uit het Mailgun-dashboard (EU-regio)"],
            [
              "MAILGUN_WEBHOOK_SIGNING_KEY",
              "Om te controleren dat binnenkomende mail echt van Mailgun komt",
            ],
          ]}
        />
      </Card>

      <Card
        icon={<ShoppingBag className={icon} aria-hidden />}
        title="Magento 2"
        status={integrations.magento?.status ?? "not_configured"}
      >
        <p className="text-ink-soft">
          Eén koppeling voor alle shops, alleen lezen. Yuzu haalt orders, zendingen en
          facturen op en schrijft niets naar de live shop.
          {integrations.magento?.settings.version &&
            ` Versie ${integrations.magento.settings.version}.`}
        </p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {shops.map((s) => (
            <li
              key={s.code}
              className="flex items-center gap-2.5 rounded-lg border border-line px-3 py-2"
            >
              <ShopBadge code={s.code} />
              <span className="min-w-0 flex-1 truncate">{s.name}</span>
              <span className="tabular text-[13px] text-muted">
                store {s.store ?? "?"}
              </span>
            </li>
          ))}
        </ul>
        <EnvList
          vars={[
            ["MAGENTO_BASE_URL", "Adres van de Magento-installatie"],
            [
              "MAGENTO_ACCESS_TOKEN",
              "Token van de integratie (Systeem → Extensies → Integraties), alleen leesrechten",
            ],
          ]}
        />
      </Card>

      <Card
        icon={<Bot className={icon} aria-hidden />}
        title="AI-model"
        status={integrations.ai?.status ?? "not_configured"}
      >
        <p className="text-ink-soft">
          Claude via AWS Bedrock, met het EU-profiel vanuit Frankfurt: de verwerking
          blijft binnen EU-regio&apos;s en AWS gebruikt de data niet om modellen te
          trainen. Sonnet schrijft concepten en vertalingen, Haiku sorteert binnenkomende
          mail.
        </p>
        <EnvList
          vars={[
            ["AWS_REGION", "eu-central-1"],
            ["AWS_ACCESS_KEY_ID", "Toegangssleutel met alleen Bedrock-rechten"],
            ["AWS_SECRET_ACCESS_KEY", "Bijbehorende geheime sleutel"],
          ]}
        />
      </Card>
    </div>
  );
}
