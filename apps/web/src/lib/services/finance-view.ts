/**
 * Shared response-shaping for `/api/v1/cuentas-de-cobro...` and
 * `/api/v1/invoices...` routes — kept separate from
 * `@/lib/services/finance` (pure data-access), same split
 * `@/lib/services/project-view` already uses for projects.
 *
 * `pdfFileKey` (the raw R2 object key) is never returned to the client —
 * only `hasPdf`; routes that need a real download link fetch a signed URL
 * via `getSignedDownloadUrl` separately (same "never a raw key, always a
 * short-lived signed URL" rule every other file-backed entity in this app
 * follows).
 */
import type { FinanceLineItem, cuentasDeCobro, invoices } from "@freeops/db/schema";

type CuentaDeCobroRow = typeof cuentasDeCobro.$inferSelect;
type InvoiceRow = typeof invoices.$inferSelect;

function withLineTotals(items: unknown) {
  if (!Array.isArray(items) || items.length === 0) return null;
  return (items as FinanceLineItem[]).map((item) => ({ ...item, lineTotal: item.quantity * item.unitAmount }));
}

export function serializeCuentaDeCobro(row: CuentaDeCobroRow) {
  return {
    id: row.id,
    projectId: row.projectId,
    number: row.number,
    clientName: row.clientName,
    clientTaxId: row.clientTaxId,
    concept: row.concept,
    amount: Number(row.amount),
    items: withLineTotals(row.items),
    currency: row.currency,
    issueDate: row.issueDate,
    dueDate: row.dueDate,
    status: row.status as "draft" | "issued" | "paid" | "overdue" | "cancelled",
    requiresWithholdingCertificate: row.requiresWithholdingCertificate,
    hasPdf: row.pdfFileKey != null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function serializeInvoice(row: InvoiceRow) {
  return {
    id: row.id,
    projectId: row.projectId,
    cuentaDeCobroId: row.cuentaDeCobroId,
    number: row.number,
    clientName: row.clientName,
    clientTaxId: row.clientTaxId,
    amount: Number(row.amount),
    items: withLineTotals(row.items),
    taxAmount: Number(row.taxAmount),
    totalAmount: Number(row.totalAmount),
    currency: row.currency,
    issueDate: row.issueDate,
    dueDate: row.dueDate,
    status: row.status as "draft" | "issued" | "paid" | "overdue" | "cancelled",
    eInvoicingStatus: row.eInvoicingStatus as "not_applicable" | "pending" | "submitted" | "accepted" | "rejected",
    hasPdf: row.pdfFileKey != null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
