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
import { CrmOpportunityCard } from "./crm-opportunity-card";
import type { CrmStage } from "./crm-types";

/** Cycled by stage position — CRM stages have no stored color, this is a
 * display-only sequence (grey → blue → indigo → amber → green), with
 * closed-won/closed-lost flags overriding it regardless of position. */
const STAGE_DOT_CYCLE = ["bg-line", "bg-accent", "bg-accent", "bg-attention", "bg-positive"];

function stageDotColor(stage: CrmStage, position: number) {
  if (stage.isClosedWon) return "bg-positive";
  if (stage.isClosedLost) return "bg-critical";
  return STAGE_DOT_CYCLE[position % STAGE_DOT_CYCLE.length];
}

function formatStageValue(stage: CrmStage) {
  const total = stage.opportunities.reduce((sum, o) => sum + (o.estimatedValue ?? 0), 0);
  const currency = stage.opportunities[0]?.currency ?? "COP";
  if (total === 0) return null;
  try {
    return new Intl.NumberFormat("es-CO", { style: "currency", currency, maximumFractionDigits: 0 }).format(total);
  } catch {
    return `${currency} ${total.toLocaleString()}`;
  }
}

/** Same shape as `kanban-column.tsx` — see that file's doc comments for the drag-handle/rename/actions-menu conventions this mirrors, minus WIP limits (not part of this module's scope). */
export function CrmStageColumn({
  stage,
  position,
  otherStages,
  onRename,
  onRequestDelete,
  onAddOpportunity,
  onMoveOpportunity,
  onDeleteOpportunity,
  onOpenDetail,
}: {
  stage: CrmStage;
  position: number;
  otherStages: CrmStage[];
  onRename: (name: string) => void;
  onRequestDelete: () => void;
  onAddOpportunity: (title: string, clientName: string) => void;
  onMoveOpportunity: (opportunityId: string, stageId: string) => void;
  onDeleteOpportunity: (opportunityId: string) => void;
  onOpenDetail: (opportunityId: string) => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(stage.name);
  const [adding, setAdding] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [clientDraft, setClientDraft] = useState("");

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: stage.id,
    data: { type: "stage", stage },
  });

  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: stage.id,
    data: { type: "stage-droppable", stageId: stage.id },
  });

  const opportunityIds = stage.opportunities.map((o) => o.id);

  function submitRename() {
    const trimmed = nameDraft.trim();
    if (trimmed && trimmed !== stage.name) onRename(trimmed);
    else setNameDraft(stage.name);
    setRenaming(false);
  }

  function submitAdd() {
    const title = titleDraft.trim();
    const client = clientDraft.trim();
    if (title && client) onAddOpportunity(title, client);
    setTitleDraft("");
    setClientDraft("");
    setAdding(false);
  }

  const stageValue = formatStageValue(stage);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("group flex w-[280px] shrink-0 flex-col", isDragging && "opacity-50")}
    >
      <div className="flex items-center gap-1.5 px-1 pb-1">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Arrastrar para reordenar la etapa "${stage.name}"`}
          className="flex size-5 shrink-0 cursor-grab touch-none items-center justify-center text-ink-muted opacity-0 transition-opacity duration-fast ease-out hover:text-ink group-hover:opacity-100 active:cursor-grabbing"
        >
          <GripVertical className="size-3.5" />
        </button>
        <span className={cn("size-1.5 shrink-0 rounded-full", stageDotColor(stage, position))} aria-hidden="true" />
        {renaming ? (
          <Input
            autoFocus
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={submitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitRename();
              if (e.key === "Escape") {
                setNameDraft(stage.name);
                setRenaming(false);
              }
            }}
            className="h-7 flex-1"
          />
        ) : (
          <span className="flex-1 truncate text-[14px] font-medium text-ink">
            {stage.name}
            {stage.isClosedWon && <span className="ml-1.5 text-[12px] font-normal text-positive-ink">· ganado</span>}
            {stage.isClosedLost && <span className="ml-1.5 text-[12px] font-normal text-ink-muted">· perdido</span>}
          </span>
        )}
        <span className="shrink-0 text-[12px] text-ink-muted">{stage.opportunities.length}</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Acciones de etapa para "${stage.name}"`}
              className="shrink-0"
            >
              <MoreVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setRenaming(true)}>Renombrar</DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={onRequestDelete}>
              Eliminar etapa
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {stageValue && (
        <div className="px-1 pb-2.5 font-mono text-data-mono text-ink-muted">{stageValue}</div>
      )}

      <div ref={setDroppableRef} className={cn("min-h-24 flex-1 space-y-2.5 rounded-tile bg-surface-sunken/60 p-1.5", isOver && "bg-accent-tint")}>
        <SortableContext items={opportunityIds} strategy={verticalListSortingStrategy}>
          {stage.opportunities.map((opportunity) => (
            <CrmOpportunityCard
              key={opportunity.id}
              opportunity={opportunity}
              otherStages={otherStages}
              onMove={(stageId) => onMoveOpportunity(opportunity.id, stageId)}
              onDelete={() => onDeleteOpportunity(opportunity.id)}
              onOpenDetail={() => onOpenDetail(opportunity.id)}
            />
          ))}
        </SortableContext>
        {stage.opportunities.length === 0 && !adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex w-full items-center justify-center gap-1.5 py-4 font-mono text-[11px] text-ink-muted transition-colors duration-fast ease-out hover:text-ink"
          >
            <Plus className="size-3.5" /> Agregar oportunidad
          </button>
        )}
      </div>

      <div className="p-2 pt-0">
        {adding ? (
          <div className="space-y-1.5">
            <Input
              autoFocus
              placeholder="Título del trato"
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setAdding(false)}
            />
            <Input
              placeholder="Nombre del cliente"
              value={clientDraft}
              onChange={(e) => setClientDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitAdd();
                if (e.key === "Escape") setAdding(false);
              }}
            />
            <div className="flex gap-1.5">
              <Button type="button" size="sm" onClick={submitAdd} disabled={!titleDraft.trim() || !clientDraft.trim()}>
                Agregar
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setTitleDraft("");
                  setClientDraft("");
                  setAdding(false);
                }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          stage.opportunities.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full justify-start text-ink-soft"
              onClick={() => setAdding(true)}
            >
              <Plus /> Agregar oportunidad
            </Button>
          )
        )}
      </div>
    </div>
  );
}
