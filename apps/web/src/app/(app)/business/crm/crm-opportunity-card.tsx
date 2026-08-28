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

/** Small day-count pill: days until `expectedCloseDate` if set, otherwise
 * days since `createdAt` — matching the mocked card's small "N d" chip,
 * derived from real dates rather than a stored field that doesn't exist. */
function daysBadge(opportunity: CrmOpportunity) {
  if (opportunity.closedAt) return { label: "cerrado", tone: "positive" as const };
  const target = opportunity.expectedCloseDate
    ? new Date(`${opportunity.expectedCloseDate}T00:00:00`)
    : new Date(opportunity.createdAt);
  const days = Math.round((target.getTime() - Date.now()) / 86_400_000);
  if (opportunity.expectedCloseDate) {
    if (days < 0) return { label: "vencido", tone: "critical" as const };
    return { label: `${days} d`, tone: days <= 3 ? ("attention" as const) : ("neutral" as const) };
  }
  const age = Math.max(0, Math.round((Date.now() - target.getTime()) / 86_400_000));
  return { label: `${age} d`, tone: "neutral" as const };
}

const BADGE_TONE: Record<string, string> = {
  positive: "bg-positive-tint text-positive-ink",
  critical: "bg-critical-tint text-critical-ink",
  attention: "bg-attention-tint text-attention-ink",
  neutral: "bg-surface-sunken text-ink-muted",
};

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
  const badge = daysBadge(opportunity);

  return (
    <Card
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("gap-0 rounded-tile border border-line bg-surface p-3", isDragging && "opacity-40")}
    >
      <div className="flex items-start gap-1.5">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Arrastrar para mover "${opportunity.title}"`}
          className="mt-0.5 flex size-5 shrink-0 cursor-grab touch-none items-center justify-center text-ink-muted transition-colors duration-fast ease-out hover:text-ink active:cursor-grabbing"
        >
          <GripVertical className="size-3.5" />
        </button>
        <button type="button" onClick={onOpenDetail} className="min-w-0 flex-1 text-left">
          <div className="text-body-sm font-medium break-words text-ink">{opportunity.title}</div>
          <p className="mt-0.5 truncate text-[12px] text-ink-muted">{opportunity.clientName}</p>
          <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-line-soft pt-2">
            <span className="font-mono text-data-mono text-ink">{value ?? "—"}</span>
            <span className={cn("shrink-0 rounded-pill px-[8px] py-[2px] text-[11px] font-medium", BADGE_TONE[badge.tone])}>
              {badge.label}
            </span>
          </div>
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
