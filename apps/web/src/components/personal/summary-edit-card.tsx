"use client";

import type { ReactNode } from "react";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
   * Label for the toggle button while editing, shown in the card's own
   * header row. Pass `null` to hide it entirely — used by every
   * pixel-mocked screen (Profile/Banking/Tax), whose mock instead shows
   * the cancel action ("Descartar"/"Cancelar") as a plain tertiary button
   * inside the caller's own action row alongside "Guardar", not in this
   * header — see each form's own action row.
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
 *
 * "Ledger Quiet" restyle: `Card` is already a bare structural wrapper
 * (stage 1) — this component adds no box/border/background of its own, so
 * the collapsed summary and the edit form both read as a plain field grid
 * sitting directly in whitespace, matching the mocked Profile/Banking
 * screens. The "Edit" toggle button no longer carries a pencil icon — the
 * handoff's "Assets" section forbids icons outright.
 */
export function SummaryEditCard({
  title,
  description,
  editing,
  onToggleEdit,
  editLabel = "Editar",
  cancelLabel = "Cancelar",
  summary,
  children,
  className,
  contentClassName,
}: SummaryEditCardProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <div>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription className="mt-0.5">{description}</CardDescription>}
        </div>
        {/* `CardAction` is Card's own grid-column-2/justify-self-end slot
            (see card.tsx) — using it here (rather than a bare Button
            alongside the title div) is what keeps this header a real
            title-left/button-right row instead of the button stretching
            to the grid cell's full width, which is CSS Grid's default
            item-stretch behavior for a plain second child. */}
        {!editing ? (
          <CardAction>
            <Button type="button" variant="outline" size="sm" onClick={onToggleEdit} className="shrink-0">
              {editLabel}
            </Button>
          </CardAction>
        ) : (
          cancelLabel !== null && (
            <CardAction>
              <Button type="button" variant="ghost" size="sm" onClick={onToggleEdit} className="shrink-0">
                {cancelLabel}
              </Button>
            </CardAction>
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
