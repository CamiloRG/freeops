/**
 * Zod schemas for PILA calculation — app_spec.md § "API Contracts &
 * Integrations" → "13. PILA calculation (+ guided hand-off)". Same
 * shared-frontend/backend pattern as `@/lib/validation/finance`/
 * `@/lib/validation/payments`.
 */
import { z } from "zod";

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** `{ month: "YYYY-MM" }` — the only input `POST /api/v1/pila/calculations` accepts (see #7 of the stage brief: a client never posts a total or any computed figure). */
export const pilaCalculationCreateSchema = z.object({
  month: z.string().trim().regex(MONTH_RE, "Usa el formato AAAA-MM, p. ej. 2026-08."),
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
