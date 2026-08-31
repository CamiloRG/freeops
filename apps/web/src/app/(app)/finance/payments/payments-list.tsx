"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Circle, Clock, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader } from "@/components/layout/page-header";
import { InlineNotice } from "@/components/ui/inline-notice";
import { StatTile, StatTileGrid } from "@/components/admin/stat-tile";
import { cn } from "@/lib/utils";
import type { OverdueDashboard } from "@/lib/services/payments";

export interface PaymentListItem {
  id: string;
  documentType: "cuenta_de_cobro" | "invoice";
  documentId: string;
  documentNumber: string;
  clientName: string;
  documentTotal: number;
  amountPaid: number | null;
  currency: string;
  dueDate: string;
  status: string;
  effectiveStatus: "pending" | "partial" | "paid" | "overdue" | "failed";
  daysOverdue: number | null;
  remindersSent: number;
  paidAt: string | null;
  paymentMethod: string | null;
  createdAt: string;
  updatedAt: string;
}

const STATUS_LABEL: Record<PaymentListItem["effectiveStatus"], string> = {
  pending: "Pendiente",
  partial: "Parcial",
  paid: "Pagado",
  overdue: "Vencido",
  failed: "Fallido",
};

const STATUS_PILL: Record<PaymentListItem["effectiveStatus"], string> = {
  pending: "bg-surface-sunken text-ink-muted",
  partial: "bg-accent-tint text-accent-press",
  paid: "bg-positive-tint text-positive-ink",
  overdue: "bg-critical-tint text-critical-ink",
  failed: "bg-critical-tint text-critical-ink",
};

// a11y: color is never the only signal for "overdue" (or any other
// status) — each pill always pairs its color with both an icon AND a text
// label (see `STATUS_LABEL` above).
const STATUS_ICON: Record<PaymentListItem["effectiveStatus"], typeof Clock> = {
  pending: Clock,
  partial: Circle,
  paid: CheckCircle2,
  overdue: AlertTriangle,
  failed: XCircle,
};

const DOCUMENT_TYPE_LABEL: Record<PaymentListItem["documentType"], string> = {
  cuenta_de_cobro: "Cuenta de cobro",
  invoice: "Factura",
};

function documentHref(item: PaymentListItem) {
  return item.documentType === "invoice"
    ? `/finance/invoices/${item.documentId}`
    : `/finance/cuentas-de-cobro/${item.documentId}`;
}

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

