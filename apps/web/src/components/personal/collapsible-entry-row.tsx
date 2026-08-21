"use client";

import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CollapsibleEntryRowProps {
  expanded: boolean;
  onToggle: () => void;
  /** Collapsed row content — title/company/dates, laid out by the caller. */
  summary: ReactNode;
  /** Full edit form for this one entry, shown when `expanded`. */
  children: ReactNode;
  className?: string;
}

/**
 * A single collapsed-summary row that expands in place to its full edit
 * form — Resume's Experience-entry pattern. Pair with `useSingleOpen` in
 * the parent list for accordion (one-open-at-a-time) behavior.
 */
export function CollapsibleEntryRow({ expanded, onToggle, summary, children, className }: CollapsibleEntryRowProps) {
  return (
    <div className={className}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted"
      >
        <ChevronRight
          aria-hidden
          className={cn("size-4 shrink-0 text-muted-foreground transition-transform duration-200", expanded && "rotate-90")}
        />
        <div className="min-w-0 flex-1">{summary}</div>
      </button>
      {expanded && (
        <div className="animate-in fade-in slide-in-from-top-1 space-y-3 py-1 pr-3 pb-5 pl-10 duration-200">
          {children}
        </div>
      )}
    </div>
  );
}
