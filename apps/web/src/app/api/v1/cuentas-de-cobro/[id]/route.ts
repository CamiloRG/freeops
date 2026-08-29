/**
 * GET/PATCH/DELETE /api/v1/cuentas-de-cobro/:id — app_spec.md § "API
 * Contracts & Integrations" → "9. Cuentas de cobro".
 *
 * PATCH: only while `status = "draft"` (`updateCuentaDeCobro` throws
 * `UNPROCESSABLE_ENTITY` otherwise).
 *
 * DELETE: draft → direct soft-delete; non-draft (issued/paid/overdue/
 * cancelled) → the shared DIAN retention-warning two-step flow (see
 * `@/lib/services/deletion-warnings`), same shape as contract documents /
 * tax-info documents, entityType `"cuenta_de_cobro"`. Without
 * `?confirm=true`: `200 { warning, confirmUrl }`, nothing deleted. With
 * `?confirm=true`: soft-deletes, `204`.
 */
import { NextResponse, type NextRequest } from "next/server";
import { withUserDb } from "@/lib/db/rls";
import { apiErrorResponse, toApiErrorResponse } from "@/lib/api/errors";
import { cuentaDeCobroUpdateSchema } from "@/lib/validation/finance";
import { getOwnedCuentaDeCobro, softDeleteCuentaDeCobro, updateCuentaDeCobro } from "@/lib/services/finance";
import { serializeCuentaDeCobro } from "@/lib/services/finance-view";
import { getSignedDownloadUrl } from "@/lib/storage/r2";
import { DIAN_RETENTION_WARNING, isWithinDianWindow, logDeletionWarning } from "@/lib/services/deletion-warnings";

export const runtime = "nodejs";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const row = await withUserDb((tx, user) => getOwnedCuentaDeCobro(tx, user.id, id));
    if (!row) {
      return apiErrorResponse("NOT_FOUND", "Cuenta de cobro no encontrada.");
    }
    const pdfUrl = row.pdfFileKey ? await getSignedDownloadUrl("financeDocuments", row.pdfFileKey) : null;
    return NextResponse.json({ ...serializeCuentaDeCobro(row), pdfUrl });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const input = cuentaDeCobroUpdateSchema.parse(body);

    const updated = await withUserDb((tx, user) => updateCuentaDeCobro(tx, user.id, id, input));
    if (!updated) {
      return apiErrorResponse("NOT_FOUND", "Cuenta de cobro no encontrada.");
    }
    return NextResponse.json(serializeCuentaDeCobro(updated));
  } catch (error) {
    return toApiErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const confirm = request.nextUrl.searchParams.get("confirm") === "true";

    const result = await withUserDb(async (tx, user) => {
      const cdc = await getOwnedCuentaDeCobro(tx, user.id, id);
      if (!cdc) return { status: "not_found" as const };

      if (cdc.status === "draft") {
        await softDeleteCuentaDeCobro(tx, cdc.id);
        return { status: "deleted" as const };
      }

      const withinDianWindow = isWithinDianWindow(new Date(`${cdc.issueDate}T00:00:00`));

      if (!confirm) {
        await logDeletionWarning(tx, {
          userId: user.id,
          entityType: "cuenta_de_cobro",
          entityId: cdc.id,
          action: "soft_delete_requested",
          withinDianWindow,
        });
        return { status: "needs_confirm" as const };
      }

      await logDeletionWarning(tx, {
        userId: user.id,
        entityType: "cuenta_de_cobro",
        entityId: cdc.id,
        action: "soft_delete_confirmed",
        withinDianWindow,
        acknowledged: true,
      });
      await softDeleteCuentaDeCobro(tx, cdc.id);
      return { status: "deleted" as const };
    });

    if (result.status === "not_found") {
      return apiErrorResponse("NOT_FOUND", "Cuenta de cobro no encontrada.");
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
