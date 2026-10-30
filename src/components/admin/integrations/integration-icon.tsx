import { Bot, Mail, ShoppingBag } from "lucide-react";
import type { IntegrationKind } from "@/domain/integrations";

const ICONS = { magento: ShoppingBag, mailgun: Mail, ai: Bot } as const;

export function IntegrationIcon({
  kind,
  size = "md",
}: {
  kind: IntegrationKind;
  size?: "md" | "lg";
}) {
  const Icon = ICONS[kind];
  const box = size === "lg" ? "h-11 w-11 rounded-xl" : "h-9 w-9 rounded-lg";
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center border border-line bg-panel-sunk text-ink-soft ${box}`}
    >
      <Icon
        className={size === "lg" ? "h-5 w-5" : "h-[18px] w-[18px]"}
        strokeWidth={1.8}
      />
    </span>
  );
}

const DOT: Record<string, string> = {
  connected: "var(--success)",
  error: "var(--alert)",
  demo: "var(--yuzu)",
  not_configured: "var(--line-strong)",
};

export function StatusDot({ status, label }: { status: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[13.5px] text-ink-soft">
      <span
        aria-hidden
        className="h-2 w-2 rounded-full"
        style={{ background: DOT[status] ?? DOT.not_configured }}
      />
      {label}
    </span>
  );
}
