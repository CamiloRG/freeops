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
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { InlineNotice } from "@/components/ui/inline-notice";
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

const MOVE_ERROR = "No se pudo mover la tarea — revisa tu conexión e intenta de nuevo.";

function ColumnSkeleton() {
  return (
    <div className="flex w-72 shrink-0 flex-col gap-2.5 bg-surface-sunken p-3">
      <Skeleton className="w-24" />
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

  // "Ledger Quiet" stage 3: the handoff forbids toasts outright ("no
  // toasts — errors surface as an inline notice above the action row").
  // A kanban board has no single "action row" (a move/add/delete can come
  // from any card or column), so this is one shared error-display slot
  // for the whole board, rendered once near the top of the board's content
  // area (below the breadcrumb/tabs the layout already owns, above the
  // columns) rather than per-card/per-column. Cleared automatically the
  // next time ANY mutation on this board succeeds (so a stale error
  // doesn't linger once the user has proven the connection works again),
  // AND dismissible directly via a small text affordance in the notice
  // itself — both, rather than picking just one, since an error the user
  // wants to acknowledge and move on from shouldn't have to wait on
  // another action succeeding first. The optimistic-update-then-rollback
  // logic itself is completely unchanged from the pre-migration version —
  // only how the failure is surfaced changed (`toast.error(...)` calls
  // replaced by `showBoardError`/state below).
  const [boardError, setBoardError] = useState<string | null>(null);

  function showBoardError(message: string) {
    setBoardError(message);
  }

  function clearBoardError() {
    setBoardError(null);
  }

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
      showBoardError("No se pudo reordenar las columnas — revisa tu conexión e intenta de nuevo.");
    } else {
      clearBoardError();
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
      showBoardError(MOVE_ERROR);
    } else {
      clearBoardError();
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
      showBoardError("No se pudo agregar esa tarea — intenta de nuevo.");
      return;
    }
    clearBoardError();
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
      showBoardError("No se pudo eliminar esa tarea — intenta de nuevo.");
    } else {
      clearBoardError();
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
      showBoardError("No se pudo agregar esa columna — intenta de nuevo.");
      return;
    }
    clearBoardError();
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
      showBoardError("No se pudo renombrar esa columna — intenta de nuevo.");
    } else {
      clearBoardError();
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
        showBoardError("No se pudo eliminar esa columna — intenta de nuevo.");
      } else {
        clearBoardError();
      }
      void destColumn;
    } else {
      setColumns((cols) => cols.filter((c) => c.id !== target.id));
      const res = await fetch(`/api/v1/board/columns/${target.id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        setColumns(rollback);
        showBoardError("No se pudo eliminar esa columna — intenta de nuevo.");
      } else {
        clearBoardError();
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
          <p className="text-h3 text-ink">No se pudo cargar el tablero</p>
          <p className="mt-1.5 text-caption text-ink-muted">Revisa tu conexión e intenta de nuevo.</p>
          <Button type="button" variant="outline" className="mt-4" onClick={retryLoadBoard}>
            Reintentar
          </Button>
        </CardContent>
      </Card>
    );
  }

  void boardId;

  return (
    <div>
      {boardError && (
        <InlineNotice
          variant="danger"
          title="ERROR"
          description={boardError}
          className="mb-4 max-w-none"
        >
          <button
            type="button"
            onClick={clearBoardError}
            className="mt-2 font-mono text-[11px] text-danger underline decoration-danger underline-offset-2 hover:text-ink"
          >
            descartar
          </button>
        </InlineNotice>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex items-start gap-3 overflow-x-auto pb-2" role="application" aria-label="Tablero kanban">
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
            <Button type="button" variant="ghost" className="w-full" onClick={() => setAddColumnOpen(true)}>
              + Agregar columna
            </Button>
          </div>
        </div>

        <DragOverlay>
          {activeTask && (
            <KanbanCard task={activeTask} otherColumns={[]} onMove={() => {}} onDelete={() => {}} />
          )}
          {activeColumn && (
            <div className="w-72 border border-line bg-paper p-3">
              <span className="font-mono text-label-mono tracking-[0.06em] text-ink uppercase">
                {activeColumn.name}
              </span>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <Dialog open={addColumnOpen} onOpenChange={setAddColumnOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar columna</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            placeholder="Nombre de la columna"
            value={newColumnName}
            onChange={(e) => setNewColumnName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddColumn()}
          />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setAddColumnOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleAddColumn} disabled={!newColumnName.trim()}>
              Agregar columna
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
            <DialogTitle>¿Eliminar &quot;{deleteColumnTarget?.name}&quot;?</DialogTitle>
            {deleteColumnTarget && deleteColumnTarget.tasks.length > 0 && (
              <DialogDescription>
                Esta columna tiene {deleteColumnTarget.tasks.length} tarea(s). Elige primero a dónde moverlas.
              </DialogDescription>
            )}
          </DialogHeader>
          {deleteColumnTarget && deleteColumnTarget.tasks.length > 0 && (
            <Select value={moveTasksTo} onValueChange={setMoveTasksTo}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Mover tareas a…" />
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
            <Button type="button" variant="ghost" onClick={() => setDeleteColumnTarget(null)}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={!!deleteColumnTarget && deleteColumnTarget.tasks.length > 0 && !moveTasksTo}
              onClick={confirmDeleteColumn}
            >
              Eliminar columna
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
