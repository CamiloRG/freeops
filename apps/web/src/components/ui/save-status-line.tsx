import { cn } from "@/lib/utils"
import { formatSavedAt, type SaveStatusValue } from "@/hooks/use-save-status"

/**
 * The top-right mono status line paired with `BreadcrumbHeader` (README
 * "Save feedback": "On save, the top-right mono status line changes to
 * `guardado HH:MM`" / "Interactions & behavior" → "Save"). Idle renders
 * nothing; saving shows a quiet in-progress label; saved shows
 * `guardado HH:MM` in `--ink-muted`; error renders nothing here — errors
 * are the inline-notice's job, not this line's (see `InlineNotice`).
 */
export function SaveStatusLine({
  status,
  className,
}: {
  status: SaveStatusValue;
  className?: string;
}) {
  if (status.status === "saving") {
    return (
      <span
        className={cn("font-mono text-[11px] text-ink-muted", className)}
      >
        guardando…
      </span>
    );
  }

  if (status.status === "saved") {
    return (
      <span
        className={cn("font-mono text-[11px] text-ink-muted", className)}
      >
        {formatSavedAt(status.savedAt)}
      </span>
    );
  }

  return null;
}
