/**
 * DELETE /api/v1/projects/:projectId/documents/:docId — app_spec.md §
 * "API Contracts & Integrations" → "6. Contract & amendment documents".
 * Shared DIAN retention-warning delete pattern (see
 * `@/lib/services/deletion-warnings`), entityType `"contract_document"` —
 * same shape as tax-info documents in Phase 4.
 *
 * Without `?confirm=true`: `200 { warning, confirmUrl }`, nothing deleted.
 * With `?confirm=true`: soft-deletes (`deleted_at`), `204`.
 */
import { NextResponse, type NextRequest } from "next/server";
import { withUserDb } from "@/lib/db/rls";
import { apiErrorResponse, toApiErrorResponse } from "@/lib/api/errors";
import { findOwnedContractDocument, softDeleteContractDocument } from "@/lib/services/contract-documents";
import {
  DIAN_RETENTION_WARNING,
  isWithinDianWindow,
  logDeletionWarning,
} from "@/lib/services/deletion-warnings";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; docId: string }> }
) {
  try {
    const { projectId, docId } = await params;
    const confirm = request.nextUrl.searchParams.get("confirm") === "true";

    const result = await withUserDb(async (tx, user) => {
      const doc = await findOwnedContractDocument(tx, user.id, projectId, docId);
      if (!doc || doc.deletedAt) {
        return { status: "not_found" as const };
      }

      const withinDianWindow = isWithinDianWindow(doc.uploadedAt);

      if (!confirm) {
        await logDeletionWarning(tx, {
          userId: user.id,
          entityType: "contract_document",
          entityId: doc.id,
          action: "soft_delete_requested",
          withinDianWindow,
        });
        return { status: "needs_confirm" as const };
      }

      await logDeletionWarning(tx, {
        userId: user.id,
        entityType: "contract_document",
        entityId: doc.id,
        action: "soft_delete_confirmed",
        withinDianWindow,
        acknowledged: true,
      });
      await softDeleteContractDocument(tx, doc.id);
      return { status: "deleted" as const };
    });

    if (result.status === "not_found") {
      return apiErrorResponse("NOT_FOUND", "Document not found.");
    }
    if (result.status === "needs_confirm") {
      return NextResponse.json({
        warning: DIAN_RETENTION_WARNING,
        confirmUrl: `${request.nextUrl.pathname}?confirm=true`,
      });
    }
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
