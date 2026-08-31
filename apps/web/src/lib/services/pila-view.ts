/**
 * Shared response-shaping for `/api/v1/pila/calculations...` routes —
 * kept separate from `@/lib/services/pila` (pure data-access), same split
 * `@/lib/services/finance-view`/`@/lib/services/payments-view` already use.
 */
import type { pilaRecords } from "@freeops/db/schema";
import type { ArlRiskClass, PilaCotizanteType } from "@freeops/rules-engine";
import { formatPeriod } from "@/lib/services/pila";
import { PILA_OPERATOR_LINKS, type PilaOperator } from "@/lib/pila/operators";

type PilaRecordRow = typeof pilaRecords.$inferSelect;

/** `Number(null)` is `0` — never use it on a column that can legitimately be `null` ("not applicable"), or a real absence silently renders as a fabricated $0. */
function numberOrNull(value: string | null): number | null {
  return value != null ? Number(value) : null;
}

export function serializePilaRecord(row: PilaRecordRow) {
  return {
    id: row.id,
    month: formatPeriod(row.periodYear, row.periodMonth),
    periodYear: row.periodYear,
    periodMonth: row.periodMonth,
    totalIncomeBase: Number(row.totalIncomeBase),
    ibc: Number(row.ibc),
    // `null` (not $0) whenever health isn't mandatory — cotizante tipo 76 (Resolución 1529 de 2026).
    healthContribution: numberOrNull(row.healthContribution),
    pensionContribution: Number(row.pensionContribution),
    arlContribution: numberOrNull(row.arlContribution),
    arlIbc: numberOrNull(row.arlIbc),
    totalAmountOwed: Number(row.totalAmountOwed),
    cotizanteType: row.cotizanteType as PilaCotizanteType,
    daysWorkedInPeriod: row.daysWorkedInPeriod,
    arlRiskClass: row.arlRiskClass as ArlRiskClass | null,
    compensationFundRate: numberOrNull(row.compensationFundRate),
    compensationFundContribution: numberOrNull(row.compensationFundContribution),
    operator: row.operator as PilaOperator,
    status: row.status as "calculated" | "paid" | "overdue",
    paidAt: row.paidAt,
    confirmationReference: row.confirmationReference,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * `GET /api/v1/pila/calculations/:id/handoff` response body — always all
 * 4 operator links (per app_spec.md's response shape), plus the record's
 * own `ibc`/`totalAmountOwed`/period. Purely informational: never claims
 * submission occurred (see `@/lib/pila/operators`'s doc comment).
 */
export function buildPilaHandoff(row: PilaRecordRow) {
  return {
    operatorLinks: PILA_OPERATOR_LINKS.map((link) => ({
      operator: link.operator,
      label: link.label,
      url: link.url,
    })),
    ibc: Number(row.ibc),
    totalAmountOwed: Number(row.totalAmountOwed),
    month: formatPeriod(row.periodYear, row.periodMonth),
  };
}
