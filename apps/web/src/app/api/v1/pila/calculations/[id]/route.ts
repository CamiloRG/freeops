/**
 * DELETE /api/v1/pila/calculations/:id — app_spec.md § "API Contracts &
 * Integrations" → "13. PILA calculation". The shared DIAN retention-
 * warning two-step flow (see `@/lib/services/deletion-warnings`), same
 * shape/contract as the withholding-certificates DELETE route,
 * `entityType: "pila_record"`. Without `?confirm=true`: `200 { warning,
 * confirmUrl }`, nothing deleted. With `?confirm=true`: soft-deletes,
 * `204`. `isWithinDianWindow` computed off the record's own period (first
 * day of that month), per the stage brief.
 */
import { NextResponse, type NextRequest } from "next/server";
import { withUserDb } from "@/lib/db/rls";
import { apiErrorResponse, toApiErrorResponse } from "@/lib/api/errors";
import { getOwnedPilaCalculation, softDeletePilaCalculation } from "@/lib/services/pila";
import { DIAN_RETENTION_WARNING, isWithinDianWindow, logDeletionWarning } from "@/lib/services/deletion-warnings";

export const runtime = "nodejs";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const confirm = request.nextUrl.searchParams.get("confirm") === "true";

    const result = await withUserDb(async (tx, user) => {
      const record = await getOwnedPilaCalculation(tx, user.id, id);
      if (!record) return { status: "not_found" as const };

      const withinDianWindow = isWithinDianWindow(new Date(record.periodYear, record.periodMonth - 1, 1));

      if (!confirm) {
        await logDeletionWarning(tx, {
          userId: user.id,
          entityType: "pila_record",
          entityId: record.id,
          action: "soft_delete_requested",
          withinDianWindow,
        });
        return { status: "needs_confirm" as const };
      }

      await logDeletionWarning(tx, {
        userId: user.id,
        entityType: "pila_record",
        entityId: record.id,
        action: "soft_delete_confirmed",
        withinDianWindow,
        acknowledged: true,
      });
      await softDeletePilaCalculation(tx, record.id);
      return { status: "deleted" as const };
    });

    if (result.status === "not_found") {
      return apiErrorResponse("NOT_FOUND", "Cálculo de PILA no encontrado.");
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
