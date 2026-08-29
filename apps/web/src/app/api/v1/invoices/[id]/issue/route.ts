/**
 * POST /api/v1/invoices/:id/issue — app_spec.md § "API Contracts &
 * Integrations" → "10. Invoices". Same shape as
 * `app/api/v1/cuentas-de-cobro/[id]/issue/route.ts` (see that file's doc
 * comment for the synchronous-generation-behind-an-async-shaped-contract
 * deviation this mirrors from `app/api/v1/me/resume/export/route.ts`).
 */
import { NextResponse, type NextRequest } from "next/server";
import { withUserDb } from "@/lib/db/rls";
import { apiErrorResponse, toApiErrorResponse } from "@/lib/api/errors";
import { finalizeInvoiceIssue, issueInvoice } from "@/lib/services/finance";
import { putInvoicePdf } from "@/lib/storage/r2";

export const runtime = "nodejs";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const jobId = await withUserDb(async (tx, user) => {
      const result = await issueInvoice(tx, user.id, id);
      if (!result) return null;

      const key = await putInvoicePdf(user.id, result.pdfBuffer);
      await finalizeInvoiceIssue(tx, result.invoice.id, key);
      return Buffer.from(key, "utf8").toString("base64url");
    });

    if (jobId === null) {
      return apiErrorResponse("NOT_FOUND", "Factura no encontrada.");
    }
    return NextResponse.json({ jobId }, { status: 202 });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
