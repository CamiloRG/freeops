"use client";

import type { ReactNode } from "react";
import { Pencil } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface SummaryEditCardProps {
  title: ReactNode;
  description?: ReactNode;
  /** Whether the card is currently showing the edit form. */
  editing: boolean;
  /** Toggles between the collapsed summary and the edit form. */
  onToggleEdit: () => void;
  /** Label for the toggle button while collapsed. */
  editLabel?: string;
  /**
   * Label for the toggle button while editing. Pass `null` to hide it
   * entirely (e.g. a first-time form with nothing saved yet to cancel
   * back to).
   */
  cancelLabel?: string | null;
  /** Read-only collapsed view, shown when `editing` is false. */
  summary: ReactNode;
  /** Edit form, shown when `editing` is true. */
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

/**
 * The one real implementation of "collapsed read-only summary + Edit
 * button that toggles to an editable form" — the standing pattern for
 * every Personal-module section (Profile, Banking, Tax Info, Branding,
 * and Resume's Basics card) and the pattern future data-entry-heavy
 * modules (Business, Finance) should reach for by default. Pair with
 * `useEditToggle` for the editing boolean, and `SummaryGrid`/`SummaryField`
 * for the label/value grid used inside `summary`.
 */
export function SummaryEditCard({
  title,
  description,
  editing,
  onToggleEdit,
  editLabel = "Edit",
  cancelLabel = "Cancel",
  summary,
  children,
  className,
  contentClassName,
}: SummaryEditCardProps) {
  return (
    <Card className={className}>
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription className="mt-0.5">{description}</CardDescription>}
        </div>
        {!editing ? (
          <Button type="button" variant="outline" size="sm" onClick={onToggleEdit} className="shrink-0">
            <Pencil />
            {editLabel}
          </Button>
        ) : (
          cancelLabel !== null && (
            <Button type="button" variant="ghost" size="sm" onClick={onToggleEdit} className="shrink-0">
              {cancelLabel}
            </Button>
          )
        )}
      </CardHeader>
      <CardContent className={cn("pt-1", contentClassName)}>
        <div key={editing ? "edit" : "summary"} className="animate-in fade-in duration-200">
          {editing ? children : summary}
        </div>
      </CardContent>
    </Card>
  );
}
