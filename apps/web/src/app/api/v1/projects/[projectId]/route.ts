/**
 * GET/PATCH/DELETE /api/v1/projects/:projectId — app_spec.md § "API Contracts &
 * Integrations" → "5. Projects".
 *
 * DELETE follows the shared DIAN retention-warning two-step pattern (see
 * `@/lib/services/deletion-warnings`) whenever the project has contract
 * documents — same shape as tax-info documents in Phase 4, entityType
 * `"project"`.
 */
import { NextResponse, type NextRequest } from "next/server";
import { withUserDb } from "@/lib/db/rls";
import { apiErrorResponse, toApiErrorResponse } from "@/lib/api/errors";
import { projectUpdateSchema } from "@/lib/validation/business";
import { getProjectDetail, projectHasContractDocuments, softDeleteProject, updateProject } from "@/lib/services/projects";
import { serializeProject } from "@/lib/services/project-view";
import { getSignedDownloadUrl } from "@/lib/storage/r2";
import { isWithinDianWindow, logDeletionWarning } from "@/lib/services/deletion-warnings";

export const runtime = "nodejs";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    const detail = await withUserDb((tx, user) => getProjectDetail(tx, user.id, projectId));
    if (!detail) {
      return apiErrorResponse("NOT_FOUND", "Project not found.");
    }
    const documents = await Promise.all(
      detail.contractDocuments.map(async (doc) => ({
        id: doc.id,
        type: doc.documentType,
        label: doc.title,
        fileUrl: await getSignedDownloadUrl("contractDocuments", doc.fileKey),
        fileSizeBytes: doc.fileSizeBytes,
        uploadedAt: doc.uploadedAt,
      }))
    );
    return NextResponse.json({
      ...serializeProject(detail.project),
      contractDocuments: documents,
      kanbanBoardId: detail.kanbanBoardId,
    });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    const body = await request.json();
    const input = projectUpdateSchema.parse(body);

    const updated = await withUserDb((tx, user) => updateProject(tx, user.id, projectId, input));
    if (!updated) {
      return apiErrorResponse("NOT_FOUND", "Project not found.");
    }
    return NextResponse.json(serializeProject(updated));
  } catch (error) {
    return toApiErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    const confirm = request.nextUrl.searchParams.get("confirm") === "true";

    const result = await withUserDb(async (tx, user) => {
      const detail = await getProjectDetail(tx, user.id, projectId);
      if (!detail) {
        return { status: "not_found" as const };
      }

      const hasDocuments = await projectHasContractDocuments(tx, projectId);

      if (hasDocuments && !confirm) {
        await logDeletionWarning(tx, {
          userId: user.id,
          entityType: "project",
          entityId: projectId,
          action: "soft_delete_requested",
          withinDianWindow: true,
        });
        return { status: "needs_confirm" as const };
      }

      if (hasDocuments) {
        const anyRecent = detail.contractDocuments.some((doc) => isWithinDianWindow(doc.uploadedAt));
        await logDeletionWarning(tx, {
          userId: user.id,
          entityType: "project",
          entityId: projectId,
          action: "soft_delete_confirmed",
          withinDianWindow: anyRecent,
          acknowledged: true,
        });
      }

      await softDeleteProject(tx, projectId);
      return { status: "deleted" as const };
    });

    if (result.status === "not_found") {
      return apiErrorResponse("NOT_FOUND", "Project not found.");
    }
    if (result.status === "needs_confirm") {
      return NextResponse.json({
        warning:
          "This project has contract documents typically retained for DIAN audit (5 years). Delete anyway?",
        confirmUrl: `${request.nextUrl.pathname}?confirm=true`,
      });
    }
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
