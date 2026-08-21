/**
 * GET/POST /api/v1/projects/:projectId/documents — app_spec.md §
 * "API Contracts & Integrations" → "6. Contract & amendment documents".
 * `multipart/form-data`, fields `file` (PDF/DOCX, ≤25MB) + `type` + `label`.
 */
import { NextResponse, type NextRequest } from "next/server";
import { withUserDb } from "@/lib/db/rls";
import { apiErrorResponse, toApiErrorResponse, ApiError } from "@/lib/api/errors";
import { contractDocumentUploadMetaSchema } from "@/lib/validation/business";
import { addContractDocument, listContractDocuments } from "@/lib/services/contract-documents";
import { getOwnedProject } from "@/lib/services/projects";
import { FileValidationError, getSignedDownloadUrl, processAndUploadFile } from "@/lib/storage/r2";

export const runtime = "nodejs";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    const rows = await withUserDb((tx, user) => listContractDocuments(tx, user.id, projectId));
    if (rows === null) {
      return apiErrorResponse("NOT_FOUND", "Project not found.");
    }
    const data = await Promise.all(
      rows.map(async (doc) => ({
        id: doc.id,
        type: doc.documentType,
        label: doc.title,
        fileUrl: await getSignedDownloadUrl("contractDocuments", doc.fileKey),
        fileSizeBytes: doc.fileSizeBytes,
        uploadedAt: doc.uploadedAt,
      }))
    );
    return NextResponse.json({ data });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    const formData = await request.formData();
    const file = formData.get("file");
    const typeRaw = formData.get("type");
    const labelRaw = formData.get("label");

    if (!(file instanceof File)) {
      return apiErrorResponse("VALIDATION_ERROR", "Missing `file` field.");
    }
    const metaParse = contractDocumentUploadMetaSchema.safeParse({ type: typeRaw, label: labelRaw });
    if (!metaParse.success) {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        "`type` must be one of executed_contract, amendment, appendix, change_order, and `label` is required."
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const result = await withUserDb(async (tx, user) => {
      const project = await getOwnedProject(tx, user.id, projectId);
      if (!project) return null;

      let upload;
      try {
        upload = await processAndUploadFile({
          bucket: "contractDocuments",
          keyPrefix: `contract-documents/${user.id}`,
          buffer,
          slot: "contractDocument",
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

      const doc = await addContractDocument(tx, user.id, projectId, {
        fileKey: upload.key,
        fileName: file.name || "document",
        mimeType: upload.mimeType,
        fileSizeBytes: buffer.byteLength,
        documentType: metaParse.data.type,
        title: metaParse.data.label,
      });
      return doc;
    });

    if (!result) {
      return apiErrorResponse("NOT_FOUND", "Project not found.");
    }

    const fileUrl = await getSignedDownloadUrl("contractDocuments", result.fileKey);
    return NextResponse.json(
      {
        id: result.id,
        type: result.documentType,
        label: result.title,
        fileUrl,
        fileSizeBytes: result.fileSizeBytes,
        uploadedAt: result.uploadedAt,
      },
      { status: 201 }
    );
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
