"use client";

import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type AiProcessingStatus = "idle" | "processing" | "done" | "error";

export interface AiProcessingCardProps {
  status: AiProcessingStatus;
  /**
   * Staged copy cycled through while `status === "processing"`, in order
   * (e.g. `["Reading your document…", "Extracting skills & experience…",
   * "Almost done…"]`). Reflects the real rough order of work — never a
   * fabricated percentage, since there's no real granular progress to
   * report honestly. The last stage is held once reached, so a
   * longer-than-expected request never implies something false.
   */
  stages: string[];
  /**
   * How often to advance to the next stage while processing, in ms. This
   * is a time-based heuristic for genuinely-unknown-duration work, NOT a
   * countdown to a scripted "done" — the caller alone decides when
   * `status` becomes `"done"` or `"error"`, driven by the real request's
   * actual resolution.
   */
  stageIntervalMs?: number;
  /** Content shown while idle — title/description/CTA, fully caller-defined, plain text (no icon). */
  idle: ReactNode;
  /** Content shown once `status === "done"`, plain text (no icon). */
  done: ReactNode;
  /** Content shown if `status === "error"`, plain text (no icon). Defaults to a generic message. */
  error?: ReactNode;
  className?: string;
}

const DEFAULT_STAGE_INTERVAL_MS = 1300;
const PROGRESS_SEGMENTS = 4;

/**
 * Reusable "AI is working" status display — introduced for resume import
 * but deliberately generic (status/stages/idle/done/error props, no
 * resume-specific field names) so any future AI-driven operation in the
 * app can reuse it rather than rebuilding this pattern.
 *
 * "Ledger Quiet" restyle: the original pulsing colored file-icon / success
 * checkmark / destructive icon violated the handoff's explicit "no
 * illustrations, icons, or images" rule (README "Assets"). Idle/done/error
 * now render as plain mono caption text with no icon slot content — just
 * whatever the caller passes. The "processing" state no longer pulses a
 * ring icon; it reuses the handoff's own "Progress (completeness)"
 * component spec instead (4 segments, `height:4px`, `gap:3px`, filled
 * `--accent`, empty `--line`) — segments fill as the *real* staged-copy
 * clock below advances, not a fabricated percentage.
 *
 * Unlike the design mockup this was ported from (which drove the demo off
 * a fixed 4.2s timer), this component has NO internal notion of when work
 * finishes — `status` is fully controlled by the caller, who should flip
 * it to `"processing"` the instant the real request starts and to
 * `"done"`/`"error"` only when that request actually resolves. The stage
 * text/segment fill still advance on their own clock (`stageIntervalMs`)
 * purely as a "we're still genuinely working" heartbeat while the real
 * response is pending, capping at the final stage/full segment count
 * rather than looping or stalling — this is the exact same real timer as
 * before, only its visual is now a segmented bar instead of a spinner.
 */
export function AiProcessingCard({
  status,
  stages,
  stageIntervalMs = DEFAULT_STAGE_INTERVAL_MS,
  idle,
  done,
  error,
  className,
}: AiProcessingCardProps) {
  const [stageIndex, setStageIndex] = useState(0);

  // Reset the stage clock the instant a fresh "processing" run starts —
  // React's sanctioned "adjust state when a prop changes" pattern (set
  // state directly during render, not in an effect) rather than an effect
  // that would fire a render-triggering setState synchronously on mount.
  const [prevStatus, setPrevStatus] = useState(status);
  if (status !== prevStatus) {
    setPrevStatus(status);
    if (status === "processing") setStageIndex(0);
  }

  useEffect(() => {
    if (status !== "processing") return;
    const timer = setInterval(() => {
      setStageIndex((i) => Math.min(i + 1, Math.max(stages.length - 1, 0)));
    }, stageIntervalMs);
    return () => clearInterval(timer);
  }, [status, stageIntervalMs, stages.length]);

  const stageText = stages[Math.min(stageIndex, Math.max(stages.length - 1, 0))] ?? "";

  // Map the real stage clock (however many logical stages the caller
  // defined) onto the spec's fixed 4-segment display — still driven by the
  // same real interval/request lifecycle, just visualized more coarsely.
  const progressFraction = stages.length > 0 ? (stageIndex + 1) / stages.length : 0;
  const filledSegments = Math.min(PROGRESS_SEGMENTS, Math.max(1, Math.round(progressFraction * PROGRESS_SEGMENTS)));

  return (
    <div className={cn("flex items-center gap-4", className)}>
      {status === "idle" && idle}

      {status === "processing" && (
        <div className="min-w-0 flex-1">
          <div key={stageIndex} className="animate-in fade-in slide-in-from-bottom-0.5 text-body text-ink duration-300">
            {stageText}
          </div>
          <div className="mt-2 flex max-w-56 gap-[3px]" role="progressbar" aria-label={stageText}>
            {Array.from({ length: PROGRESS_SEGMENTS }, (_, i) => (
              <span
                key={i}
                aria-hidden
                className={cn("h-1 flex-1 transition-colors duration-fast ease-out", i < filledSegments ? "bg-accent" : "bg-line")}
              />
            ))}
          </div>
        </div>
      )}

      {status === "done" && <div className="min-w-0 flex-1 animate-in fade-in duration-300">{done}</div>}

      {status === "error" && (
        <div className="min-w-0 flex-1">
          {error ?? <p className="text-caption text-danger">Algo salió mal — inténtalo de nuevo.</p>}
        </div>
      )}
    </div>
  );
}
