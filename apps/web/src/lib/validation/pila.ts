/**
 * Zod schemas for PILA calculation — app_spec.md § "API Contracts &
 * Integrations" → "13. PILA calculation (+ guided hand-off)". Same
 * shared-frontend/backend pattern as `@/lib/validation/finance`/
 * `@/lib/validation/payments`.
 */
import { z } from "zod";
import { arlRiskClassSchema } from "@freeops/rules-engine";

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * `POST /api/v1/pila/calculations` body. `month` is always required; the
 * other 3 fields are only needed when the resolved income for that month
 * is below 1 SMLMV AND the active regulatory config declares the
 * cotizante-76 regime ("partTimeIndependentRegime") — the server enforces
 * that requirement itself (see `createPilaCalculation`'s
 * `needs_part_time_info` gate), never trusting the client to know when
 * they're needed. Still just raw freelancer-declared facts (days worked,
 * risk class, a rate choice), never a computed figure — same "client never
 * posts a total" rule this schema already followed for `month`.
 */
export const pilaCalculationCreateSchema = z.object({
  month: z.string().trim().regex(MONTH_RE, "Usa el formato AAAA-MM, p. ej. 2026-08."),
  daysWorkedInPeriod: z.number().int().min(1).max(30).optional(),
  arlRiskClass: arlRiskClassSchema.optional(),
  compensationFundRate: z.number().positive().max(1).optional(),
});
export type PilaCalculationCreateInput = z.infer<typeof pilaCalculationCreateSchema>;

/** `?month=YYYY-MM` query filter for `GET /api/v1/pila/calculations`. */
export const pilaCalculationListQuerySchema = z.object({
  month: z.string().trim().regex(MONTH_RE, "Usa el formato AAAA-MM, p. ej. 2026-08.").optional(),
});
export type PilaCalculationListQuery = z.infer<typeof pilaCalculationListQuerySchema>;

export const pilaOperatorSchema = z.enum(["miplanilla", "soi", "aportes_en_linea", "simple", "other"]);

/** `POST /api/v1/pila/calculations/:id/confirm-paid` body. */
export const pilaConfirmPaidSchema = z.object({
  paidDate: z.string().trim().min(1, "Ingresa la fecha de pago."),
  confirmationReference: z.string().trim().max(200).optional(),
  operator: pilaOperatorSchema.optional(),
});
export type PilaConfirmPaidInput = z.infer<typeof pilaConfirmPaidSchema>;
