import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

/**
 * "Aero" buttons (README "Buttons — all pills" + the full control inventory
 * in the `.dc.html` reference): every variant is a full pill (`radius:
 * 999px`), 14/500 type, `padding: 12px 22px` (Ghost: `12px 18px`). Same
 * `variant`/`size` prop UNIONS as the prior Ledger Quiet button so every
 * existing call site across the app (including not-yet-rebuilt Personal/
 * Business/Finance/Admin screens) keeps compiling and looks intentional —
 * only the underlying classes changed.
 *
 * Variant mapping (shadcn/Ledger Quiet name → Aero treatment):
 *   default     → Primary     (bg --accent, text white — README rule 3:
 *                 "accent carries", this is its main job now)
 *   outline     → Secondary   (bg --surface, 1px --line border)
 *   secondary   → Secondary   (same — no separate lower-emphasis-but-filled
 *                 concept exists in this system either; both shadcn
 *                 variants collapse onto Aero's one Secondary pill)
 *   ghost       → Ghost       (transparent, text --accent / --accent-on-dark
 *                 on a dark ancestor)
 *   destructive → Destructive (bg --critical, text white)
 *   link        → plain text-accent link, no pill/padding/border — Aero has
 *                 no literal "link" button; nearest honest rendering for
 *                 call sites that want an inline text action, not a pill
 *
 * Focus ring is a 3px accent ring on every variant (README "Buttons": .28
 * alpha on filled variants, .15 on Secondary/Ghost's white/transparent
 * backgrounds) plus the variant's own border color where it has one.
 */
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 rounded-pill font-sans text-ui font-medium whitespace-nowrap transition-colors duration-fast ease-out outline-none select-none focus-visible:ring-[3px] disabled:pointer-events-none disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-accent text-white hover:bg-accent-press active:bg-[#3355C9] focus-visible:ring-accent/28 disabled:bg-surface-sunken disabled:text-ink-muted",
        outline:
          "border border-line bg-surface text-ink hover:bg-surface-sunken active:border-[#D6DCE6] active:bg-line focus-visible:border-accent focus-visible:ring-accent/15 disabled:border-line disabled:bg-surface disabled:text-ink-muted",
        secondary:
          "border border-line bg-surface text-ink hover:bg-surface-sunken active:border-[#D6DCE6] active:bg-line focus-visible:border-accent focus-visible:ring-accent/15 disabled:border-line disabled:bg-surface disabled:text-ink-muted",
        ghost:
          "bg-transparent text-accent hover:bg-accent-tint active:bg-[#DCE5FF] focus-visible:ring-accent/15 disabled:text-[#C7CBD4] dark:text-accent-on-dark",
        destructive:
          "bg-critical text-white hover:bg-[#D93A2F] active:bg-[#BE3126] focus-visible:ring-critical/28 disabled:bg-critical-tint disabled:text-[#E0A29C]",
        link: "rounded-none bg-transparent p-0! text-accent underline-offset-4 hover:underline disabled:text-ink-muted",
      },
      size: {
        default:
          "px-[22px] py-[12px] text-[14px] has-data-[icon=inline-end]:pr-[18px] has-data-[icon=inline-start]:pl-[18px]",
        xs: "px-3 py-[6px] text-[12px]",
        sm: "px-4 py-[9px] text-ui-sm",
        lg: "px-[26px] py-[14px] text-[15px]",
        icon: "size-11 p-0!",
        "icon-xs": "size-8 p-0!",
        "icon-sm": "size-9 p-0!",
        "icon-lg": "size-12 p-0!",
      },
    },
    compoundVariants: [
      {
        variant: "ghost",
        size: "default",
        class: "px-[18px]!",
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
