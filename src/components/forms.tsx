"use client";

import { useActionState, useTransition, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { FormState } from "@/server/actions/admin";

/** Formulier dat een server action aanroept en het resultaat eronder toont. */
export function ActionForm({
  action,
  children,
  className = "",
  submitLabel = "Opslaan",
  submitClassName = "btn btn-primary",
  footer,
}: {
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  children: ReactNode;
  className?: string;
  submitLabel?: string;
  submitClassName?: string;
  footer?: ReactNode;
}) {
  const [state, formAction] = useActionState(action, null);
  return (
    <form action={formAction} className={className}>
      {children}
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton label={submitLabel} className={submitClassName} />
        {footer}
        {state && (
          <p
            role="status"
            className={`text-[13.5px] ${state.ok ? "text-success" : "text-alert"}`}
          >
            {state.ok ? state.message : state.error}
          </p>
        )}
      </div>
    </form>
  );
}

function SubmitButton({ label, className }: { label: string; className: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? "Bezig…" : label}
    </button>
  );
}

/** Knop voor een directe actie (verwijderen, in- of uitschakelen), met optionele bevestiging. */
export function ActionButton({
  onAction,
  children,
  confirm,
  className = "btn btn-quiet",
}: {
  onAction: () => Promise<unknown>;
  children: ReactNode;
  confirm?: string;
  className?: string;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className={className}
      disabled={pending}
      onClick={() => {
        if (confirm && !window.confirm(confirm)) return;
        start(async () => void (await onAction()));
      }}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[13.5px] font-medium text-ink-soft">{label}</span>
      {children}
      {hint && (
        <span className="mt-1 block text-[12.5px] leading-relaxed text-muted">
          {hint}
        </span>
      )}
    </label>
  );
}
