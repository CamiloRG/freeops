/**
 * POST /api/v1/withholding-certificates/:id/upload — app_spec.md § "API
 * Contracts & Integrations" → "12. Withholding certificates".
 * `multipart/form-data`, field `file` (PDF/JPG/PNG/DOCX, ≤10MB) — mirrors
 * `POST /api/v1/me/tax-info/documents`'s upload pattern exactly.
 *
 * Uploading a certificate copy IS the "received" signal — see
 * `@/lib/services/withholding-certificates`'s `attachWithholdingCertificateFile`
 * doc comment; this route does not accept a separate status field.
 *
 * `R2_BUCKET_WITHHOLDING_CERTIFICATES` may not be provisioned yet in the
 * real Cloudflare account (same situation `R2_BUCKET_FINANCE_DOCUMENTS`
 * was in after Stage 2) — `processAndUploadFile`/`bucketNameFor` throw a
 * clear "env var not set" error in that case rather than crashing
 * uninformatively; that error is surfaced here as a normal 500 via
 * `toApiErrorResponse`'s catch-all (no fallback-bucket workaround).
 */
import { NextResponse, type NextRequest } from "next/server";
import { withUserDb } from "@/lib/db/rls";
import { toApiErrorResponse, apiErrorResponse, ApiError } from "@/lib/api/errors";
import { attachWithholdingCertificateFile } from "@/lib/services/withholding-certificates";
import { serializeWithholdingCertificate } from "@/lib/services/withholding-view";
import { FileValidationError, getSignedDownloadUrl, processAndUploadFile } from "@/lib/storage/r2";

export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return apiErrorResponse("VALIDATION_ERROR", "Falta el campo `file`.");
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const result = await withUserDb(async (tx, user) => {
      let upload;
      try {
        upload = await processAndUploadFile({
          bucket: "withholdingCertificates",
          keyPrefix: `withholding-certificates/${user.id}`,
          buffer,
          slot: "withholdingCertificate",
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

      return attachWithholdingCertificateFile(tx, user.id, id, upload.key);
    });

    if (!result) {
      return apiErrorResponse("NOT_FOUND", "Certificado de retención no encontrado.");
    }
    const fileUrl = result.fileKey ? await getSignedDownloadUrl("withholdingCertificates", result.fileKey) : null;
    return NextResponse.json({ ...serializeWithholdingCertificate(result), fileUrl });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
