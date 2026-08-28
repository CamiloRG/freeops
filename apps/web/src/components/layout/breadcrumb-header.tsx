import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

/**
 * The mono breadcrumb + top-right status line pattern that sits above tabs
 * in every app content area — mirrors Aero's screen 3 ("Run detail")
 * header block: "breadcrumb → title + status pill + action pills → tab
 * row." `status` accepts any node so callers can pass a plain string or
 * `<SaveStatusLine status={...} />` once a form is wired to
 * `useSaveStatus()`.
 */
export function BreadcrumbHeader({
  breadcrumb,
  status,
  className,
}: {
  breadcrumb: string;
  status?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between", className)}>
      <div className="font-mono text-label-mono tracking-[0.14em] text-ink-muted uppercase">
        {breadcrumb}
      </div>
      {status ? <div className="font-mono text-[11px]">{status}</div> : null}
    </div>
  )
}
