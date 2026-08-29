/**
 * Pure PILA (Planilla Integrada de Liquidación de Aportes) calculation —
 * no I/O, no DB access. Every rate/threshold it uses comes from a
 * validated `RegulatoryConfigPayload` supplied by the caller (typically
 * via `resolveActiveRegulatoryConfig`), per the "no formula is ever
 * hardcoded" principle in app_spec.md's rules-engine section.
 */
import type { ArlRiskClass, RegulatoryConfigPayload } from "./config";

export interface CalculatePilaInput {
  grossMonthlyIncomeCop: number;
  config: RegulatoryConfigPayload;
  /**
   * ARL affiliation is legally mandatory for independent-contractor
   * service agreements lasting over 1 month (and always required for
   * risk classes IV/V, per Decreto 1772 de 1994). However, this app has
   * no risk-class field anywhere in its schema yet, and most FreeOps
   * freelancers doing knowledge work fall under Class I. Rather than
   * silently defaulting ARL on (which could misrepresent a contract that
   * hasn't captured risk class) or silently defaulting it off (which
   * could under-report a real legal obligation), this calculator treats
   * ARL as an explicit opt-in: pass `arlRiskClass` to include it, omit it
   * to exclude it. A future stage should decide how/where the
   * freelancer's risk class is captured — inventing that UI/data model
   * is out of scope for this stage.
   */
  arlRiskClass?: ArlRiskClass;
}

export interface CalculatePilaResult {
  ibc: number;
  healthContribution: number;
  pensionContribution: number;
  arlContribution: number | null;
  totalAmountOwed: number;
}

/** Thrown when `calculatePila` receives an invalid gross income. */
export class InvalidPilaInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidPilaInputError";
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Rounds to 2 decimal places (matches the DB's numeric(14,2) columns). */
function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Computes IBC (contribution base income) and the resulting health/pension
 * (and optionally ARL) contributions for one month, per a single validated
 * regulatory config version.
 */
export function calculatePila(input: CalculatePilaInput): CalculatePilaResult {
  const { grossMonthlyIncomeCop, config, arlRiskClass } = input;

  if (
    typeof grossMonthlyIncomeCop !== "number" ||
    !Number.isFinite(grossMonthlyIncomeCop) ||
    grossMonthlyIncomeCop <= 0
  ) {
    throw new InvalidPilaInputError(
      `grossMonthlyIncomeCop must be a finite number > 0, got ${grossMonthlyIncomeCop}`
    );
  }

  const ibcFloor = config.ibcFloorSmlmv * config.smlmv;
  const ibcCeiling = config.ibcCeilingSmlmv * config.smlmv;
  const ibc = clamp(grossMonthlyIncomeCop * config.ibcMinPct, ibcFloor, ibcCeiling);

  const healthContribution = round2(ibc * config.healthPct);
  const pensionContribution = round2(ibc * config.pensionPct);

  const arlContribution =
    arlRiskClass === undefined
      ? null
      : round2(ibc * config.arlPctByClass[arlRiskClass]);

  const totalAmountOwed = round2(
    healthContribution + pensionContribution + (arlContribution ?? 0)
  );

  return {
    ibc: round2(ibc),
    healthContribution,
    pensionContribution,
    arlContribution,
    totalAmountOwed,
  };
}
