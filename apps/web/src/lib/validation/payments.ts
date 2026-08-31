/**
 * Zod schemas for Payments / overdue tracking — app_spec.md § "API
 * Contracts & Integrations" → "11. Payments & overdue reminders". Same
 * shared-frontend/backend pattern as `@/lib/validation/finance`.
 *
 * `paymentListQuerySchema` differs from `financeListQuerySchema` in one
 * deliberate way: the spec's contract is a *repeated* `?status=` query
 * param (`?status=overdue&status=pending`), i.e. an array — not the single
 * value `financeListQuerySchema` handles for cuentas de cobro/invoices.
 * `"overdue"` is a valid filter value even though it is never a *stored*
 * `payments.status` value — it's the read-time-computed effective status
 * (see `@/lib/services/payments`'s doc comment).
 */
import { z } from "zod";

export const paymentEffectiveStatusSchema = z.enum(["pending", "partial", "paid", "overdue", "failed"]);

export const paymentListQuerySchema = z.object({
  status: z.array(paymentEffectiveStatusSchema).optional(),
});
export type PaymentListQuery = z.infer<typeof paymentListQuerySchema>;

export const markPaymentPaidSchema = z.object({
  paidDate: z.string().trim().min(1, "Ingresa la fecha de pago."),
  paidAmount: z.number().positive("El monto pagado debe ser mayor a 0.").optional(),
});
export type MarkPaymentPaidInput = z.infer<typeof markPaymentPaidSchema>;
