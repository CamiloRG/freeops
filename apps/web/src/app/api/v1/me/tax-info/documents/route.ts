/**
 * POST /api/v1/me/tax-info/documents — app_spec.md § "API Contracts &
 * Integrations" → "1. Freelancer profile, banking & tax data".
 * `multipart/form-data`, field `file` (PDF/JPG/PNG/DOCX, ≤10MB) + `type`.
 */
import { NextResponse, type NextRequest } from "next/server";
import { withUserDb } from "@/lib/db/rls";
import { toApiErrorResponse, apiErrorResponse, ApiError } from "@/lib/api/errors";
import { taxDocumentTypeSchema } from "@/lib/validation/personal";
import { addTaxDocument } from "@/lib/services/tax-info";
import { FileValidationError, getSignedDownloadUrl, processAndUploadFile } from "@/lib/storage/r2";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const typeRaw = formData.get("type");

    if (!(file instanceof File)) {
      return apiErrorResponse("VALIDATION_ERROR", "Missing `file` field.");
    }
    const typeParse = taxDocumentTypeSchema.safeParse(typeRaw);
    if (!typeParse.success) {
      return apiErrorResponse("VALIDATION_ERROR", "`type` must be one of rut, camara_comercio, other.");
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const result = await withUserDb(async (tx, user) => {
      let upload;
      try {
        upload = await processAndUploadFile({
          bucket: "taxDocuments",
          keyPrefix: `tax-documents/${user.id}`,
          buffer,
          slot: "taxDocument",
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

      const doc = await addTaxDocument(tx, user.id, {
        fileKey: upload.key,
        fileName: file.name || "document",
        mimeType: upload.mimeType,
        documentType: typeParse.data,
      });
      return doc;
    });

    const fileUrl = await getSignedDownloadUrl("taxDocuments", result.fileKey);
    return NextResponse.json(
      { id: result.id, type: result.documentType, fileUrl, uploadedAt: result.uploadedAt },
      { status: 201 }
    );
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
