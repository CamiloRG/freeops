"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Segmented, SegmentedItem } from "@/components/ui/segmented";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SummaryEditCard } from "@/components/personal/summary-edit-card";
import { useEditToggle } from "@/components/personal/use-edit-toggle";
import { SaveStatusLine } from "@/components/ui/save-status-line";
import { useSaveStatus } from "@/hooks/use-save-status";
import { InlineNotice } from "@/components/ui/inline-notice";
import { cn } from "@/lib/utils";
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
import type { CuentaDeCobroListItem, ProjectOption } from "../cuenta-de-cobro-list";

const STATUS_LABEL: Record<CuentaDeCobroListItem["status"], string> = {
  draft: "Borrador",
  issued: "Emitida",
  paid: "Pagada",
  overdue: "Vencida",
  cancelled: "Cancelada",
};

const STATUS_PILL: Record<CuentaDeCobroListItem["status"], string> = {
  draft: "bg-surface-sunken text-ink-muted",
  issued: "bg-accent-tint text-accent-press",
  paid: "bg-positive-tint text-positive-ink",
  overdue: "bg-critical-tint text-critical-ink",
  cancelled: "bg-critical-tint text-critical-ink",
};

function formatCurrency(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("es-CO", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString()}`;
  }
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });
}

type DraftItem = { description: string; quantity: string; unitAmount: string };

export interface CuentaDeCobroDetailData extends CuentaDeCobroListItem {
  pdfUrl: string | null;
}

export function CuentaDeCobroDetail({
  cdc: initialCdc,
  projectOptions,
}: {
  cdc: CuentaDeCobroDetailData;
  projectOptions: ProjectOption[];
}) {
  const router = useRouter();
  const [cdc, setCdc] = useState(initialCdc);
  const { editing, toggle } = useEditToggle();
  const saveStatus = useSaveStatus();

  const [form, setForm] = useState(() => ({
    projectId: cdc.projectId ?? "none",
    clientName: cdc.clientName,
    clientTaxId: cdc.clientTaxId ?? "",
    concept: cdc.concept,
    issueDate: cdc.issueDate,
    dueDate: cdc.dueDate,
    amount: String(cdc.amount),
  }));
  const [formItems, setFormItems] = useState<DraftItem[]>(() =>
    cdc.items && cdc.items.length > 0
      ? cdc.items.map((it) => ({ description: it.description, quantity: String(it.quantity), unitAmount: String(it.unitAmount) }))
      : [{ description: "", quantity: "1", unitAmount: "" }]
  );
  const [mode, setMode] = useState<"flat" | "items">(cdc.items && cdc.items.length > 0 ? "items" : "flat");

  const [issuing, setIssuing] = useState(false);
  const [issueError, setIssueError] = useState<string | null>(null);
  const [deleteState, setDeleteState] = useState<{ warning: string; confirmUrl: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleSave() {
    saveStatus.markSaving();
    const payload: Record<string, unknown> = {
      projectId: form.projectId === "none" ? null : form.projectId,
      clientName: form.clientName,
      clientTaxId: form.clientTaxId || "",
      concept: form.concept,
      issueDate: form.issueDate,
      dueDate: form.dueDate,
    };
    if (mode === "items") {
      const cleaned = formItems
        .filter((it) => it.description.trim())
        .map((it) => ({ description: it.description.trim(), quantity: Number(it.quantity), unitAmount: Number(it.unitAmount) }));
      if (cleaned.length === 0) {
        saveStatus.markError("Agrega al menos un ítem.");
        return;
      }
      payload.items = cleaned;
    } else {
      payload.items = null;
      payload.amount = Number(form.amount);
    }

    const res = await fetch(`/api/v1/cuentas-de-cobro/${cdc.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body) {
      saveStatus.markError(body?.error?.message ?? "No se pudo guardar — intenta de nuevo.");
      return;
    }
    setCdc((c) => ({ ...c, ...body }));
    saveStatus.markSaved();
    toggle();
  }

  async function handleIssue() {
    setIssuing(true);
    setIssueError(null);
    const res = await fetch(`/api/v1/cuentas-de-cobro/${cdc.id}/issue`, { method: "POST" });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.jobId) {
      setIssuing(false);
      setIssueError(body?.error?.message ?? "No se pudo emitir la cuenta de cobro.");
      return;
    }
    // Poll — generation is synchronous today, but the contract is real async shape (see route's doc comment).
    for (let attempt = 0; attempt < 10; attempt++) {
      const pollRes = await fetch(`/api/v1/cuentas-de-cobro/${cdc.id}/export/${body.jobId}`);
      const pollBody = await pollRes.json().catch(() => null);
      if (pollBody?.status === "done") {
        setIssuing(false);
        router.refresh();
        setCdc((c) => ({ ...c, status: "issued", hasPdf: true, pdfUrl: pollBody.fileUrl }));
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 700));
    }
    setIssuing(false);
    setIssueError("La generación está tardando más de lo esperado — recarga la página en un momento.");
  }

  async function requestDelete() {
    const res = await fetch(`/api/v1/cuentas-de-cobro/${cdc.id}`, { method: "DELETE" });
    if (res.status === 204) {
      router.push("/finance/cuentas-de-cobro");
      return;
    }
    const body = await res.json().catch(() => null);
    if (body?.confirmUrl) {
      setDeleteState({ warning: body.warning, confirmUrl: body.confirmUrl });
    }
  }

  async function confirmDelete() {
    if (!deleteState) return;
    setDeleting(true);
    const res = await fetch(deleteState.confirmUrl, { method: "DELETE" });
    setDeleting(false);
    if (res.status === 204) {
      router.push("/finance/cuentas-de-cobro");
      return;
    }
    setDeleteState(null);
  }

  const isDraft = cdc.status === "draft";

  return (
    <div className="px-9 pt-[26px] pb-8">
      <Link
        href="/finance/cuentas-de-cobro"
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-ink-muted transition-colors duration-fast ease-out hover:text-ink"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        Todas las cuentas de cobro
      </Link>

      <div className="mb-1 flex flex-wrap items-center gap-2.5">
        <h1 className="font-mono text-h2 text-ink">{cdc.number}</h1>
        <span className={cn("rounded-pill px-[10px] py-[4px] text-[12px] font-medium", STATUS_PILL[cdc.status])}>
          {STATUS_LABEL[cdc.status]}
        </span>
      </div>
      <p className="-mt-1 mb-6 text-body-sm text-ink-soft">
        {cdc.clientName} · {formatCurrency(cdc.amount, cdc.currency)}
      </p>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        {isDraft && (
          <Button type="button" onClick={handleIssue} disabled={issuing}>
            {issuing ? "Emitiendo…" : "Emitir cuenta de cobro"}
          </Button>
        )}
        {cdc.hasPdf && cdc.pdfUrl && (
          <Button type="button" variant="outline" asChild>
            <a href={cdc.pdfUrl} target="_blank" rel="noreferrer">
              Descargar PDF
            </a>
          </Button>
        )}
        {!isDraft && (
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" disabled>
              Enviar
            </Button>
            <span className="text-[11px] text-ink-muted">próximamente — llega en la fase de notificaciones</span>
          </div>
        )}
        <Button type="button" variant="ghost" className="ml-auto text-critical" onClick={requestDelete}>
          Eliminar
        </Button>
      </div>

      {issueError && <InlineNotice variant="danger" title={issueError} className="mb-4" />}

      {isDraft ? (
        <SummaryEditCard
          title="Detalle"
          editing={editing}
          onToggleEdit={toggle}
          cancelLabel="Cancelar"
          summary={
            <div className="space-y-3 text-body-sm">
              <SummaryRow label="Proyecto" value={projectOptions.find((p) => p.id === cdc.projectId)?.title ?? "Sin proyecto"} />
              <SummaryRow label="Cliente" value={cdc.clientName} />
              <SummaryRow label="NIT / CC cliente" value={cdc.clientTaxId ?? "—"} />
              <SummaryRow label="Concepto" value={cdc.concept} />
              <SummaryRow label="Fecha de emisión" value={formatDate(cdc.issueDate)} />
              <SummaryRow label="Fecha de vencimiento" value={formatDate(cdc.dueDate)} />
              {cdc.items && cdc.items.length > 0 ? (
                <div>
                  <div className="text-[12px] font-medium text-ink-muted">Ítems</div>
                  <table className="mt-1.5 w-full text-left text-[13px]">
                    <tbody>
                      {cdc.items.map((item, i) => (
                        <tr key={i} className="border-t border-line-soft">
                          <td className="py-1.5 pr-3 text-ink">{item.description}</td>
                          <td className="py-1.5 pr-3 text-ink-muted">{item.quantity}</td>
                          <td className="py-1.5 pr-3 text-ink-muted">{formatCurrency(item.unitAmount, cdc.currency)}</td>
                          <td className="py-1.5 text-right font-mono text-data-mono text-ink">
                            {formatCurrency(item.lineTotal, cdc.currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
              <SummaryRow label="Total" value={formatCurrency(cdc.amount, cdc.currency)} strong />
            </div>
          }
        >
          <div className="space-y-4">
            <div className="flex items-center justify-end">
              <SaveStatusLine status={saveStatus} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="edit-project">Proyecto</Label>
                <Select value={form.projectId} onValueChange={(v) => setForm((f) => ({ ...f, projectId: v }))}>
                  <SelectTrigger id="edit-project" className="w-full">
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
                <Label htmlFor="edit-client">Cliente</Label>
                <Input id="edit-client" value={form.clientName} onChange={(e) => setForm((f) => ({ ...f, clientName: e.target.value }))} />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="edit-tax-id">NIT / CC cliente</Label>
                <Input id="edit-tax-id" value={form.clientTaxId} onChange={(e) => setForm((f) => ({ ...f, clientTaxId: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-concept">Concepto</Label>
                <Input id="edit-concept" value={form.concept} onChange={(e) => setForm((f) => ({ ...f, concept: e.target.value }))} />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="edit-issue">Fecha de emisión</Label>
                <Input id="edit-issue" type="date" value={form.issueDate} onChange={(e) => setForm((f) => ({ ...f, issueDate: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-due">Fecha de vencimiento</Label>
                <Input id="edit-due" type="date" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Valor</Label>
              <Segmented value={mode} onValueChange={(v) => v && setMode(v as "flat" | "items")}>
                <SegmentedItem value="flat">Monto fijo</SegmentedItem>
                <SegmentedItem value="items">Ítems</SegmentedItem>
              </Segmented>
            </div>

            {mode === "flat" ? (
              <div className="space-y-1.5">
                <Label htmlFor="edit-amount">Valor (COP)</Label>
                <Input
                  id="edit-amount"
                  type="number"
                  min={0}
                  className="font-mono text-data-mono"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Ítems</Label>
                {formItems.map((item, index) => (
                  <div key={index} className="grid grid-cols-[1fr_70px_120px_auto] items-end gap-2">
                    <Input
                      value={item.description}
                      onChange={(e) => setFormItems((arr) => arr.map((it, i) => (i === index ? { ...it, description: e.target.value } : it)))}
                    />
                    <Input
                      type="number"
                      min={0}
                      value={item.quantity}
                      onChange={(e) => setFormItems((arr) => arr.map((it, i) => (i === index ? { ...it, quantity: e.target.value } : it)))}
                    />
                    <Input
                      type="number"
                      min={0}
                      className="font-mono text-data-mono"
                      value={item.unitAmount}
                      onChange={(e) => setFormItems((arr) => arr.map((it, i) => (i === index ? { ...it, unitAmount: e.target.value } : it)))}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={formItems.length === 1}
                      onClick={() => setFormItems((arr) => arr.filter((_, i) => i !== index))}
                    >
                      Quitar
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={() => setFormItems((arr) => [...arr, { description: "", quantity: "1", unitAmount: "" }])}>
                  + Agregar ítem
                </Button>
              </div>
            )}

            {saveStatus.status === "error" && (
              <InlineNotice variant="danger" title={saveStatus.errorMessage ?? "No se pudo guardar."} />
            )}

            <div className="flex justify-end gap-2 border-t border-line-soft pt-4">
              <Button type="button" variant="ghost" onClick={toggle}>
                Cancelar
              </Button>
              <Button type="button" onClick={handleSave} disabled={saveStatus.status === "saving"}>
                {saveStatus.status === "saving" ? "Guardando…" : "Guardar"}
              </Button>
            </div>
          </div>
        </SummaryEditCard>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Detalle</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-1 text-body-sm">
            <SummaryRow label="Proyecto" value={projectOptions.find((p) => p.id === cdc.projectId)?.title ?? "Sin proyecto"} />
            <SummaryRow label="Cliente" value={cdc.clientName} />
            <SummaryRow label="NIT / CC cliente" value={cdc.clientTaxId ?? "—"} />
            <SummaryRow label="Concepto" value={cdc.concept} />
            <SummaryRow label="Fecha de emisión" value={formatDate(cdc.issueDate)} />
            <SummaryRow label="Fecha de vencimiento" value={formatDate(cdc.dueDate)} />
            {cdc.items && cdc.items.length > 0 ? (
              <div>
                <div className="text-[12px] font-medium text-ink-muted">Ítems</div>
                <table className="mt-1.5 w-full text-left text-[13px]">
                  <tbody>
                    {cdc.items.map((item, i) => (
                      <tr key={i} className="border-t border-line-soft">
                        <td className="py-1.5 pr-3 text-ink">{item.description}</td>
                        <td className="py-1.5 pr-3 text-ink-muted">{item.quantity}</td>
                        <td className="py-1.5 pr-3 text-ink-muted">{formatCurrency(item.unitAmount, cdc.currency)}</td>
                        <td className="py-1.5 text-right font-mono text-data-mono text-ink">
                          {formatCurrency(item.lineTotal, cdc.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            <SummaryRow label="Total" value={formatCurrency(cdc.amount, cdc.currency)} strong />
          </CardContent>
        </Card>
      )}

      <AlertDialog open={!!deleteState} onOpenChange={(open) => !open && setDeleteState(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta cuenta de cobro?</AlertDialogTitle>
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

function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-[12px] text-ink-muted">{label}</span>
      <span className={cn("text-right", strong ? "font-mono text-data-mono font-semibold text-ink" : "text-ink")}>{value}</span>
    </div>
  );
}
