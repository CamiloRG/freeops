/**
 * GET/POST /api/v1/me/banking/:id/certificate — the "Certificación" dialog
 * on each account card (Aero multi-account rollout). GET returns a signed
 * download URL for the certificate already on file; POST uploads/replaces
 * it (`multipart/form-data`, field `file`). No AI involved here — this is
 * the plain manual attach path for an account that was entered by hand or
 * needs its certificate refreshed, mirroring tax-info's own plain-upload
 * pattern (`taxDocument` slot) rather than resume's AI path.
 */
import { NextResponse, type NextRequest } from "next/server";
import { withRlsContext } from "@freeops/db/rls-client";
import { requireUser } from "@/lib/db/rls";
import { toApiErrorResponse, apiErrorResponse, ApiError } from "@/lib/api/errors";
import { attachCertificate, getCertificateFileKey } from "@/lib/services/banking";
import { FileValidationError, getSignedDownloadUrl, processAndUploadFile } from "@/lib/storage/r2";

export const runtime = "nodejs";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { user, accessToken } = await requireUser();
    const fileKey = await withRlsContext(accessToken, (tx) => getCertificateFileKey(tx, user.id, id));
    const fileUrl = await getSignedDownloadUrl("taxDocuments", fileKey);
    return NextResponse.json({ fileUrl });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return apiErrorResponse("VALIDATION_ERROR", "Missing `file` field.");
    }
    const buffer = Buffer.from(await file.arrayBuffer());

    const { user, accessToken } = await requireUser();
    const result = await withRlsContext(accessToken, async (tx) => {
      let upload;
      try {
        upload = await processAndUploadFile({
          bucket: "taxDocuments",
          keyPrefix: `banking-certificates/${user.id}`,
          buffer,
          slot: "bankCertificate",
        });
      } catch (error) {
        if (error instanceof FileValidationError) {
          throw new ApiError(
            error.kind === "PAYLOAD_TOO_LARGE" ? "PAYLOAD_TOO_LARGE" : "UNSUPPORTED_MEDIA_TYPE",
            error.message
          );
        }
        throw error;
      }
      return attachCertificate(tx, user.id, id, { fileKey: upload.key, fileName: file.name || "certificacion" });
    });

    return NextResponse.json(result);
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
