import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * "Aero" input — the one non-pill control (README "Radius, not bubbly":
 * "8 inputs"): a real box, `1px solid --line`, `padding 12px 14px`, 14px
 * value text. Rest placeholder `--ink-muted`; focus `1px solid --accent` +
 * a 3px accent ring; invalid `1px solid --critical`; disabled bg
 * `--surface-sunken`, text `--ink-muted`.
 */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-auto w-full min-w-0 rounded-input border border-line bg-surface px-[14px] py-[12px] font-sans text-body-sm text-ink transition-colors duration-fast ease-out outline-none placeholder:text-ink-muted file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-ink focus-visible:border-accent focus-visible:ring-[3px] focus-visible:ring-accent/15 disabled:pointer-events-none disabled:cursor-not-allowed disabled:border-line disabled:bg-surface-sunken disabled:text-ink-muted aria-invalid:border-critical aria-invalid:focus-visible:ring-critical/15",
        className
      )}
      {...props}
    />
  )
}

export { Input }
