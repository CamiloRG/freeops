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
 *
 * "Ledger Quiet" restyle: no radius, no box — row separation is pure
 * whitespace/padding, hover tints to `--surface-sunken` (the handoff's
 * "Tables / record lists" row-hover convention, reused here since this is
 * effectively a one-row-per-entry list). The chevron is the one functional,
 * non-decorative glyph this system permits (README "Assets": "a 1.5px-
 * stroke line set at 16px in `--ink-soft`, never filled or colored") — kept
 * plain and thin, not filled/colored.
 */
export function CollapsibleEntryRow({ expanded, onToggle, summary, children, className }: CollapsibleEntryRowProps) {
  return (
    <div className={className}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center gap-3 px-1 py-[14px] text-left transition-colors duration-fast ease-out hover:bg-surface-sunken"
      >
        <ChevronRight
          aria-hidden
          strokeWidth={1.5}
          className={cn("size-4 shrink-0 text-ink-soft transition-transform duration-fast ease-out", expanded && "rotate-90")}
        />
        <div className="min-w-0 flex-1">{summary}</div>
      </button>
      {expanded && (
        <div className="animate-in fade-in slide-in-from-top-1 space-y-4 px-1 pt-1 pb-6 pl-8 duration-200">
          {children}
        </div>
      )}
    </div>
  );
}
