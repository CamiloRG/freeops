"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, MoreVertical } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { displayColumnName, type KanbanColumn, type KanbanTask } from "./kanban-types";
import { LABEL_COLOR_TEXT_CLASS } from "./kanban-label-colors";
import type { KanbanLabelColor } from "@/lib/validation/business";

function formatDueDate(value: string | null) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("es-CO", { month: "short", day: "numeric" });
}

/**
 * A kanban task card. Draggable via `@dnd-kit/sortable` (mouse/touch,
 * progressive enhancement) AND exposes an always-visible "Move" menu — the
 * WCAG 2.2 AA mandatory non-drag alternative app_spec.md § "UX & Frontend"
 * → "6.3 Accessible non-drag alternative for kanban/CRM boards" requires
 * ("not only on hover, since hover doesn't exist on touch"). Both paths
 * call the exact same `onMove` handler, which fires the identical
 * `PATCH .../board/tasks/:taskId` mutation either way — never a second,
 * out-of-sync implementation.
 *
 * "Ledger Quiet" visual-boundary judgment call (stage 3, no mock covers a
 * kanban board): `Card` itself renders no box at all any more (stage 1's
 * restyle — pure structural wrapper). A dense, draggable multi-column
 * board reads poorly with whitespace-only separation between cards sitting
 * on the column's own `--surface-sunken` tone — there'd be nothing to
 * visually pick up/drop. Chosen option (a) from the two the stage
 * instructions offered: the same `1px --line` hairline-border exception
 * stage 1 already granted `Dialog`/`AlertDialog` ("functionally distinct
 * draggable/floating objects, not plain content sections") — applied here
 * to `bg-paper` (so a card visibly lifts off the column's sunken
 * background) with no radius/shadow, consistent with the rest of the
 * system. `KanbanColumn` gets the matching half of this: background-tone
 * separation only (`--surface-sunken`, no border), per rule 2's own
 * "depth comes only from background tone" language.
 */
export function KanbanCard({
  task,
  otherColumns,
  onMove,
  onDelete,
  onOpenDetail,
}: {
  task: KanbanTask;
  otherColumns: KanbanColumn[];
  onMove: (columnId: string) => void;
  onDelete: () => void;
  onOpenDetail?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: "task", task },
  });

  const dueDate = formatDueDate(task.dueDate);
  const labels = task.labels ?? [];
  const checklist = task.checklist ?? null;

  return (
    <Card
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "gap-0 border border-line bg-paper p-2.5",
        isDragging && "opacity-40"
      )}
    >
      <div className="flex items-start gap-1.5">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Arrastrar para reordenar "${task.title}"`}
          className="mt-0.5 flex size-6 shrink-0 cursor-grab touch-none items-center justify-center text-ink-muted transition-colors duration-fast ease-out hover:text-ink active:cursor-grabbing"
        >
          <GripVertical className="size-4" />
        </button>
        {/*
          Task Detail dialog trigger (kanban feature pack, item 4): the
          card's body/title area, a DISTINCT hit target from both the
          drag-handle button above and the "..." actions-menu button
          below — neither of those two's behavior changes at all. `onClick`
          only (no drag listeners here), so this never interferes with
          `@dnd-kit`'s pointer sensor on the handle.
        */}
        <button
          type="button"
          onClick={onOpenDetail}
          disabled={!onOpenDetail}
          className="min-w-0 flex-1 text-left disabled:cursor-default"
        >
          {labels.length > 0 && (
            <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
              {labels.map((label) => (
                <span
                  key={label.id}
                  className={cn(
                    "font-mono text-[10.5px] uppercase",
                    LABEL_COLOR_TEXT_CLASS[label.color as KanbanLabelColor] ?? "text-ink-soft"
                  )}
                >
                  {label.name}
                </span>
              ))}
            </div>
          )}
          <div className="text-body-sm font-medium break-words text-ink">
            {task.taskNumber != null && (
              <span className="mr-1 font-mono text-[11px] font-normal text-ink-muted">#{task.taskNumber}</span>
            )}
            {task.title}
          </div>
          {task.description && (
            <p className="mt-0.5 line-clamp-2 text-caption text-ink-muted">{task.description}</p>
          )}
          {(dueDate || checklist) && (
            <div className="mt-1.5 flex items-center gap-2 font-mono text-[11px] text-ink-muted">
              {dueDate && <span>Vence {dueDate}</span>}
              {checklist && (
                <span className={checklist.done === checklist.total ? "text-success" : "text-ink-muted"}>
                  {checklist.done}/{checklist.total}
                </span>
              )}
            </div>
          )}
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Mover o eliminar "${task.title}"`}
              className="shrink-0"
            >
              <MoreVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Mover a</DropdownMenuLabel>
            {otherColumns.length === 0 && (
              <DropdownMenuItem disabled>No hay otras columnas</DropdownMenuItem>
            )}
            {otherColumns.map((column) => (
              <DropdownMenuItem key={column.id} onSelect={() => onMove(column.id)}>
                {displayColumnName(column.name)}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={onDelete}>
              Eliminar tarea
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Card>
  );
}
