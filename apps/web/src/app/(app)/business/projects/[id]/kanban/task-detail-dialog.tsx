"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InlineNotice } from "@/components/ui/inline-notice";
import type { KanbanLabel, KanbanTask } from "./kanban-types";
import { LABEL_COLOR_TEXT_CLASS } from "./kanban-label-colors";
import type { KanbanLabelColor } from "@/lib/validation/business";

interface ChecklistItem {
  id: string;
  text: string;
  isDone: boolean;
  position: number;
}

/**
 * Task Detail dialog (kanban feature pack, item 4) — a real, deliberate UI
 * addition (no mock/prior UI existed for this). Opened by clicking a
 * card's body/title (NOT the drag-handle, NOT the "..." menu — both keep
 * their existing distinct hit targets, see `kanban-card.tsx`). Houses:
 * title/description/due-date editing (judgment call: built for real,
 * since `PATCH .../tasks/:taskId` already accepts these three fields with
 * zero backend changes needed — see this component's own "Guardar"
 * button), the checklist (add/toggle/delete + "N/M" indicator), and the
 * task's attached/removable labels. On close, always tells the parent to
 * refetch the board — simplest-correct way to make sure the card face's
 * checklist indicator/labels/title reflect whatever changed in here,
 * matching the same "refetch after mutation" convention `restoreTask`'s
 * UI already uses.
 */
