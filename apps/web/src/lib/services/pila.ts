/**
 * PILA calculation + guided operator hand-off — app_spec.md § "API
 * Contracts & Integrations" → "13. PILA calculation (+ guided hand-off)"
 * and § "PILA calculator" UX flow. Pure consumer of
 * `packages/rules-engine`'s `resolveActiveRegulatoryConfig` +
 * `calculatePila` — no formula is ever re-implemented here (per that
 * package's own doc comment). Same `RlsTx` + `userId` + typed-input shape
 * as every other service in this app (see `@/lib/services/payments`/
 * `@/lib/services/withholding-certificates` for the closest existing
 * reference).
 *
 * Income base (decided, not re-derived): for a given period, sum the
 * pre-tax `amount` column (NOT `totalAmount`) across every non-draft,
 * non-cancelled `cuentas_de_cobro` AND `invoices` row for that user whose
 * `issue_date` falls within that calendar month (`status in ('issued',
 * 'paid','overdue')`). If that sum is zero, no record is created — a
 * clean `422` instead (never a silent/fabricated $0 PILA record, per
 * app_spec.md's explicit "never show $0 as if it were a computed answer"
 * requirement).
 *
 * ARL stays opt-in/no-UI for the standard regime (see
 * `packages/rules-engine/src/pila.ts`'s own doc comment on why — no
 * risk-class field anywhere else in this app's schema). Cotizante tipo 76
 * (Resolución 1529 de 2026, periods from 2026-08 — see below) is the one
 * exception: ARL is legally mandatory there, so this service requires
 * `arlRiskClass` before calculating under that regime.
 *
 * Cotizante tipo 76 ("Trabajador de tiempo parcial Independiente"): when
 * the summed income for a period is below 1 SMLMV AND the resolved
 * regulatory config for that period declares `partTimeIndependentRegime`,
 * `createPilaCalculation` requires `daysWorkedInPeriod` + `arlRiskClass` in
 * the input — if either is missing, it throws a `422` carrying
 * `details: { reason: "needs_part_time_info", ... }` (never creates
 * anything) so the wizard can reveal those fields and resubmit. See
 * `@freeops/rules-engine`'s `calculatePila` doc comment for the full
 * regime rules (confirmed with the FreeOps team, 2026-08-31).
 *
 * Status lifecycle: this app's real schema enum is `calculated | paid |
 * overdue` (NOT the spec prose's `calculated|handed_off|confirmed_paid`
 * wording) — same "build around the real schema" precedent as every prior
 * Phase 7 stage. `overdue` is deliberately left unused this stage: a real
 * PILA due-date depends on the freelancer's NIT last digit and a
 * UGPP-published calendar that varies by year, and fabricating/
 * hardcoding one here would be worse than showing nothing. A later stage
 * should compute it properly (e.g. once the freelancer's NIT + a real
 * UGPP calendar config exist) — inventing that here is out of scope.
 *
 * Never trust a client-computed figure (app_spec.md's explicit financial-
 * accuracy rule) — the income sum, IBC, and every contribution figure are
 * always recomputed server-side in `createPilaCalculation`/
 * `recalculatePilaCalculation`; a client only ever posts `{ month, ... }`
 * (see the cotizante-76 note above for the 3 extra optional fields —
 * still raw declared facts, never a computed figure).
 */
import { and, desc, eq, gte, inArray, isNull, lt } from "drizzle-orm";
import { cuentasDeCobro, invoices, pilaRecords } from "@freeops/db/schema";
import type { RlsTx } from "@freeops/db/rls-client";
import { resolveActiveRegulatoryConfig, calculatePila, type ArlRiskClass, type CalculatePilaResult } from "@freeops/rules-engine";
import { ApiError } from "@/lib/api/errors";
import type { PilaCalculationCreateInput, PilaConfirmPaidInput } from "@/lib/validation/pila";

/** Cuentas de cobro / invoices statuses that count as real income for a period — non-draft, non-cancelled. */
const ELIGIBLE_DOCUMENT_STATUSES = ["issued", "paid", "overdue"] as const;

function toMoneyString(value: number): string {
  return value.toFixed(2);
}

function moneyOrNull(value: number | null): string | null {
  return value != null ? toMoneyString(value) : null;
}

/** Matches `compensation_fund_rate numeric(6,4)`. */
function toRateString(value: number): string {
  return value.toFixed(4);
}

/**
 * Maps a `calculatePila` result onto the subset of `pila_records` columns
 * both `createPilaCalculation` and `recalculatePilaCalculation` write —
 * shared so the two never drift out of sync on which fields go where.
 */
