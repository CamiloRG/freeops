import { cn } from "@/lib/utils"

/** README "Loading": skeleton bars, height 12px, background --line-soft,
 * no spinner, no radius. Callers set width (e.g. `w-[80%]`). */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("h-3 animate-pulse bg-line-soft", className)}
      {...props}
    />
  )
}

export { Skeleton }
