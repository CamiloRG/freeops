import * as React from "react"

import { cn } from "@/lib/utils"

/** Same bottom-border-only treatment as Input — README: "textarea: same,
 * min-height 3 lines, no resize handle styling." */
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "field-sizing-content min-h-[calc(1.7em*3)] w-full border-b border-line bg-transparent px-0 py-[9px] font-sans text-body text-ink transition-colors duration-fast ease-out outline-none placeholder:text-ink-faint focus-visible:border-b-[1.5px] focus-visible:border-b-accent disabled:cursor-not-allowed disabled:text-ink-faint disabled:border-b-line-soft aria-invalid:border-b-[1.5px] aria-invalid:border-b-danger resize-none",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
