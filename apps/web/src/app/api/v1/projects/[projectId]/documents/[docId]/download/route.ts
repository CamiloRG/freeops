/**
 * GET /api/v1/projects/:projectId/documents/:docId/download —
 * app_spec.md § "API Contracts & Integrations" → "6. Contract & amendment
 * documents". `302` redirect to a short-lived signed R2 object-storage
 * URL, same choice as the spec's `(or 302 to a short-lived signed URL)`.
 */
import { NextResponse, type NextRequest } from "next/server";
import { withUserDb } from "@/lib/db/rls";
import { apiErrorResponse, toApiErrorResponse } from "@/lib/api/errors";
import { findOwnedContractDocument } from "@/lib/services/contract-documents";
import { getSignedDownloadUrl } from "@/lib/storage/r2";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string; docId: string }> }
) {
  try {
    const { projectId, docId } = await params;
    const doc = await withUserDb((tx, user) => findOwnedContractDocument(tx, user.id, projectId, docId));
    if (!doc || doc.deletedAt) {
      return apiErrorResponse("NOT_FOUND", "Document not found.");
    }
    const url = await getSignedDownloadUrl("contractDocuments", doc.fileKey);
    return NextResponse.redirect(url, { status: 302 });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
