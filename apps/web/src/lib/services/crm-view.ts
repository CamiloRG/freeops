/**
 * Shared response-shaping for `/api/v1/crm/...` routes — kept separate
 * from `@/lib/services/crm` (pure data-access), same split
 * `@/lib/services/project-view` already established. See
 * `@/lib/validation/crm`'s doc comment for the API-contract-vs-schema
 * field-name mapping this mirrors.
 */
import type { crmOpportunities, crmPipelineStages } from "@freeops/db/schema";
import type { projects } from "@freeops/db/schema";

type StageRow = typeof crmPipelineStages.$inferSelect;
type OpportunityRow = typeof crmOpportunities.$inferSelect;
type ProjectRow = typeof projects.$inferSelect;

export function serializeStage(row: StageRow) {
  return {
    id: row.id,
    name: row.name,
    position: row.position,
    isClosedWon: row.isWonStage,
    isClosedLost: row.isLostStage,
    isDefault: row.isDefault,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function serializeOpportunity(row: OpportunityRow) {
  return {
    id: row.id,
    stageId: row.stageId,
    title: row.title,
    clientName: row.clientName,
    clientEmail: row.clientEmail,
    clientPhone: row.clientPhone,
    estimatedValue: row.dealValue != null ? Number(row.dealValue) : null,
    currency: row.currency,
    expectedCloseDate: row.expectedCloseDate,
    notes: row.notes,
    source: row.source,
    closedAt: row.closedAt,
    convertedProjectId: row.convertedProjectId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Minimal project shape returned inline in the `PATCH .../opportunities/:id` response's `createdProject` field — app_spec.md §8's example. Full detail is available at `GET /api/v1/projects/:id` once the freelancer follows the link. */
export function serializeCreatedProject(row: ProjectRow) {
  return {
    id: row.id,
    name: row.title,
    clientName: row.clientName,
    status: row.status,
  };
}
