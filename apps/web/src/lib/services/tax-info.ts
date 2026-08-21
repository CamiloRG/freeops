/**
 * Tax Information — app_spec.md § "API Contracts & Integrations" → "1.
 * Freelancer profile, banking & tax data" (tax-info half).
 *
 * `tax_id_number_encrypted` follows the same envelope-encryption pattern
 * as banking details (see `@/lib/encryption`). Unlike the account number,
 * the API contract's `GET /api/v1/me/tax-info` response includes the
 * plaintext `taxId` (not masked) — the spec's contract literally lists
 * `{ taxId, taxRegime, ... }`, and a NIT/cédula is routinely shown
 * in-app elsewhere (invoices, cuentas de cobro), unlike a bank account
 * number which the spec explicitly calls out as "never returned after
 * creation."
 */
import { and, eq, isNull } from "drizzle-orm";
import { taxInfo, taxInfoDocuments } from "@freeops/db/schema";
import type { RlsTx } from "@freeops/db/rls-client";
import { decryptField, encryptField } from "@/lib/encryption";
import { ApiError } from "@/lib/api/errors";
import type { TaxInfoUpsertInput } from "@/lib/validation/personal";

export async function getTaxInfoRow(tx: RlsTx, userId: string) {
  return tx.query.taxInfo.findFirst({ where: eq(taxInfo.userId, userId) });
}

export async function getTaxInfoDecrypted(tx: RlsTx, userId: string) {
  const row = await getTaxInfoRow(tx, userId);
  if (!row) return null;
  return {
    ...row,
    taxIdNumber: decryptField(row.taxIdNumberEncrypted),
  };
}

export async function upsertTaxInfo(tx: RlsTx, userId: string, input: TaxInfoUpsertInput) {
  const existing = await getTaxInfoRow(tx, userId);
  const taxIdNumberEncrypted = encryptField(input.taxIdNumber);

  const shared = {
    taxIdType: input.taxIdType,
    taxIdNumberEncrypted,
    taxRegime: input.taxRegime ?? null,
    isGranContribuyente: input.isGranContribuyente ?? false,
    isIvaResponsible: input.isIvaResponsible ?? false,
    ciiuCode: input.ciiuCode || null,
    fiscalAddress: input.fiscalAddress || null,
  };

  if (existing) {
    const [updated] = await tx
      .update(taxInfo)
      .set({ ...shared, updatedAt: new Date() })
      .where(eq(taxInfo.id, existing.id))
      .returning();
    return { ...updated, taxIdNumber: input.taxIdNumber };
  }

  const [created] = await tx
    .insert(taxInfo)
    .values({ userId, ...shared })
    .returning();
  return { ...created, taxIdNumber: input.taxIdNumber };
}

export async function listTaxDocuments(tx: RlsTx, userId: string) {
  const info = await getTaxInfoRow(tx, userId);
  if (!info) return [];
  return tx.query.taxInfoDocuments.findMany({
    where: and(eq(taxInfoDocuments.taxInfoId, info.id), isNull(taxInfoDocuments.deletedAt)),
    orderBy: (t, { desc }) => [desc(t.uploadedAt)],
  });
}

export async function addTaxDocument(
  tx: RlsTx,
  userId: string,
  input: { fileKey: string; fileName: string; mimeType: string; documentType: "rut" | "camara_comercio" | "other" }
) {
  const info = await getTaxInfoRow(tx, userId);
  if (!info) {
    throw new ApiError(
      "UNPROCESSABLE_ENTITY",
      "Save your tax information before uploading supporting documents."
    );
  }
  const [created] = await tx
    .insert(taxInfoDocuments)
    .values({
      taxInfoId: info.id,
      documentType: input.documentType,
      fileKey: input.fileKey,
      fileName: input.fileName,
      mimeType: input.mimeType,
    })
    .returning();
  return created;
}

/** Returns the document row only if it belongs (via tax_info) to `userId` — RLS also enforces this, this is a defense-in-depth existence check for the 404 vs 403 distinction. */
export async function findOwnedTaxDocument(tx: RlsTx, userId: string, documentId: string) {
  const info = await getTaxInfoRow(tx, userId);
  if (!info) return null;
  return tx.query.taxInfoDocuments.findFirst({
    where: and(eq(taxInfoDocuments.id, documentId), eq(taxInfoDocuments.taxInfoId, info.id)),
  });
}

export async function softDeleteTaxDocument(tx: RlsTx, documentId: string) {
  const [updated] = await tx
    .update(taxInfoDocuments)
    .set({ deletedAt: new Date() })
    .where(eq(taxInfoDocuments.id, documentId))
    .returning();
  return updated;
}
