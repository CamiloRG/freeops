"use client"

import * as React from "react"
import { Progress as ProgressPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

/**
 * "Aero" progress (README "Overlays & feedback" → "Progress"): 6px pill
 * track in `--surface-sunken`, accent fill. Also used by list/run rows
 * ("progress bar (5px, radius pill)") — pass `className="h-[5px]"` there.
 */
function Progress({
  className,
  value,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root>) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(
        "relative h-[6px] w-full overflow-hidden rounded-pill bg-surface-sunken",
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className="h-full flex-1 rounded-pill bg-accent transition-transform duration-300 ease-out"
        style={{ transform: `translateX(-${100 - (value ?? 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  )
}

export { Progress }
