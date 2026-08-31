/**
 * Zod schemas for Withholding-certificate tracking — app_spec.md § "API
 * Contracts & Integrations" → "12. Withholding certificates". Same
 * shared-frontend/backend pattern as `@/lib/validation/finance`.
 *
 * Tracking only — FreeOps never generates the certificate itself, so there
 * is no "compute expectedAmount" path here; it's always either freelancer-
 * entered or left `null` by the auto-creation hook (see
 * `@/lib/services/withholding-certificates`'s doc comment).
 */
import { z } from "zod";

export const withholdingCertificateStatusSchema = z.enum(["pending", "received", "not_applicable"]);

export const withholdingCertificateCreateSchema = z.object({
  projectId: z.uuid().optional().nullable(),
  clientName: z.string().trim().min(1, "Ingresa el nombre del cliente.").max(300),
  taxYear: z.number().int("El año fiscal debe ser un número entero.").min(2000).max(2100),
  period: z.string().trim().max(50).optional().or(z.literal("")),
  expectedAmount: z.number().nonnegative("El monto esperado no puede ser negativo.").optional(),
});
export type WithholdingCertificateCreateInput = z.infer<typeof withholdingCertificateCreateSchema>;

export const withholdingCertificateUpdateSchema = z.object({
  status: withholdingCertificateStatusSchema.optional(),
  receivedAt: z.string().trim().min(1).optional().nullable(),
});
export type WithholdingCertificateUpdateInput = z.infer<typeof withholdingCertificateUpdateSchema>;

export const withholdingCertificateListQuerySchema = z.object({
  status: withholdingCertificateStatusSchema.optional(),
  projectId: z.uuid().optional(),
});
