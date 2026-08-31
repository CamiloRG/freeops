"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Clock, ExternalLink, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { InlineNotice } from "@/components/ui/inline-notice";
import { cn } from "@/lib/utils";
import { PILA_OPERATOR_LABEL, type PilaOperator } from "@/lib/pila/operators";

export interface PilaRecordItem {
  id: string;
  month: string;
  periodYear: number;
  periodMonth: number;
  totalIncomeBase: number;
  ibc: number;
  healthContribution: number;
  pensionContribution: number;
  arlContribution: number | null;
  totalAmountOwed: number;
  operator: PilaOperator;
  status: "calculated" | "paid" | "overdue";
  paidAt: string | null;
  confirmationReference: string | null;
  createdAt: string;
  updatedAt: string;
}

interface OperatorLink {
  operator: string;
  label: string;
  url: string;
}

const STATUS_LABEL: Record<PilaRecordItem["status"], string> = {
  calculated: "Calculado",
  paid: "Pagado",
  overdue: "Vencido",
};

const STATUS_PILL: Record<PilaRecordItem["status"], string> = {
  calculated: "bg-surface-sunken text-ink-muted",
  paid: "bg-positive-tint text-positive-ink",
  overdue: "bg-critical-tint text-critical-ink",
};

const STATUS_ICON: Record<PilaRecordItem["status"], typeof Clock> = {
  calculated: Clock,
  paid: CheckCircle2,
  overdue: AlertTriangle,
};

const OPERATOR_OPTIONS: { value: PilaOperator; label: string }[] = [
  { value: "miplanilla", label: PILA_OPERATOR_LABEL.miplanilla },
  { value: "soi", label: PILA_OPERATOR_LABEL.soi },
  { value: "aportes_en_linea", label: PILA_OPERATOR_LABEL.aportes_en_linea },
  { value: "simple", label: PILA_OPERATOR_LABEL.simple },
  { value: "other", label: PILA_OPERATOR_LABEL.other },
];

