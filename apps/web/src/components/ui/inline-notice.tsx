import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

/**
 * "Aero" inline notice (README "Overlays & feedback" → "Notices (inline)"):
 * radius 14, semantic tint background, **no border and no icon** — title
 * 13/600 in the semantic ink, body 13px `--ink-soft`. Used both for the
 * "verification required" pattern (banking step-up) and for error
 * surfacing in place of toasts (the kanban board's `InlineNotice` migration
 * off `sonner`). `variant="danger"` kept as the historical prop name for
 * every existing call site; maps onto Aero's `--critical` family.
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
        "max-w-measure rounded-tile px-[18px] py-[14px]",
        variant === "danger" ? "bg-critical-tint" : "bg-accent-tint",
        className
      )}
    >
      <div
        className={cn(
          "text-[13px] font-semibold",
          variant === "danger" ? "text-critical-ink" : "text-accent-press"
        )}
      >
        {title}
      </div>
      {description ? (
        <div className="mt-[5px] text-[13px] text-ink-soft">{description}</div>
      ) : null}
      {children}
    </div>
  )
}
