"use client";

import { useEffect, useState, type ReactNode } from "react";
import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";

export type AiProcessingStatus = "idle" | "processing" | "done" | "error";

export interface AiProcessingCardProps {
  status: AiProcessingStatus;
  /**
   * Staged copy shown one at a time while `status === "processing"` (e.g.
   * `["Leyendo tu documento…", "Extrayendo habilidades…", "Casi listo…"]`).
   * Each stage becomes one checklist row — done ones get a checkmark,
   * the current one a filled accent dot, the rest an empty ring. Reflects
   * the real rough order of work; never a fabricated fine-grained percent.
   */
  stages: string[];
  /** How often to advance to the next stage while processing, in ms — a
   * heartbeat for genuinely-unknown-duration work, not a countdown to a
   * scripted "done"; the caller alone decides when `status` resolves. */
  stageIntervalMs?: number;
  /** File name shown in the processing card's header row, if known. */
  fileName?: string;
  /** Content shown while idle — title/description/CTA, caller-defined. */
  idle: ReactNode;
  /** Content shown once `status === "done"`. */
  done: ReactNode;
  /** Content shown if `status === "error"`. Defaults to a generic message. */
  error?: ReactNode;
  className?: string;
}

const DEFAULT_STAGE_INTERVAL_MS = 1300;

/**
 * Reusable "AI is working" status display — generic (status/stages/idle/
 * done/error props, no resume-specific field names) so any AI-driven
 * operation can reuse it.
 *
 * "Aero" restyle: a bordered, accent-ringed card with a PDF-icon tile,
 * file name + live stage text, a big percentage (derived honestly from
 * `stageIndex / stages.length`, never fabricated finer than the real
 * stage count implies), and a checklist of the stages below — matching
 * the new Personal-module mocks' upload/processing pattern. Idle and done
 * stay fully caller-defined content (this component does not know what
 * "done" means for a given feature).
 *
 * This component has NO internal notion of when work finishes — `status`
 * is fully controlled by the caller, who flips it to `"processing"` the
 * instant the real request starts and to `"done"`/`"error"` only when
 * that request actually resolves. The stage text/checklist/percentage
 * advance on their own clock (`stageIntervalMs`) purely as a "still
 * genuinely working" heartbeat, capping at the final stage rather than
 * looping or stalling past it.
 */
export function AiProcessingCard({
  status,
  stages,
  stageIntervalMs = DEFAULT_STAGE_INTERVAL_MS,
  fileName,
  idle,
  done,
  error,
  className,
}: AiProcessingCardProps) {
  const [stageIndex, setStageIndex] = useState(0);

  // Reset the stage clock the instant a fresh "processing" run starts —
  // React's sanctioned "adjust state when a prop changes" pattern (set
  // state directly during render, not in an effect).
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

  if (status === "idle") return <>{idle}</>;
  if (status === "done") return <>{done}</>;

  if (status === "error") {
    return (
      <>{error ?? <p className="text-caption text-critical-ink">Algo salió mal — inténtalo de nuevo.</p>}</>
    );
  }

  const stageText = stages[Math.min(stageIndex, Math.max(stages.length - 1, 0))] ?? "";
  const percent = stages.length > 0 ? Math.round(((stageIndex + 1) / stages.length) * 100) : 0;

  return (
    <div className={cn("rounded-card border border-accent bg-surface p-5", className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-accent-tint text-accent-press">
            <FileText className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            {fileName && <div className="truncate text-body-sm font-medium text-ink">{fileName}</div>}
            <div key={stageIndex} className="animate-in fade-in text-[13px] text-accent-press duration-300">
              {stageText}
            </div>
          </div>
        </div>
        <div className="shrink-0 text-h3 text-ink">{percent}%</div>
      </div>

      <div className="mt-4 flex flex-col gap-2 border-t border-line-soft pt-4">
        {stages.map((stage, i) => {
          const stageStatus = i < stageIndex ? "done" : i === stageIndex ? "current" : "pending";
          return (
            <div key={stage} className="flex items-center gap-2.5 text-[13px]">
              {stageStatus === "done" ? (
                <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-positive text-white">
                  <svg viewBox="0 0 12 12" className="size-2.5" fill="none" aria-hidden="true">
                    <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              ) : stageStatus === "current" ? (
                <span className="size-4 shrink-0 rounded-full bg-accent" aria-hidden="true" />
              ) : (
                <span className="size-4 shrink-0 rounded-full border border-line" aria-hidden="true" />
              )}
              <span className={cn(stageStatus === "pending" ? "text-ink-muted" : "font-medium text-ink")}>
                {stage}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