export function PaymentsList({
  initialItems,
  dashboard,
}: {
  initialItems: PaymentListItem[];
  dashboard: OverdueDashboard;
}) {
  const [items, setItems] = useState(initialItems);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [markPaidTarget, setMarkPaidTarget] = useState<PaymentListItem | null>(null);
  const [paidDate, setPaidDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paidAmount, setPaidAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = statusFilter === "all" ? items : items.filter((i) => i.effectiveStatus === statusFilter);
  const pendingCount = items.filter((i) => i.effectiveStatus === "pending").length;
  const topClient = dashboard.byClient[0] ?? null;

  function openMarkPaid(item: PaymentListItem) {
    setMarkPaidTarget(item);
    setPaidDate(new Date().toISOString().slice(0, 10));
    setPaidAmount("");
    setError(null);
  }

  async function confirmMarkPaid() {
    if (!markPaidTarget) return;
    setSaving(true);
    setError(null);
    const payload: Record<string, unknown> = { paidDate };
    if (paidAmount.trim()) payload.paidAmount = Number(paidAmount);

    const res = await fetch(`/api/v1/payments/${markPaidTarget.id}/mark-paid`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => null);
    setSaving(false);
    if (!res.ok || !body) {
      setError(body?.error?.message ?? "No se pudo registrar el pago — intenta de nuevo.");
      return;
    }
    setItems((arr) => arr.map((it) => (it.id === body.id ? { ...it, ...body } : it)));
    setMarkPaidTarget(null);
  }

  return (
    <div className="px-9 pt-[26px] pb-8">
      <PageHeader
        title="Pagos"
        description="Da seguimiento a los pagos de tus cuentas de cobro y facturas emitidas, y detecta cuáles están vencidos."
      />

      <StatTileGrid className="mb-8">
        <StatTile
          label="Total vencido"
          value={formatCurrency(dashboard.totalOverdueAmount, "COP")}
          tone={dashboard.count > 0 ? "warning" : "default"}
        />
        <StatTile label="Pagos vencidos" value={dashboard.count} tone={dashboard.count > 0 ? "warning" : "default"} />
        <StatTile label="Pagos pendientes" value={pendingCount} />
        <StatTile
          label="Mayor saldo pendiente"
          value={topClient ? formatCurrency(topClient.amount, "COP") : "—"}
          hint={topClient ? topClient.clientName : "Sin pagos vencidos"}
        />
      </StatTileGrid>

      <div className="mb-6 flex flex-wrap items-center gap-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44" aria-label="Filtrar por estado">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="pending">Pendiente</SelectItem>
            <SelectItem value="partial">Parcial</SelectItem>
            <SelectItem value="paid">Pagado</SelectItem>
            <SelectItem value="overdue">Vencido</SelectItem>
            <SelectItem value="failed">Fallido</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="max-w-measure py-10">
          <h3 className="text-h3 text-ink">Aún no hay pagos</h3>
          <p className="mt-1.5 text-caption text-ink-muted">
            {statusFilter !== "all"
              ? "Ningún pago coincide con este filtro."
              : "Los pagos se crean automáticamente al emitir una cuenta de cobro o factura."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-body-sm">
            <thead>
              <tr className="font-mono text-label-mono tracking-[0.14em] text-ink-muted uppercase">
                <th className="pb-2 font-normal">Cliente</th>
                <th className="pb-2 font-normal">Documento</th>
                <th className="pb-2 font-normal">Vence</th>
                <th className="pb-2 text-right font-normal">Valor</th>
                <th className="pb-2 font-normal">Estado</th>
                <th className="pb-2 font-normal" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const Icon = STATUS_ICON[item.effectiveStatus];
                const isPaid = item.effectiveStatus === "paid";
                return (
                  <tr key={item.id} className="border-t border-line-soft hover:bg-surface-sunken">
                    <td className="py-3 pr-4 text-ink">{item.clientName}</td>
                    <td className="py-3 pr-4">
                      <Link href={documentHref(item)} className="font-mono text-[12px] font-medium text-ink hover:text-accent">
                        {DOCUMENT_TYPE_LABEL[item.documentType]} · {item.documentNumber}
                      </Link>
                    </td>
                    <td className="py-3 pr-4 text-ink-soft">
                      {formatDate(item.dueDate)}
                      {item.daysOverdue != null && (
                        <span className="ml-1.5 text-[11px] text-critical">({item.daysOverdue}d)</span>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-right font-mono text-data-mono text-ink">
                      {formatCurrency(item.documentTotal, item.currency)}
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-pill px-[10px] py-[4px] text-[11px] font-medium",
                          STATUS_PILL[item.effectiveStatus]
                        )}
                      >
                        <Icon className="size-3" aria-hidden="true" />
                        {STATUS_LABEL[item.effectiveStatus]}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {!isPaid && (
                          <Button type="button" variant="outline" size="sm" onClick={() => openMarkPaid(item)}>
                            Marcar como pagada
                          </Button>
                        )}
                        <div className="flex items-center gap-1.5">
                          <Button type="button" variant="ghost" size="sm" disabled>
                            Enviar recordatorio
                          </Button>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-3 text-[11px] text-ink-muted">
            Enviar recordatorio: próximamente — llega en la fase de notificaciones.
          </p>
        </div>
      )}

      <Dialog open={!!markPaidTarget} onOpenChange={(open) => !open && setMarkPaidTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marcar pago como pagado</DialogTitle>
          </DialogHeader>
          {markPaidTarget && (
            <div className="space-y-4">
              <p className="text-body-sm text-ink-soft">
                {markPaidTarget.clientName} · {formatCurrency(markPaidTarget.documentTotal, markPaidTarget.currency)}
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="paid-date">Fecha de pago</Label>
                <Input id="paid-date" type="date" value={paidDate} onChange={(e) => setPaidDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="paid-amount">Monto pagado (opcional — por defecto el total)</Label>
                <Input
                  id="paid-amount"
                  type="number"
                  min={0}
                  className="font-mono text-data-mono"
                  placeholder={String(markPaidTarget.documentTotal)}
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                />
              </div>
              {error && <InlineNotice variant="danger" title={error} />}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setMarkPaidTarget(null)}>
              Cancelar
            </Button>
            <Button type="button" onClick={confirmMarkPaid} disabled={saving || !paidDate}>
              {saving ? "Guardando…" : "Confirmar pago"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
