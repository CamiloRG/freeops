import { Card } from "@/components/ui/card";

function formatCurrency(value: number | null, currency: string) {
  if (value == null) return null;
  try {
    return new Intl.NumberFormat("es-CO", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString()}`;
  }
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * The new mocks' "Vigencia del contrato" side panel — real fields only.
 * Dropped the mock's "N° de contrato" row (no contract-number field
 * exists on `projects`) and its "Otrosí pendiente de firma" alert (no
 * document sign-off/status is tracked, so there's no honest way to know
 * which upload, if any, is "pending").
 */
export function ContractValidityPanel({
  value,
  currency,
  startDate,
  expectedEndDate,
}: {
  value: number | null;
  currency: string;
  startDate: string | null;
  expectedEndDate: string | null;
}) {
  const start = startDate ? new Date(`${startDate}T00:00:00`) : null;
  const end = expectedEndDate ? new Date(`${expectedEndDate}T00:00:00`) : null;
  const totalDays = start && end ? Math.round((end.getTime() - start.getTime()) / 86_400_000) : null;
  const now = new Date();
  const elapsedDays = start ? Math.round((now.getTime() - start.getTime()) / 86_400_000) : null;
  const percentElapsed =
    totalDays && totalDays > 0 && elapsedDays != null
      ? Math.min(100, Math.max(0, Math.round((elapsedDays / totalDays) * 100)))
      : null;

  return (
    <Card className="h-fit w-full lg:w-[320px] lg:shrink-0">
      <div className="text-body-sm font-medium text-ink">Vigencia del contrato</div>
      <div className="mt-4 flex flex-col gap-3">
        <div className="flex items-center justify-between text-[13px]">
          <span className="text-ink-muted">Inicio</span>
          <span className="font-medium text-ink">{startDate ? formatDate(startDate) : "—"}</span>
        </div>
        <div className="flex items-center justify-between text-[13px]">
          <span className="text-ink-muted">Fin</span>
          <span className="font-medium text-ink">{expectedEndDate ? formatDate(expectedEndDate) : "—"}</span>
        </div>
        <div className="flex items-center justify-between text-[13px]">
          <span className="text-ink-muted">Valor total</span>
          <span className="font-medium text-ink">{formatCurrency(value, currency) ?? "—"}</span>
        </div>
      </div>

      {percentElapsed != null && (
        <>
          <div className="mt-4 flex items-center justify-between text-[12px] text-ink-muted">
            <span>Tiempo transcurrido</span>
            <span>{percentElapsed}%</span>
          </div>
          <div className="mt-1.5 h-[6px] w-full overflow-hidden rounded-pill bg-surface-sunken">
            <div className="h-full rounded-pill bg-accent" style={{ width: `${percentElapsed}%` }} />
          </div>
        </>
      )}
    </Card>
  );
}
