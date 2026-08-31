/**
 * Shared response-shaping for `/api/v1/withholding-certificates...`
 * routes — kept separate from `@/lib/services/withholding-certificates`
 * (pure data-access), same split `@/lib/services/finance-view` already
 * uses for cuentas de cobro/invoices.
 *
 * `fileKey` (the raw R2 object key) is never returned to the client —
 * only `hasFile`; routes that need a real download link fetch a signed
 * URL via `getSignedDownloadUrl` separately and merge it in (`fileUrl`),
 * same "never a raw key, always a short-lived signed URL" rule every
 * other file-backed entity in this app follows.
 */
import type { withholdingCertificates } from "@freeops/db/schema";

type WithholdingCertificateRow = typeof withholdingCertificates.$inferSelect;

export function serializeWithholdingCertificate(row: WithholdingCertificateRow) {
  return {
    id: row.id,
    projectId: row.projectId,
    cuentaDeCobroId: row.cuentaDeCobroId,
    invoiceId: row.invoiceId,
    clientName: row.clientName,
    taxYear: row.taxYear,
    period: row.period,
    required: row.required,
    status: row.status as "pending" | "received" | "not_applicable",
    receivedAt: row.receivedAt,
    expectedAmount: row.expectedAmount != null ? Number(row.expectedAmount) : null,
    hasFile: row.fileKey != null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
