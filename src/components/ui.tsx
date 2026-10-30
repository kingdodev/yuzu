import type { ReactNode } from "react";
import { TICKET_STATUS_LABELS, type TicketStatus } from "@/domain/tickets";

const SHOP_STYLE: Record<string, { fg: string; bg: string; label: string }> = {
  nl: { fg: "var(--shop-nl)", bg: "var(--shop-nl-tint)", label: "Nederland" },
  be: { fg: "var(--shop-be)", bg: "var(--shop-be-tint)", label: "België" },
  fr: { fg: "var(--shop-fr)", bg: "var(--shop-fr-tint)", label: "Frankrijk" },
  es: { fg: "var(--shop-es)", bg: "var(--shop-es-tint)", label: "Spanje" },
};

/** Landcode van de shop, in de kleur van die shop. */
export function ShopBadge({ code, size = "sm" }: { code: string; size?: "sm" | "md" }) {
  const style = SHOP_STYLE[code] ?? {
    fg: "var(--muted)",
    bg: "var(--panel-sunk)",
    label: code,
  };
  return (
    <span
      title={style.label}
      className={`inline-flex shrink-0 items-center justify-center rounded-[5px] font-semibold tracking-wide ${
        size === "sm"
          ? "h-[18px] min-w-[26px] px-1 text-[10.5px]"
          : "h-6 min-w-[32px] px-1.5 text-xs"
      }`}
      style={{ color: style.fg, background: style.bg }}
    >
      {code.toUpperCase()}
    </span>
  );
}

const STATUS_DOT: Record<TicketStatus, string> = {
  new: "var(--yuzu)",
  open: "var(--link)",
  pending_customer: "var(--line-strong)",
  pending_third_party: "var(--line-strong)",
  solved: "transparent",
  closed: "transparent",
};

export function StatusPill({ status }: { status: TicketStatus }) {
  const hollow = status === "solved" || status === "closed";
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] text-ink-soft">
      <span
        aria-hidden
        className="h-2 w-2 rounded-full"
        style={{
          background: STATUS_DOT[status],
          boxShadow: hollow
            ? "inset 0 0 0 1.5px var(--muted)"
            : status === "new"
              ? "0 0 0 1px var(--yuzu-ink)"
              : undefined,
        }}
      />
      {TICKET_STATUS_LABELS[status]}
    </span>
  );
}

const TAG_COLORS: Record<string, { fg: string; bg: string }> = {
  green: { fg: "#2e6b4c", bg: "#e2f0e8" },
  blue: { fg: "#25507f", bg: "#e2ecf7" },
  purple: { fg: "#5b3f86", bg: "#ece6f6" },
  red: { fg: "#9b2b24", bg: "#f8e4e2" },
  gray: { fg: "var(--ink-soft)", bg: "var(--panel-sunk)" },
};
export const TAG_COLOR_NAMES = Object.keys(TAG_COLORS);

export function TagChip({
  name,
  color,
  children,
}: {
  name: string;
  color: string;
  children?: ReactNode;
}) {
  const c = TAG_COLORS[color] ?? TAG_COLORS.gray;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ color: c.fg, background: c.bg }}
    >
      {name}
      {children}
    </span>
  );
}

/** Het Yuzu-teken: een halve, doorgesneden yuzu. */
export function YuzuMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="10.5" fill="var(--yuzu)" />
      <circle
        cx="12"
        cy="12"
        r="7.2"
        fill="none"
        stroke="var(--yuzu-ink)"
        strokeOpacity=".28"
        strokeWidth="1"
      />
      {[0, 60, 120, 180, 240, 300].map((deg) => (
        <line
          key={deg}
          x1="12"
          y1="12"
          x2={12 + 7.2 * Math.cos((deg * Math.PI) / 180)}
          y2={12 + 7.2 * Math.sin((deg * Math.PI) / 180)}
          stroke="var(--yuzu-ink)"
          strokeOpacity=".28"
          strokeWidth="1"
        />
      ))}
    </svg>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        <h1 className="text-[1.6rem] font-semibold leading-tight tracking-[-0.01em]">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 text-[15px] leading-relaxed text-muted">{description}</p>
        )}
      </div>
      {actions}
    </div>
  );
}

export function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl bg-panel shadow-card ${className}`}>
      {children}
    </section>
  );
}

/** Melding dat iets nog niet gekoppeld is. Eerlijk, zonder te doen alsof. */
export function DemoNotice({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-line-strong bg-panel-sunk px-3.5 py-2.5 text-[13.5px] leading-relaxed text-muted">
      {children}
    </p>
  );
}

export function Skeleton({ lines = 6 }: { lines?: number }) {
  return (
    <div className="animate-pulse space-y-3 p-4" aria-label="Laden">
      {Array.from({ length: lines }, (_, i) => (
        <div
          key={i}
          className="h-3.5 rounded bg-line"
          style={{ width: `${60 + ((i * 17) % 35)}%` }}
        />
      ))}
    </div>
  );
}
