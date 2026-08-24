"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InlineNotice } from "@/components/ui/inline-notice";
import type { CrmOpportunity, CrmStage } from "./crm-types";

function formatDate(value: string | null) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });
}

/**
 * Opportunity Detail dialog — app_spec.md § "UX & Frontend" → "5.5 CRM
 * Opportunity Detail": "notes, value, expected start date, stage history;
 * 'Mark Closed-Won' action". Same "clicking a card's body opens a detail
 * dialog" convention `TaskDetailDialog`/`kanban-card.tsx` established for
 * kanban, including the `prevOpportunityId` render-time state-reset trick
 * `TaskDetailDialog` uses (see that file's doc comment for why this is the
 * React-sanctioned shape rather than a `useEffect`).
 *
 * A per-stage timestamped history table doesn't exist in this phase's
 * schema (`crm_opportunities` carries only the current `stageId` +
 * `closedAt`) — flagged, deliberate scope call: the current stage plus
 * "cerrado el <fecha>" (when applicable) is shown instead of an invented
 * move-by-move log, rather than either fabricating history data or adding
 * a new audit table+migration for a detail this phase's other 6 features
 * don't otherwise need. `onRequestMove` is the SAME function `crm-board.tsx`
 * wires to drag/the card menu — see that file's `requestMoveOpportunity`
 * doc comment for why a won-stage target opens the confirm dialog instead
 * of moving immediately, even when triggered from here.
 */
export function OpportunityDetailDialog({
  opportunity,
  stages,
  onClose,
  onSaved,
  onRequestMove,
  onDelete,
}: {
  opportunity: CrmOpportunity | null;
  stages: CrmStage[];
  onClose: () => void;
  onSaved: (updated: CrmOpportunity) => void;
  onRequestMove: (opportunity: CrmOpportunity, stageId: string) => void;
  onDelete: (opportunityId: string) => void;
}) {
  const open = !!opportunity;

  const [title, setTitle] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [estimatedValue, setEstimatedValue] = useState("");
  const [expectedCloseDate, setExpectedCloseDate] = useState("");
  const [source, setSource] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [prevOpportunityId, setPrevOpportunityId] = useState<string | null>(null);
  if (opportunity && opportunity.id !== prevOpportunityId) {
    setPrevOpportunityId(opportunity.id);
    setTitle(opportunity.title);
    setClientName(opportunity.clientName);
    setClientEmail(opportunity.clientEmail ?? "");
    setClientPhone(opportunity.clientPhone ?? "");
    setEstimatedValue(opportunity.estimatedValue != null ? String(opportunity.estimatedValue) : "");
    setExpectedCloseDate(opportunity.expectedCloseDate ?? "");
    setSource(opportunity.source ?? "");
    setNotes(opportunity.notes ?? "");
    setError(null);
  }

  const currentStage = stages.find((s) => s.id === opportunity?.stageId);
  const otherStages = stages.filter((s) => s.id !== opportunity?.stageId);
  const isClosed = !!opportunity?.closedAt;

  function handleClose(nextOpen: boolean) {
    if (nextOpen || saving) return;
    onClose();
  }

  async function handleSave() {
    if (!opportunity) return;
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/v1/crm/opportunities/${opportunity.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        clientName,
        clientEmail,
        clientPhone,
        estimatedValue: estimatedValue ? Number(estimatedValue) : null,
        expectedCloseDate: expectedCloseDate || "",
        source,
        notes,
      }),
    });
    const body = await res.json().catch(() => null);
    setSaving(false);
    if (!res.ok || !body) {
      setError("No se pudo guardar la oportunidad — intenta de nuevo.");
      return;
    }
    onSaved({ ...opportunity, ...body, createdAt: opportunity.createdAt });
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{opportunity?.title || "Oportunidad"}</DialogTitle>
        </DialogHeader>

        {error && <InlineNotice variant="danger" title="ERROR" description={error} />}

        {opportunity && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] text-ink-muted">
              <span>
                Etapa: <span className="text-ink">{currentStage?.name ?? "—"}</span>
              </span>
              {opportunity.closedAt && (
                <span>Cerrada el {formatDate(opportunity.closedAt.slice(0, 10))}</span>
              )}
            </div>

            {opportunity.convertedProjectId && (
              <InlineNotice
                variant="accent"
                title="PROYECTO CREADO"
                description="Esta oportunidad ya generó un proyecto en Negocio."
              >
                <Link
                  href={`/business/projects/${opportunity.convertedProjectId}`}
                  className="mt-2 inline-block font-mono text-[11px] text-accent underline underline-offset-2 hover:text-ink"
                >
                  Ver proyecto →
                </Link>
              </InlineNotice>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="font-mono text-label-mono tracking-[0.06em] text-ink-muted uppercase">Título</label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} disabled={isClosed} className="mt-1.5" />
              </div>
              <div>
                <label className="font-mono text-label-mono tracking-[0.06em] text-ink-muted uppercase">Cliente</label>
                <Input value={clientName} onChange={(e) => setClientName(e.target.value)} disabled={isClosed} className="mt-1.5" />
              </div>
              <div>
                <label className="font-mono text-label-mono tracking-[0.06em] text-ink-muted uppercase">Correo</label>
                <Input value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} disabled={isClosed} className="mt-1.5" />
              </div>
              <div>
                <label className="font-mono text-label-mono tracking-[0.06em] text-ink-muted uppercase">Teléfono</label>
                <Input value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} disabled={isClosed} className="mt-1.5" />
              </div>
              <div>
                <label className="font-mono text-label-mono tracking-[0.06em] text-ink-muted uppercase">Valor estimado</label>
                <Input
                  type="number"
                  min={0}
                  value={estimatedValue}
                  onChange={(e) => setEstimatedValue(e.target.value)}
                  disabled={isClosed}
                  className="mt-1.5"
                />
              </div>
              <div>
                <label className="font-mono text-label-mono tracking-[0.06em] text-ink-muted uppercase">
                  Cierre / inicio estimado
                </label>
                <Input
                  type="date"
                  value={expectedCloseDate}
                  onChange={(e) => setExpectedCloseDate(e.target.value)}
                  disabled={isClosed}
                  className="mt-1.5"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="font-mono text-label-mono tracking-[0.06em] text-ink-muted uppercase">Origen</label>
                <Input
                  placeholder="Referido, sitio web, LinkedIn…"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  disabled={isClosed}
                  className="mt-1.5"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="font-mono text-label-mono tracking-[0.06em] text-ink-muted uppercase">Notas</label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} disabled={isClosed} className="mt-1.5" rows={3} />
              </div>
            </div>

            {!isClosed && (
              <Button type="button" size="sm" onClick={handleSave} disabled={saving}>
                {saving ? "Guardando…" : "Guardar"}
              </Button>
            )}

            {!isClosed && otherStages.length > 0 && (
              <div>
                <div className="mb-1.5 font-mono text-label-mono tracking-[0.06em] text-ink-muted uppercase">Mover a</div>
                <div className="flex flex-wrap gap-1.5">
                  {otherStages.map((stage) => (
                    <Button
                      key={stage.id}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onRequestMove(opportunity, stage.id)}
                    >
                      {stage.name}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="justify-between sm:justify-between">
          <button
            type="button"
            onClick={() => opportunity && onDelete(opportunity.id)}
            className="font-mono text-[11px] text-danger underline decoration-danger underline-offset-2 hover:text-ink"
          >
            Eliminar oportunidad
          </button>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
