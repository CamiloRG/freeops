import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

/**
 * "Aero" status pills (README "Status pills"): `padding 6px 13px`, radius
 * pill, 12/500, with a 6px dot in the base hue — tint background + `ink`
 * foreground per semantic family. Neutral/ID pills use `--surface-sunken` +
 * `--ink-soft` in `data-mono` 11px, no dot. Same `variant` prop union as
 * the prior Ledger Quiet badge (plain mono text, no pill) so every existing
 * call site keeps compiling; mapped onto the closest Aero pill.
 */
const badgeVariants = cva(
  "group/badge inline-flex w-fit shrink-0 items-center gap-[6px] rounded-pill px-[13px] py-[6px] font-sans text-[12px] font-medium whitespace-nowrap [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default:
          "bg-accent-tint text-ink before:inline-block before:size-[6px] before:shrink-0 before:rounded-full before:bg-accent before:content-['']",
        secondary:
          "gap-1.5 rounded-pill bg-surface-sunken px-[10px] py-[5px] font-mono text-data-mono text-ink-soft",
        destructive:
          "bg-critical-tint text-ink before:inline-block before:size-[6px] before:shrink-0 before:rounded-full before:bg-critical before:content-['']",
        outline: "border border-line bg-surface text-ink-soft",
        ghost: "gap-0 bg-transparent p-0 font-mono text-[11px] font-normal text-ink-muted",
        link: "gap-0 bg-transparent p-0 font-mono text-[11px] font-normal text-accent underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
