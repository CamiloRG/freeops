/**
 * PATCH/DELETE /api/v1/withholding-certificates/:id — app_spec.md § "API
 * Contracts & Integrations" → "12. Withholding certificates".
 *
 * DELETE: the shared DIAN retention-warning two-step flow (see
 * `@/lib/services/deletion-warnings`), same shape/contract as the
 * cuentas-de-cobro DELETE route, `entityType: "withholding_certificate"`.
 * Without `?confirm=true`: `200 { warning, confirmUrl }`, nothing deleted.
 * With `?confirm=true`: soft-deletes, `204`.
 */
import { NextResponse, type NextRequest } from "next/server";
import { withUserDb } from "@/lib/db/rls";
import { apiErrorResponse, toApiErrorResponse } from "@/lib/api/errors";
import { withholdingCertificateUpdateSchema } from "@/lib/validation/withholding";
import {
  getOwnedWithholdingCertificate,
  softDeleteWithholdingCertificate,
  updateWithholdingCertificateStatus,
} from "@/lib/services/withholding-certificates";
import { serializeWithholdingCertificate } from "@/lib/services/withholding-view";
import { getSignedDownloadUrl } from "@/lib/storage/r2";
import { DIAN_RETENTION_WARNING, isWithinDianWindow, logDeletionWarning } from "@/lib/services/deletion-warnings";

export const runtime = "nodejs";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const input = withholdingCertificateUpdateSchema.parse(body);

    const updated = await withUserDb((tx, user) => updateWithholdingCertificateStatus(tx, user.id, id, input));
    if (!updated) {
      return apiErrorResponse("NOT_FOUND", "Certificado de retención no encontrado.");
    }
    const fileUrl = updated.fileKey ? await getSignedDownloadUrl("withholdingCertificates", updated.fileKey) : null;
    return NextResponse.json({ ...serializeWithholdingCertificate(updated), fileUrl });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const confirm = request.nextUrl.searchParams.get("confirm") === "true";

    const result = await withUserDb(async (tx, user) => {
      const cert = await getOwnedWithholdingCertificate(tx, user.id, id);
      if (!cert) return { status: "not_found" as const };

      const withinDianWindow = isWithinDianWindow(new Date(`${cert.taxYear}-01-01T00:00:00`));

      if (!confirm) {
        await logDeletionWarning(tx, {
          userId: user.id,
          entityType: "withholding_certificate",
          entityId: cert.id,
          action: "soft_delete_requested",
          withinDianWindow,
        });
        return { status: "needs_confirm" as const };
      }

      await logDeletionWarning(tx, {
        userId: user.id,
        entityType: "withholding_certificate",
        entityId: cert.id,
        action: "soft_delete_confirmed",
        withinDianWindow,
        acknowledged: true,
      });
      await softDeleteWithholdingCertificate(tx, cert.id);
      return { status: "deleted" as const };
    });

    if (result.status === "not_found") {
      return apiErrorResponse("NOT_FOUND", "Certificado de retención no encontrado.");
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
