"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InlineNotice } from "@/components/ui/inline-notice";
import type { KanbanLabel } from "./kanban-types";
import { LABEL_COLOR_DISPLAY_NAME, LABEL_COLOR_ORDER, LABEL_COLOR_TEXT_CLASS } from "./kanban-label-colors";
import type { KanbanLabelColor } from "@/lib/validation/business";

/**
 * "Administrar etiquetas" dialog (kanban feature pack, item 3) — create/
 * rename/delete a board's labels. Color choice is a `Select` of the 10
 * preset names (no free color picker), each option rendered as plain
 * colored mono text — never a swatch/chip — consistent with how labels
 * render everywhere else in this system.
 */
export function ManageLabelsDialog({
  open,
  onOpenChange,
  projectId,
  labels,
  onLabelsChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  labels: KanbanLabel[];
  onLabelsChanged: (labels: KanbanLabel[]) => void;
}) {
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<KanbanLabelColor>("blue");
  const [error, setError] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");

  async function refetchLabels() {
    const res = await fetch(`/api/v1/projects/${projectId}/board/labels`);
    const body = await res.json().catch(() => null);
    if (res.ok && body) onLabelsChanged(body.labels);
  }

  async function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    setError(null);
    const res = await fetch(`/api/v1/projects/${projectId}/board/labels`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, color: newColor }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      setError(body?.error?.message ?? "No se pudo crear la etiqueta — intenta de nuevo.");
      return;
    }
    setNewName("");
    await refetchLabels();
  }

  async function handleDelete(labelId: string) {
    setError(null);
    const res = await fetch(`/api/v1/board/labels/${labelId}`, { method: "DELETE" });
    if (!res.ok && res.status !== 204) {
      setError("No se pudo eliminar la etiqueta — intenta de nuevo.");
      return;
    }
    onLabelsChanged(labels.filter((l) => l.id !== labelId));
  }

  function startRename(label: KanbanLabel) {
    setRenamingId(label.id);
    setRenameDraft(label.name);
  }

  async function submitRename(labelId: string) {
    const name = renameDraft.trim();
    setRenamingId(null);
    if (!name) return;
    setError(null);
    const res = await fetch(`/api/v1/board/labels/${labelId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      setError(body?.error?.message ?? "No se pudo renombrar la etiqueta — intenta de nuevo.");
      return;
    }
    await refetchLabels();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[75vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Administrar etiquetas</DialogTitle>
        </DialogHeader>

        {error && <InlineNotice variant="danger" title="ERROR" description={error} className="max-w-none" />}

        <ul className="space-y-2">
          {labels.length === 0 && <li className="text-caption text-ink-faint">Este tablero no tiene etiquetas.</li>}
          {labels.map((label) => (
            <li key={label.id} className="flex items-center justify-between gap-2 border-b border-line pb-2">
              {renamingId === label.id ? (
                <Input
                  autoFocus
                  value={renameDraft}
                  onChange={(e) => setRenameDraft(e.target.value)}
                  onBlur={() => submitRename(label.id)}
                  onKeyDown={(e) => e.key === "Enter" && submitRename(label.id)}
                  className="h-8 flex-1"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => startRename(label)}
                  className={`flex-1 text-left font-mono text-[12px] uppercase ${
                    LABEL_COLOR_TEXT_CLASS[label.color as KanbanLabelColor] ?? "text-ink-soft"
                  }`}
                >
                  {label.name}
                </button>
              )}
              <button
                type="button"
                onClick={() => handleDelete(label.id)}
                className="shrink-0 font-mono text-[11px] text-ink-faint underline decoration-ink-faint underline-offset-2 hover:text-danger"
              >
                eliminar
              </button>
            </li>
          ))}
        </ul>

        <div className="flex items-end gap-2 border-t border-line pt-4">
          <div className="flex-1 space-y-1.5">
            <label className="font-mono text-label-mono tracking-[0.06em] text-ink-muted uppercase">Nombre</label>
            <Input
              placeholder="Nombre de la etiqueta"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
          </div>
          <div className="w-32 space-y-1.5">
            <label className="font-mono text-label-mono tracking-[0.06em] text-ink-muted uppercase">Color</label>
            <Select value={newColor} onValueChange={(v) => setNewColor(v as KanbanLabelColor)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LABEL_COLOR_ORDER.map((color) => (
                  <SelectItem key={color} value={color}>
                    <span className={LABEL_COLOR_TEXT_CLASS[color]}>{LABEL_COLOR_DISPLAY_NAME[color]}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="button" onClick={handleCreate} disabled={!newName.trim()}>
            Crear
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
