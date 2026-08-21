"use client"

import type { CSSProperties } from "react"
import { Toaster as Sonner, type ToasterProps } from "sonner"

/**
 * Toast notifications — new in Phase 5 for the kanban board's move-failure
 * rollback UX (app_spec.md § "UX & Frontend" → "Flow — Kanban board
 * interaction": "reserve toasts for errors... never a toast for routine
 * success"). Standard shadcn/ui-paired toast library, themed to this
 * codebase's Cloud Neutral design tokens (`--card`/`--foreground`/
 * `--border`/`--destructive`, see `globals.css`) rather than sonner's
 * default hardcoded palette. Mounted once in `(app)/layout.tsx`.
 */
function Toaster({ ...props }: ToasterProps) {
  return (
    <Sonner
      theme="system"
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--card)",
          "--normal-text": "var(--foreground)",
          "--normal-border": "var(--border)",
          "--error-bg": "var(--card)",
          "--error-text": "var(--destructive)",
          "--error-border": "var(--destructive)",
          "--success-bg": "var(--card)",
          "--success-text": "var(--success)",
          "--success-border": "var(--success)",
        } as CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
