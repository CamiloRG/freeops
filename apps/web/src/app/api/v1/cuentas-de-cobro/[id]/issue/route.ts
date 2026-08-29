/**
 * POST /api/v1/cuentas-de-cobro/:id/issue — app_spec.md § "API Contracts &
 * Integrations" → "9. Cuentas de cobro". Draft → issued transition: locks
 * the record (no further edits — see `updateCuentaDeCobro`), renders and
 * uploads the PDF, stores `pdfFileKey`.
 *
 * Same synchronous-generation-behind-an-async-shaped-contract deviation as
 * `app/api/v1/me/resume/export/route.ts` (see that file's doc comment): no
 * real background-job queue exists yet, so generation runs synchronously
 * here, but the `202 { jobId }` + poll (`.../export/:jobId`) contract shape
 * is preserved. `jobId` is the R2 object key itself (URL-safe base64).
 */
import { NextResponse, type NextRequest } from "next/server";
import { withUserDb } from "@/lib/db/rls";
import { apiErrorResponse, toApiErrorResponse } from "@/lib/api/errors";
import { finalizeCuentaDeCobroIssue, issueCuentaDeCobro } from "@/lib/services/finance";
import { putCuentaDeCobroPdf } from "@/lib/storage/r2";

export const runtime = "nodejs";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const jobId = await withUserDb(async (tx, user) => {
      const result = await issueCuentaDeCobro(tx, user.id, id);
      if (!result) return null;

      const key = await putCuentaDeCobroPdf(user.id, result.pdfBuffer);
      await finalizeCuentaDeCobroIssue(tx, result.cdc.id, key);
      return Buffer.from(key, "utf8").toString("base64url");
    });

    if (jobId === null) {
      return apiErrorResponse("NOT_FOUND", "Cuenta de cobro no encontrada.");
    }
    return NextResponse.json({ jobId }, { status: 202 });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
