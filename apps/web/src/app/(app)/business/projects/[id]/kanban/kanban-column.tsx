"use client";

import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, MoreVertical, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { KanbanCard } from "./kanban-card";
import type { KanbanColumn as KanbanColumnData } from "./kanban-types";

export function KanbanColumn({
  column,
  otherColumns,
  onRename,
  onRequestDelete,
  onAddTask,
  onMoveTask,
  onDeleteTask,
}: {
  column: KanbanColumnData;
  otherColumns: KanbanColumnData[];
  onRename: (name: string) => void;
  onRequestDelete: () => void;
  onAddTask: (title: string) => void;
  onMoveTask: (taskId: string, columnId: string) => void;
  onDeleteTask: (taskId: string) => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(column.name);
  const [addingTask, setAddingTask] = useState(false);
  const [taskDraft, setTaskDraft] = useState("");

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: column.id,
    data: { type: "column", column },
  });

  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: column.id,
    data: { type: "column-droppable", columnId: column.id },
  });

  const taskIds = column.tasks.map((t) => t.id);

  function submitRename() {
    const trimmed = nameDraft.trim();
    if (trimmed && trimmed !== column.name) onRename(trimmed);
    else setNameDraft(column.name);
    setRenaming(false);
  }

  function submitTask() {
    const trimmed = taskDraft.trim();
    if (trimmed) onAddTask(trimmed);
    setTaskDraft("");
    setAddingTask(false);
  }

  return (
    <div
      ref={setNodeRef}
      data-column-name={column.name}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex w-72 shrink-0 flex-col rounded-xl border border-border bg-muted/40",
        isDragging && "opacity-50"
      )}
    >
      <div className="flex items-center gap-1.5 border-b border-border px-2.5 py-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Drag to reorder column "${column.name}"`}
          className="flex size-6 shrink-0 cursor-grab touch-none items-center justify-center rounded text-muted-foreground hover:bg-muted active:cursor-grabbing"
        >
          <GripVertical className="size-4" />
        </button>
        {renaming ? (
          <Input
            autoFocus
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={submitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitRename();
              if (e.key === "Escape") {
                setNameDraft(column.name);
                setRenaming(false);
              }
            }}
            className="h-7 flex-1"
          />
        ) : (
          <span className="flex-1 truncate text-sm font-semibold">{column.name}</span>
        )}
        <span className="shrink-0 text-xs text-muted-foreground">{column.tasks.length}</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Column actions for "${column.name}"`}
              className="shrink-0"
            >
              <MoreVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setRenaming(true)}>Rename</DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={onRequestDelete}>
              Delete column
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div
        ref={setDroppableRef}
        className={cn("min-h-24 flex-1 space-y-2 p-2", isOver && "bg-primary/5")}
      >
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {column.tasks.map((task) => (
            <KanbanCard
              key={task.id}
              task={task}
              otherColumns={otherColumns}
              onMove={(targetColumnId) => onMoveTask(task.id, targetColumnId)}
              onDelete={() => onDeleteTask(task.id)}
            />
          ))}
        </SortableContext>
        {column.tasks.length === 0 && !addingTask && (
          <button
            type="button"
            onClick={() => setAddingTask(true)}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-4 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground"
          >
            <Plus className="size-3.5" /> Add a task
          </button>
        )}
      </div>

      <div className="p-2 pt-0">
        {addingTask ? (
          <div className="space-y-1.5">
            <Input
              autoFocus
              placeholder="Task title"
              value={taskDraft}
              onChange={(e) => setTaskDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitTask();
                if (e.key === "Escape") {
                  setTaskDraft("");
                  setAddingTask(false);
                }
              }}
            />
            <div className="flex gap-1.5">
              <Button type="button" size="sm" onClick={submitTask}>
                Add
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setTaskDraft("");
                  setAddingTask(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          column.tasks.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full justify-start text-muted-foreground"
              onClick={() => setAddingTask(true)}
            >
              <Plus /> Add a task
            </Button>
          )
        )}
      </div>
    </div>
  );
}
