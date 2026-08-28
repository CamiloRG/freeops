import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * "Aero" card (README "Cards & tiles"): radius 20, `1px solid --line`, bg
 * `--surface`, padding 20–30 — a real bordered surface again, unlike
 * Ledger Quiet's whitespace-only invisible wrapper (README rule 4: "depth
 * by border first, shadow rarely" — a card's border IS its depth cue, no
 * shadow needed at rest). `size="sm"` tightens padding for denser lists.
 * Every sub-component export is kept (same names, same tree shape) so
 * every existing screen that imports the whole family keeps working.
 */
function Card({
  className,
  size = "default",
  ...props
}: React.ComponentProps<"div"> & { size?: "default" | "sm" }) {
  return (
    <div
      data-slot="card"
      data-size={size}
      className={cn(
        "group/card flex flex-col gap-(--card-spacing) rounded-card border border-line bg-surface p-[26px] [--card-spacing:--spacing(4)] data-[size=sm]:p-[18px] data-[size=sm]:[--card-spacing:--spacing(3)]",
        className
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "group/card-header @container/card-header grid auto-rows-min items-start gap-1 has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto]",
        className
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn(
        "font-sans text-h3 text-ink group-data-[size=sm]/card:text-body",
        className
      )}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-body-sm text-ink-soft", className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="card-content" className={cn(className)} {...props} />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center gap-4", className)}
      {...props}
    />
  )
}

/**
 * Nested well inside a card (README "Cards & tiles": "Nested well inside a
 * card: radius 14, bg --surface-sunken, no border") — for a sub-block that
 * needs visual separation without another full card border.
 */
function CardWell({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-well"
      className={cn("rounded-tile bg-surface-sunken p-4", className)}
      {...props}
    />
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
  CardWell,
}
