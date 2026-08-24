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
import type { CrmOpportunity, CrmStage } from "./crm-types";

function formatCurrency(value: number | null, currency: string) {
  if (value == null) return null;
  try {
    return new Intl.NumberFormat("es-CO", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString()}`;
  }
}

function formatDate(value: string | null) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("es-CO", { month: "short", day: "numeric" });
}

/**
 * A CRM opportunity card — same draggable-card + always-visible "Mover a"
 * menu shape as `kanban-card.tsx` (app_spec.md § "UX & Frontend" → "6.3
 * Accessible non-drag alternative for kanban/CRM boards" names the CRM
 * pipeline board explicitly, not just kanban). `onMove` is the SAME
 * handler for both the drag path and this menu, and — critically — for a
 * won-stage destination that handler opens the Closed-Won confirmation
 * dialog rather than moving anything immediately; see `crm-board.tsx`'s
 * `requestMoveOpportunity` doc comment. Same hairline-border card
 * exception as `kanban-card.tsx` (Card renders no box by default; a
 * draggable board needs a visible boundary).
 */
export function CrmOpportunityCard({
  opportunity,
  otherStages,
  onMove,
  onDelete,
  onOpenDetail,
}: {
  opportunity: CrmOpportunity;
  otherStages: CrmStage[];
  onMove: (stageId: string) => void;
  onDelete: () => void;
  onOpenDetail: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: opportunity.id,
    data: { type: "opportunity", opportunity },
  });

  const value = formatCurrency(opportunity.estimatedValue, opportunity.currency);
  const closeDate = formatDate(opportunity.expectedCloseDate);

  return (
    <Card
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("gap-0 border border-line bg-paper p-2.5", isDragging && "opacity-40")}
    >
      <div className="flex items-start gap-1.5">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Arrastrar para mover "${opportunity.title}"`}
          className="mt-0.5 flex size-6 shrink-0 cursor-grab touch-none items-center justify-center text-ink-muted transition-colors duration-fast ease-out hover:text-ink active:cursor-grabbing"
        >
          <GripVertical className="size-4" />
        </button>
        <button type="button" onClick={onOpenDetail} className="min-w-0 flex-1 text-left">
          <div className="text-body-sm font-medium break-words text-ink">{opportunity.title}</div>
          <p className="mt-0.5 truncate text-caption text-ink-muted">{opportunity.clientName}</p>
          {(value || closeDate) && (
            <div className="mt-1.5 flex items-center gap-2 font-mono text-[11px] text-ink-muted">
              {value && <span className="text-ink">{value}</span>}
              {closeDate && <span>vence {closeDate}</span>}
            </div>
          )}
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Mover o eliminar "${opportunity.title}"`}
              className="shrink-0"
            >
              <MoreVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Mover a</DropdownMenuLabel>
            {otherStages.length === 0 && <DropdownMenuItem disabled>No hay otras etapas</DropdownMenuItem>}
            {otherStages.map((stage) => (
              <DropdownMenuItem key={stage.id} onSelect={() => onMove(stage.id)}>
                {stage.name}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={onDelete}>
              Eliminar oportunidad
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Card>
  );
}