function buildPilaResultPatch(result: CalculatePilaResult) {
  return {
    ibc: toMoneyString(result.ibc),
    arlIbc: moneyOrNull(result.arlIbc),
    healthContribution: moneyOrNull(result.healthContribution),
    pensionContribution: toMoneyString(result.pensionContribution),
    arlContribution: moneyOrNull(result.arlContribution),
    compensationFundContribution: moneyOrNull(result.compensationFundContribution),
    totalAmountOwed: toMoneyString(result.totalAmountOwed),
    cotizanteType: result.cotizanteType,
  };
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "23505";
}

/** Parses a validated `"YYYY-MM"` string into its numeric parts. Exported (pure, no I/O) for unit testing. */
export function parseMonthParam(month: string): { periodYear: number; periodMonth: number } {
  const match = /^(\d{4})-(\d{2})$/.exec(month.trim());
  if (!match) {
    throw new ApiError("VALIDATION_ERROR", `Formato de mes inválido: "${month}". Usa AAAA-MM.`);
  }
  const periodYear = Number(match[1]);
  const periodMonth = Number(match[2]);
  if (periodMonth < 1 || periodMonth > 12) {
    throw new ApiError("VALIDATION_ERROR", `Mes fuera de rango: "${month}".`);
  }
  return { periodYear, periodMonth };
}

/** `"YYYY-MM"` for a stored `(periodYear, periodMonth)` pair — the inverse of `parseMonthParam`. Exported (pure) for tests/serialization. */
export function formatPeriod(periodYear: number, periodMonth: number): string {
  return `${periodYear}-${String(periodMonth).padStart(2, "0")}`;
}

/** `[start, end)` calendar-month date-string bounds (both `YYYY-MM-DD`, `end` exclusive) for an `issue_date` range filter. Exported (pure) for unit testing. */
export function monthDateRange(periodYear: number, periodMonth: number): { start: string; end: string } {
  const start = `${periodYear}-${String(periodMonth).padStart(2, "0")}-01`;
  const nextMonth = periodMonth === 12 ? 1 : periodMonth + 1;
  const nextYear = periodMonth === 12 ? periodYear + 1 : periodYear;
  const end = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
  return { start, end };
}

/** Sums a set of `numeric` money-column rows (stringified by Postgres/drizzle) into a plain JS number. Exported (pure) for unit testing. */
export function sumIncomeRows(rows: { amount: string | null }[]): number {
  return rows.reduce((sum, row) => sum + (row.amount != null ? Number(row.amount) : 0), 0);
}

/**
 * Sums this user's eligible cuentas de cobro + invoices `amount` (pre-tax)
 * for the given calendar month — see this file's doc comment for the
 * exact eligibility rule.
 */
export async function sumMonthlyIncome(
  tx: RlsTx,
  userId: string,
  periodYear: number,
  periodMonth: number
): Promise<number> {
  const { start, end } = monthDateRange(periodYear, periodMonth);

  const [cdcRows, invoiceRows] = await Promise.all([
    tx
      .select({ amount: cuentasDeCobro.amount })
      .from(cuentasDeCobro)
      .where(
        and(
          eq(cuentasDeCobro.userId, userId),
          isNull(cuentasDeCobro.deletedAt),
          inArray(cuentasDeCobro.status, ELIGIBLE_DOCUMENT_STATUSES),
          gte(cuentasDeCobro.issueDate, start),
          lt(cuentasDeCobro.issueDate, end)
        )
      ),
    tx
      .select({ amount: invoices.amount })
      .from(invoices)
      .where(
        and(
          eq(invoices.userId, userId),
          isNull(invoices.deletedAt),
          inArray(invoices.status, ELIGIBLE_DOCUMENT_STATUSES),
          gte(invoices.issueDate, start),
          lt(invoices.issueDate, end)
        )
      ),
  ]);

  return sumIncomeRows(cdcRows) + sumIncomeRows(invoiceRows);
}

export async function listPilaCalculations(tx: RlsTx, userId: string, month?: string) {
  const conditions = [eq(pilaRecords.userId, userId), isNull(pilaRecords.deletedAt)];
  if (month) {
    const { periodYear, periodMonth } = parseMonthParam(month);
    conditions.push(eq(pilaRecords.periodYear, periodYear));
    conditions.push(eq(pilaRecords.periodMonth, periodMonth));
  }
  return tx.query.pilaRecords.findMany({
    where: and(...conditions),
    orderBy: [desc(pilaRecords.periodYear), desc(pilaRecords.periodMonth), desc(pilaRecords.createdAt)],
  });
}

/** Returns the row only if it belongs to `userId` — RLS also enforces this; same 404-vs-403 existence check every other service uses. */
export async function getOwnedPilaCalculation(tx: RlsTx, userId: string, id: string) {
  return tx.query.pilaRecords.findFirst({
    where: and(eq(pilaRecords.id, id), eq(pilaRecords.userId, userId), isNull(pilaRecords.deletedAt)),
  });
}

