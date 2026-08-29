"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Segmented, SegmentedItem } from "@/components/ui/segmented";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader } from "@/components/layout/page-header";
import { InlineNotice } from "@/components/ui/inline-notice";
import { cn } from "@/lib/utils";

export interface CuentaDeCobroListItem {
  id: string;
  projectId: string | null;
  number: string;
  clientName: string;
  clientTaxId: string | null;
  concept: string;
  amount: number;
  items: { description: string; quantity: number; unitAmount: number; lineTotal: number }[] | null;
  currency: string;
  issueDate: string;
  dueDate: string;
  status: "draft" | "issued" | "paid" | "overdue" | "cancelled";
  requiresWithholdingCertificate: boolean;
  hasPdf: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectOption {
  id: string;
  title: string;
  clientName: string;
}

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
  return date.toLocaleDateString("es-CO", { month: "short", day: "numeric", year: "numeric" });
}

type DraftItem = { description: string; quantity: string; unitAmount: string };
const emptyDraftItem = (): DraftItem => ({ description: "", quantity: "1", unitAmount: "" });

const emptyDraft = {
  projectId: "none",
  clientName: "",
  clientTaxId: "",
  concept: "",
  amount: "",
  issueDate: new Date().toISOString().slice(0, 10),
  dueDate: "",
  requiresWithholdingCertificate: false,
};