function currentMonthValue(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function formatCurrency(value: number, currency = "COP") {
  try {
    return new Intl.NumberFormat("es-CO", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString()}`;
  }
}

function formatMonthLabel(month: string) {
  const [year, monthNum] = month.split("-").map(Number);
  const date = new Date(year, monthNum - 1, 1);
  const label = date.toLocaleDateString("es-CO", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function PilaWizard({ initialHistory }: { initialHistory: PilaRecordItem[] }) {
  const [history, setHistory] = useState<PilaRecordItem[]>(initialHistory);
  const [month, setMonth] = useState(currentMonthValue());

  const [loading, setLoading] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [current, setCurrent] = useState<PilaRecordItem | null>(null);
  const [emptyMonth, setEmptyMonth] = useState<string | null>(null);
  const [calcError, setCalcError] = useState<string | null>(null);
  const [hasCalculated, setHasCalculated] = useState(false);

  const [operatorLinks, setOperatorLinks] = useState<OperatorLink[] | null>(null);

  const [confirmPaidOpen, setConfirmPaidOpen] = useState(false);
  const [paidDate, setPaidDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [confirmationReference, setConfirmationReference] = useState("");
  const [paidOperator, setPaidOperator] = useState<PilaOperator>("other");
  const [confirmSaving, setConfirmSaving] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const [deleteState, setDeleteState] = useState<{ id: string; warning: string; confirmUrl: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const sortedHistory = useMemo(
    () => [...history].sort((a, b) => (a.month < b.month ? 1 : a.month > b.month ? -1 : 0)),
    [history]
  );

  async function fetchHandoff(id: string) {
    const res = await fetch(`/api/v1/pila/calculations/${id}/handoff`);
    const body = await res.json().catch(() => null);
    if (res.ok && body?.operatorLinks) {
      setOperatorLinks(body.operatorLinks);
    } else {
      setOperatorLinks(null);
    }
  }

  function applyRecord(record: PilaRecordItem) {
    setCurrent(record);
    setEmptyMonth(null);
    setHistory((arr) => {
      const withoutExisting = arr.filter((r) => r.id !== record.id);
      return [...withoutExisting, record];
    });
    void fetchHandoff(record.id);
  }

  async function handleCalculate() {
    setLoading(true);
    setCalcError(null);
    setEmptyMonth(null);
    setCurrent(null);
    setOperatorLinks(null);
    setHasCalculated(true);

    const existing = history.find((r) => r.month === month);
    if (existing) {
      applyRecord(existing);
      setLoading(false);
      return;
    }

    const res = await fetch("/api/v1/pila/calculations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month }),
    });
    const body = await res.json().catch(() => null);
    setLoading(false);

    if (res.status === 201 && body) {
      applyRecord(body);
      return;
    }
    if (res.status === 422) {
      setEmptyMonth(month);
      return;
    }
    if (res.status === 409 && body) {
      // Race: someone else's tab already created it — refetch and show it.
      const listRes = await fetch(`/api/v1/pila/calculations?month=${month}`);
      const listBody = await listRes.json().catch(() => null);
      if (listBody?.data?.[0]) {
        applyRecord(listBody.data[0]);
        return;
      }
    }
    setCalcError(body?.error?.message ?? "No se pudo calcular la PILA — intenta de nuevo.");
  }

  async function handleRecalculate() {
    if (!current) return;
    setRecalculating(true);
    setCalcError(null);
    const res = await fetch(`/api/v1/pila/calculations/${current.id}/recalculate`, { method: "PATCH" });
    const body = await res.json().catch(() => null);
    setRecalculating(false);
    if (!res.ok || !body) {
      setCalcError(body?.error?.message ?? "No se pudo recalcular — intenta de nuevo.");
      return;
    }
    applyRecord(body);
  }

  function openConfirmPaid() {
    setPaidDate(new Date().toISOString().slice(0, 10));
    setConfirmationReference("");
    setPaidOperator(current?.operator && current.operator !== "other" ? current.operator : "other");
    setConfirmError(null);
    setConfirmPaidOpen(true);
  }

  async function submitConfirmPaid() {
    if (!current) return;
    setConfirmSaving(true);
    setConfirmError(null);
    const res = await fetch(`/api/v1/pila/calculations/${current.id}/confirm-paid`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paidDate,
        confirmationReference: confirmationReference.trim() || undefined,
        operator: paidOperator,
      }),
    });
    const body = await res.json().catch(() => null);
    setConfirmSaving(false);
    if (!res.ok || !body) {
      setConfirmError(body?.error?.message ?? "No se pudo registrar el pago — intenta de nuevo.");
      return;
    }
    applyRecord(body);
    setConfirmPaidOpen(false);
  }

  async function requestDelete(item: PilaRecordItem) {
    const res = await fetch(`/api/v1/pila/calculations/${item.id}`, { method: "DELETE" });
    if (res.status === 204) {
      setHistory((arr) => arr.filter((it) => it.id !== item.id));
      if (current?.id === item.id) setCurrent(null);
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
      setHistory((arr) => arr.filter((it) => it.id !== deleteState.id));
      if (current?.id === deleteState.id) setCurrent(null);
    }
    setDeleteState(null);
  }

  return (
    <div className="px-9 pt-[26px] pb-8">
      <PageHeader
        title="PILA"
        description="Calcula el aporte mensual a seguridad social (IBC, salud y pensión) a partir de tus cuentas de cobro y facturas, y da seguimiento al pago."
      />

      <Card className="mb-8">
        <CardContent className="flex flex-wrap items-end gap-4 pt-0">
          <div className="space-y-1.5">
            <Label htmlFor="pila-month">Mes</Label>
            <Input
              id="pila-month"
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-44 font-mono text-data-mono"
            />
          </div>
          <Button type="button" onClick={handleCalculate} disabled={loading || !month}>
            {loading ? "Calculando…" : "Calcular"}
          </Button>
        </CardContent>
      </Card>

      {calcError && <InlineNotice variant="danger" title={calcError} className="mb-6" />}

      {loading && (
        <Card className="mb-8 animate-pulse">
          <CardContent className="space-y-3 pt-0">
            <div className="h-4 w-40 rounded bg-surface-sunken" />
            <div className="h-8 w-64 rounded bg-surface-sunken" />
            <div className="h-4 w-52 rounded bg-surface-sunken" />
          </CardContent>
        </Card>
      )}

      {!loading && hasCalculated && emptyMonth && (
        <InlineNotice
          variant="accent"
          title={`Nada que calcular para ${formatMonthLabel(emptyMonth)}`}
          description="No hay cuentas de cobro ni facturas registradas (emitidas, pagadas o vencidas) para ese mes — no se creó ningún cálculo. Esto no es lo mismo que un aporte de $0."
          className="mb-8"
        />
      )}

      {!loading && current && (
        <>
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-3">
                <span>{formatMonthLabel(current.month)}</span>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-pill px-[10px] py-[4px] text-[11px] font-medium",
                    STATUS_PILL[current.status]
                  )}
                >
                  {(() => {
                    const Icon = STATUS_ICON[current.status];
                    return <Icon className="size-3" aria-hidden="true" />;
                  })()}
                  {STATUS_LABEL[current.status]}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-4">
                <div>
                  <div className="font-mono text-label-mono tracking-[0.06em] text-ink-muted uppercase">
                    Ingreso base
                  </div>
                  <div className="mt-[6px] font-mono text-body text-ink">
                    {formatCurrency(current.totalIncomeBase)}
                  </div>
                </div>
                <div>
                  <div className="font-mono text-label-mono tracking-[0.06em] text-ink-muted uppercase">IBC</div>
                  <div className="mt-[6px] font-mono text-h3 text-ink">{formatCurrency(current.ibc)}</div>
                </div>
                <div>
                  <div className="font-mono text-label-mono tracking-[0.06em] text-ink-muted uppercase">Salud</div>
                  <div className="mt-[6px] font-mono text-body text-ink">
                    {formatCurrency(current.healthContribution)}
                  </div>
                </div>
                <div>
                  <div className="font-mono text-label-mono tracking-[0.06em] text-ink-muted uppercase">Pensión</div>
                  <div className="mt-[6px] font-mono text-body text-ink">
                    {formatCurrency(current.pensionContribution)}
                  </div>
                </div>
              </div>
              <div className="mt-6 border-t border-line-soft pt-5">
                <div className="font-mono text-label-mono tracking-[0.06em] text-ink-muted uppercase">
                  Total a pagar
                </div>
                <div className="mt-[6px] font-mono text-h1 text-ink">{formatCurrency(current.totalAmountOwed)}</div>
              </div>
              {current.status === "paid" && (
                <p className="mt-4 text-caption text-ink-soft">
                  Pagado el {current.paidAt ?? "—"}
                  {current.operator !== "other" ? ` vía ${PILA_OPERATOR_LABEL[current.operator]}` : ""}
                  {current.confirmationReference ? ` · ref. ${current.confirmationReference}` : ""}
                </p>
              )}
              <div className="mt-6 flex flex-wrap gap-3">
                {current.status === "calculated" && (
                  <>
                    <Button type="button" variant="outline" onClick={handleRecalculate} disabled={recalculating}>
                      {recalculating ? "Recalculando…" : "Recalcular"}
                    </Button>
                    <Button type="button" onClick={openConfirmPaid}>
                      Marcar como pagado
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {operatorLinks && (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Pagar en tu operador</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="mb-4 text-body-sm text-ink-soft">
                  Estos enlaces abren el sitio del operador en una pestaña nueva — no se envía ningún dato de tu
                  cálculo. Completa el pago allí y luego vuelve a marcar esta PILA como pagada.
                </p>
                <div className="flex flex-wrap gap-3">
                  {operatorLinks.map((link) => (
                    <a
                      key={link.operator}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-tile border border-line px-4 py-2 text-body-sm font-medium text-ink hover:bg-surface-sunken"
                    >
                      {link.label}
                      <ExternalLink className="size-3.5" aria-hidden="true" />
                    </a>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      <h2 className="mb-4 text-h3 text-ink">Historial</h2>
      {sortedHistory.length === 0 ? (
        <div className="max-w-measure py-10">
          <h3 className="text-h3 text-ink">Aún no hay cálculos de PILA</h3>
          <p className="mt-1.5 text-caption text-ink-muted">
            Selecciona un mes arriba y presiona &quot;Calcular&quot; para generar el primero.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-body-sm">
            <thead>
              <tr className="font-mono text-label-mono tracking-[0.14em] text-ink-muted uppercase">
                <th className="pb-2 font-normal">Mes</th>
                <th className="pb-2 text-right font-normal">IBC</th>
                <th className="pb-2 text-right font-normal">Total</th>
                <th className="pb-2 font-normal">Estado</th>
                <th className="pb-2 font-normal" />
              </tr>
            </thead>
            <tbody>
              {sortedHistory.map((item) => {
                const Icon = STATUS_ICON[item.status];
                return (
                  <tr key={item.id} className="border-t border-line-soft hover:bg-surface-sunken">
                    <td className="py-3 pr-4 text-ink">{formatMonthLabel(item.month)}</td>
                    <td className="py-3 pr-4 text-right font-mono text-data-mono text-ink">
                      {formatCurrency(item.ibc)}
                    </td>
                    <td className="py-3 pr-4 text-right font-mono text-data-mono text-ink">
                      {formatCurrency(item.totalAmountOwed)}
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
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setMonth(item.month);
                            applyRecord(item);
                            setHasCalculated(true);
                          }}
                        >
                          Ver
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-critical"
                          onClick={() => requestDelete(item)}
                        >
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

      <Dialog open={confirmPaidOpen} onOpenChange={setConfirmPaidOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marcar PILA como pagada</DialogTitle>
          </DialogHeader>
          {current && (
            <div className="space-y-4">
              <p className="text-body-sm text-ink-soft">
                {formatMonthLabel(current.month)} · {formatCurrency(current.totalAmountOwed)}
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="pila-paid-date">Fecha de pago</Label>
                <Input
                  id="pila-paid-date"
                  type="date"
                  value={paidDate}
                  onChange={(e) => setPaidDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pila-operator">Operador usado</Label>
                <Select value={paidOperator} onValueChange={(v) => setPaidOperator(v as PilaOperator)}>
                  <SelectTrigger id="pila-operator" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPERATOR_OPTIONS.map((op) => (
                      <SelectItem key={op.value} value={op.value}>
                        {op.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pila-confirmation-ref">Referencia de confirmación (opcional)</Label>
                <Input
                  id="pila-confirmation-ref"
                  value={confirmationReference}
                  onChange={(e) => setConfirmationReference(e.target.value)}
                  placeholder="p. ej. número de comprobante del operador"
                />
              </div>
              {confirmError && <InlineNotice variant="danger" title={confirmError} />}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setConfirmPaidOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={submitConfirmPaid} disabled={confirmSaving || !paidDate}>
              {confirmSaving ? "Guardando…" : "Confirmar pago"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteState} onOpenChange={(open) => !open && setDeleteState(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este cálculo de PILA?</AlertDialogTitle>
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
