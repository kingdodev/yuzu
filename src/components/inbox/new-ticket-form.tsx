"use client";

import { Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createOutboundTicket } from "@/server/actions/tickets";
import { AttachmentPicker, type PickerState } from "../attachments/attachment-picker";
import { Field } from "../forms";
import { ShopBadge } from "../ui";

type Shop = {
  id: string;
  code: string;
  name: string;
  senderName: string;
  senderEmail: string;
};

export function NewTicketForm({
  shops,
  initial,
}: {
  shops: Shop[];
  initial: { shopCode: string; to: string; name: string };
}) {
  const router = useRouter();
  const [shopId, setShopId] = useState(
    shops.find((s) => s.code === initial.shopCode)?.id ?? shops[0].id,
  );
  const [to, setTo] = useState(initial.to);
  const [name, setName] = useState(initial.name);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [nextStatus, setNextStatus] = useState<"pending_customer" | "solved" | "open">(
    "pending_customer",
  );
  const [files, setFiles] = useState<PickerState>({ ids: [], busy: false });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const shop = shops.find((s) => s.id === shopId) ?? shops[0];

  const ready = to.trim() && subject.trim() && body.trim() && !files.busy;

  function submit() {
    if (!ready) return;
    setError(null);
    start(async () => {
      const result = await createOutboundTicket({
        shopId,
        to,
        name,
        subject,
        body,
        nextStatus,
        attachmentIds: files.ids,
      });
      if (result.ok) router.push(result.href);
      else setError(result.error);
    });
  }

  return (
    <form
      className="space-y-5 rounded-xl bg-panel p-5 shadow-card"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="max-w-sm">
        <Field
          label="Vanaf shop"
          hint={
            <>
              Verstuurd als {shop.senderName} &lt;{shop.senderEmail}&gt;
            </>
          }
        >
          <div className="flex items-center gap-2">
            <ShopBadge code={shop.code} />
            <select
              className="field"
              value={shopId}
              onChange={(e) => setShopId(e.target.value)}
            >
              {shops.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Aan (e-mailadres)">
          <input
            className="field"
            type="email"
            required
            autoComplete="off"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="klant@example.nl"
          />
        </Field>
        <Field label="Naam klant" hint="Niet verplicht.">
          <input
            className="field"
            autoComplete="off"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
      </div>

      <Field label="Onderwerp">
        <input
          className="field"
          required
          maxLength={300}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
      </Field>

      <Field label="Bericht">
        <textarea
          className="field min-h-[220px]"
          required
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
          }}
        />
      </Field>

      <div className="flex flex-wrap items-center gap-2">
        <AttachmentPicker onChange={setFiles} />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <select
            className="field w-auto py-1.5"
            value={nextStatus}
            onChange={(e) => setNextStatus(e.target.value as typeof nextStatus)}
            aria-label="Status na versturen"
          >
            <option value="pending_customer">Daarna: wacht op klant</option>
            <option value="solved">Daarna: opgelost</option>
            <option value="open">Daarna: open laten</option>
          </select>
          <button type="submit" className="btn btn-primary" disabled={pending || !ready}>
            <Send className="h-4 w-4" aria-hidden />
            {pending ? "Bezig…" : files.busy ? "Bijlagen uploaden…" : "Versturen"}
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="text-[13.5px] text-alert">
          {error}
        </p>
      )}
      <p className="text-[12.5px] text-muted">
        In de demo wordt de mail nog niet echt verstuurd; hij komt wel in Yuzu te staan.
      </p>
    </form>
  );
}
