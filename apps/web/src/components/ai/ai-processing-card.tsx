"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Check, FileText } from "lucide-react";
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
  /** Content shown next to the idle icon — title/description/CTA, fully caller-defined. */
  idle: ReactNode;
  /** Content shown next to the success icon once `status === "done"`. */
  done: ReactNode;
  /** Content shown next to the error icon once `status === "error"`. Defaults to a generic message. */
  error?: ReactNode;
  className?: string;
}

const DEFAULT_STAGE_INTERVAL_MS = 1300;

/**
 * Reusable "AI is working" status display — pulsing icon, sweeping
 * progress bar, staged cycling copy, success checkmark. Introduced for
 * resume import but deliberately generic (status/stages/idle/done/error
 * props, no resume-specific field names) so any future AI-driven
 * operation in the app can reuse it rather than rebuilding this pattern.
 *
 * Unlike the design mockup this was ported from (which drove the demo off
 * a fixed 4.2s timer), this component has NO internal notion of when work
 * finishes — `status` is fully controlled by the caller, who should flip
 * it to `"processing"` the instant the real request starts and to
 * `"done"`/`"error"` only when that request actually resolves. The stage
 * text still advances on its own clock (`stageIntervalMs`) purely as a
 * "we're still genuinely working" heartbeat while the real response is
 * pending, capping at the final stage rather than looping or stalling.
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

  return (
    <div className={cn("flex items-center gap-4", className)}>
      {status === "idle" && (
        <>
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted">
            <FileText className="size-[22px] text-muted-foreground" strokeWidth={1.8} />
          </div>
          {idle}
        </>
      )}

      {status === "processing" && (
        <>
          <div className="relative flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <span
              aria-hidden
              className="absolute inset-0 rounded-xl border-[1.5px] border-primary animate-[ai-processing-pulse_1.6s_ease-in-out_infinite]"
            />
            <FileText className="size-[22px] text-primary" strokeWidth={1.8} />
          </div>
          <div className="min-w-0 flex-1">
            <div key={stageIndex} className="animate-in fade-in slide-in-from-bottom-0.5 text-sm font-semibold duration-300">
              {stageText}
            </div>
            <div className="relative mt-2 h-[3px] w-full max-w-56 overflow-hidden rounded-full bg-muted">
              <span
                aria-hidden
                className="absolute inset-y-0 left-0 w-[35%] rounded-full bg-primary animate-[ai-processing-sweep_1.3s_ease-in-out_infinite]"
              />
            </div>
          </div>
        </>
      )}

      {status === "done" && (
        <>
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-success/15">
            <Check className="size-5 text-success" strokeWidth={2.4} />
          </div>
          <div className="min-w-0 flex-1 animate-in fade-in duration-300">{done}</div>
        </>
      )}

      {status === "error" && (
        <>
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-destructive/10">
            <FileText className="size-[22px] text-destructive" strokeWidth={1.8} />
          </div>
          <div className="min-w-0 flex-1">
            {error ?? <p className="text-sm text-destructive">Something went wrong — try again.</p>}
          </div>
        </>
      )}
    </div>
  );
}
