import Link from "next/link";
import { Card } from "@/components/ui/card";
import { displayColumnName } from "../kanban/kanban-types";

type BoardColumn = { id: string; name: string; tasks: { dueDate: string | null; title: string }[] };
type DocumentRow = { documentType: string };

const DOCUMENT_TYPE_LABEL: Record<string, string> = {
  executed_contract: "Contratos firmados",
  amendment: "Otrosíes",
  appendix: "Anexos",
  change_order: "Órdenes de cambio",
};

function formatCurrency(value: number | null, currency: string) {
  if (value == null) return null;
  try {
    return new Intl.NumberFormat("es-CO", { style: "currency", currency, notation: "compact", maximumFractionDigits: 1 }).format(
      value
    );
  } catch {
    return `${currency} ${value.toLocaleString()}`;
  }
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });
}

function daysBetween(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/**
 * Real, read-only project dashboard — the new mocks' "Resumen" tab. Every
 * number here is derived from data that actually exists (contract dates,
 * task/document counts); deliberately does NOT reproduce the mock's
 * "Por facturar"/"Cuentas por emitir"/Facturado-Pagado-Por-facturar
 * breakdown or the "otrosí pendiente de firma" alert — those need the
 * Facturación feature and a document sign-off status this app doesn't
 * track. See `billing/page.tsx`'s own placeholder for the former; the
 * latter has no substitute here rather than a guessed one.
 */
export function ProjectOverviewDashboard({
  projectId,
  value,
  currency,
  startDate,
  expectedEndDate,
  columns,
  documents,
}: {
  projectId: string;
  value: number | null;
  currency: string;
  startDate: string | null;
  expectedEndDate: string | null;
  columns: BoardColumn[] | null;
  documents: DocumentRow[] | null;
}) {
  const today = new Date();
  const start = startDate ? new Date(`${startDate}T00:00:00`) : null;
  const end = expectedEndDate ? new Date(`${expectedEndDate}T00:00:00`) : null;

  const totalDays = start && end ? daysBetween(start, end) : null;
  const elapsedDays = start ? daysBetween(start, today) : null;
  const remainingDays = end ? daysBetween(today, end) : null;
  const percentElapsed =
    totalDays && totalDays > 0 && elapsedDays != null
      ? Math.min(100, Math.max(0, Math.round((elapsedDays / totalDays) * 100)))
      : null;

  const totalTasks = columns?.reduce((sum, c) => sum + c.tasks.length, 0) ?? null;
  const totalDocuments = documents?.length ?? null;

  const documentsByType = new Map<string, number>();
  for (const doc of documents ?? []) {
    documentsByType.set(doc.documentType, (documentsByType.get(doc.documentType) ?? 0) + 1);
  }

  const overdueTasks = (columns ?? []).flatMap((c) =>
    c.tasks
      .filter((t) => t.dueDate && new Date(`${t.dueDate}T00:00:00`) < today)
      .map((t) => ({ ...t, columnName: c.name }))
  );

  const endingSoon = remainingDays != null && remainingDays >= 0 && remainingDays <= 30;
  const endingOverdue = remainingDays != null && remainingDays < 0;
  const hasAlerts = overdueTasks.length > 0 || endingSoon || endingOverdue;

  return (
    <div className="mb-8 flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card size="sm">
          <div className="font-mono text-label-mono tracking-[0.14em] text-ink-muted uppercase">
            Valor del contrato
          </div>
          <div className="mt-2 text-h3 text-ink">{formatCurrency(value, currency) ?? "—"}</div>
        </Card>
        <Card size="sm">
          <div className="font-mono text-label-mono tracking-[0.14em] text-ink-muted uppercase">
            Tiempo restante
          </div>
          <div className={`mt-2 text-h3 ${endingOverdue ? "text-critical-ink" : "text-ink"}`}>
            {remainingDays != null ? `${remainingDays} d` : "—"}
          </div>
          <div className="mt-1 text-[12px] text-ink-muted">
            {end ? `Cierre el ${formatDate(expectedEndDate!)}` : "Sin fecha de cierre"}
          </div>
        </Card>
        <Card size="sm">
          <div className="font-mono text-label-mono tracking-[0.14em] text-ink-muted uppercase">Tareas</div>
          <div className="mt-2 text-h3 text-ink">{totalTasks ?? "—"}</div>
          <div className="mt-1 text-[12px] text-ink-muted">
            {columns ? `en ${columns.length} columna${columns.length === 1 ? "" : "s"}` : "Sin tablero"}
          </div>
        </Card>
        <Card size="sm">
          <div className="font-mono text-label-mono tracking-[0.14em] text-ink-muted uppercase">Documentos</div>
          <div className="mt-2 text-h3 text-ink">{totalDocuments ?? 0}</div>
        </Card>
      </div>

      {percentElapsed != null && (
        <Card>
          <div className="flex items-center justify-between">
            <div className="text-body-sm font-medium text-ink">Avance del contrato</div>
            <div className="font-mono text-data-mono text-ink-muted">
              {formatDate(startDate!)} – {formatDate(expectedEndDate!)}
            </div>
          </div>
          <div className="mt-3 h-[6px] w-full overflow-hidden rounded-pill bg-surface-sunken">
            <div className="h-full rounded-pill bg-accent" style={{ width: `${percentElapsed}%` }} />
          </div>
          <div className="mt-2 flex items-center justify-between text-[12px] text-ink-muted">
            <span>{percentElapsed}% del plazo transcurrido</span>
            {remainingDays != null && (
              <span>{remainingDays >= 0 ? `${remainingDays} días restantes` : `${-remainingDays} días de retraso`}</span>
            )}
          </div>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_1fr_320px]">
        <Card>
          <div className="flex items-center justify-between">
            <div className="text-body-sm font-medium text-ink">Documentos</div>
            <Link href={`/business/projects/${projectId}/documents`} className="text-[13px] text-accent hover:underline">
              Ver todos →
            </Link>
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {documentsByType.size === 0 ? (
              <p className="text-[13px] text-ink-muted">Aún no hay documentos.</p>
            ) : (
              Array.from(documentsByType.entries()).map(([type, count]) => (
                <div key={type} className="flex items-center justify-between text-[13px]">
                  <span className="text-ink-soft">{DOCUMENT_TYPE_LABEL[type] ?? type}</span>
                  <span className="font-mono text-ink">{count}</span>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div className="text-body-sm font-medium text-ink">Tareas</div>
            <Link href={`/business/projects/${projectId}/kanban`} className="text-[13px] text-accent hover:underline">
              Ver kanban →
            </Link>
          </div>
          <div className="mt-3 flex flex-col gap-2.5">
            {!columns || columns.length === 0 ? (
              <p className="text-[13px] text-ink-muted">Aún no hay tablero de tareas.</p>
            ) : (
              columns.map((column) => {
                const pct = totalTasks && totalTasks > 0 ? Math.round((column.tasks.length / totalTasks) * 100) : 0;
                return (
                  <div key={column.id}>
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="text-ink-soft">{displayColumnName(column.name)}</span>
                      <span className="font-mono text-ink">{column.tasks.length}</span>
                    </div>
                    <div className="mt-1 h-[4px] w-full overflow-hidden rounded-pill bg-surface-sunken">
                      <div className="h-full rounded-pill bg-accent" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        <Card>
          <div className="text-body-sm font-medium text-ink">Requiere tu atención</div>
          <div className="mt-3 flex flex-col gap-2.5">
            {!hasAlerts ? (
              <p className="text-[13px] text-ink-muted">Todo al día — sin tareas vencidas ni cierres próximos.</p>
            ) : (
              <>
                {endingOverdue && (
                  <div className="rounded-tile bg-critical-tint p-3">
                    <div className="text-[13px] font-medium text-critical-ink">Contrato vencido</div>
                    <div className="text-[12px] text-ink-soft">
                      La fecha de cierre esperada fue el {formatDate(expectedEndDate!)}.
                    </div>
                  </div>
                )}
                {endingSoon && (
                  <div className="rounded-tile bg-attention-tint p-3">
                    <div className="text-[13px] font-medium text-attention-ink">Cierre próximo</div>
                    <div className="text-[12px] text-ink-soft">
                      Vence en {remainingDays} día{remainingDays === 1 ? "" : "s"} — {formatDate(expectedEndDate!)}.
                    </div>
                  </div>
                )}
                {overdueTasks.slice(0, 4).map((task) => (
                  <div key={task.title + task.dueDate} className="rounded-tile bg-critical-tint p-3">
                    <div className="truncate text-[13px] font-medium text-critical-ink">{task.title}</div>
                    <div className="text-[12px] text-ink-soft">
                      {displayColumnName(task.columnName)} · venció {formatDate(task.dueDate!)}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
