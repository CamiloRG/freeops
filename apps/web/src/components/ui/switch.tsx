"use client"

import * as React from "react"
import { Switch as SwitchPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

/**
 * "Aero" toggle (README "Inputs & selection": "Toggle 52×30 pill, knob 24,
 * on = --accent, off = --line"). `size="sm"` is a smaller variant kept for
 * call sites that need a denser control — not separately specified in the
 * handoff, scaled proportionally from the default.
 */
function Switch({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: "sm" | "default"
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "peer group/switch relative inline-flex shrink-0 items-center rounded-pill border border-transparent transition-colors duration-fast outline-none after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:ring-3 focus-visible:ring-accent/15 aria-invalid:border-critical aria-invalid:ring-3 aria-invalid:ring-critical/15 data-[size=default]:h-[30px] data-[size=default]:w-[52px] data-[size=sm]:h-[22px] data-[size=sm]:w-[38px] data-checked:bg-accent data-unchecked:bg-line data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block rounded-full bg-white shadow-raised ring-0 transition-transform duration-fast group-data-[size=default]/switch:size-6 group-data-[size=sm]/switch:size-[18px] group-data-[size=default]/switch:data-checked:translate-x-[calc(100%-2px)] group-data-[size=sm]/switch:data-checked:translate-x-[calc(100%-2px)] group-data-[size=default]/switch:data-unchecked:translate-x-0.5 group-data-[size=sm]/switch:data-unchecked:translate-x-0.5"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
