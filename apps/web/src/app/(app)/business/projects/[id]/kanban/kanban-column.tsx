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
import { displayColumnName, type KanbanColumn as KanbanColumnData, type KanbanTask } from "./kanban-types";

export function KanbanColumn({
  column,
  visibleTasks,
  otherColumns,
  onRename,
  onRequestDelete,
  onAddTask,
  onMoveTask,
  onDeleteTask,
  onOpenTaskDetail,
  onSetWipLimit,
}: {
  column: KanbanColumnData;
  /**
   * Kanban feature pack, items 5/6 (sort/filter): the tasks to actually
   * RENDER, already filtered/re-sorted for display by the parent —
   * defaults to `column.tasks` (this column's true, unfiltered list) when
   * no filter/sort is active, so behavior is unchanged from before this
   * feature pack. `column.tasks.length` (the TRUE count) is still what
   * drives the WIP-limit header display below — a filter must never make
   * a column look like it has room it doesn't actually have.
   */
  visibleTasks?: KanbanTask[];
  otherColumns: KanbanColumnData[];
  onRename: (name: string) => void;
  onRequestDelete: () => void;
  onAddTask: (title: string) => void;
  onMoveTask: (taskId: string, columnId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onOpenTaskDetail?: (taskId: string) => void;
  onSetWipLimit: (limit: number | null) => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(column.name);
  const [addingTask, setAddingTask] = useState(false);
  const [taskDraft, setTaskDraft] = useState("");
  // Kanban feature pack, item 1 (WIP limits): a small inline input inside
  // the column header, toggled from the "..." actions menu's new "Límite
  // de tareas" item — reuses the existing column-header space rather than
  // introducing a new popover primitive this codebase doesn't have yet.
  const [settingLimit, setSettingLimit] = useState(false);
  const [limitDraft, setLimitDraft] = useState(column.wipLimit != null ? String(column.wipLimit) : "");

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: column.id,
    data: { type: "column", column },
  });

  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: column.id,
    data: { type: "column-droppable", columnId: column.id },
  });

  const tasksToRender = visibleTasks ?? column.tasks;
  const taskIds = tasksToRender.map((t) => t.id);

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

  function submitLimit() {
    const trimmed = limitDraft.trim();
    setSettingLimit(false);
    if (!trimmed) {
      if (column.wipLimit != null) onSetWipLimit(null);
      return;
    }
    const parsed = Number.parseInt(trimmed, 10);
    if (Number.isFinite(parsed) && parsed >= 1 && parsed !== column.wipLimit) {
      onSetWipLimit(parsed);
    }
  }

  const atOrOverLimit = column.wipLimit != null && column.tasks.length >= column.wipLimit;

  return (
    <div
      ref={setNodeRef}
      data-column-name={column.name}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex w-72 shrink-0 flex-col bg-surface-sunken",
        isDragging && "opacity-50"
      )}
    >
      <div className="flex items-center gap-1.5 px-3 py-2.5">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Arrastrar para reordenar la columna "${column.name}"`}
          className="flex size-6 shrink-0 cursor-grab touch-none items-center justify-center text-ink-muted transition-colors duration-fast ease-out hover:text-ink active:cursor-grabbing"
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
          <span className="flex-1 truncate font-mono text-label-mono tracking-[0.06em] text-ink uppercase">
            {displayColumnName(column.name)}
          </span>
        )}
        {/*
          WIP-limit count slot (kanban feature pack, item 1): plain mono
          text, no pill/chip — turns `--danger` at/over the limit so the
          constraint is visible before a drag/add is even attempted, not
          only after a rejection.
        */}
        <span
          className={cn(
            "shrink-0 font-mono text-[11px]",
            atOrOverLimit ? "text-danger" : "text-ink-muted"
          )}
        >
          {column.tasks.length}
          {column.wipLimit != null && ` / ${column.wipLimit}`}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Acciones de columna para "${column.name}"`}
              className="shrink-0"
            >
              <MoreVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setRenaming(true)}>Renombrar</DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                setLimitDraft(column.wipLimit != null ? String(column.wipLimit) : "");
                setSettingLimit(true);
              }}
            >
              Límite de tareas
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={onRequestDelete}>
              Eliminar columna
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {settingLimit && (
        <div className="flex items-center gap-1.5 px-3 pb-2.5">
          <Input
            autoFocus
            type="number"
            min={1}
            placeholder="Sin límite"
            value={limitDraft}
            onChange={(e) => setLimitDraft(e.target.value)}
            onBlur={submitLimit}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitLimit();
              if (e.key === "Escape") {
                setLimitDraft(column.wipLimit != null ? String(column.wipLimit) : "");
                setSettingLimit(false);
              }
            }}
            className="h-7 flex-1"
          />
        </div>
      )}

      <div
        ref={setDroppableRef}
        className={cn("min-h-24 flex-1 space-y-2 p-2", isOver && "bg-accent-50")}
      >
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {tasksToRender.map((task) => (
            <KanbanCard
              key={task.id}
              task={task}
              otherColumns={otherColumns}
              onMove={(targetColumnId) => onMoveTask(task.id, targetColumnId)}
              onDelete={() => onDeleteTask(task.id)}
              onOpenDetail={onOpenTaskDetail ? () => onOpenTaskDetail(task.id) : undefined}
            />
          ))}
        </SortableContext>
        {/* Per item 6's own spec: a column with zero VISIBLE (filtered) tasks shows the normal empty-state, not an invented "no results" message. */}
        {tasksToRender.length === 0 && !addingTask && (
          <button
            type="button"
            onClick={() => setAddingTask(true)}
            className="flex w-full items-center justify-center gap-1.5 py-4 font-mono text-[11px] text-ink-muted transition-colors duration-fast ease-out hover:text-ink"
          >
            <Plus className="size-3.5" /> Agregar una tarea
          </button>
        )}
      </div>

      <div className="p-2 pt-0">
        {addingTask ? (
          <div className="space-y-1.5">
            <Input
              autoFocus
              placeholder="Título de la tarea"
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
                Agregar
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
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          // Matches the empty-state button above on `tasksToRender` (not
          // the true `column.tasks` count) so a fully-filtered-out column
          // shows exactly one "add a task" affordance, not both at once.
          tasksToRender.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full justify-start text-ink-soft"
              onClick={() => setAddingTask(true)}
            >
              <Plus /> Agregar una tarea
            </Button>
          )
        )}
      </div>
    </div>
  );
}
