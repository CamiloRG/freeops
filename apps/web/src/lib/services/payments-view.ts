/**
 * Shared response-shaping for `/api/v1/payments...` routes — kept
 * separate from `@/lib/services/payments` (pure data-access + join
 * logic), same split `@/lib/services/finance-view` already uses for
 * cuentas de cobro/invoices.
 */
import type { PaymentJoinedRow } from "@/lib/services/payments";

export function serializePayment(row: PaymentJoinedRow & { remindersSent: number }) {
  return {
    id: row.id,
    documentType: row.documentType,
    documentId: row.documentId,
    documentNumber: row.documentNumber,
    clientName: row.clientName,
    documentTotal: row.documentTotal,
    amountPaid: row.amountPaid,
    currency: row.currency,
    dueDate: row.dueDate,
    status: row.status,
    effectiveStatus: row.effectiveStatus,
    daysOverdue: row.daysOverdue,
    remindersSent: row.remindersSent,
    paidAt: row.paidAt,
    paymentMethod: row.paymentMethod,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
