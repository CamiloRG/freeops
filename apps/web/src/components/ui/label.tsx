"use client"

import * as React from "react"
import { Label as LabelPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

/**
 * "Aero" field label — `12px/500 --ink-soft` sitting above its control with
 * a 7px gap (README "Inputs & selection"), NOT the mono/uppercase treatment
 * Ledger Quiet used — Aero reserves mono for section markers/IDs/numbers,
 * not for ordinary field labels. Error state (paired via the sibling
 * control's `aria-invalid` through the shared `group/field` wrapper, or
 * `data-invalid` directly) switches to `--critical-ink`.
 */
function Label({
  className,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        "mb-[7px] flex items-center gap-2 font-sans text-[12px] font-medium text-ink-soft select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 peer-aria-invalid:text-critical-ink group-has-[[aria-invalid=true]]/field:text-critical-ink data-invalid:text-critical-ink",
        className
      )}
      {...props}
    />
  )
}

export { Label }
