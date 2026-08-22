"use client"

import * as React from "react"
import { Label as LabelPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

/**
 * "Ledger Quiet" `label-mono` treatment (README type scale): 10.5px/500/
 * .06em tracking/uppercase, `--ink-muted` at rest. Field-level error state
 * is driven by the sibling input's `aria-invalid` via the shared
 * `group/field` wrapper — callers that want the danger-red label pair a
 * `group/field` ancestor with `aria-invalid` on the control, or simply pass
 * `data-invalid` directly on the Label for a standalone error label.
 */
function Label({
  className,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        "flex items-center gap-2 font-mono text-label-mono tracking-[0.06em] text-ink-muted uppercase select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 peer-aria-invalid:text-danger group-has-[[aria-invalid=true]]/field:text-danger data-invalid:text-danger",
        className
      )}
      {...props}
    />
  )
}

export { Label }