export function TaskDetailDialog({
  task,
  boardLabels,
  onClose,
}: {
  task: KanbanTask | null;
  boardLabels: KanbanLabel[];
  onClose: () => void;
}) {
  const open = !!task;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [labels, setLabels] = useState<KanbanLabel[]>([]);
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [newItemText, setNewItemText] = useState("");

  const [prevTaskId, setPrevTaskId] = useState<string | null>(null);
  if (task && task.id !== prevTaskId) {
    // React-sanctioned "adjust state during render when a prop changes"
    // shape (see the ADR's `AiProcessingCard`/kanban-board precedent for
    // this exact pattern) — resets the form/local state the instant a
    // DIFFERENT task is opened, without a `useEffect` synchronous-setState
    // lint violation.
    setPrevTaskId(task.id);
    setTitle(task.title);
    setDescription(task.description ?? "");
    setDueDate(task.dueDate ?? "");
    setLabels(task.labels ?? []);
    setError(null);
    setNewItemText("");
    setItems([]);
    setItemsLoading(true);
  }

  useEffect(() => {
    if (!task) return;
    let cancelled = false;
    fetch(`/api/v1/board/tasks/${task.id}/checklist-items`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (cancelled) return;
        setItems(body?.items ?? []);
        setItemsLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // Only re-fetch when a genuinely different task opens (`prevTaskId`
    // already gates the reset above); intentionally not depending on
    // `task` itself since `task` is a fresh object reference on every
    // board refetch even for the same id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id]);

  const attachedIds = new Set(labels.map((l) => l.id));
  const availableLabels = boardLabels.filter((l) => !attachedIds.has(l.id));
  const done = items.filter((i) => i.isDone).length;

  function handleClose(nextOpen: boolean) {
    if (nextOpen) return;
    onClose();
  }

  async function handleSaveFields() {
    if (!task) return;
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/v1/board/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description, dueDate: dueDate || null }),
    });
    setSaving(false);
    if (!res.ok) {
      setError("No se pudo guardar la tarea — intenta de nuevo.");
      return;
    }
  }

  async function handleAttachLabel(labelId: string) {
    if (!task) return;
    const label = boardLabels.find((l) => l.id === labelId);
    if (!label) return;
    setLabels((prev) => [...prev, label]);
    const res = await fetch(`/api/v1/board/tasks/${task.id}/labels/${labelId}`, { method: "POST" });
    if (!res.ok) {
      setLabels((prev) => prev.filter((l) => l.id !== labelId));
      setError("No se pudo agregar esa etiqueta — intenta de nuevo.");
    }
  }

  async function handleDetachLabel(labelId: string) {
    if (!task) return;
    const rollback = labels;
    setLabels((prev) => prev.filter((l) => l.id !== labelId));
    const res = await fetch(`/api/v1/board/tasks/${task.id}/labels/${labelId}`, { method: "DELETE" });
    if (!res.ok) {
      setLabels(rollback);
      setError("No se pudo quitar esa etiqueta — intenta de nuevo.");
    }
  }

  async function handleAddItem() {
    if (!task) return;
    const text = newItemText.trim();
    if (!text) return;
    setNewItemText("");
    const res = await fetch(`/api/v1/board/tasks/${task.id}/checklist-items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body) {
      setError("No se pudo agregar ese ítem — intenta de nuevo.");
      return;
    }
    setItems((prev) => [...prev, body]);
  }

  async function handleToggleItem(item: ChecklistItem) {
    const rollback = items;
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, isDone: !i.isDone } : i)));
    const res = await fetch(`/api/v1/board/checklist-items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDone: !item.isDone }),
    });
    if (!res.ok) {
      setItems(rollback);
      setError("No se pudo actualizar ese ítem — intenta de nuevo.");
    }
  }

  async function handleDeleteItem(itemId: string) {
    const rollback = items;
    setItems((prev) => prev.filter((i) => i.id !== itemId));
    const res = await fetch(`/api/v1/board/checklist-items/${itemId}`, { method: "DELETE" });
    if (!res.ok && res.status !== 204) {
      setItems(rollback);
      setError("No se pudo eliminar ese ítem — intenta de nuevo.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {task?.taskNumber != null && (
              <span className="mr-1.5 font-mono text-[11px] text-ink-muted">#{task.taskNumber}</span>
            )}
            Detalle de la tarea
          </DialogTitle>
        </DialogHeader>

        {error && <InlineNotice variant="danger" title="ERROR" description={error} className="max-w-none" />}

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="font-mono text-label-mono tracking-[0.06em] text-ink-muted uppercase">Título</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <label className="font-mono text-label-mono tracking-[0.06em] text-ink-muted uppercase">
              Descripción
            </label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>

          <div className="space-y-1.5">
            <label className="font-mono text-label-mono tracking-[0.06em] text-ink-muted uppercase">
              Fecha límite
            </label>
            <Input type="date" value={dueDate ?? ""} onChange={(e) => setDueDate(e.target.value)} className="w-44" />
          </div>

          <Button type="button" size="sm" variant="outline" onClick={handleSaveFields} disabled={saving}>
            {saving ? "Guardando…" : "Guardar"}
          </Button>

          <div className="space-y-1.5 border-t border-line pt-4">
            <label className="font-mono text-label-mono tracking-[0.06em] text-ink-muted uppercase">
              Etiquetas
            </label>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              {labels.length === 0 && <span className="text-caption text-ink-faint">Sin etiquetas</span>}
              {labels.map((label) => (
                <span key={label.id} className="inline-flex items-center gap-1.5">
                  <span
                    className={`font-mono text-[11px] uppercase ${
                      LABEL_COLOR_TEXT_CLASS[label.color as KanbanLabelColor] ?? "text-ink-soft"
                    }`}
                  >
                    {label.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDetachLabel(label.id)}
                    className="font-mono text-[11px] text-ink-faint underline decoration-ink-faint underline-offset-2 hover:text-ink"
                  >
                    quitar
                  </button>
                </span>
              ))}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    disabled={availableLabels.length === 0}
                    className="font-mono text-[11px] text-ink-muted underline decoration-ink-muted underline-offset-2 hover:text-ink disabled:opacity-40"
                  >
                    + agregar etiqueta
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {availableLabels.map((label) => (
                    <DropdownMenuItem key={label.id} onSelect={() => handleAttachLabel(label.id)}>
                      <span
                        className={LABEL_COLOR_TEXT_CLASS[label.color as KanbanLabelColor] ?? "text-ink-soft"}
                      >
                        {label.name}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="space-y-1.5 border-t border-line pt-4">
            <div className="flex items-center justify-between">
              <label className="font-mono text-label-mono tracking-[0.06em] text-ink-muted uppercase">
                Lista de tareas
              </label>
              {items.length > 0 && (
                <span className={`font-mono text-[11px] ${done === items.length ? "text-success" : "text-ink-muted"}`}>
                  {done}/{items.length}
                </span>
              )}
            </div>

            {itemsLoading ? (
              <p className="text-caption text-ink-faint">Cargando…</p>
            ) : (
              <ul className="space-y-1.5">
                {items.map((item) => (
                  <li key={item.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={item.isDone}
                      onChange={() => handleToggleItem(item)}
                      className="size-3.5 accent-accent"
                    />
                    <span
                      className={`flex-1 text-body-sm ${item.isDone ? "text-ink-faint line-through" : "text-ink"}`}
                    >
                      {item.text}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteItem(item.id)}
                      className="font-mono text-[11px] text-ink-faint underline decoration-ink-faint underline-offset-2 hover:text-ink"
                    >
                      eliminar
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex gap-1.5 pt-1">
              <Input
                placeholder="Nuevo ítem"
                value={newItemText}
                onChange={(e) => setNewItemText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddItem()}
                className="h-8"
              />
              <Button type="button" size="sm" onClick={handleAddItem} disabled={!newItemText.trim()}>
                Agregar
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
