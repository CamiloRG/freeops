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
})
  .strict()
  .refine((cfg) => cfg.ibcCeilingSmlmv >= cfg.ibcFloorSmlmv, {
    message: "ibcCeilingSmlmv must be >= ibcFloorSmlmv",
    path: ["ibcCeilingSmlmv"],
  });

export type RegulatoryConfigPayload = z.infer<typeof regulatoryConfigPayloadSchema>;

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
