/**
 * Shared response-shaping for `/api/v1/projects...` routes — kept separate
 * from `@/lib/services/projects` (pure data-access) so every route
 * serializes a `projects` row identically. See `@/lib/validation/business`
 * for the API-contract-vs-schema field-name mapping this mirrors.
 */
import type { projects } from "@freeops/db/schema";

type ProjectRow = typeof projects.$inferSelect;

export type ProjectStatus = "active" | "completed" | "archived" | "cancelled";

export function serializeProject(row: ProjectRow) {
  return {
    id: row.id,
    name: row.title,
    clientName: row.clientName,
    clientEmail: row.clientEmail,
    clientTaxId: row.clientTaxId,
    description: row.description,
    scopeNotes: row.scopeNotes,
    status: row.status as ProjectStatus,
    startDate: row.startDate,
    expectedEndDate: row.endDate,
    value: row.dealValue != null ? Number(row.dealValue) : null,
    currency: row.currency,
    // Always "manual" this phase — see this file's doc comment and the
    // ADR's Phase 5 section. Populated for real once Phase 6's Closed-Won
    // automation starts setting `opportunityId`.
    source: (row.opportunityId ? "crm_auto" : "manual") as "manual" | "crm_auto",
    opportunityId: row.opportunityId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
