/**
 * Zod schema for the `regulatory_config_versions.config` jsonb payload —
 * see `packages/db/src/schema/compliance.ts`. This is the single source of
 * truth for the shape of a Colombia PILA regulatory config row; every rule
 * consumed by this package must pass this validation before it is used in
 * any calculation, so a malformed row fails loudly at load time instead of
 * producing NaN/undefined math downstream (app_spec.md's config-driven
 * rules engine principle).
 *
 * Keys are camelCase for consistency with the rest of this TS codebase —
 * the jsonb body's own key casing is this package's call, independent of
 * the (already-camelCased-by-Drizzle) column name.
 */
import { z } from "zod";

/** ARL (workplace-risk-insurance) risk classes, per Decreto 1772 de 1994. */
export const arlRiskClassSchema = z.enum(["I", "II", "III", "IV", "V"]);
export type ArlRiskClass = z.infer<typeof arlRiskClassSchema>;

/**
 * Every numeric field is required to be a plain JS `number` — Zod's
 * `z.number()` already rejects strings (no implicit coercion), which is
 * exactly what we want: a stringified rate from a hand-edited JSON file or
 * a jsonb round-trip gone wrong must fail validation, not silently
 * participate in arithmetic.
 */
export const regulatoryConfigPayloadSchema = z.object({
  /** Salario Mínimo Mensual Legal Vigente, in COP, for the period. */
  smlmv: z.number().positive(),
  /** Fraction of gross monthly income used to compute the IBC (e.g. 0.40). */
  ibcMinPct: z.number().positive().max(1),
  /** IBC floor, expressed as a multiple of SMLMV (e.g. 1). */
  ibcFloorSmlmv: z.number().positive(),
  /** IBC ceiling, expressed as a multiple of SMLMV (e.g. 25). */
  ibcCeilingSmlmv: z.number().positive(),
  /** Health (EPS) contribution rate applied to the IBC (e.g. 0.125). */
  healthPct: z.number().positive().max(1),
  /** Pension (AFP) contribution rate applied to the IBC (e.g. 0.16). */
  pensionPct: z.number().positive().max(1),
  /** ARL contribution rate applied to the IBC, keyed by risk class. */
  arlPctByClass: z.object({
    I: z.number().nonnegative().max(1),
    II: z.number().nonnegative().max(1),
    III: z.number().nonnegative().max(1),
    IV: z.number().nonnegative().max(1),
    V: z.number().nonnegative().max(1),
  }),
  /** Unidad de Valor Tributario, in COP, for the period (DIAN thresholds). */
  uvtValue: z.number().positive(),
  /**
   * Optional "cotizante tipo 76" regime — Resolución 1529 de 2026 (MinSalud,
   * 24-jul-2026), created for independent workers earning below 1 SMLMV who
   * worked less than a full month, effective for periods from 2026-08
   * onward. Its presence on a given regulatory-config version is exactly
   * what gates whether `calculatePila` uses this regime for that period —
   * an older version with this field absent keeps producing the pre-76
   * behavior (IBC floored at 1 SMLMV) for its own period, which is the
   * legally correct historical result, not a bug. Confirmed with the
   * FreeOps team (2026-08-31): pension is always mandatory here (IBC by
   * days-worked bracket), ARL is always mandatory at a full-SMLMV/30-day
   * IBC regardless of days actually worked, health is not mandatory in the
   * contributory regime, and caja de compensación familiar is voluntary.
   */
  partTimeIndependentRegime: z
    .object({
      /**
       * IBC for pension, as a fraction of SMLMV, keyed by the upper bound
       * (inclusive) of days worked in the period. Must be sorted ascending
       * by `daysUpTo` and its last entry must cover day 30. Resolución
       * 1529/2026: 1-7d→1/4, 8-14d→2/4, 15-21d→3/4, 22-30d→1 SMLMV.
       */
      pensionIbcBrackets: z
        .array(
          z.object({
            daysUpTo: z.number().int().positive().max(31),
            ibcFractionOfSmlmv: z.number().positive().max(1),
          })
        )
        .min(1),
      /**
       * ARL IBC, as a multiple of SMLMV — always a full month (1 SMLMV,
       * i.e. `1`) regardless of `daysWorkedInPeriod`, per the confirmed
       * rule above. Kept as config (not hardcoded `1`) so a future
       * regulatory change doesn't require a code change.
       */
      arlIbcSmlmvMultiple: z.number().positive(),
      /** Voluntary caja de compensación familiar rates the freelancer may opt into (fraction of the pension IBC). */
      compensationFundRateOptions: z.array(z.number().positive().max(1)).min(1),
    })
    .optional(),
})
  .strict()
  .refine((cfg) => cfg.ibcCeilingSmlmv >= cfg.ibcFloorSmlmv, {
    message: "ibcCeilingSmlmv must be >= ibcFloorSmlmv",
    path: ["ibcCeilingSmlmv"],
  })
  .refine(
    (cfg) =>
      !cfg.partTimeIndependentRegime ||
      cfg.partTimeIndependentRegime.pensionIbcBrackets.some((b) => b.daysUpTo >= 30),
    {
      message: "partTimeIndependentRegime.pensionIbcBrackets must cover up to day 30",
      path: ["partTimeIndependentRegime", "pensionIbcBrackets"],
    }
  );

export type RegulatoryConfigPayload = z.infer<typeof regulatoryConfigPayloadSchema>;

/** The "cotizante tipo 76" regime block — see its field on `RegulatoryConfigPayload` above. */
export type PartTimeIndependentRegime = NonNullable<RegulatoryConfigPayload["partTimeIndependentRegime"]>;

/** Thrown when a `regulatory_config_versions.config` row fails validation. */
export class InvalidRegulatoryConfigError extends Error {
  readonly issues: z.ZodIssue[];

  constructor(issues: z.ZodIssue[], context?: string) {
    const detail = issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ");
    super(
      `Invalid regulatory config payload${context ? ` (${context})` : ""}: ${detail}`
    );
    this.name = "InvalidRegulatoryConfigError";
    this.issues = issues;
  }
}

/**
 * Parses and validates a raw jsonb `config` value. Throws
 * `InvalidRegulatoryConfigError` (never returns a partially-valid object)
 * on any schema violation, including wrong-typed numbers (e.g. a string
 * where a number belongs).
 */
export function parseRegulatoryConfigPayload(
  raw: unknown,
  context?: string
): RegulatoryConfigPayload {
  const result = regulatoryConfigPayloadSchema.safeParse(raw);
  if (!result.success) {
    throw new InvalidRegulatoryConfigError(result.error.issues, context);
  }
  return result.data;
}
