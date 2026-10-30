import { ShopBadge } from "../../ui";
import { listIntegrations } from "@/server/admin";

function EnvList({ vars }: { vars: [string, string][] }) {
  return (
    <div>
      <h3 className="mb-1.5 text-[13px] font-medium text-muted">
        Wat er straks nodig is
      </h3>
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

/** Mailgun: nog niet zelf aan te sluiten; uitleg wat er komt. */
export async function MailgunDetails() {
  const { shops } = await listIntegrations();
  return (
    <div className="space-y-5 text-[14px]">
      <p className="text-ink-soft">
        Klanten blijven mailen naar het adres van de shop. Google Workspace stuurt die
        mail door naar Mailgun, Mailgun levert hem af bij Yuzu, en antwoorden gaan via
        Mailgun weer naar buiten, vanaf het adres van de shop.
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
    </div>
  );
}

/** AI-model: nog niet zelf aan te sluiten; uitleg wat er komt. */
export function AiDetails() {
  return (
    <div className="space-y-5 text-[14px]">
      <p className="text-ink-soft">
        Claude via AWS Bedrock, met het EU-profiel vanuit Frankfurt: de verwerking blijft
        binnen EU-regio&apos;s en AWS gebruikt de data niet om modellen te trainen. Sonnet
        schrijft concepten en vertalingen, Haiku sorteert binnenkomende mail.
      </p>
      <EnvList
        vars={[
          ["AWS_REGION", "eu-central-1"],
          ["AWS_ACCESS_KEY_ID", "Toegangssleutel met alleen Bedrock-rechten"],
          ["AWS_SECRET_ACCESS_KEY", "Bijbehorende geheime sleutel"],
        ]}
      />
    </div>
  );
}
