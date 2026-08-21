"use client";

import { useEffect, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, horizontalListSortingStrategy, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { KanbanColumn } from "./kanban-column";
import { KanbanCard } from "./kanban-card";
import type { KanbanColumn as KanbanColumnData, KanbanTask } from "./kanban-types";

const MOVE_ERROR = "Couldn't move task — check your connection and try again.";

function ColumnSkeleton() {
  return (
    <div className="flex w-72 shrink-0 flex-col gap-2 rounded-xl border border-border bg-muted/40 p-2.5">
      <Skeleton className="h-5 w-24" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  );
}

export function KanbanBoard({ projectId }: { projectId: string }) {
  const [state, setState] = useState<"loading" | "error" | "ready">("loading");
  const [boardId, setBoardId] = useState<string | null>(null);
  const [columns, setColumns] = useState<KanbanColumnData[]>([]);
  const [activeTask, setActiveTask] = useState<KanbanTask | null>(null);
  const [activeColumn, setActiveColumn] = useState<KanbanColumnData | null>(null);

  const [addColumnOpen, setAddColumnOpen] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");

  const [deleteColumnTarget, setDeleteColumnTarget] = useState<KanbanColumnData | null>(null);
  const [moveTasksTo, setMoveTasksTo] = useState<string>("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Pure fetch, no `setState` calls inside — the effect below applies the
  // result from a `.then()` callback (React's sanctioned "subscribe to an
  // external system, setState when it resolves" shape) rather than
  // synchronously in the effect body, per this codebase's
  // `react-hooks/set-state-in-effect` lint rule (see the ADR's PATTERNS
  // entry on `AiProcessingCard` for the same rule hit previously).
  async function fetchBoard(id: string) {
    const res = await fetch(`/api/v1/projects/${id}/board`);
    const body = await res.json().catch(() => null);
    if (!res.ok || !body) return null;
    return body as { id: string; columns: KanbanColumnData[] };
  }

  useEffect(() => {
    let cancelled = false;
    fetchBoard(projectId).then((result) => {
      if (cancelled) return;
      if (!result) {
        setState("error");
        return;
      }
      setBoardId(result.id);
      setColumns(result.columns);
      setState("ready");
    });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  function retryLoadBoard() {
    setState("loading");
    fetchBoard(projectId).then((result) => {
      if (!result) {
        setState("error");
        return;
      }
      setBoardId(result.id);
      setColumns(result.columns);
      setState("ready");
    });
  }

  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current;
    if (data?.type === "task") setActiveTask(data.task as KanbanTask);
    if (data?.type === "column") setActiveColumn(data.column as KanbanColumnData);
  }

  async function persistColumnMove(columnId: string, position: number, rollback: KanbanColumnData[]) {
    const res = await fetch(`/api/v1/board/columns/${columnId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ position }),
    });
    if (!res.ok) {
      setColumns(rollback);
      toast.error("Couldn't reorder columns — check your connection and try again.");
    }
  }

  async function persistTaskMove(taskId: string, columnId: string, position: number, rollback: KanbanColumnData[]) {
    const res = await fetch(`/api/v1/board/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ columnId, position }),
    });
    if (!res.ok) {
      setColumns(rollback);
      toast.error(MOVE_ERROR);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveTask(null);
    setActiveColumn(null);
    if (!over) return;

    const activeType = active.data.current?.type;

    if (activeType === "column") {
      if (active.id === over.id) return;
      const oldIndex = columns.findIndex((c) => c.id === active.id);
      const newIndex = columns.findIndex((c) => c.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;
      const rollback = columns;
      const reordered = arrayMove(columns, oldIndex, newIndex).map((c, i) => ({ ...c, position: i }));
      setColumns(reordered);
      persistColumnMove(active.id as string, newIndex, rollback);
      return;
    }

    if (activeType === "task") {
      const taskId = active.id as string;
      const sourceColumn = columns.find((c) => c.tasks.some((t) => t.id === taskId));
      if (!sourceColumn) return;

      let destColumnId: string;
      let destIndex: number;
      const overType = over.data.current?.type;
      if (overType === "task") {
        const destColumn = columns.find((c) => c.tasks.some((t) => t.id === over.id));
        if (!destColumn) return;
        destColumnId = destColumn.id;
        destIndex = destColumn.tasks.findIndex((t) => t.id === over.id);
      } else if (overType === "column-droppable" || overType === "column") {
        destColumnId = (over.data.current?.columnId as string) ?? (over.id as string);
        const destColumn = columns.find((c) => c.id === destColumnId);
        destIndex = destColumn ? destColumn.tasks.length : 0;
      } else {
        return;
      }

      const oldIndex = sourceColumn.tasks.findIndex((t) => t.id === taskId);
      if (destColumnId === sourceColumn.id && oldIndex === destIndex) return;

      applyTaskMove(taskId, sourceColumn.id, destColumnId, destIndex);
    }
  }

  /** Shared by drag-end AND the accessible "Move to" menu — identical optimistic-update + rollback path either way. */
  function applyTaskMove(taskId: string, sourceColumnId: string, destColumnId: string, destIndex: number) {
    const rollback = columns;
    const next = columns.map((c) => ({ ...c, tasks: [...c.tasks] }));
    const srcCol = next.find((c) => c.id === sourceColumnId)!;
    const taskIndexInSrc = srcCol.tasks.findIndex((t) => t.id === taskId);
    const [movedTask] = srcCol.tasks.splice(taskIndexInSrc, 1);
    const dstCol = next.find((c) => c.id === destColumnId)!;
    let insertIndex = destIndex;
    if (srcCol.id === dstCol.id && taskIndexInSrc < destIndex) insertIndex -= 1;
    insertIndex = Math.min(Math.max(insertIndex, 0), dstCol.tasks.length);
    dstCol.tasks.splice(insertIndex, 0, movedTask);
    srcCol.tasks = srcCol.tasks.map((t, i) => ({ ...t, position: i }));
    dstCol.tasks = dstCol.tasks.map((t, i) => ({ ...t, position: i }));

    setColumns(next);
    persistTaskMove(taskId, destColumnId, insertIndex, rollback);
  }

  function handleMoveViaMenu(taskId: string, targetColumnId: string) {
    const sourceColumn = columns.find((c) => c.tasks.some((t) => t.id === taskId));
    if (!sourceColumn) return;
    const destColumn = columns.find((c) => c.id === targetColumnId);
    const destIndex = destColumn ? destColumn.tasks.length : 0;
    applyTaskMove(taskId, sourceColumn.id, targetColumnId, destIndex);
  }

  async function handleAddTask(columnId: string, title: string) {
    const rollback = columns;
    const tempId = `temp-${crypto.randomUUID()}`;
    const optimisticTask: KanbanTask = { id: tempId, title, description: null, position: 9999, dueDate: null };
    setColumns((cols) =>
      cols.map((c) => (c.id === columnId ? { ...c, tasks: [...c.tasks, optimisticTask] } : c))
    );
    const res = await fetch(`/api/v1/board/columns/${columnId}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body) {
      setColumns(rollback);
      toast.error("Couldn't add that task — try again.");
      return;
    }
    setColumns((cols) =>
      cols.map((c) =>
        c.id === columnId ? { ...c, tasks: c.tasks.map((t) => (t.id === tempId ? { ...body } : t)) } : c
      )
    );
  }

  async function handleDeleteTask(taskId: string) {
    const rollback = columns;
    setColumns((cols) => cols.map((c) => ({ ...c, tasks: c.tasks.filter((t) => t.id !== taskId) })));
    const res = await fetch(`/api/v1/board/tasks/${taskId}`, { method: "DELETE" });
    if (!res.ok && res.status !== 204) {
      setColumns(rollback);
      toast.error("Couldn't delete that task — try again.");
    }
  }

  async function handleAddColumn() {
    const name = newColumnName.trim();
    if (!name) return;
    setAddColumnOpen(false);
    setNewColumnName("");
    const res = await fetch(`/api/v1/projects/${projectId}/board/columns`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body) {
      toast.error("Couldn't add that column — try again.");
      return;
    }
    setColumns((cols) => [...cols, { ...body, tasks: [] }]);
  }

  async function handleRenameColumn(columnId: string, name: string) {
    const rollback = columns;
    setColumns((cols) => cols.map((c) => (c.id === columnId ? { ...c, name } : c)));
    const res = await fetch(`/api/v1/board/columns/${columnId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      setColumns(rollback);
      toast.error("Couldn't rename that column — try again.");
    }
  }

  async function confirmDeleteColumn() {
    if (!deleteColumnTarget) return;
    const target = deleteColumnTarget;
    const rollback = columns;
    setDeleteColumnTarget(null);

    if (target.tasks.length > 0) {
      const destColumn = columns.find((c) => c.id === moveTasksTo);
      const movedTasks = target.tasks;
      setColumns((cols) =>
        cols
          .filter((c) => c.id !== target.id)
          .map((c) => (c.id === moveTasksTo ? { ...c, tasks: [...c.tasks, ...movedTasks] } : c))
      );
      const res = await fetch(`/api/v1/board/columns/${target.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moveTasksToColumnId: moveTasksTo }),
      });
      if (!res.ok) {
        setColumns(rollback);
        toast.error("Couldn't delete that column — try again.");
      }
      void destColumn;
    } else {
      setColumns((cols) => cols.filter((c) => c.id !== target.id));
      const res = await fetch(`/api/v1/board/columns/${target.id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        setColumns(rollback);
        toast.error("Couldn't delete that column — try again.");
      }
    }
    setMoveTasksTo("");
  }

  if (state === "loading") {
    return (
      <div className="flex gap-3 overflow-x-auto pb-2">
        <ColumnSkeleton />
        <ColumnSkeleton />
        <ColumnSkeleton />
      </div>
    );
  }

  if (state === "error") {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-sm font-medium">Couldn&apos;t load the board</p>
          <p className="mt-1 text-sm text-muted-foreground">Check your connection and try again.</p>
          <Button type="button" className="mt-4" onClick={retryLoadBoard}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  void boardId;

  return (
    <div>
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex items-start gap-3 overflow-x-auto pb-2" role="application" aria-label="Kanban board">
          <SortableContext items={columns.map((c) => c.id)} strategy={horizontalListSortingStrategy}>
            {columns.map((column) => (
              <KanbanColumn
                key={column.id}
                column={column}
                otherColumns={columns.filter((c) => c.id !== column.id)}
                onRename={(name) => handleRenameColumn(column.id, name)}
                onRequestDelete={() => setDeleteColumnTarget(column)}
                onAddTask={(title) => handleAddTask(column.id, title)}
                onMoveTask={(taskId, targetColumnId) => handleMoveViaMenu(taskId, targetColumnId)}
                onDeleteTask={handleDeleteTask}
              />
            ))}
          </SortableContext>
          <div className="w-72 shrink-0">
            <Button type="button" variant="outline" className="w-full" onClick={() => setAddColumnOpen(true)}>
              + Add column
            </Button>
          </div>
        </div>

        <DragOverlay>
          {activeTask && (
            <KanbanCard task={activeTask} otherColumns={[]} onMove={() => {}} onDelete={() => {}} />
          )}
          {activeColumn && (
            <div className="w-72 rounded-xl border border-border bg-card p-2.5 shadow-lg">
              <span className="text-sm font-semibold">{activeColumn.name}</span>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <Dialog open={addColumnOpen} onOpenChange={setAddColumnOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add column</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            placeholder="Column name"
            value={newColumnName}
            onChange={(e) => setNewColumnName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddColumn()}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAddColumnOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleAddColumn} disabled={!newColumnName.trim()}>
              Add column
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!deleteColumnTarget}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteColumnTarget(null);
            setMoveTasksTo("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete &quot;{deleteColumnTarget?.name}&quot;?</DialogTitle>
            {deleteColumnTarget && deleteColumnTarget.tasks.length > 0 && (
              <DialogDescription>
                This column has {deleteColumnTarget.tasks.length} task(s). Choose where to move them first.
              </DialogDescription>
            )}
          </DialogHeader>
          {deleteColumnTarget && deleteColumnTarget.tasks.length > 0 && (
            <Select value={moveTasksTo} onValueChange={setMoveTasksTo}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Move tasks to…" />
              </SelectTrigger>
              <SelectContent>
                {columns
                  .filter((c) => c.id !== deleteColumnTarget.id)
                  .map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteColumnTarget(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={!!deleteColumnTarget && deleteColumnTarget.tasks.length > 0 && !moveTasksTo}
              onClick={confirmDeleteColumn}
            >
              Delete column
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
