import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

/**
 * "Ledger Quiet" buttons (design_handoff_freeops_ledger_quiet/README.md,
 * "Buttons" section): primary is a solid ink fill, secondary/tertiary/
 * destructive are all text-only (underline or plain), never a second
 * filled color. Same `variant`/`size` prop UNIONS as the prior Cloud
 * Neutral button so every existing call site across the app (including
 * stage-2/3 screens this pass doesn't touch) keeps compiling and looks
 * intentional, not broken — only the underlying classes changed.
 *
 * Variant mapping (shadcn name → Ledger Quiet treatment):
 *   default     → primary   (bg --ink, text --paper)
 *   outline     → secondary (text --ink, border-bottom 1px --ink)
 *   secondary   → secondary (same treatment — no separate "filled but
 *                 lower-emphasis" concept exists in this system; the two
 *                 shadcn variants collapse onto the one underline style)
 *   ghost       → tertiary  (text --ink-soft, no border)
 *   link        → secondary (already inherently a link)
 *   destructive → destructive (text --danger, border-bottom --danger)
 *
 * Icon-only sizes (icon/icon-xs/icon-sm/icon-lg) drop the border-bottom
 * from the underline variants via compoundVariants below — a visible
 * underline reads as a text link, not as a square icon affordance, so
 * icon buttons fall back to color-only hover for every non-primary variant.
 */
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 border-b border-transparent bg-clip-padding font-sans text-ui font-medium whitespace-nowrap transition-colors duration-fast ease-out outline-none select-none focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 disabled:pointer-events-none disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-ink text-paper hover:bg-[#1A1916] active:bg-black disabled:bg-line-soft disabled:text-ink-faint",
        outline:
          "bg-transparent text-ink border-b-ink px-0! py-0.5! hover:text-accent hover:border-b-accent disabled:text-ink-faint disabled:border-b-line-soft",
        secondary:
          "bg-transparent text-ink border-b-ink px-0! py-0.5! hover:text-accent hover:border-b-accent disabled:text-ink-faint disabled:border-b-line-soft",
        ghost:
          "bg-transparent text-ink-soft hover:text-ink disabled:text-ink-faint",
        destructive:
          "bg-transparent text-danger border-b-danger px-0! py-0.5! hover:text-[#a53c2d] hover:border-b-[#a53c2d] disabled:text-ink-faint disabled:border-b-line-soft",
        link: "bg-transparent text-ink border-b-ink px-0! py-0.5! hover:text-accent hover:border-b-accent",
      },
      size: {
        default: "px-6 py-[13px] text-[12.5px] has-data-[icon=inline-end]:pr-5 has-data-[icon=inline-start]:pl-5",
        xs: "px-3 py-[6px] text-[11.5px]",
        sm: "px-4 py-[9px] text-[12px]",
        lg: "px-7 py-[15px] text-[13px]",
        icon: "size-9 p-0!",
        "icon-xs": "size-7 p-0!",
        "icon-sm": "size-8 p-0!",
        "icon-lg": "size-10 p-0!",
      },
    },
    compoundVariants: [
      {
        variant: ["outline", "secondary", "destructive", "link"],
        size: ["icon", "icon-xs", "icon-sm", "icon-lg"],
        class: "border-b-0!",
      },
    ],
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
