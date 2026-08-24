"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { KanbanArchivedTask } from "./kanban-types";

function timeSince(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "hace un momento";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `hace ${days} d`;
}

/**
 * "Ver archivadas" dialog (kanban feature pack, item 2). Lists soft-
 * deleted tasks for this board, each with a "Restaurar" button.
 * `restoreTask` can reject with a WIP-limit `422` (item 1) — per the
 * phase instructions, that error must surface through the board's
 * EXISTING `boardError`/`InlineNotice` mechanism, not a second
 * error-display path, so a rejection here closes this dialog and hands
 * the message to the parent's `onError` (which calls `showBoardError`) —
 * the dialog itself never renders its own error banner.
 */
export function ArchivedTasksDialog({
  open,
  projectId,
  onOpenChange,
  onRestored,
  onError,
}: {
  open: boolean;
  projectId: string;
  onOpenChange: (open: boolean) => void;
  onRestored: () => void;
  onError: (message: string) => void;
}) {
  const [tasks, setTasks] = useState<KanbanArchivedTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  // React-sanctioned "adjust state during render when a prop changes"
  // shape (same pattern `task-detail-dialog.tsx`/`AiProcessingCard`/the
  // kanban board's own fetch-on-mount already use in this codebase) —
  // flips to the loading state the instant the dialog opens, so the
  // effect below only ever calls `setState` from inside its promise
  // callback, never synchronously in the effect body.
  const [prevOpen, setPrevOpen] = useState(false);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setLoading(true);
  }

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch(`/api/v1/projects/${projectId}/board/archived`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (cancelled) return;
        setTasks(body?.tasks ?? []);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, projectId]);

  async function handleRestore(taskId: string) {
    setRestoringId(taskId);
    const res = await fetch(`/api/v1/board/tasks/${taskId}/restore`, { method: "POST" });
    setRestoringId(null);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      onOpenChange(false);
      onError(body?.error?.message ?? "No se pudo restaurar la tarea — intenta de nuevo.");
      return;
    }
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    onRestored();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[75vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tareas archivadas</DialogTitle>
        </DialogHeader>

        {loading && <p className="text-caption text-ink-faint">Cargando…</p>}
        {!loading && tasks.length === 0 && (
          <p className="text-caption text-ink-faint">No hay tareas archivadas en este tablero.</p>
        )}

        <ul className="space-y-2">
          {tasks.map((task) => (
            <li key={task.id} className="flex items-center justify-between gap-3 border-b border-line pb-2">
              <div className="min-w-0">
                <div className="truncate text-body-sm text-ink">{task.title}</div>
                <div className="font-mono text-[11px] text-ink-muted">
                  {task.columnName ?? "esta columna ya no existe"} · {timeSince(task.deletedAt)}
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={restoringId === task.id}
                onClick={() => handleRestore(task.id)}
              >
                {restoringId === task.id ? "Restaurando…" : "Restaurar"}
              </Button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
