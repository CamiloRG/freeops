import { cn } from "@/lib/utils"

/** README "Empty & loading" → "Loading": skeleton bars, height 14, radius
 * pill, bg --surface-sunken, no spinner. Callers set width (e.g. `w-[80%]`). */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("h-[14px] animate-pulse rounded-pill bg-surface-sunken", className)}
      {...props}
    />
  )
}

export { Skeleton }
