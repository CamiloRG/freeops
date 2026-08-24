/**
 * PATCH/DELETE /api/v1/crm/stages/:stageId — same rename/reorder/delete-
 * with-reassignment pattern as `/api/v1/board/columns/:columnId`.
 */
import { NextResponse, type NextRequest } from "next/server";
import { withUserDb } from "@/lib/db/rls";
import { apiErrorResponse, toApiErrorResponse } from "@/lib/api/errors";
import { crmStageDeleteSchema, crmStageUpdateSchema } from "@/lib/validation/crm";
import { deleteStage, updateStage } from "@/lib/services/crm";
import { serializeStage } from "@/lib/services/crm-view";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ stageId: string }> }) {
  try {
    const { stageId } = await params;
    const body = await request.json();
    const input = crmStageUpdateSchema.parse(body);

    const stage = await withUserDb((tx, user) => updateStage(tx, user.id, stageId, input));
    if (!stage) return apiErrorResponse("NOT_FOUND", "Stage not found.");
    return NextResponse.json(serializeStage(stage));
  } catch (error) {
    return toApiErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ stageId: string }> }) {
  try {
    const { stageId } = await params;
    const body = await request.json().catch(() => ({}));
    const input = crmStageDeleteSchema.parse(body);

    const result = await withUserDb((tx, user) =>
      deleteStage(tx, user.id, stageId, input.moveOpportunitiesToStageId)
    );
    if (result.status === "not_found") return apiErrorResponse("NOT_FOUND", "Stage not found.");
    if (result.status === "needs_target") {
      return apiErrorResponse(
        "VALIDATION_ERROR",
        "Esta etapa tiene oportunidades abiertas. Indica `moveOpportunitiesToStageId` primero."
      );
    }
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
