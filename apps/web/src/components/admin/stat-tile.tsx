import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Hero-number stat tile for the `/admin` operations dashboard — same
 * mono-label-above-value shape as `components/personal/summary-grid.tsx`'s
 * `SummaryField`, but the value renders at `text-h1` (24px, mono) since
 * this is a headline number meant to be read at a glance, not a form
 * field. No box/border/shadow, per the Ledger Quiet design system — tiles
 * are separated by grid gap alone.
 */
export function StatTile({
  label,
  value,
  tone = "default",
  hint,
}: {
  label: string;
  value: ReactNode;
  tone?: "default" | "warning";
  hint?: ReactNode;
}) {
  return (
    <div>
      <div className="font-mono text-label-mono tracking-[0.06em] text-ink-muted uppercase">{label}</div>
      <div
        className={cn(
          "mt-[6px] font-mono text-h1 text-ink",
          tone === "warning" && "text-[var(--warning)]"
        )}
      >
        {value}
      </div>
      {hint ? <div className="mt-[4px] text-caption text-ink-soft">{hint}</div> : null}
    </div>
  );
}

/** Grid wrapper for a row of `StatTile`s — plain whitespace separation, no card. */
export function StatTileGrid({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 gap-x-11 gap-y-[26px] sm:grid-cols-3 lg:grid-cols-4", className)}>
      {children}
    </div>
  );
}
