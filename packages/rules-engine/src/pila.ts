/**
 * Pure PILA (Planilla Integrada de Liquidación de Aportes) calculation —
 * no I/O, no DB access. Every rate/threshold it uses comes from a
 * validated `RegulatoryConfigPayload` supplied by the caller (typically
 * via `resolveActiveRegulatoryConfig`), per the "no formula is ever
 * hardcoded" principle in app_spec.md's rules-engine section.
 *
 * Two regimes, selected purely from data (never a hardcoded date/branch
 * in this file):
 *  - "standard": the pre-existing 40%-of-income IBC, floored at 1 SMLMV,
 *    ceilinged at 25 SMLMV — used whenever income is >= 1 SMLMV, or when
 *    the active config's period predates the 76 regime (no
 *    `partTimeIndependentRegime` block, so behavior is unchanged for any
 *    historical period).
 *  - "76": "cotizante tipo 76 — trabajador de tiempo parcial independiente"
 *    (Resolución 1529 de 2026, MinSalud, vigente desde periodos de
 *    2026-08) — used whenever income is below 1 SMLMV AND the active
 *    config declares `partTimeIndependentRegime`. Confirmed with the
 *    FreeOps team (2026-08-31): pension is always mandatory (IBC by
 *    days-worked bracket), ARL is always mandatory at a full-SMLMV/30-day
 *    IBC regardless of days actually worked, health is not mandatory in
 *    the contributory regime (never reported as a fabricated $0 — it's
 *    `null`), and caja de compensación familiar is voluntary.
 */
import type { ArlRiskClass, PartTimeIndependentRegime, RegulatoryConfigPayload } from "./config";

export type PilaCotizanteType = "standard" | "76";

export interface CalculatePilaInput {
  grossMonthlyIncomeCop: number;
  config: RegulatoryConfigPayload;
  /**
   * ARL affiliation is legally mandatory for independent-contractor
   * service agreements lasting over 1 month (and always required for
   * risk classes IV/V, per Decreto 1772 de 1994), and — separately —
   * always mandatory under the "76" regime below. This app has no
   * risk-class field anywhere else in its schema, and most FreeOps
   * freelancers doing knowledge work fall under Class I. Rather than
   * silently defaulting ARL on or off, the standard regime keeps treating
   * it as an explicit opt-in: pass `arlRiskClass` to include it, omit it
   * to exclude it. Under the "76" regime, the caller (the service layer)
   * is responsible for requiring it before calling this function — see
   * that layer's `needs_part_time_info` gate — since it's not optional
   * there; `calculatePila` itself still just returns `arlContribution:
   * null` if it's omitted, same defensive shape either way.
   */
  arlRiskClass?: ArlRiskClass;
  /** Required (validated by the caller) only when the "76" regime applies — the number of days actually worked in the period, 1-30. */
  daysWorkedInPeriod?: number;
  /**
   * Freelancer's voluntary choice to contribute to a caja de compensación
   * familiar — only meaningful under the "76" regime. Must be one of
   * `config.partTimeIndependentRegime.compensationFundRateOptions`;
   * omit to not contribute (the default — never assumed).
   */
  compensationFundRate?: number;
}

export interface CalculatePilaResult {
  cotizanteType: PilaCotizanteType;
  /** Pension contribution base income — under "76" this is the days-worked-bracket IBC, not a % of income. */
  ibc: number;
  /** ARL's own base income, only ever different from `ibc` under the "76" regime (always 1 SMLMV there, regardless of days worked). `null` when ARL wasn't computed (no `arlRiskClass` given). */
  arlIbc: number | null;
  /** `null` (never a fabricated `$0`) when health isn't mandatory for this calculation — i.e. under the "76" regime. */
  healthContribution: number | null;
  pensionContribution: number;
  arlContribution: number | null;
  /** `null` unless the freelancer opted into a caja de compensación familiar contribution (only possible under the "76" regime). */
  compensationFundContribution: number | null;
  totalAmountOwed: number;
}

/** Thrown when `calculatePila` receives an invalid gross income, or invalid/missing inputs for the regime it resolves into. */
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

function resolvePensionIbcFraction(
  regime: PartTimeIndependentRegime,
  daysWorkedInPeriod: number
): number {
  const sorted = [...regime.pensionIbcBrackets].sort((a, b) => a.daysUpTo - b.daysUpTo);
  const bracket = sorted.find((b) => daysWorkedInPeriod <= b.daysUpTo);
  if (!bracket) {
    // Schema validation already guarantees some bracket covers day 30, so
    // this only fires for an out-of-range daysWorkedInPeriod — caller's bug.
    throw new InvalidPilaInputError(
      `No pensionIbcBrackets entry covers daysWorkedInPeriod=${daysWorkedInPeriod}`
    );
  }
  return bracket.ibcFractionOfSmlmv;
}

