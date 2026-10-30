"use client";

import { Check, Copy, KeyRound } from "lucide-react";
import { useState, useTransition } from "react";
import { createPasswordLink, type LinkResult } from "@/server/actions/auth";

/**
 * Maak een link waarmee een collega zelf een wachtwoord kiest. Tot Mailgun
 * gekoppeld is, kopieer je de link en stuur je hem zelf (bijv. via WhatsApp
 * of mail).
 */
export function PasswordLink({
  userId,
  hasPassword,
  disabled,
}: {
  userId: string;
  hasPassword: boolean;
  disabled: boolean;
}) {
  const [result, setResult] = useState<LinkResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  const url = result?.ok ? `${window.location.origin}${result.path}` : "";

  return (
    <div className="space-y-2">
      <button
        type="button"
        className="btn btn-quiet px-2 py-1.5 text-[13.5px]"
        disabled={pending || disabled}
        title={disabled ? "Zet de gebruiker eerst op actief" : undefined}
        onClick={() =>
          start(async () => {
            setCopied(false);
            setResult(await createPasswordLink(userId));
          })
        }
      >
        <KeyRound className="h-4 w-4" aria-hidden />
        {hasPassword ? "Link voor nieuw wachtwoord" : "Uitnodigingslink maken"}
      </button>
      {result && !result.ok && (
        <p role="status" className="text-[13px] text-alert">
          {result.error}
        </p>
      )}
      {result?.ok && (
        <div className="rounded-lg border border-line bg-panel-sunk p-3">
          <p className="mb-2 text-[13px] text-ink-soft">
            Stuur deze link naar de collega. Hij werkt één keer en is geldig tot{" "}
            {new Date(result.expiresAt).toLocaleString("nl-NL", {
              weekday: "long",
              day: "numeric",
              month: "long",
              hour: "2-digit",
              minute: "2-digit",
            })}
            . Een eerdere link vervalt.
          </p>
          <div className="flex gap-2">
            <input
              readOnly
              value={url}
              aria-label="Link"
              className="field min-w-0 flex-1 py-1.5 font-mono text-[12.5px]"
              onFocus={(e) => e.currentTarget.select()}
            />
            <button
              type="button"
              className="btn btn-secondary py-1.5"
              onClick={async () => {
                await navigator.clipboard.writeText(url);
                setCopied(true);
              }}
            >
              {copied ? (
                <Check className="h-4 w-4" aria-hidden />
              ) : (
                <Copy className="h-4 w-4" aria-hidden />
              )}
              {copied ? "Gekopieerd" : "Kopieer"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