/**
 * `POST /api/v1/pila/calculations` — creates a `calculated` record for
 * `input.month`. Throws `ApiError("UNPROCESSABLE_ENTITY", ...)` if no
 * eligible income exists for that month (see this file's doc comment —
 * never creates a $0 record), and `ApiError("CONFLICT", ...)` if one
 * already exists for that user+period (pre-checked here for a clean
 * message, backstopped by the DB's own unique constraint against a race).
 */
export async function createPilaCalculation(tx: RlsTx, userId: string, input: PilaCalculationCreateInput) {
  const { periodYear, periodMonth } = parseMonthParam(input.month);

  const existing = await tx.query.pilaRecords.findFirst({
    where: and(
      eq(pilaRecords.userId, userId),
      eq(pilaRecords.periodYear, periodYear),
      eq(pilaRecords.periodMonth, periodMonth),
      isNull(pilaRecords.deletedAt)
    ),
  });
  if (existing) {
    throw new ApiError(
      "CONFLICT",
      `Ya existe un cálculo de PILA para ${formatPeriod(periodYear, periodMonth)} — usa recalcular en su lugar.`
    );
  }

  const grossMonthlyIncomeCop = await sumMonthlyIncome(tx, userId, periodYear, periodMonth);
  if (grossMonthlyIncomeCop <= 0) {
    throw new ApiError(
      "UNPROCESSABLE_ENTITY",
      `No hay cuentas de cobro/facturas registradas para ${formatPeriod(periodYear, periodMonth)}.`
    );
  }

  const resolved = await resolveActiveRegulatoryConfig(tx, {
    country: "CO",
    forDate: new Date(Date.UTC(periodYear, periodMonth - 1, 1)),
  });

  const regime = resolved.config.partTimeIndependentRegime;
  const needsPartTimeInfo =
    grossMonthlyIncomeCop < resolved.config.smlmv &&
    regime !== undefined &&
    (input.daysWorkedInPeriod === undefined || input.arlRiskClass === undefined);
  if (needsPartTimeInfo) {
    throw new ApiError(
      "UNPROCESSABLE_ENTITY",
      `Ingresos de ${formatPeriod(periodYear, periodMonth)} inferiores a 1 SMLMV — se requieren días trabajados y clase de riesgo ARL para calcular bajo el cotizante tipo 76.`,
      {
        reason: "needs_part_time_info",
        cotizanteType: "76",
        grossMonthlyIncomeCop,
        pensionIbcBrackets: regime!.pensionIbcBrackets,
        compensationFundRateOptions: regime!.compensationFundRateOptions,
      }
    );
  }

  const result = calculatePila({
    grossMonthlyIncomeCop,
    config: resolved.config,
    daysWorkedInPeriod: input.daysWorkedInPeriod,
    arlRiskClass: input.arlRiskClass,
    compensationFundRate: input.compensationFundRate,
  });

  try {
    const [created] = await tx
      .insert(pilaRecords)
      .values({
        userId,
        periodYear,
        periodMonth,
        totalIncomeBase: toMoneyString(grossMonthlyIncomeCop),
        ...buildPilaResultPatch(result),
        daysWorkedInPeriod: result.cotizanteType === "76" ? input.daysWorkedInPeriod ?? null : null,
        arlRiskClass: input.arlRiskClass ?? null,
        compensationFundRate:
          result.compensationFundContribution != null && input.compensationFundRate !== undefined
            ? toRateString(input.compensationFundRate)
            : null,
        regulatoryConfigVersionId: resolved.id,
        status: "calculated",
      })
      .returning();
    return created;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ApiError(
        "CONFLICT",
        `Ya existe un cálculo de PILA para ${formatPeriod(periodYear, periodMonth)} — usa recalcular en su lugar.`
      );
    }
    throw error;
  }
}

/**
 * `PATCH /api/v1/pila/calculations/:id/recalculate` — only allowed while
 * `status = 'calculated'`; `422`s if already `paid`. Re-runs the same
 * income-sum + `calculatePila` logic against the (possibly updated)
 * active regulatory config for the record's own period, and overwrites
 * every computed figure. Returns `null` if not found/owned.
 */
