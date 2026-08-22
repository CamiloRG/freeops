/**
 * DIAN retention-warning delete pattern, shared across every entity that
 * needs it — app_spec.md § "API Contracts & Integrations" (tax-info
 * documents §1, contract documents §6, cuentas de cobro §9, invoices §10)
 * and § "Data Model & Schema" → "Deletion-warning audit log".
 *
 * Two-step flow, driven by `packages/db/src/schema/audit.ts`'s
 * `deletion_warnings` table (Phase 2 schema, unused until this phase):
 *   1. `DELETE` without `?confirm=true` → logs a `soft_delete_requested`
 *      row, returns `{ warning, confirmUrl }` without deleting anything.
 *   2. `DELETE ?confirm=true` → logs `soft_delete_confirmed`
 *      (`acknowledgedAt` set), caller then flips the entity's
 *      `deleted_at` — soft delete only, nothing physically destroyed.
 *
 * This phase is the first to actually exercise the table — see
 * `app/api/v1/me/tax-info/documents/[id]/route.ts` for the concrete wiring.
 */
import { deletionWarnings } from "@freeops/db/schema";
import type { RlsTx } from "@freeops/db/rls-client";

/** Colombia/DIAN's commonly-cited audit-retention expectation for tax-relevant records. */
const DIAN_RETENTION_YEARS = 5;

export function isWithinDianWindow(referenceDate: Date): boolean {
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - DIAN_RETENTION_YEARS);
  return referenceDate > cutoff;
}

// "Ledger Quiet" stage 3: translated to Spanish — pure user-facing copy,
// not logic (fixes an English string that was appearing inside an
// otherwise-Spanish delete-confirmation dialog on both the already-merged
// Personal/Tax screen and this stage's own contract-document/project
// delete flows). No behavior/shape change.
export const DIAN_RETENTION_WARNING =
  "Este documento normalmente se conserva 5 años para efectos de auditoría de la DIAN. ¿Eliminar de todos modos?";

export async function logDeletionWarning(
  tx: RlsTx,
  params: {
    userId: string;
    entityType: string;
    entityId: string;
    action: "soft_delete_requested" | "soft_delete_confirmed" | "restore";
    withinDianWindow: boolean;
    acknowledged?: boolean;
  }
) {
  const [row] = await tx
    .insert(deletionWarnings)
    .values({
      userId: params.userId,
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,
      withinDianWindow: params.withinDianWindow,
      acknowledgedAt: params.acknowledged ? new Date() : null,
    })
    .returning();
  return row;
}
