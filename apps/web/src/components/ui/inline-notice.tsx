import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

/**
 * "Ledger Quiet" inline notice (README "Inline notices"): `--surface-sunken`
 * background, `2px --accent` left border, mono title, caption body — used
 * both for the "verification required" pattern (banking step-up, stage 2)
 * and for error surfacing in place of toasts (README "Save feedback": no
 * toasts, "Errors surface as an inline notice above the action row" —
 * stage 3 migrates the kanban board's `toast.error(...)` calls onto this).
 * Danger variant swaps to `--danger-bg` background + `--danger` border/
 * title. No icons, per the handoff's "Assets" section.
 */
export function InlineNotice({
  variant = "accent",
  title,
  description,
  children,
  className,
}: {
  variant?: "accent" | "danger";
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={variant === "danger" ? "alert" : undefined}
      className={cn(
        "max-w-measure border-l-2 px-[18px] py-[14px]",
        variant === "danger"
          ? "bg-danger-bg border-l-danger"
          : "bg-surface-sunken border-l-accent",
        className
      )}
    >
      <div
        className={cn(
          "font-mono text-label-mono tracking-[0.06em] uppercase",
          variant === "danger" ? "text-danger" : "text-accent"
        )}
      >
        {title}
      </div>
      {description ? (
        <div className="mt-[5px] text-caption text-ink-soft">
          {description}
        </div>
      ) : null}
      {children}
    </div>
  )
}