export async function recalculatePilaCalculation(tx: RlsTx, userId: string, id: string) {
  const existing = await getOwnedPilaCalculation(tx, userId, id);
  if (!existing) return null;
  if (existing.status !== "calculated") {
    throw new ApiError("UNPROCESSABLE_ENTITY", "Este cálculo de PILA ya está marcado como pagado.");
  }

  const grossMonthlyIncomeCop = await sumMonthlyIncome(tx, userId, existing.periodYear, existing.periodMonth);
  if (grossMonthlyIncomeCop <= 0) {
    throw new ApiError(
      "UNPROCESSABLE_ENTITY",
      `No hay cuentas de cobro/facturas registradas para ${formatPeriod(existing.periodYear, existing.periodMonth)}.`
    );
  }

  const resolved = await resolveActiveRegulatoryConfig(tx, {
    country: "CO",
    forDate: new Date(Date.UTC(existing.periodYear, existing.periodMonth - 1, 1)),
  });

  // Reuses whatever days-worked/ARL-risk-class/caja-rate this record was
  // originally created with (never re-asks the client — recalculate takes
  // no body) — see this file's doc comment. If income has since crossed
  // back above 1 SMLMV, or the regime is no longer declared, `calculatePila`
  // simply falls back to the standard branch on its own; if it's now BELOW
  // 1 SMLMV for the first time (e.g. invoices were edited/removed) and the
  // record was never given days-worked/risk-class, the same
  // `needs_part_time_info` gate as `createPilaCalculation` applies —
  // recalculate can't silently invent those facts either.
  const regime = resolved.config.partTimeIndependentRegime;
  const needsPartTimeInfo =
    grossMonthlyIncomeCop < resolved.config.smlmv &&
    regime !== undefined &&
    (existing.daysWorkedInPeriod == null || existing.arlRiskClass == null);
  if (needsPartTimeInfo) {
    throw new ApiError(
      "UNPROCESSABLE_ENTITY",
      `Ingresos de ${formatPeriod(existing.periodYear, existing.periodMonth)} ahora inferiores a 1 SMLMV — este cálculo no tiene días trabajados ni clase de riesgo ARL registrados para el cotizante tipo 76. Elimínalo y créalo de nuevo con esa información.`,
      {
        reason: "needs_part_time_info",
        cotizanteType: "76",
        grossMonthlyIncomeCop,
        pensionIbcBrackets: regime!.pensionIbcBrackets,
        compensationFundRateOptions: regime!.compensationFundRateOptions,
      }
    );
  }

  const result = calculatePila({
    grossMonthlyIncomeCop,
    config: resolved.config,
    daysWorkedInPeriod: existing.daysWorkedInPeriod ?? undefined,
    arlRiskClass: (existing.arlRiskClass as ArlRiskClass | null) ?? undefined,
    compensationFundRate: existing.compensationFundRate != null ? Number(existing.compensationFundRate) : undefined,
  });

  const [updated] = await tx
    .update(pilaRecords)
    .set({
      totalIncomeBase: toMoneyString(grossMonthlyIncomeCop),
      ...buildPilaResultPatch(result),
      // Clear stale 76-only facts if this recalculation fell back to the
      // standard regime (e.g. income rose back above 1 SMLMV) — never show
      // a leftover "days worked" on a standard-regime record.
      daysWorkedInPeriod: result.cotizanteType === "76" ? existing.daysWorkedInPeriod : null,
      compensationFundRate: result.compensationFundContribution != null ? existing.compensationFundRate : null,
      regulatoryConfigVersionId: resolved.id,
      updatedAt: new Date(),
    })
    .where(eq(pilaRecords.id, id))
    .returning();
  return updated;
}

/**
 * `POST /api/v1/pila/calculations/:id/confirm-paid` — self-attested by
 * the freelancer after completing payment on their chosen operator's
 * site (there is no API into any of the 4 operators). `422`s if already
 * `paid`. Also persists `operator` onto the record when provided — this
 * is the natural point to record which operator was actually used, since
 * it's only known once payment is done. Returns `null` if not
 * found/owned.
 */
export async function confirmPilaPaid(tx: RlsTx, userId: string, id: string, input: PilaConfirmPaidInput) {
  const existing = await getOwnedPilaCalculation(tx, userId, id);
  if (!existing) return null;
  if (existing.status === "paid") {
    throw new ApiError("UNPROCESSABLE_ENTITY", "Este cálculo de PILA ya está marcado como pagado.");
  }

  const patch: Partial<typeof pilaRecords.$inferInsert> = {
    status: "paid",
    paidAt: input.paidDate,
    updatedAt: new Date(),
  };
  if (input.confirmationReference !== undefined) patch.confirmationReference = input.confirmationReference || null;
  if (input.operator !== undefined) patch.operator = input.operator;

  const [updated] = await tx.update(pilaRecords).set(patch).where(eq(pilaRecords.id, id)).returning();
  return updated;
}

export async function softDeletePilaCalculation(tx: RlsTx, id: string) {
  const [updated] = await tx.update(pilaRecords).set({ deletedAt: new Date() }).where(eq(pilaRecords.id, id)).returning();
  return updated;
}
