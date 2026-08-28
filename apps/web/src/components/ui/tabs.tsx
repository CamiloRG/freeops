"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Tabs as TabsPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn(
        "group/tabs flex gap-2 data-horizontal:flex-col",
        className
      )}
      {...props}
    />
  )
}

/**
 * "Aero" tabs (README "Navigation" → "Tabs"): 13px, `padding-bottom 9px`,
 * gap 26; active = `--ink` 500 + `2px solid --accent` underline, rest
 * `--ink-muted`. "Filter chips inside cards are pills instead" — that's
 * `variant="pill"` here, `--accent-tint` when active.
 */
const tabsListVariants = cva(
  "group/tabs-list inline-flex w-fit items-center group-data-horizontal/tabs:h-auto group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col",
  {
    variants: {
      variant: {
        default: "gap-[26px] border-b border-line-soft bg-transparent",
        pill: "gap-2 rounded-pill bg-surface-sunken p-1",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function TabsList({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> &
  VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "relative inline-flex items-center justify-center gap-1.5 pb-[9px] text-[13px] whitespace-nowrap text-ink-muted transition-colors duration-fast ease-out group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start hover:text-ink focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50 data-active:font-medium data-active:text-ink [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        "after:absolute after:inset-x-0 after:-bottom-px after:h-[2px] after:bg-accent after:opacity-0 after:transition-opacity group-data-vertical/tabs:after:inset-y-0 group-data-vertical/tabs:after:-right-1 group-data-vertical/tabs:after:w-0.5 data-active:after:opacity-100",
        "group-data-[variant=pill]/tabs-list:rounded-pill group-data-[variant=pill]/tabs-list:px-[13px] group-data-[variant=pill]/tabs-list:py-[6px] group-data-[variant=pill]/tabs-list:pb-[6px] group-data-[variant=pill]/tabs-list:after:hidden group-data-[variant=pill]/tabs-list:data-active:bg-accent-tint group-data-[variant=pill]/tabs-list:data-active:text-ink",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 text-body-sm outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
