"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { InlineNotice } from "@/components/ui/inline-notice";
import { SaveStatusLine } from "@/components/ui/save-status-line";
import { SummaryEditCard } from "@/components/personal/summary-edit-card";
import { useEditToggle } from "@/components/personal/use-edit-toggle";
import { SummaryField, SummaryGrid } from "@/components/personal/summary-grid";
import { useSaveStatus } from "@/hooks/use-save-status";
import { isDirty } from "@/lib/form-dirty";
import { projectUpdateSchema } from "@/lib/validation/business";
import type { ProjectListItem } from "../../project-list";

type ProjectStatus = ProjectListItem["status"];

const STATUS_LABEL: Record<ProjectStatus, string> = {
  active: "Activo",
  completed: "Completado",
  archived: "Archivado",
  cancelled: "Cancelado",
};

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
  return date.toLocaleDateString("es-CO", { month: "short", day: "numeric", year: "numeric" });
}

interface ProjectOverview {
  id: string;
  name: string;
  clientName: string;
  clientEmail: string | null;
  clientTaxId: string | null;
  description: string | null;
  scopeNotes: string | null;
  status: ProjectStatus;
  startDate: string | null;
  expectedEndDate: string | null;
  value: number | null;
  currency: string;
  source: "manual" | "crm_auto";
}

/**
 * Business / Resumen — NOT pixel-mocked in the design handoff (only
 * Personal's Profile/Banking are). Wired onto the exact Stage 2 pattern
 * (`SummaryEditCard` + `useSaveStatus`/`SaveStatusLine` bridged through
 * `useProjectHeaderStatus` + `InlineNotice` for errors, `isDirty` gating
 * the Save button) — field labels below map onto the schema per the
 * ADR's Phase 5 "Field-name mapping" note (API `name`↔`title`,
 * `value`↔`deal_value`, `startDate`↔`start_date`,
 * `expectedEndDate`↔`end_date`); layout/copy choices are this stage's own
 * judgment call, not an invented visual pattern.
 */
