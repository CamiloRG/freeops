import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * "Ledger Quiet" field-grid (README "Layout constants" → `field-grid: 1fr
 * 1fr, gap 26px row / 44px column`, matched pixel-for-pixel against the
 * mocked Personal/Profile and Personal/Banking screens) used inside
 * `SummaryEditCard`'s collapsed `summary` slot across Profile / Tax Info /
 * Banking. Resume's Basics card and Branding's logo/swatch summary use a
 * bespoke `summary` layout instead — the component's `summary` slot is a
 * plain `ReactNode`, not tied to the grid shape, deliberately.
 */
export function SummaryGrid({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("grid max-w-[560px] grid-cols-1 gap-x-11 gap-y-[26px] sm:grid-cols-2", className)}>
      {children}
    </div>
  );
}

export function SummaryField({
  label,
  value,
  mono = false,
  className,
  full = false,
}: {
  label: string;
  /** Pass the raw value (string/null/undefined/ReactNode) — empty values
   * render as "—" in `--ink-faint` automatically, per the handoff's
   * "empty" field convention, rather than each call site having to know
   * to fall back to a dash string itself. */
  value: ReactNode;
  /** Numeric/identifier fields (phone, account number, tax IDs) render in
   * `data-mono` per the handoff's "Numeric values ... are also mono" rule. */
  mono?: boolean;
  className?: string;
  /** Spans both grid columns — used for Profile's Titular/Bio fields. */
  full?: boolean;
}) {
  const isEmpty = value === null || value === undefined || value === "";
  return (
    <div className={cn(full && "sm:col-span-2", className)}>
      <div className="font-mono text-label-mono tracking-[0.06em] text-ink-muted uppercase">{label}</div>
      <div
        className={cn(
          "mt-[6px] text-body text-ink",
          mono && "font-mono text-data-mono",
          isEmpty && "text-ink-faint"
        )}
      >
        {isEmpty ? "—" : value}
      </div>
    </div>
  );
}
