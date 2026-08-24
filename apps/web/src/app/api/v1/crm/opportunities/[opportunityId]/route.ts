/**
 * GET/PATCH/DELETE /api/v1/crm/opportunities/:opportunityId —
 * app_spec.md § "API Contracts & Integrations" → "8. CRM pipeline /
 * opportunities". `PATCH`'s `createdProject` field is only present when
 * this call's `stageId` change is what triggered the Closed-Won → Project
 * automation — see `@/lib/services/crm`'s `updateOpportunity` doc comment.
 *
 * `DELETE` is a soft delete (the schema's `deletedAt`) with no DIAN
 * retention warning — app_spec.md is explicit that CRM notes/opportunities
 * are outside the DIAN-relevant record set (unlike contract documents).
 * Unlike kanban tasks (soft-deleted with zero confirmation, since a "Ver
 * archivadas" restore UI exists — see `kanban.ts`'s `listArchivedTasks`),
 * this phase deliberately does NOT build an equivalent archive/restore UI
 * for opportunities, so the client shows a plain "are you sure" `Dialog`
 * confirm before calling this route — matching the spec's own literal
 * words for this record type ("delete immediately with a standard 'are
 * you sure' confirmation only").
 */
import { NextResponse, type NextRequest } from "next/server";
import { withUserDb } from "@/lib/db/rls";
import { apiErrorResponse, toApiErrorResponse } from "@/lib/api/errors";
import { crmOpportunityUpdateSchema } from "@/lib/validation/crm";
import { getOwnedOpportunity, softDeleteOpportunity, updateOpportunity } from "@/lib/services/crm";
import { serializeCreatedProject, serializeOpportunity } from "@/lib/services/crm-view";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ opportunityId: string }> }) {
  try {
    const { opportunityId } = await params;
    const opportunity = await withUserDb((tx, user) => getOwnedOpportunity(tx, user.id, opportunityId));
    if (!opportunity) return apiErrorResponse("NOT_FOUND", "Opportunity not found.");
    return NextResponse.json(serializeOpportunity(opportunity));
  } catch (error) {
    return toApiErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ opportunityId: string }> }) {
  try {
    const { opportunityId } = await params;
    const body = await request.json();
    const input = crmOpportunityUpdateSchema.parse(body);

    const result = await withUserDb((tx, user) => updateOpportunity(tx, user.id, opportunityId, input));
    if (!result) return apiErrorResponse("NOT_FOUND", "Opportunity not found.");

    return NextResponse.json({
      ...serializeOpportunity(result.opportunity),
      createdProject: result.createdProject ? serializeCreatedProject(result.createdProject) : undefined,
    });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ opportunityId: string }> }) {
  try {
    const { opportunityId } = await params;
    const deleted = await withUserDb((tx, user) => softDeleteOpportunity(tx, user.id, opportunityId));
    if (!deleted) return apiErrorResponse("NOT_FOUND", "Opportunity not found.");
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
