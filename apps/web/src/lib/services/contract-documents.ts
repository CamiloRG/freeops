/**
 * Contract & amendment documents — app_spec.md § "API Contracts &
 * Integrations" → "6. Contract & amendment documents". Financial/tax-
 * relevant per the Data Model section's own comment on `contract_documents`
 * ("executed contracts are audit evidence") — soft-delete + the DIAN
 * retention-warning pattern applies, same as tax-info documents (see
 * `@/lib/services/deletion-warnings`).
 */
import { and, desc, eq, isNull } from "drizzle-orm";
import { contractDocuments } from "@freeops/db/schema";
import type { RlsTx } from "@freeops/db/rls-client";
import { getOwnedProject } from "@/lib/services/projects";
import type { contractDocumentTypeSchema } from "@/lib/validation/business";
import type { z } from "zod";

export async function listContractDocuments(tx: RlsTx, userId: string, projectId: string) {
  const project = await getOwnedProject(tx, userId, projectId);
  if (!project) return null;
  return tx.query.contractDocuments.findMany({
    where: and(eq(contractDocuments.projectId, project.id), isNull(contractDocuments.deletedAt)),
    orderBy: [desc(contractDocuments.uploadedAt)],
  });
}

export async function addContractDocument(
  tx: RlsTx,
  userId: string,
  projectId: string,
  input: {
    fileKey: string;
    fileName: string;
    mimeType: string;
    fileSizeBytes: number;
    documentType: z.infer<typeof contractDocumentTypeSchema>;
    title: string;
  }
) {
  const project = await getOwnedProject(tx, userId, projectId);
  if (!project) return null;

  const [created] = await tx
    .insert(contractDocuments)
    .values({
      projectId: project.id,
      documentType: input.documentType,
      title: input.title,
      fileKey: input.fileKey,
      fileName: input.fileName,
      mimeType: input.mimeType,
      fileSizeBytes: input.fileSizeBytes,
    })
    .returning();
  return created;
}

/** Returns the document only if it belongs (via project) to `userId` — RLS also enforces this; defense-in-depth existence check for the 404 vs 403 distinction. */
export async function findOwnedContractDocument(
  tx: RlsTx,
  userId: string,
  projectId: string,
  documentId: string
) {
  const project = await getOwnedProject(tx, userId, projectId);
  if (!project) return null;
  return tx.query.contractDocuments.findFirst({
    where: and(eq(contractDocuments.id, documentId), eq(contractDocuments.projectId, project.id)),
  });
}

export async function softDeleteContractDocument(tx: RlsTx, documentId: string) {
  const [updated] = await tx
    .update(contractDocuments)
    .set({ deletedAt: new Date() })
    .where(eq(contractDocuments.id, documentId))
    .returning();
  return updated;
}