export function CuentaDeCobroList({
  initialItems,
  projectOptions,
}: {
  initialItems: CuentaDeCobroListItem[];
  projectOptions: ProjectOption[];
}) {
  const router = useRouter();
  const [items] = useState(initialItems);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [mode, setMode] = useState<"flat" | "items">("flat");
  const [draft, setDraft] = useState(emptyDraft);
  const [draftItems, setDraftItems] = useState<DraftItem[]>([emptyDraftItem()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = statusFilter === "all" ? items : items.filter((i) => i.status === statusFilter);

  const itemsTotal = draftItems.reduce((sum, it) => {
    const qty = Number(it.quantity) || 0;
    const unit = Number(it.unitAmount) || 0;
    return sum + qty * unit;
  }, 0);

  function resetDialog() {
    setDraft(emptyDraft);
    setDraftItems([emptyDraftItem()]);
    setMode("flat");
    setError(null);
  }

  async function handleCreate() {
    setError(null);
    const payload: Record<string, unknown> = {
      projectId: draft.projectId === "none" ? undefined : draft.projectId,
      clientName: draft.clientName,
      clientTaxId: draft.clientTaxId || undefined,
      concept: draft.concept,
      issueDate: draft.issueDate,
      dueDate: draft.dueDate,
      requiresWithholdingCertificate: draft.requiresWithholdingCertificate,
    };
    if (mode === "items") {
      const cleaned = draftItems
        .filter((it) => it.description.trim())
        .map((it) => ({
          description: it.description.trim(),
          quantity: Number(it.quantity),
          unitAmount: Number(it.unitAmount),
        }));
      if (cleaned.length === 0) {
        setError("Agrega al menos un ítem.");
        return;
      }
      payload.items = cleaned;
    } else {
      payload.amount = draft.amount ? Number(draft.amount) : undefined;
    }

    setSaving(true);
    const res = await fetch("/api/v1/cuentas-de-cobro", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => null);
    setSaving(false);
    if (!res.ok || !body) {
      setError(body?.error?.message ?? "No se pudo crear la cuenta de cobro — intenta de nuevo.");
      return;
    }
    setDialogOpen(false);
    resetDialog();
    router.push(`/finance/cuentas-de-cobro/${body.id}`);
  }

  return (
    <div className="px-9 pt-[26px] pb-8">
      <PageHeader
        title="Cuentas de cobro"
        description="Genera cuentas de cobro para tus clientes y descarga el PDF una vez emitidas."
        action={
          <Button type="button" onClick={() => setDialogOpen(true)}>
            + Nueva cuenta de cobro
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
            <SelectItem value="draft">Borrador</SelectItem>
            <SelectItem value="issued">Emitida</SelectItem>
            <SelectItem value="paid">Pagada</SelectItem>
            <SelectItem value="overdue">Vencida</SelectItem>
            <SelectItem value="cancelled">Cancelada</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="max-w-measure py-10">
          <h3 className="text-h3 text-ink">Aún no hay cuentas de cobro</h3>
          <p className="mt-1.5 text-caption text-ink-muted">
            {statusFilter !== "all"
              ? "Ninguna cuenta de cobro coincide con este filtro."
              : "Crea tu primera cuenta de cobro para empezar a cobrarle a tus clientes."}
          </p>
          {statusFilter === "all" && (
            <Button type="button" variant="outline" className="mt-4" onClick={() => setDialogOpen(true)}>
              + Nueva cuenta de cobro
            </Button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-body-sm">
            <thead>
              <tr className="font-mono text-label-mono tracking-[0.14em] text-ink-muted uppercase">
                <th className="pb-2 font-normal">Número</th>
                <th className="pb-2 font-normal">Cliente</th>
                <th className="pb-2 font-normal">Concepto</th>
                <th className="pb-2 font-normal">Vence</th>
                <th className="pb-2 text-right font-normal">Valor</th>
                <th className="pb-2 text-right font-normal">Estado</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((cdc) => (
                <tr key={cdc.id} className="border-t border-line-soft hover:bg-surface-sunken">
                  <td className="py-3 pr-4">
                    <Link
                      href={`/finance/cuentas-de-cobro/${cdc.id}`}
                      className="font-mono text-[12px] font-medium text-ink hover:text-accent"
                    >
                      {cdc.number}
                    </Link>
                  </td>
                  <td className="py-3 pr-4 text-ink">{cdc.clientName}</td>
                  <td className="max-w-[240px] truncate py-3 pr-4 text-ink-soft">{cdc.concept}</td>
                  <td className="py-3 pr-4 text-ink-soft">{formatDate(cdc.dueDate)}</td>
                  <td className="py-3 pr-4 text-right font-mono text-data-mono text-ink">
                    {formatCurrency(cdc.amount, cdc.currency)}
                  </td>
                  <td className="py-3 text-right">
                    <span className={cn("rounded-pill px-[10px] py-[4px] text-[11px] font-medium", STATUS_PILL[cdc.status])}>
                      {STATUS_LABEL[cdc.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetDialog();
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nueva cuenta de cobro</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="cdc-project">Proyecto (opcional)</Label>
                <Select value={draft.projectId} onValueChange={(v) => setDraft((d) => ({ ...d, projectId: v }))}>
                  <SelectTrigger id="cdc-project" className="w-full">
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
                <Label htmlFor="cdc-client">Nombre del cliente</Label>
                <Input
                  id="cdc-client"
                  value={draft.clientName}
                  onChange={(e) => setDraft((d) => ({ ...d, clientName: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="cdc-tax-id">NIT / CC del cliente (opcional)</Label>
                <Input
                  id="cdc-tax-id"
                  value={draft.clientTaxId}
                  onChange={(e) => setDraft((d) => ({ ...d, clientTaxId: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cdc-concept">Concepto</Label>
                <Input
                  id="cdc-concept"
                  placeholder={mode === "items" ? "p. ej. Servicios profesionales — ver detalle" : "Descripción del cobro"}
                  value={draft.concept}
                  onChange={(e) => setDraft((d) => ({ ...d, concept: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="cdc-issue">Fecha de emisión</Label>
                <Input
                  id="cdc-issue"
                  type="date"
                  value={draft.issueDate}
                  onChange={(e) => setDraft((d) => ({ ...d, issueDate: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cdc-due">Fecha de vencimiento</Label>
                <Input
                  id="cdc-due"
                  type="date"
                  value={draft.dueDate}
                  onChange={(e) => setDraft((d) => ({ ...d, dueDate: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-tile bg-surface-sunken px-4 py-3">
              <div>
                <div className="text-body-sm font-medium text-ink">Requiere certificado de retención</div>
                <div className="text-[12px] text-ink-muted">El cliente necesitará un certificado luego del pago.</div>
              </div>
              <Switch
                checked={draft.requiresWithholdingCertificate}
                onCheckedChange={(v) => setDraft((d) => ({ ...d, requiresWithholdingCertificate: v }))}
              />
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
                <Label htmlFor="cdc-amount">Valor (COP)</Label>
                <Input
                  id="cdc-amount"
                  type="number"
                  min={0}
                  className="font-mono text-data-mono"
                  value={draft.amount}
                  onChange={(e) => setDraft((d) => ({ ...d, amount: e.target.value }))}
                />
              </div>
            ) : (
              <div className="space-y-2">
                {draftItems.map((item, index) => (
                  <div key={index} className="grid grid-cols-[1fr_70px_120px_auto] items-end gap-2">
                    <div className="space-y-1">
                      {index === 0 && <Label className="text-[11px]">Descripción</Label>}
                      <Input
                        value={item.description}
                        onChange={(e) =>
                          setDraftItems((arr) => arr.map((it, i) => (i === index ? { ...it, description: e.target.value } : it)))
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      {index === 0 && <Label className="text-[11px]">Cant.</Label>}
                      <Input
                        type="number"
                        min={0}
                        value={item.quantity}
                        onChange={(e) =>
                          setDraftItems((arr) => arr.map((it, i) => (i === index ? { ...it, quantity: e.target.value } : it)))
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      {index === 0 && <Label className="text-[11px]">Valor unit.</Label>}
                      <Input
                        type="number"
                        min={0}
                        className="font-mono text-data-mono"
                        value={item.unitAmount}
                        onChange={(e) =>
                          setDraftItems((arr) => arr.map((it, i) => (i === index ? { ...it, unitAmount: e.target.value } : it)))
                        }
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={draftItems.length === 1}
                      onClick={() => setDraftItems((arr) => arr.filter((_, i) => i !== index))}
                    >
                      Quitar
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={() => setDraftItems((arr) => [...arr, emptyDraftItem()])}>
                  + Agregar ítem
                </Button>
                <div className="flex justify-end border-t border-line-soft pt-2 text-body-sm">
                  <span className="text-ink-muted">Total: </span>
                  <span className="ml-1.5 font-mono text-data-mono font-semibold text-ink">
                    {formatCurrency(itemsTotal, "COP")}
                  </span>
                </div>
              </div>
            )}

            {error && <InlineNotice variant="danger" title={error} />}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleCreate}
              disabled={saving || !draft.clientName || !draft.concept || !draft.issueDate || !draft.dueDate}
            >
              {saving ? "Creando…" : "Crear cuenta de cobro"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
