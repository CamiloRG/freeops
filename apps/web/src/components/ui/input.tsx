import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * "Ledger Quiet" input — bottom-border only, no box (README "Inputs /
 * fields"): rest `border-bottom: 1px --line`, focus `1.5px --accent`,
 * invalid `1.5px --danger`, disabled `--ink-faint` text on `--line-soft`.
 * `field-sizing`/padding/font intentionally match `data-mono` sizing when
 * `type="number"`-like usage is needed by a caller — plain text stays
 * `--font-sans` at 14px per the "value" row of the fields spec.
 */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-auto w-full min-w-0 border-b border-line bg-transparent px-0 py-[9px] font-sans text-body text-ink transition-colors duration-fast ease-out outline-none placeholder:text-ink-faint file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-ink focus-visible:border-b-[1.5px] focus-visible:border-b-accent disabled:pointer-events-none disabled:cursor-not-allowed disabled:text-ink-faint disabled:border-b-line-soft aria-invalid:border-b-[1.5px] aria-invalid:border-b-danger",
        className
      )}
      {...props}
    />
  )
}

export { Input }
