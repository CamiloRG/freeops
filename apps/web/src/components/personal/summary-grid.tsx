import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Label/value grid used inside `SummaryEditCard`'s collapsed `summary`
 * slot across Profile / Tax Info / Branding — a small muted label above a
 * medium-weight value, two columns on larger screens.
 */
export function SummaryGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grid gap-x-8 gap-y-4 sm:grid-cols-2", className)}>{children}</div>;
}

export function SummaryField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-medium">{value}</div>
    </div>
  );
}
