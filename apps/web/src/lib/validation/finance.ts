/**
 * Zod schemas for the Finance module (Phase 7 Stage 2: cuentas de cobro,
 * invoices) — app_spec.md § "API Contracts & Integrations" → "9. Cuentas
 * de cobro", "10. Invoices". Same shared-frontend/backend pattern as
 * `@/lib/validation/business`/`@/lib/validation/personal`.
 *
 * Itemization: `items` is a real alternative to the flat `concept`+`amount`
 * (cuenta de cobro) / `amount` (invoice, pre-tax) entry — see
 * `packages/db/src/schema/finance.ts`'s `FinanceLineItem` doc comment.
 * When `items` is present it must be non-empty; `amount` becomes optional
 * on create in that case (the service layer computes it), but the
 * `.refine` below still requires one or the other so a client can never
 * submit neither.
 */
import { z } from "zod";

export const financeLineItemSchema = z.object({
  description: z.string().trim().min(1, "Ingresa una descripción.").max(500),
  quantity: z.number().positive("La cantidad debe ser mayor a 0."),
  unitAmount: z.number().nonnegative("El valor unitario no puede ser negativo."),
});
export type FinanceLineItemInput = z.infer<typeof financeLineItemSchema>;

const hasAmountOrItems = (data: { amount?: number | null; items?: unknown[] }) =>
  (data.items && data.items.length > 0) || data.amount != null;

// --- Cuentas de cobro --------------------------------------------------

export const cuentaDeCobroCreateSchema = z
  .object({
    projectId: z.uuid().optional().nullable(),
    clientName: z.string().trim().min(1, "Ingresa el nombre del cliente.").max(300),
    clientTaxId: z.string().trim().max(30).optional().or(z.literal("")),
    concept: z.string().trim().min(1, "Ingresa un concepto.").max(500),
    amount: z.number().nonnegative().optional(),
    items: z.array(financeLineItemSchema).min(1).optional(),
    currency: z.string().trim().length(3).optional(),
    issueDate: z.string().trim().min(1, "Ingresa la fecha de emisión."),
    dueDate: z.string().trim().min(1, "Ingresa la fecha de vencimiento."),
    requiresWithholdingCertificate: z.boolean().optional(),
  })
  .refine(hasAmountOrItems, { message: "Ingresa un valor o agrega al menos un ítem.", path: ["amount"] });
export type CuentaDeCobroCreateInput = z.infer<typeof cuentaDeCobroCreateSchema>;

export const cuentaDeCobroUpdateSchema = z.object({
  projectId: z.uuid().optional().nullable(),
  clientName: z.string().trim().min(1).max(300).optional(),
  clientTaxId: z.string().trim().max(30).optional().or(z.literal("")),
  concept: z.string().trim().min(1).max(500).optional(),
  amount: z.number().nonnegative().optional(),
  // `null` explicitly clears itemization back to the flat concept+amount
  // entry; `undefined` (absent) leaves items unchanged.
  items: z.array(financeLineItemSchema).min(1).optional().nullable(),
  currency: z.string().trim().length(3).optional(),
  issueDate: z.string().trim().min(1).optional(),
  dueDate: z.string().trim().min(1).optional(),
  requiresWithholdingCertificate: z.boolean().optional(),
});
export type CuentaDeCobroUpdateInput = z.infer<typeof cuentaDeCobroUpdateSchema>;

// --- Invoices ------------------------------------------------------------
// No `concept` field — `invoices` has no such column in the schema (only
// `cuentas_de_cobro` does); itemization still uses the same shape.

export const invoiceCreateSchema = z
  .object({
    projectId: z.uuid().optional().nullable(),
    cuentaDeCobroId: z.uuid().optional().nullable(),
    clientName: z.string().trim().min(1, "Ingresa el nombre del cliente.").max(300),
    clientTaxId: z.string().trim().max(30).optional().or(z.literal("")),
    amount: z.number().nonnegative().optional(), // pre-tax
    items: z.array(financeLineItemSchema).min(1).optional(),
    taxAmount: z.number().nonnegative().optional(),
    currency: z.string().trim().length(3).optional(),
    issueDate: z.string().trim().min(1, "Ingresa la fecha de emisión."),
    dueDate: z.string().trim().min(1, "Ingresa la fecha de vencimiento."),
  })
  .refine(hasAmountOrItems, { message: "Ingresa un valor o agrega al menos un ítem.", path: ["amount"] });
export type InvoiceCreateInput = z.infer<typeof invoiceCreateSchema>;

export const invoiceUpdateSchema = z.object({
  projectId: z.uuid().optional().nullable(),
  cuentaDeCobroId: z.uuid().optional().nullable(),
  clientName: z.string().trim().min(1).max(300).optional(),
  clientTaxId: z.string().trim().max(30).optional().or(z.literal("")),
  amount: z.number().nonnegative().optional(),
  items: z.array(financeLineItemSchema).min(1).optional().nullable(),
  taxAmount: z.number().nonnegative().optional(),
  currency: z.string().trim().length(3).optional(),
  issueDate: z.string().trim().min(1).optional(),
  dueDate: z.string().trim().min(1).optional(),
});
export type InvoiceUpdateInput = z.infer<typeof invoiceUpdateSchema>;

export const financeListQuerySchema = z.object({
  status: z.enum(["draft", "issued", "paid", "overdue", "cancelled"]).optional(),
  projectId: z.uuid().optional(),
});
