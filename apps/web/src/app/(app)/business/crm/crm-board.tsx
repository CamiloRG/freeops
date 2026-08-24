"use client";

import { useState } from "react";
import Link from "next/link";
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
import { Input } from "@/components/ui/input";
import { InlineNotice } from "@/components/ui/inline-notice";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BreadcrumbHeader } from "@/components/layout/breadcrumb-header";
import { CrmStageColumn } from "./crm-stage-column";
import { CrmOpportunityCard } from "./crm-opportunity-card";
import { OpportunityDetailDialog } from "./opportunity-detail-dialog";
import { CloseWonConfirmDialog } from "./close-won-confirm-dialog";
import type { CrmOpportunity, CrmStage } from "./crm-types";

const MOVE_ERROR = "No se pudo mover la oportunidad — revisa tu conexión e intenta de nuevo.";

/**
 * The CRM pipeline board — a stage-column drag-and-drop board that mirrors
 * `kanban-board.tsx`'s structure closely (same `@dnd-kit` sensors,
 * optimistic-move-then-rollback contract, and mandatory accessible "Mover
 * a" menu — app_spec.md's § "6.3 Accessible non-drag alternative" names
 * this board explicitly, not just kanban's). Two real differences from
 * kanban, both flowing from this module's own data model and spec:
 *
 * 1. **No persisted card ordering within a stage** — `crm_opportunities`
 *    has no `position` column (see `crm-types.ts`'s doc comment), so a
 *    same-stage drag is a display no-op, never a mutation.
 * 2. **Moving into a Closed-Won stage never applies optimistically.**
 *    app_spec.md's interaction table is explicit: "Silent move confirm;
 *    Closed-Won always confirms via modal." Every other move (drag or the
 *    "Mover a" menu, into any open or Closed-Lost stage) follows kanban's
 *    usual optimistic-update-then-rollback-on-error path; a Closed-Won
 *    target instead opens `CloseWonConfirmDialog` and does nothing to
 *    board state until the user explicitly confirms — see
 *    `requestMoveOpportunity` below, the single function both paths call.
 */