/**
 * Computes IBC (contribution base income) and the resulting
 * health/pension/ARL/caja-de-compensación contributions for one month, per
 * a single validated regulatory config version. See this file's doc
 * comment for the two-regime selection rule.
 */
export function calculatePila(input: CalculatePilaInput): CalculatePilaResult {
  const { grossMonthlyIncomeCop, config, arlRiskClass, daysWorkedInPeriod, compensationFundRate } = input;

  if (
    typeof grossMonthlyIncomeCop !== "number" ||
    !Number.isFinite(grossMonthlyIncomeCop) ||
    grossMonthlyIncomeCop <= 0
  ) {
    throw new InvalidPilaInputError(
      `grossMonthlyIncomeCop must be a finite number > 0, got ${grossMonthlyIncomeCop}`
    );
  }

  const regime = config.partTimeIndependentRegime;
  const usesPartTimeRegime = grossMonthlyIncomeCop < config.smlmv && regime !== undefined;

  if (usesPartTimeRegime) {
    return calculatePilaPartTime(config, regime!, {
      daysWorkedInPeriod,
      arlRiskClass,
      compensationFundRate,
    });
  }

  const ibcFloor = config.ibcFloorSmlmv * config.smlmv;
  const ibcCeiling = config.ibcCeilingSmlmv * config.smlmv;
  const ibc = clamp(grossMonthlyIncomeCop * config.ibcMinPct, ibcFloor, ibcCeiling);

  const healthContribution = round2(ibc * config.healthPct);
  const pensionContribution = round2(ibc * config.pensionPct);

  const arlContribution =
    arlRiskClass === undefined ? null : round2(ibc * config.arlPctByClass[arlRiskClass]);

  const totalAmountOwed = round2(
    healthContribution + pensionContribution + (arlContribution ?? 0)
  );

  return {
    cotizanteType: "standard",
    ibc: round2(ibc),
    arlIbc: arlRiskClass === undefined ? null : round2(ibc),
    healthContribution,
    pensionContribution,
    arlContribution,
    compensationFundContribution: null,
    totalAmountOwed,
  };
}

function calculatePilaPartTime(
  config: RegulatoryConfigPayload,
  regime: PartTimeIndependentRegime,
  input: {
    daysWorkedInPeriod: number | undefined;
    arlRiskClass: ArlRiskClass | undefined;
    compensationFundRate: number | undefined;
  }
): CalculatePilaResult {
  const { daysWorkedInPeriod, arlRiskClass, compensationFundRate } = input;

  if (
    daysWorkedInPeriod === undefined ||
    !Number.isInteger(daysWorkedInPeriod) ||
    daysWorkedInPeriod < 1 ||
    daysWorkedInPeriod > 30
  ) {
    throw new InvalidPilaInputError(
      `daysWorkedInPeriod must be an integer between 1 and 30 under the "76" regime, got ${daysWorkedInPeriod}`
    );
  }

  const pensionIbc = round2(resolvePensionIbcFraction(regime, daysWorkedInPeriod) * config.smlmv);
  const pensionContribution = round2(pensionIbc * config.pensionPct);

  // ARL is always mandatory under this regime, at a full-SMLMV/30-day IBC
  // regardless of daysWorkedInPeriod — confirmed with the FreeOps team.
  // `calculatePila` still only computes it when a risk class is given (see
  // this file's `arlRiskClass` doc comment); the service layer is what
  // actually enforces it's required before reaching here.
  const arlIbc = round2(regime.arlIbcSmlmvMultiple * config.smlmv);
  const arlContribution = arlRiskClass === undefined ? null : round2(arlIbc * config.arlPctByClass[arlRiskClass]);

  let compensationFundContribution: number | null = null;
  if (compensationFundRate !== undefined) {
    if (!regime.compensationFundRateOptions.includes(compensationFundRate)) {
      throw new InvalidPilaInputError(
        `compensationFundRate=${compensationFundRate} is not one of the configured compensationFundRateOptions`
      );
    }
    compensationFundContribution = round2(pensionIbc * compensationFundRate);
  }

  const totalAmountOwed = round2(
    pensionContribution + (arlContribution ?? 0) + (compensationFundContribution ?? 0)
  );

  return {
    cotizanteType: "76",
    ibc: pensionIbc,
    arlIbc: arlRiskClass === undefined ? null : arlIbc,
    healthContribution: null,
    pensionContribution,
    arlContribution,
    compensationFundContribution,
    totalAmountOwed,
  };
}
