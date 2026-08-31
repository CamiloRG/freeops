"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock, MinusCircle, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader } from "@/components/layout/page-header";
import { InlineNotice } from "@/components/ui/inline-notice";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

export interface WithholdingCertificateListItem {
  id: string;
  projectId: string | null;
  cuentaDeCobroId: string | null;
  invoiceId: string | null;
  clientName: string;
  taxYear: number;
  period: string | null;
  required: boolean;
  status: "pending" | "received" | "not_applicable";
  receivedAt: string | null;
  expectedAmount: number | null;
  hasFile: boolean;
  fileUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectOption {
  id: string;
  title: string;
  clientName: string;
}

const STATUS_LABEL: Record<WithholdingCertificateListItem["status"], string> = {
  pending: "Pendiente",
  received: "Recibido",
  not_applicable: "No aplica",
};

const STATUS_PILL: Record<WithholdingCertificateListItem["status"], string> = {
  pending: "bg-surface-sunken text-ink-muted",
  received: "bg-positive-tint text-positive-ink",
  not_applicable: "bg-surface-sunken text-ink-muted",
};

const STATUS_ICON: Record<WithholdingCertificateListItem["status"], typeof Clock> = {
  pending: Clock,
  received: CheckCircle2,
  not_applicable: MinusCircle,
};

function formatCurrency(value: number, currency = "COP") {
  try {
    return new Intl.NumberFormat("es-CO", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString()}`;
  }
}

function documentHref(item: WithholdingCertificateListItem) {
  if (item.invoiceId) return `/finance/invoices/${item.invoiceId}`;
  if (item.cuentaDeCobroId) return `/finance/cuentas-de-cobro/${item.cuentaDeCobroId}`;
  return null;
}

const emptyDraft = {
  projectId: "none",
  clientName: "",
  taxYear: String(new Date().getFullYear()),
  period: "",
  expectedAmount: "",
};

export function WithholdingCertificateList({
  initialItems,
  projectOptions,
}: {
  initialItems: WithholdingCertificateListItem[];
  projectOptions: ProjectOption[];
}) {
  const [items, setItems] = useState(initialItems);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [editTarget, setEditTarget] = useState<WithholdingCertificateListItem | null>(null);
  const [editStatus, setEditStatus] = useState<WithholdingCertificateListItem["status"]>("pending");
  const [editReceivedAt, setEditReceivedAt] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const [deleteState, setDeleteState] = useState<{ id: string; warning: string; confirmUrl: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filtered = statusFilter === "all" ? items : items.filter((i) => i.status === statusFilter);

  function resetCreateDialog() {
    setDraft(emptyDraft);
    setCreateError(null);
  }

  async function handleCreate() {
    setCreateError(null);
    if (!draft.clientName.trim() || !draft.taxYear) {
      setCreateError("Ingresa el cliente y el año fiscal.");
      return;
    }
    setCreating(true);
    const res = await fetch("/api/v1/withholding-certificates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: draft.projectId === "none" ? undefined : draft.projectId,
        clientName: draft.clientName.trim(),
        taxYear: Number(draft.taxYear),
        period: draft.period.trim() || undefined,
        expectedAmount: draft.expectedAmount ? Number(draft.expectedAmount) : undefined,
      }),
    });
    const body = await res.json().catch(() => null);
    setCreating(false);
    if (!res.ok || !body) {
      setCreateError(body?.error?.message ?? "No se pudo crear el certificado — intenta de nuevo.");
      return;
    }
    setItems((arr) => [{ ...body, fileUrl: null }, ...arr]);
    setCreateOpen(false);
    resetCreateDialog();
  }

  function openEdit(item: WithholdingCertificateListItem) {
    setEditTarget(item);
    setEditStatus(item.status);
    setEditReceivedAt(item.receivedAt ?? "");
    setEditError(null);
  }

  async function confirmEdit() {
    if (!editTarget) return;
    setEditSaving(true);
    setEditError(null);
    const res = await fetch(`/api/v1/withholding-certificates/${editTarget.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: editStatus,
        receivedAt: editReceivedAt || null,
      }),
    });
    const body = await res.json().catch(() => null);
    setEditSaving(false);
    if (!res.ok || !body) {
      setEditError(body?.error?.message ?? "No se pudo actualizar — intenta de nuevo.");
      return;
    }
    setItems((arr) => arr.map((it) => (it.id === body.id ? { ...it, ...body } : it)));
    setEditTarget(null);
  }

  async function handleUpload(item: WithholdingCertificateListItem) {
    const file = fileInputRefs.current[item.id]?.files?.[0];
    if (!file) return;
    setUploadingId(item.id);
    setUploadError(null);
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`/api/v1/withholding-certificates/${item.id}/upload`, { method: "POST", body: formData });
    const body = await res.json().catch(() => null);
    setUploadingId(null);
    if (!res.ok || !body) {
      setUploadError(body?.error?.message ?? "No se pudo subir el archivo.");
      return;
    }
    setItems((arr) => arr.map((it) => (it.id === body.id ? { ...it, ...body } : it)));
    const input = fileInputRefs.current[item.id];
    if (input) input.value = "";
  }

  async function requestDelete(item: WithholdingCertificateListItem) {
    const res = await fetch(`/api/v1/withholding-certificates/${item.id}`, { method: "DELETE" });
    if (res.status === 204) {
      setItems((arr) => arr.filter((it) => it.id !== item.id));
      return;
    }
    const body = await res.json().catch(() => null);
    if (body?.confirmUrl) {
      setDeleteState({ id: item.id, warning: body.warning, confirmUrl: body.confirmUrl });
    }
  }

  async function confirmDelete() {
    if (!deleteState) return;
    setDeleting(true);
    const res = await fetch(deleteState.confirmUrl, { method: "DELETE" });
    setDeleting(false);
    if (res.status === 204) {
      setItems((arr) => arr.filter((it) => it.id !== deleteState.id));
    }
    setDeleteState(null);
  }

  return (
    <div className="px-9 pt-[26px] pb-8">
      <PageHeader
        title="Retenciones"
        description="Lleva el control de los certificados de retención que tus clientes deben enviarte."
        action={
          <Button type="button" onClick={() => setCreateOpen(true)}>
            + Nuevo certificado
          </Button>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44" aria-label="Filtrar por estado">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="pending">Pendiente</SelectItem>
            <SelectItem value="received">Recibido</SelectItem>
            <SelectItem value="not_applicable">No aplica</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {uploadError && <InlineNotice variant="danger" title={uploadError} className="mb-4" />}

      {filtered.length === 0 ? (
        <div className="max-w-measure py-10">
          <h3 className="text-h3 text-ink">Aún no hay certificados de retención</h3>
          <p className="mt-1.5 text-caption text-ink-muted">
            {statusFilter !== "all"
              ? "Ningún certificado coincide con este filtro."
              : "Se crean automáticamente al emitir una cuenta de cobro o factura que los requiera, o agrégalos manualmente."}
          </p>
          {statusFilter === "all" && (
            <Button type="button" variant="outline" className="mt-4" onClick={() => setCreateOpen(true)}>
              + Nuevo certificado
            </Button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-body-sm">
            <thead>
              <tr className="font-mono text-label-mono tracking-[0.14em] text-ink-muted uppercase">
                <th className="pb-2 font-normal">Cliente</th>
                <th className="pb-2 font-normal">Año fiscal</th>
                <th className="pb-2 font-normal">Período</th>
                <th className="pb-2 font-normal">Documento</th>
                <th className="pb-2 text-right font-normal">Monto esperado</th>
                <th className="pb-2 font-normal">Estado</th>
                <th className="pb-2 font-normal" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const Icon = STATUS_ICON[item.status];
                const href = documentHref(item);
                return (
                  <tr key={item.id} className="border-t border-line-soft hover:bg-surface-sunken">
                    <td className="py-3 pr-4 text-ink">{item.clientName}</td>
                    <td className="py-3 pr-4 font-mono text-data-mono text-ink-soft">{item.taxYear}</td>
                    <td className="py-3 pr-4 text-ink-soft">{item.period ?? "—"}</td>
                    <td className="py-3 pr-4">
                      {href ? (
                        <Link href={href} className="font-mono text-[12px] font-medium text-ink hover:text-accent">
                          Ver documento
                        </Link>
                      ) : (
                        <span className="text-ink-muted">—</span>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-right font-mono text-data-mono text-ink">
                      {item.expectedAmount != null ? formatCurrency(item.expectedAmount) : "—"}
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-pill px-[10px] py-[4px] text-[11px] font-medium",
                          STATUS_PILL[item.status]
                        )}
                      >
                        <Icon className="size-3" aria-hidden="true" />
                        {STATUS_LABEL[item.status]}
                      </span>
                      {item.hasFile && item.fileUrl && (
                        <a
                          href={item.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="ml-2 inline-flex items-center gap-1 text-[11px] text-ink-muted hover:text-accent"
                        >
                          <Paperclip className="size-3" aria-hidden="true" />
                          archivo
                        </a>
                      )}
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <input
                          ref={(el) => {
                            fileInputRefs.current[item.id] = el;
                          }}
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg,.docx"
                          className="hidden"
                          onChange={() => handleUpload(item)}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={uploadingId === item.id}
                          onClick={() => fileInputRefs.current[item.id]?.click()}
                        >
                          {uploadingId === item.id ? "Subiendo…" : "Subir archivo"}
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => openEdit(item)}>
                          Editar
                        </Button>
                        <Button type="button" variant="ghost" size="sm" className="text-critical" onClick={() => requestDelete(item)}>
                          Eliminar
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) resetCreateDialog();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo certificado de retención</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="wc-project">Proyecto (opcional)</Label>
              <Select value={draft.projectId} onValueChange={(v) => setDraft((d) => ({ ...d, projectId: v }))}>
                <SelectTrigger id="wc-project" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin proyecto</SelectItem>
                  {projectOptions.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.title} — {p.clientName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wc-client">Cliente</Label>
              <Input id="wc-client" value={draft.clientName} onChange={(e) => setDraft((d) => ({ ...d, clientName: e.target.value }))} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="wc-year">Año fiscal</Label>
                <Input
                  id="wc-year"
                  type="number"
                  value={draft.taxYear}
                  onChange={(e) => setDraft((d) => ({ ...d, taxYear: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="wc-period">Período (opcional)</Label>
                <Input
                  id="wc-period"
                  placeholder="p. ej. anual, marzo"
                  value={draft.period}
                  onChange={(e) => setDraft((d) => ({ ...d, period: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wc-amount">Monto esperado (opcional)</Label>
              <Input
                id="wc-amount"
                type="number"
                min={0}
                className="font-mono text-data-mono"
                value={draft.expectedAmount}
                onChange={(e) => setDraft((d) => ({ ...d, expectedAmount: e.target.value }))}
              />
            </div>
            {createError && <InlineNotice variant="danger" title={createError} />}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleCreate} disabled={creating}>
              {creating ? "Creando…" : "Crear certificado"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar estado</DialogTitle>
          </DialogHeader>
          {editTarget && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="wc-edit-status">Estado</Label>
                <Select value={editStatus} onValueChange={(v) => setEditStatus(v as typeof editStatus)}>
                  <SelectTrigger id="wc-edit-status" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pendiente</SelectItem>
                    <SelectItem value="received">Recibido</SelectItem>
                    <SelectItem value="not_applicable">No aplica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="wc-edit-received">Fecha de recepción (opcional)</Label>
                <Input
                  id="wc-edit-received"
                  type="date"
                  value={editReceivedAt}
                  onChange={(e) => setEditReceivedAt(e.target.value)}
                />
              </div>
              {editError && <InlineNotice variant="danger" title={editError} />}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setEditTarget(null)}>
              Cancelar
            </Button>
            <Button type="button" onClick={confirmEdit} disabled={editSaving}>
              {editSaving ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteState} onOpenChange={(open) => !open && setDeleteState(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este certificado?</AlertDialogTitle>
            <AlertDialogDescription>{deleteState?.warning}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleting}>
              Eliminar de todos modos
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
