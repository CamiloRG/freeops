import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

/**
 * "Ledger Quiet" status markers (README "Status markers"): plain 11px mono
 * text, NO pill/chip background, no border, no radius — semantic color only
 * (`auto`→accent, `manual`/draft→ink-muted, paid/verified→success,
 * pending/sent→warning, overdue/destructive→danger). Same `variant` prop
 * union as before so every existing call site keeps compiling; mapped onto
 * the closest semantic color rather than a literal pill.
 */
const badgeVariants = cva(
  "group/badge inline-flex w-fit shrink-0 items-center gap-1 whitespace-nowrap font-mono text-[11px] font-normal [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "text-accent",
        secondary: "text-ink-muted",
        destructive: "text-danger",
        outline: "text-ink-soft",
        ghost: "text-ink-muted",
        link: "text-accent underline-offset-4 hover:underline",
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
