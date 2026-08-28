"use client"

import * as React from "react"
import { ToggleGroup as ToggleGroupPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

/**
 * "Aero" segmented control (README "Inputs & selection" → "Segmented
 * control"): 4px padding track in `--surface-sunken`, radius pill; the
 * selected segment is a white pill with `0 1px 2px rgba(17,24,39,.06)`.
 * Distinct from `Tabs`'s `variant="pill"` filter-chip treatment (which
 * highlights with `--accent-tint`, not a white raised pill) — this is a
 * single-choice control (e.g. a list/board view switch), not a filter.
 */
function Segmented({
  className,
  ...props
}: Omit<
  Extract<React.ComponentProps<typeof ToggleGroupPrimitive.Root>, { type?: "single" }>,
  "type"
>) {
  return (
    <ToggleGroupPrimitive.Root
      data-slot="segmented"
      type="single"
      className={cn(
        "inline-flex w-fit items-center gap-0.5 rounded-pill bg-surface-sunken p-1",
        className
      )}
      {...props}
    />
  )
}

function SegmentedItem({
  className,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Item>) {
  return (
    <ToggleGroupPrimitive.Item
      data-slot="segmented-item"
      className={cn(
        "rounded-pill px-[14px] py-[6px] text-ui-sm text-ink-soft transition-colors duration-fast ease-out outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-accent/15 data-[state=on]:bg-surface data-[state=on]:text-ink data-[state=on]:shadow-[0_1px_2px_rgba(17,24,39,.06)]",
        className
      )}
      {...props}
    />
  )
}

export { Segmented, SegmentedItem }
