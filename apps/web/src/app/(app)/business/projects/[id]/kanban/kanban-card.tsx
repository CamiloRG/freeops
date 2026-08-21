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
import type { KanbanColumn, KanbanTask } from "./kanban-types";

function formatDueDate(value: string | null) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
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
 */
export function KanbanCard({
  task,
  otherColumns,
  onMove,
  onDelete,
}: {
  task: KanbanTask;
  otherColumns: KanbanColumn[];
  onMove: (columnId: string) => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: "task", task },
  });

  const dueDate = formatDueDate(task.dueDate);

  return (
    <Card
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "gap-0 border-border p-2.5 shadow-none",
        isDragging && "opacity-40"
      )}
    >
      <div className="flex items-start gap-1.5">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Drag to reorder "${task.title}"`}
          className="mt-0.5 flex size-6 shrink-0 cursor-grab touch-none items-center justify-center rounded text-muted-foreground hover:bg-muted active:cursor-grabbing"
        >
          <GripVertical className="size-4" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium break-words">{task.title}</div>
          {task.description && (
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{task.description}</p>
          )}
          {dueDate && <div className="mt-1.5 text-xs text-muted-foreground">Due {dueDate}</div>}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Move or delete "${task.title}"`}
              className="shrink-0"
            >
              <MoreVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Move to</DropdownMenuLabel>
            {otherColumns.length === 0 && (
              <DropdownMenuItem disabled>No other columns</DropdownMenuItem>
            )}
            {otherColumns.map((column) => (
              <DropdownMenuItem key={column.id} onSelect={() => onMove(column.id)}>
                {column.name}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={onDelete}>
              Delete task
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Card>
  );
}
