/**
 * GET /api/v1/invoices/:id/export/:jobId — poll endpoint, mirrors
 * `app/api/v1/cuentas-de-cobro/[id]/export/[jobId]/route.ts` (and, in turn,
 * `app/api/v1/me/resume/export/[jobId]/route.ts`) exactly, keyed to the
 * `invoices/<userId>/...` R2 prefix.
 */
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/db/rls";
import { apiErrorResponse, toApiErrorResponse } from "@/lib/api/errors";
import { getSignedDownloadUrl, objectExists } from "@/lib/storage/r2";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; jobId: string }> }) {
  try {
    const { jobId } = await params;
    const { user } = await requireUser();

    let key: string;
    try {
      key = Buffer.from(jobId, "base64url").toString("utf8");
    } catch {
      return apiErrorResponse("NOT_FOUND", "Unknown export job.");
    }

    if (!key.startsWith(`invoices/${user.id}/`)) {
      return apiErrorResponse("NOT_FOUND", "Unknown export job.");
    }

    const exists = await objectExists("financeDocuments", key);
    if (!exists) {
      return NextResponse.json({ status: "processing" });
    }

    const fileUrl = await getSignedDownloadUrl("financeDocuments", key);
    return NextResponse.json({ status: "done", fileUrl });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
