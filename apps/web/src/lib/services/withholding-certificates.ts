/**
 * Withholding-certificate tracking — app_spec.md § "API Contracts &
 * Integrations" → "12. Withholding certificates". Tracking only — FreeOps
 * never generates the certificate itself, the freelancer uploads the copy
 * their client sends them. Same `RlsTx` + `userId` + typed-input shape as
 * every other service (see `@/lib/services/finance` for the closest
 * existing reference).
 *
 * Auto-creation hook: `createWithholdingCertificateForDocument` is called
 * from `@/lib/services/finance`'s `createCuentaDeCobro`/`createInvoice`,
 * in the SAME transaction, whenever the document's own
 * `requiresWithholdingCertificate` flag is true — app_spec.md §12: "on
 * POST cuentas-de-cobro/invoices creation where the computed withholding
 * rate > 0, backend auto-creates a pending withholding-certificate
 * tracking row." (There's no real "withholding rate" computation anywhere
 * in this app — `packages/rules-engine` is PILA-only, not DIAN
 * retention-in-source — so the boolean flag on the document is the
 * closest honest proxy for that spec condition; `expectedAmount` is left
 * `null` on auto-created rows for the same reason, never guessed.)
 *
 * `attachWithholdingCertificateFile` treats the freelancer uploading a
 * copy of the certificate as the "received" signal itself — it auto-sets
 * `status: 'received'`, `receivedAt: today` (unless already `'received'`).
 * The separate `updateWithholdingCertificateStatus` PATCH still allows
 * manually correcting status/receivedAt (e.g. marking `'not_applicable'`,
 * or backdating `receivedAt`).
 */
import { and, desc, eq, isNull } from "drizzle-orm";
import { withholdingCertificates } from "@freeops/db/schema";
import type { RlsTx } from "@freeops/db/rls-client";
import { ApiError } from "@/lib/api/errors";
import { getOwnedProject } from "@/lib/services/projects";
import type {
  WithholdingCertificateCreateInput,
  WithholdingCertificateUpdateInput,
} from "@/lib/validation/withholding";

function toMoneyString(value: number): string {
  return value.toFixed(2);
}

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

async function assertOwnedProjectIfProvided(tx: RlsTx, userId: string, projectId?: string | null) {
  if (!projectId) return;
  const project = await getOwnedProject(tx, userId, projectId);
  if (!project) {
    throw new ApiError("VALIDATION_ERROR", "El proyecto indicado no existe o no te pertenece.");
  }
}

export async function listWithholdingCertificates(
  tx: RlsTx,
  userId: string,
  filters: { status?: string; projectId?: string } = {}
) {
  const conditions = [eq(withholdingCertificates.userId, userId), isNull(withholdingCertificates.deletedAt)];
  if (filters.status) conditions.push(eq(withholdingCertificates.status, filters.status));
  if (filters.projectId) conditions.push(eq(withholdingCertificates.projectId, filters.projectId));
  return tx.query.withholdingCertificates.findMany({
    where: and(...conditions),
    orderBy: [desc(withholdingCertificates.createdAt)],
  });
}

/** Returns the row only if it belongs to `userId` — RLS also enforces this; same 404-vs-403 existence check every other service uses. */
export async function getOwnedWithholdingCertificate(tx: RlsTx, userId: string, id: string) {
  return tx.query.withholdingCertificates.findFirst({
    where: and(
      eq(withholdingCertificates.id, id),
      eq(withholdingCertificates.userId, userId),
      isNull(withholdingCertificates.deletedAt)
    ),
  });
}

/** Manual create path — freelancer explicitly tracking a certificate not tied to a specific document (or tied to one indirectly, via `projectId` only). */
export async function createWithholdingCertificate(
  tx: RlsTx,
  userId: string,
  input: WithholdingCertificateCreateInput
) {
  await assertOwnedProjectIfProvided(tx, userId, input.projectId);

  const [created] = await tx
    .insert(withholdingCertificates)
    .values({
      userId,
      projectId: input.projectId || null,
      cuentaDeCobroId: null,
      invoiceId: null,
      clientName: input.clientName,
      taxYear: input.taxYear,
      period: input.period || null,
      required: true,
      status: "pending",
      expectedAmount: input.expectedAmount != null ? toMoneyString(input.expectedAmount) : null,
    })
    .returning();
  return created;
}

/**
 * Auto-creation hook called from `@/lib/services/finance`'s
 * `createCuentaDeCobro`/`createInvoice`, same transaction — see this
 * file's doc comment. `expectedAmount` is always left `null` here (never
 * auto-computed).
 */
export async function createWithholdingCertificateForDocument(
  tx: RlsTx,
  userId: string,
  doc: {
    projectId: string | null;
    clientName: string;
    issueDate: string;
    cuentaDeCobroId: string | null;
    invoiceId: string | null;
  }
) {
  const taxYear = new Date(`${doc.issueDate}T00:00:00`).getFullYear();
  const [created] = await tx
    .insert(withholdingCertificates)
    .values({
      userId,
      projectId: doc.projectId,
      cuentaDeCobroId: doc.cuentaDeCobroId,
      invoiceId: doc.invoiceId,
      clientName: doc.clientName,
      taxYear,
      period: null,
      required: true,
      status: "pending",
      expectedAmount: null,
    })
    .returning();
  return created;
}

/** PATCH — manual status/receivedAt correction. Returns `null` if not found/owned. */
export async function updateWithholdingCertificateStatus(
  tx: RlsTx,
  userId: string,
  id: string,
  input: WithholdingCertificateUpdateInput
) {
  const existing = await getOwnedWithholdingCertificate(tx, userId, id);
  if (!existing) return null;

  const patch: Partial<typeof withholdingCertificates.$inferInsert> = { updatedAt: new Date() };
  if (input.status !== undefined) patch.status = input.status;
  if (input.receivedAt !== undefined) patch.receivedAt = input.receivedAt;

  const [updated] = await tx
    .update(withholdingCertificates)
    .set(patch)
    .where(eq(withholdingCertificates.id, id))
    .returning();
  return updated;
}

/**
 * Records an uploaded certificate copy's R2 key and auto-marks the row
 * `received` (unless it already is) — see this file's doc comment. Returns
 * `null` if not found/owned.
 */
export async function attachWithholdingCertificateFile(tx: RlsTx, userId: string, id: string, fileKey: string) {
  const existing = await getOwnedWithholdingCertificate(tx, userId, id);
  if (!existing) return null;

  const patch: Partial<typeof withholdingCertificates.$inferInsert> = { fileKey, updatedAt: new Date() };
  if (existing.status !== "received") {
    patch.status = "received";
    patch.receivedAt = todayDateString();
  }

  const [updated] = await tx
    .update(withholdingCertificates)
    .set(patch)
    .where(eq(withholdingCertificates.id, id))
    .returning();
  return updated;
}

export async function softDeleteWithholdingCertificate(tx: RlsTx, id: string) {
  const [updated] = await tx
    .update(withholdingCertificates)
    .set({ deletedAt: new Date() })
    .where(eq(withholdingCertificates.id, id))
    .returning();
  return updated;
}
