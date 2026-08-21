/**
 * DELETE /api/v1/me/tax-info/documents/:id — app_spec.md § "API Contracts
 * & Integrations" → "1. Freelancer profile, banking & tax data" and the
 * shared DIAN retention-warning delete pattern (see
 * `@/lib/services/deletion-warnings`).
 *
 * Without `?confirm=true`: `200 { warning, confirmUrl }`, nothing deleted.
 * With `?confirm=true`: soft-deletes (`deleted_at`), `204`.
 */
import { NextResponse, type NextRequest } from "next/server";
import { withUserDb } from "@/lib/db/rls";
import { toApiErrorResponse, apiErrorResponse } from "@/lib/api/errors";
import { findOwnedTaxDocument, softDeleteTaxDocument } from "@/lib/services/tax-info";
import {
  DIAN_RETENTION_WARNING,
  isWithinDianWindow,
  logDeletionWarning,
} from "@/lib/services/deletion-warnings";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const confirm = request.nextUrl.searchParams.get("confirm") === "true";

    const result = await withUserDb(async (tx, user) => {
      const doc = await findOwnedTaxDocument(tx, user.id, id);
      if (!doc || doc.deletedAt) {
        return { status: "not_found" as const };
      }

      const withinDianWindow = isWithinDianWindow(doc.uploadedAt);

      if (!confirm) {
        await logDeletionWarning(tx, {
          userId: user.id,
          entityType: "tax_info_document",
          entityId: doc.id,
          action: "soft_delete_requested",
          withinDianWindow,
        });
        return { status: "needs_confirm" as const };
      }

      await logDeletionWarning(tx, {
        userId: user.id,
        entityType: "tax_info_document",
        entityId: doc.id,
        action: "soft_delete_confirmed",
        withinDianWindow,
        acknowledged: true,
      });
      await softDeleteTaxDocument(tx, doc.id);
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
