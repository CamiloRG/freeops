import * as React from "react"

import { cn } from "@/lib/utils"

/** Same box treatment as Input — README: "textarea: same, min-height 64px,
 * no resize affordance styling." */
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "field-sizing-content min-h-16 w-full rounded-input border border-line bg-surface px-[14px] py-[12px] font-sans text-body-sm text-ink transition-colors duration-fast ease-out outline-none placeholder:text-ink-muted focus-visible:border-accent focus-visible:ring-[3px] focus-visible:ring-accent/15 disabled:cursor-not-allowed disabled:border-line disabled:bg-surface-sunken disabled:text-ink-muted aria-invalid:border-critical aria-invalid:focus-visible:ring-critical/15 resize-none",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
