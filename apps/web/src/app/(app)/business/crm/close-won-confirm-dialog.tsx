"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InlineNotice } from "@/components/ui/inline-notice";
import { SummaryField, SummaryGrid } from "@/components/personal/summary-grid";
import type { CrmOpportunity } from "./crm-types";

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
  return date.toLocaleDateString("es-CO", { month: "long", day: "numeric", year: "numeric" });
}

/**
 * The mandatory Closed-Won confirmation modal — app_spec.md § "UX &
 * Frontend": "'Mark Closed-Won' action that triggers the auto-create-
 * project flow (confirmation modal showing what will be pre-filled)" and,
 * on the interaction-state table, "Silent move confirm; Closed-Won always
 * confirms via modal." Shown BEFORE the stage move is ever sent to the
 * server — cancelling here means nothing happened at all, not a rollback
 * of something already applied (contrast with every other stage move on
 * this board, which is optimistic-then-rollback-on-error). The preview
 * below is a pure client-side mirror of `@/lib/services/crm`'s
 * `updateOpportunity` field-mapping (client → client, notes → scope notes,
 * expected close date → expected start date) — kept in sync by hand since
 * one lives in a Server Component-only module and the other in a Client
 * Component, the same split every other server/client field-mapping pair
 * in this codebase already has.
 */
export function CloseWonConfirmDialog({
  opportunity,
  stageName,
  saving,
  error,
  onConfirm,
  onCancel,
}: {
  opportunity: CrmOpportunity | null;
  stageName: string;
  saving: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const open = !!opportunity;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !saving && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Marcar como Ganado</DialogTitle>
          <DialogDescription>
            Mover &quot;{opportunity?.title}&quot; a &quot;{stageName}&quot; crea automáticamente un proyecto nuevo con estos
            datos. El resto de los campos del proyecto quedan para completar manualmente.
          </DialogDescription>
        </DialogHeader>

        {opportunity && (
          <SummaryGrid>
            <SummaryField label="Cliente" value={opportunity.clientName} />
            <SummaryField label="Título del proyecto" value={opportunity.title} />
            <SummaryField label="Valor del trato" value={formatCurrency(opportunity.estimatedValue, opportunity.currency)} mono />
            <SummaryField label="Fecha estimada de inicio" value={formatDate(opportunity.expectedCloseDate)} />
            {opportunity.notes && <SummaryField label="Notas de alcance" value={opportunity.notes} full />}
          </SummaryGrid>
        )}

        {error && <InlineNotice variant="danger" title="ERROR" description={error} />}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" onClick={onConfirm} disabled={saving}>
            {saving ? "Creando proyecto…" : "Confirmar y crear proyecto"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