export function CrmBoard({ initialStages }: { initialStages: CrmStage[] }) {
  const [stages, setStages] = useState<CrmStage[]>(initialStages);
  const [activeOpportunity, setActiveOpportunity] = useState<CrmOpportunity | null>(null);
  const [activeStage, setActiveStage] = useState<CrmStage | null>(null);

  // Same "one shared error slot for the whole board, no toasts" pattern as
  // `kanban-board.tsx`'s `boardError` — see that file's doc comment.
  const [boardError, setBoardError] = useState<string | null>(null);
  function showBoardError(message: string) {
    setBoardError(message);
  }
  function clearBoardError() {
    setBoardError(null);
  }

  const [successNotice, setSuccessNotice] = useState<{ message: string; projectId: string } | null>(null);

  const [addStageOpen, setAddStageOpen] = useState(false);
  const [newStageName, setNewStageName] = useState("");

  const [deleteStageTarget, setDeleteStageTarget] = useState<CrmStage | null>(null);
  const [moveOpportunitiesTo, setMoveOpportunitiesTo] = useState<string>("");

  const [deleteOpportunityTarget, setDeleteOpportunityTarget] = useState<CrmOpportunity | null>(null);
  const [selectedOpportunityId, setSelectedOpportunityId] = useState<string | null>(null);

  const [closeWonTarget, setCloseWonTarget] = useState<{ opportunity: CrmOpportunity; stage: CrmStage } | null>(null);
  const [closeWonSaving, setCloseWonSaving] = useState(false);
  const [closeWonError, setCloseWonError] = useState<string | null>(null);

  const selectedOpportunity = stages.flatMap((s) => s.opportunities).find((o) => o.id === selectedOpportunityId) ?? null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  async function refetchBoard() {
    const [stagesRes, opportunitiesRes] = await Promise.all([
      fetch("/api/v1/crm/stages"),
      fetch("/api/v1/crm/opportunities"),
    ]);
    const stagesBody = await stagesRes.json().catch(() => null);
    const opportunitiesBody = await opportunitiesRes.json().catch(() => null);
    if (!stagesRes.ok || !stagesBody || !opportunitiesRes.ok || !opportunitiesBody) return;

    const byStage = new Map<string, CrmOpportunity[]>();
    for (const o of opportunitiesBody.data as CrmOpportunity[]) {
      const list = byStage.get(o.stageId) ?? [];
      list.push(o);
      byStage.set(o.stageId, list);
    }
    setStages(
      (stagesBody.data as Omit<CrmStage, "opportunities">[]).map((s) => ({
        ...s,
        opportunities: byStage.get(s.id) ?? [],
      }))
    );
  }

  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current;
    if (data?.type === "opportunity") setActiveOpportunity(data.opportunity as CrmOpportunity);
    if (data?.type === "stage") setActiveStage(data.stage as CrmStage);
  }

  async function persistStageMove(stageId: string, position: number, rollback: CrmStage[]) {
    const res = await fetch(`/api/v1/crm/stages/${stageId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ position }),
    });
    if (!res.ok) {
      setStages(rollback);
      showBoardError("No se pudo reordenar las etapas — revisa tu conexión e intenta de nuevo.");
    } else {
      clearBoardError();
    }
  }

  async function persistOpportunityMove(opportunityId: string, stageId: string, rollback: CrmStage[]) {
    const res = await fetch(`/api/v1/crm/opportunities/${opportunityId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stageId }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setStages(rollback);
      showBoardError(body?.error?.message ?? MOVE_ERROR);
    } else {
      clearBoardError();
    }
  }

  /** Optimistic move for any NON-won destination (open stage or Closed-Lost) — never called for a Closed-Won target, see `requestMoveOpportunity`. */
  function applyOpportunityMove(opportunity: CrmOpportunity, targetStage: CrmStage) {
    const rollback = stages;
    setStages((prev) =>
      prev.map((s) => {
        if (s.id === opportunity.stageId) return { ...s, opportunities: s.opportunities.filter((o) => o.id !== opportunity.id) };
        if (s.id === targetStage.id) {
          return { ...s, opportunities: [...s.opportunities, { ...opportunity, stageId: targetStage.id }] };
        }
        return s;
      })
    );
    persistOpportunityMove(opportunity.id, targetStage.id, rollback);
  }

  /**
   * Single entry point BOTH the drag path and the "Mover a" menu/detail-
   * dialog buttons call. A Closed-Won destination never touches board state
   * here — it opens the confirmation dialog and waits; every other
   * destination applies immediately via `applyOpportunityMove`.
   */
  function requestMoveOpportunity(opportunity: CrmOpportunity, targetStageId: string) {
    const targetStage = stages.find((s) => s.id === targetStageId);
    if (!targetStage || targetStage.id === opportunity.stageId) return;
    if (targetStage.isClosedWon) {
      setCloseWonTarget({ opportunity, stage: targetStage });
      return;
    }
    applyOpportunityMove(opportunity, targetStage);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveOpportunity(null);
    setActiveStage(null);
    if (!over) return;

    const activeType = active.data.current?.type;

    if (activeType === "stage") {
      if (active.id === over.id) return;
      const oldIndex = stages.findIndex((s) => s.id === active.id);
      const newIndex = stages.findIndex((s) => s.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;
      const rollback = stages;
      const reordered = arrayMove(stages, oldIndex, newIndex).map((s, i) => ({ ...s, position: i }));
      setStages(reordered);
      persistStageMove(active.id as string, newIndex, rollback);
      return;
    }

    if (activeType === "opportunity") {
      const opportunityId = active.id as string;
      const sourceStage = stages.find((s) => s.opportunities.some((o) => o.id === opportunityId));
      if (!sourceStage) return;

      let destStageId: string;
      const overType = over.data.current?.type;
      if (overType === "opportunity") {
        const destStage = stages.find((s) => s.opportunities.some((o) => o.id === over.id));
        if (!destStage) return;
        destStageId = destStage.id;
      } else if (overType === "stage-droppable" || overType === "stage") {
        destStageId = (over.data.current?.stageId as string) ?? (over.id as string);
      } else {
        return;
      }

      // No persisted position within a stage — a same-stage drop is a no-op.
      if (destStageId === sourceStage.id) return;

      const opportunity = sourceStage.opportunities.find((o) => o.id === opportunityId);
      if (!opportunity) return;
      requestMoveOpportunity(opportunity, destStageId);
    }
  }

  async function handleAddOpportunity(stageId: string, title: string, clientName: string) {
    const rollback = stages;
    const tempId = `temp-${crypto.randomUUID()}`;
    const optimistic: CrmOpportunity = {
      id: tempId,
      stageId,
      title,
      clientName,
      clientEmail: null,
      clientPhone: null,
      estimatedValue: null,
      currency: "COP",
      expectedCloseDate: null,
      notes: null,
      source: null,
      closedAt: null,
      convertedProjectId: null,
      createdAt: new Date().toISOString(),
    };
    setStages((prev) => prev.map((s) => (s.id === stageId ? { ...s, opportunities: [...s.opportunities, optimistic] } : s)));

    const res = await fetch("/api/v1/crm/opportunities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, clientName, stageId }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body) {
      setStages(rollback);
      showBoardError("No se pudo agregar esa oportunidad — intenta de nuevo.");
      return;
    }
    clearBoardError();
    setStages((prev) =>
      prev.map((s) => (s.id === stageId ? { ...s, opportunities: s.opportunities.map((o) => (o.id === tempId ? body : o)) } : s))
    );
  }

  function handleDeleteOpportunityRequest(opportunityId: string) {
    const opportunity = stages.flatMap((s) => s.opportunities).find((o) => o.id === opportunityId);
    if (!opportunity) return;
    setSelectedOpportunityId(null);
    setDeleteOpportunityTarget(opportunity);
  }

  async function confirmDeleteOpportunity() {
    if (!deleteOpportunityTarget) return;
    const target = deleteOpportunityTarget;
    const rollback = stages;
    setDeleteOpportunityTarget(null);
    setStages((prev) => prev.map((s) => ({ ...s, opportunities: s.opportunities.filter((o) => o.id !== target.id) })));
    const res = await fetch(`/api/v1/crm/opportunities/${target.id}`, { method: "DELETE" });
    if (!res.ok && res.status !== 204) {
      setStages(rollback);
      showBoardError("No se pudo eliminar esa oportunidad — intenta de nuevo.");
    } else {
      clearBoardError();
    }
  }

  function handleDetailSaved(updated: CrmOpportunity) {
    setStages((prev) => prev.map((s) => ({ ...s, opportunities: s.opportunities.map((o) => (o.id === updated.id ? updated : o)) })));
  }

  function handleDetailRequestMove(opportunity: CrmOpportunity, targetStageId: string) {
    setSelectedOpportunityId(null);
    requestMoveOpportunity(opportunity, targetStageId);
  }

  async function handleCloseWonConfirm() {
    if (!closeWonTarget) return;
    setCloseWonSaving(true);
    setCloseWonError(null);
    const res = await fetch(`/api/v1/crm/opportunities/${closeWonTarget.opportunity.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stageId: closeWonTarget.stage.id }),
    });
    const body = await res.json().catch(() => null);
    setCloseWonSaving(false);
    if (!res.ok || !body) {
      setCloseWonError(body?.error?.message ?? "No se pudo crear el proyecto — intenta de nuevo.");
      return;
    }
    setCloseWonTarget(null);
    clearBoardError();
    await refetchBoard();
    if (body.createdProject) {
      setSuccessNotice({ message: `Proyecto creado: ${body.createdProject.name}`, projectId: body.createdProject.id });
    }
  }

  function handleCloseWonCancel() {
    if (closeWonSaving) return;
    setCloseWonTarget(null);
    setCloseWonError(null);
  }

  async function handleAddStage() {
    const name = newStageName.trim();
    if (!name) return;
    setAddStageOpen(false);
    setNewStageName("");
    const res = await fetch("/api/v1/crm/stages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body) {
      showBoardError("No se pudo agregar esa etapa — intenta de nuevo.");
      return;
    }
    clearBoardError();
    setStages((prev) => [...prev, { ...body, opportunities: [] }]);
  }

  async function handleRenameStage(stageId: string, name: string) {
    const rollback = stages;
    setStages((prev) => prev.map((s) => (s.id === stageId ? { ...s, name } : s)));
    const res = await fetch(`/api/v1/crm/stages/${stageId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      setStages(rollback);
      showBoardError("No se pudo renombrar esa etapa — intenta de nuevo.");
    } else {
      clearBoardError();
    }
  }

  async function confirmDeleteStage() {
    if (!deleteStageTarget) return;
    const target = deleteStageTarget;
    const rollback = stages;
    setDeleteStageTarget(null);

    if (target.opportunities.length > 0) {
      const movedOpportunities = target.opportunities;
      setStages((prev) =>
        prev
          .filter((s) => s.id !== target.id)
          .map((s) => (s.id === moveOpportunitiesTo ? { ...s, opportunities: [...s.opportunities, ...movedOpportunities] } : s))
      );
      const res = await fetch(`/api/v1/crm/stages/${target.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moveOpportunitiesToStageId: moveOpportunitiesTo }),
      });
      if (!res.ok) {
        setStages(rollback);
        showBoardError("No se pudo eliminar esa etapa — intenta de nuevo.");
      } else {
        clearBoardError();
      }
    } else {
      setStages((prev) => prev.filter((s) => s.id !== target.id));
      const res = await fetch(`/api/v1/crm/stages/${target.id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        setStages(rollback);
        showBoardError("No se pudo eliminar esa etapa — intenta de nuevo.");
      } else {
        clearBoardError();
      }
    }
    setMoveOpportunitiesTo("");
  }

  return (
    <div className="px-9 pt-[26px] pb-8">
      <BreadcrumbHeader breadcrumb="NEGOCIO / PIPELINE CRM" />

      {boardError && (
        <InlineNotice variant="danger" title="ERROR" description={boardError} className="mt-4 mb-4 max-w-none">
          <button
            type="button"
            onClick={clearBoardError}
            className="mt-2 font-mono text-[11px] text-danger underline decoration-danger underline-offset-2 hover:text-ink"
          >
            descartar
          </button>
        </InlineNotice>
      )}

      {successNotice && (
        <InlineNotice variant="accent" title="PROYECTO CREADO" description={successNotice.message} className="mt-4 mb-4 max-w-none">
          <div className="mt-2 flex items-center gap-3">
            <Link
              href={`/business/projects/${successNotice.projectId}`}
              className="font-mono text-[11px] text-accent underline underline-offset-2 hover:text-ink"
            >
              Ver proyecto →
            </Link>
            <button
              type="button"
              onClick={() => setSuccessNotice(null)}
              className="font-mono text-[11px] text-ink-muted underline decoration-ink-muted underline-offset-2 hover:text-ink"
            >
              descartar
            </button>
          </div>
        </InlineNotice>
      )}

      <div className="mt-5">
        {/*
          `id="crm-board"`: unlike `kanban-board.tsx` (which starts empty
          and only populates via a client-side `useEffect`, so its
          `DndContext` never renders draggables during SSR), this board is
          server-rendered with real `initialStages` — `@dnd-kit`'s internal
          per-instance id generator is otherwise a plain incrementing
          counter that produces a different sequence on the server vs. the
          client's first render, causing a (harmless but noisy)
          `aria-describedby` hydration mismatch. A stable `id` seeds that
          generator deterministically instead.
        */}
        <DndContext
          id="crm-board"
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex items-start gap-3 overflow-x-auto pb-2" role="application" aria-label="Tablero de pipeline CRM">
            <SortableContext items={stages.map((s) => s.id)} strategy={horizontalListSortingStrategy}>
              {stages.map((stage) => (
                <CrmStageColumn
                  key={stage.id}
                  stage={stage}
                  otherStages={stages.filter((s) => s.id !== stage.id)}
                  onRename={(name) => handleRenameStage(stage.id, name)}
                  onRequestDelete={() => setDeleteStageTarget(stage)}
                  onAddOpportunity={(title, clientName) => handleAddOpportunity(stage.id, title, clientName)}
                  onMoveOpportunity={(opportunityId, targetStageId) => {
                    const opportunity = stage.opportunities.find((o) => o.id === opportunityId);
                    if (opportunity) requestMoveOpportunity(opportunity, targetStageId);
                  }}
                  onDeleteOpportunity={handleDeleteOpportunityRequest}
                  onOpenDetail={(opportunityId) => setSelectedOpportunityId(opportunityId)}
                />
              ))}
            </SortableContext>
            <div className="w-72 shrink-0">
              <Button type="button" variant="ghost" className="w-full" onClick={() => setAddStageOpen(true)}>
                + Agregar etapa
              </Button>
            </div>
          </div>

          <DragOverlay>
            {activeOpportunity && (
              <CrmOpportunityCard opportunity={activeOpportunity} otherStages={[]} onMove={() => {}} onDelete={() => {}} onOpenDetail={() => {}} />
            )}
            {activeStage && (
              <div className="w-72 border border-line bg-paper p-3">
                <span className="font-mono text-label-mono tracking-[0.06em] text-ink uppercase">{activeStage.name}</span>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>

      <OpportunityDetailDialog
        opportunity={selectedOpportunity}
        stages={stages}
        onClose={() => setSelectedOpportunityId(null)}
        onSaved={handleDetailSaved}
        onRequestMove={handleDetailRequestMove}
        onDelete={handleDeleteOpportunityRequest}
      />

      <CloseWonConfirmDialog
        opportunity={closeWonTarget?.opportunity ?? null}
        stageName={closeWonTarget?.stage.name ?? ""}
        saving={closeWonSaving}
        error={closeWonError}
        onConfirm={handleCloseWonConfirm}
        onCancel={handleCloseWonCancel}
      />

      <Dialog open={addStageOpen} onOpenChange={setAddStageOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar etapa</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            placeholder="Nombre de la etapa"
            value={newStageName}
            onChange={(e) => setNewStageName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddStage()}
          />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setAddStageOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleAddStage} disabled={!newStageName.trim()}>
              Agregar etapa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!deleteStageTarget}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteStageTarget(null);
            setMoveOpportunitiesTo("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar &quot;{deleteStageTarget?.name}&quot;?</DialogTitle>
            {deleteStageTarget && deleteStageTarget.opportunities.length > 0 && (
              <DialogDescription>
                Esta etapa tiene {deleteStageTarget.opportunities.length} oportunidad(es). Elige primero a dónde moverlas.
              </DialogDescription>
            )}
          </DialogHeader>
          {deleteStageTarget && deleteStageTarget.opportunities.length > 0 && (
            <Select value={moveOpportunitiesTo} onValueChange={setMoveOpportunitiesTo}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Mover oportunidades a…" />
              </SelectTrigger>
              <SelectContent>
                {stages
                  .filter((s) => s.id !== deleteStageTarget.id)
                  .map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setDeleteStageTarget(null)}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={!!deleteStageTarget && deleteStageTarget.opportunities.length > 0 && !moveOpportunitiesTo}
              onClick={confirmDeleteStage}
            >
              Eliminar etapa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteOpportunityTarget} onOpenChange={(open) => !open && setDeleteOpportunityTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar &quot;{deleteOpportunityTarget?.title}&quot;?</DialogTitle>
            <DialogDescription>Esta acción no se puede deshacer desde la interfaz.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setDeleteOpportunityTarget(null)}>
              Cancelar
            </Button>
            <Button type="button" variant="destructive" onClick={confirmDeleteOpportunity}>
              Eliminar oportunidad
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