export function OverviewForm({ projectId, initial }: { projectId: string; initial: ProjectOverview }) {
  const router = useRouter();
  const { editing, setEditing, toggle } = useEditToggle(false);
  const [saved, setSaved] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const saveStatus = useSaveStatus();

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteWarning, setDeleteWarning] = useState<string | null>(null);
  const [deleteStatus, setDeleteStatus] = useState<"idle" | "deleting" | "error">("idle");

  const dirty = isDirty(draft, saved);

  function handleToggle() {
    if (editing) {
      setDraft(saved); // restore on cancel
      saveStatus.reset();
    }
    toggle();
  }

  async function handleSave() {
    const payload = {
      name: draft.name,
      clientName: draft.clientName,
      clientEmail: draft.clientEmail || undefined,
      clientTaxId: draft.clientTaxId || undefined,
      description: draft.description || undefined,
      scopeNotes: draft.scopeNotes || undefined,
      status: draft.status,
      startDate: draft.startDate || undefined,
      expectedEndDate: draft.expectedEndDate || undefined,
      value: draft.value ?? undefined,
    };
    const parsed = projectUpdateSchema.safeParse(payload);
    if (!parsed.success) {
      saveStatus.markError(parsed.error.issues[0]?.message ?? "Revisa el formulario e intenta de nuevo.");
      return;
    }
    saveStatus.markSaving();
    const res = await fetch(`/api/v1/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body) {
      saveStatus.markError(body?.error?.message ?? "No se pudo guardar — intenta de nuevo.");
      return;
    }
    saveStatus.markSaved();
    setSaved(draft);
    setEditing(false);
  }

  async function handleDelete(confirm: boolean) {
    setDeleteStatus("deleting");
    const res = await fetch(`/api/v1/projects/${projectId}${confirm ? "?confirm=true" : ""}`, {
      method: "DELETE",
    });
    if (res.status === 204) {
      router.push("/business/projects");
      return;
    }
    const body = await res.json().catch(() => null);
    if (res.ok && body?.warning) {
      setDeleteWarning(body.warning);
      setDeleteStatus("idle");
      return;
    }
    setDeleteStatus("error");
  }

  return (
    <div className="flex flex-col gap-9">
      <SummaryEditCard
        title="Detalles del proyecto"
        description={
          <span className="text-caption text-ink-muted">
            Datos del cliente, alcance, valor y fechas del proyecto.
          </span>
        }
        editing={editing}
        onToggleEdit={handleToggle}
        cancelLabel={null}
        contentClassName="pt-[28px]"
        summary={
          <div className="space-y-6">
            <SummaryGrid>
              <SummaryField label="Nombre del proyecto" value={saved.name} />
              <SummaryField label="Estado" value={STATUS_LABEL[saved.status]} />
              <SummaryField label="Cliente" value={saved.clientName} />
              <SummaryField label="Correo del cliente" value={saved.clientEmail} />
              <SummaryField label="NIT/Cédula del cliente" value={saved.clientTaxId} />
              <SummaryField label="Valor del contrato" value={formatCurrency(saved.value, saved.currency)} mono />
              <SummaryField label="Fecha de inicio" value={formatDate(saved.startDate)} mono />
              <SummaryField label="Fecha de finalización esperada" value={formatDate(saved.expectedEndDate)} mono />
              {saved.source === "crm_auto" && (
                <SummaryField label="Origen" value={<span className="text-accent">auto · desde CRM</span>} />
              )}
            </SummaryGrid>
            {saved.description && (
              <div>
                <div className="font-mono text-label-mono tracking-[0.06em] text-ink-muted uppercase">
                  Descripción
                </div>
                <p className="mt-[6px] max-w-measure text-body text-ink">{saved.description}</p>
              </div>
            )}
            {saved.scopeNotes && (
              <div>
                <div className="font-mono text-label-mono tracking-[0.06em] text-ink-muted uppercase">
                  Notas de alcance
                </div>
                <p className="mt-[6px] max-w-measure text-body text-ink">{saved.scopeNotes}</p>
              </div>
            )}
          </div>
        }
      >
        <div className="space-y-6">
          <SummaryGrid>
            <div className="space-y-1.5">
              <Label htmlFor="ov-name">Nombre del proyecto</Label>
              <Input id="ov-name" value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ov-status">Estado</Label>
              <Select value={draft.status} onValueChange={(v) => setDraft((d) => ({ ...d, status: v as ProjectStatus }))}>
                <SelectTrigger id="ov-status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Activo</SelectItem>
                  <SelectItem value="completed">Completado</SelectItem>
                  <SelectItem value="archived">Archivado</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ov-client">Cliente</Label>
              <Input
                id="ov-client"
                value={draft.clientName}
                onChange={(e) => setDraft((d) => ({ ...d, clientName: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ov-client-email">Correo del cliente</Label>
              <Input
                id="ov-client-email"
                type="email"
                value={draft.clientEmail ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, clientEmail: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ov-client-tax">NIT/Cédula del cliente</Label>
              <Input
                id="ov-client-tax"
                className="font-mono text-data-mono"
                value={draft.clientTaxId ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, clientTaxId: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ov-value">Valor del contrato (COP)</Label>
              <Input
                id="ov-value"
                type="number"
                min={0}
                className="font-mono text-data-mono"
                value={draft.value ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, value: e.target.value ? Number(e.target.value) : null }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ov-start">Fecha de inicio</Label>
              <Input
                id="ov-start"
                type="date"
                value={draft.startDate ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, startDate: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ov-end">Fecha de finalización esperada</Label>
              <Input
                id="ov-end"
                type="date"
                value={draft.expectedEndDate ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, expectedEndDate: e.target.value }))}
              />
            </div>
          </SummaryGrid>
          <div className="max-w-measure space-y-1.5">
            <Label htmlFor="ov-description">Descripción</Label>
            <Textarea
              id="ov-description"
              rows={3}
              value={draft.description ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
            />
          </div>
          <div className="max-w-measure space-y-1.5">
            <Label htmlFor="ov-scope">Notas de alcance</Label>
            <Textarea
              id="ov-scope"
              rows={3}
              value={draft.scopeNotes ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, scopeNotes: e.target.value }))}
            />
          </div>

          {saveStatus.status === "error" && (
            <InlineNotice
              variant="danger"
              title="ERROR"
              description={saveStatus.errorMessage ?? "Revisa los campos marcados."}
            />
          )}

          <div className="flex items-center gap-4">
            <Button type="button" onClick={handleSave} disabled={!dirty || saveStatus.status === "saving"}>
              {saveStatus.status === "saving" ? "Guardando…" : "Guardar"}
            </Button>
            <Button type="button" variant="ghost" onClick={handleToggle}>
              Descartar
            </Button>
            <SaveStatusLine status={saveStatus} className="ml-auto" />
          </div>
        </div>
      </SummaryEditCard>

      <Card>
        <CardHeader>
          <CardTitle className="text-h3 text-danger">Zona de peligro</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 max-w-measure text-caption text-ink-muted">
            Eliminar un proyecto lo da de baja — deja de aparecer en tu lista de proyectos activos, pero no se
            destruye de forma permanente.
          </p>
          <Button type="button" variant="destructive" onClick={() => setDeleteOpen(true)}>
            Eliminar proyecto
          </Button>
        </CardContent>
      </Card>

      <AlertDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) {
            setDeleteWarning(null);
            setDeleteStatus("idle");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este proyecto?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteWarning ?? "Esto quitará el proyecto de tu lista activa."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteStatus === "error" && (
            <p className="font-mono text-[11px] text-danger">No se pudo eliminar — intenta de nuevo.</p>
          )}
          {/* Plain `Button`s, NOT `AlertDialogAction`/`AlertDialogCancel` —
              this is a two-step confirm on the SAME button (first click
              fetches the DIAN warning and relabels the button to "Eliminar
              de todos modos", second click actually confirms), which needs
              to keep the dialog open across that first click. Radix's
              `AlertDialogAction` always requests dismissal on click, which
              would silently close the dialog before the second click could
              ever happen — matching the pre-restyle code's own deliberate
              choice here, same reasoning as the AI-import BYOK dialog's
              own plain-`Button` footer (see the ADR). The one-shot DIAN
              deletes elsewhere (contract documents, tax documents) already
              have the warning BEFORE the dialog opens, so those correctly
              use `AlertDialogAction`/`AlertDialogCancel` — this is the one
              exception, not a reversion of that convention. */}
          <AlertDialogFooter>
            <Button type="button" variant="ghost" onClick={() => setDeleteOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteStatus === "deleting"}
              onClick={() => handleDelete(!!deleteWarning)}
            >
              {deleteStatus === "deleting" ? "Eliminando…" : deleteWarning ? "Eliminar de todos modos" : "Eliminar"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
