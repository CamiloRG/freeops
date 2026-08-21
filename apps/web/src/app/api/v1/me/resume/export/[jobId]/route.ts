/**
 * GET /api/v1/me/resume/export/:jobId — app_spec.md § "API Contracts &
 * Integrations" → "3. Resume / CV builder". See
 * `app/api/v1/me/resume/export/route.ts`'s doc comment for the
 * synchronous-generation-behind-an-async-shaped-contract deviation.
 * `jobId` is the base64url-encoded R2 object key; this route decodes it,
 * confirms it belongs to the caller (`resumes/<userId>/...` prefix — RLS
 * doesn't cover R2, so this ownership check is the only guard), and
 * checks for existence.
 */
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/db/rls";
import { toApiErrorResponse, apiErrorResponse } from "@/lib/api/errors";
import { getSignedDownloadUrl, objectExists } from "@/lib/storage/r2";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    const { jobId } = await params;
    const { user } = await requireUser();

    let key: string;
    try {
      key = Buffer.from(jobId, "base64url").toString("utf8");
    } catch {
      return apiErrorResponse("NOT_FOUND", "Unknown export job.");
    }

    if (!key.startsWith(`resumes/${user.id}/`)) {
      return apiErrorResponse("NOT_FOUND", "Unknown export job.");
    }

    const exists = await objectExists("resumeExports", key);
    if (!exists) {
      return NextResponse.json({ status: "processing" });
    }

    const fileUrl = await getSignedDownloadUrl("resumeExports", key);
    return NextResponse.json({ status: "done", fileUrl });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
