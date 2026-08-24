/**
 * Zod schemas for the CRM module (Phase 6: Pipeline stages, Opportunities,
 * Closed-Won → Project automation) — app_spec.md § "API Contracts &
 * Integrations" → "8. CRM pipeline / opportunities".
 *
 * Field-name mapping note (same pattern flagged in
 * `@/lib/validation/business`'s doc comment): the API contract's prose
 * lists stage fields as `{id, name, position, isClosedWon, isClosedLost}`
 * and opportunity fields as `{..., estimatedValue, expectedCloseDate,
 * stageId}`, but `packages/db/src/schema/crm.ts` (which matches the Data
 * Model section verbatim) has `isWonStage`/`isLostStage` (not
 * `isClosedWon`/`isClosedLost`) and `dealValue` (not `estimatedValue`).
 * Mapping used throughout this phase, applied in `@/lib/services/crm-view`:
 * API `isClosedWon` <-> column `isWonStage`, API `isClosedLost` <-> column
 * `isLostStage`, API `estimatedValue` <-> column `dealValue`.
 *
 * Deliberate extension beyond the contract prose's literal opportunity
 * field list (flagged, same judgment call `projects.ts`/kanban's feature
 * pack made elsewhere): `clientPhone`, `notes`, `source`, `currency` are
 * also accepted — all real columns already in the schema, and an
 * opportunity detail screen with no way to record a phone number or a
 * scope/notes paragraph would be far too thin to actually track a deal.
 */
import { z } from "zod";

// --- Pipeline stages -----------------------------------------------------

export const crmStageCreateSchema = z.object({
  name: z.string().trim().min(1, "Ponle un nombre a la etapa.").max(120),
  position: z.number().int().min(0).optional(),
  // Lets a freelancer designate a custom additional won/lost stage —
  // defaults false, same as `isDefault` on the 6 seeded starter stages.
  isWonStage: z.boolean().optional(),
  isLostStage: z.boolean().optional(),
});
export type CrmStageCreateInput = z.infer<typeof crmStageCreateSchema>;

export const crmStageUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  position: z.number().int().min(0).optional(),
  isWonStage: z.boolean().optional(),
  isLostStage: z.boolean().optional(),
});
export type CrmStageUpdateInput = z.infer<typeof crmStageUpdateSchema>;

export const crmStageDeleteSchema = z.object({
  moveOpportunitiesToStageId: z.uuid().optional(),
});
export type CrmStageDeleteInput = z.infer<typeof crmStageDeleteSchema>;

// --- Opportunities ---------------------------------------------------------

export const crmOpportunityCreateSchema = z.object({
  title: z.string().trim().min(1, "Enter a deal title.").max(300),
  clientName: z.string().trim().min(1, "Enter the client's name.").max(300),
  clientEmail: z.email("Enter a valid email.").trim().optional().or(z.literal("")),
  clientPhone: z.string().trim().max(40).optional().or(z.literal("")),
  estimatedValue: z.number().nonnegative().optional().nullable(),
  currency: z.string().trim().length(3).optional(),
  expectedCloseDate: z.string().trim().optional().or(z.literal("")),
  notes: z.string().trim().max(4000).optional().or(z.literal("")),
  source: z.string().trim().max(120).optional().or(z.literal("")),
  stageId: z.uuid().optional(), // defaults to the pipeline's first (lowest-position) stage when omitted
});
export type CrmOpportunityCreateInput = z.infer<typeof crmOpportunityCreateSchema>;

export const crmOpportunityUpdateSchema = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  clientName: z.string().trim().min(1).max(300).optional(),
  clientEmail: z.email("Enter a valid email.").trim().optional().or(z.literal("")),
  clientPhone: z.string().trim().max(40).optional().or(z.literal("")),
  estimatedValue: z.number().nonnegative().optional().nullable(),
  currency: z.string().trim().length(3).optional(),
  expectedCloseDate: z.string().trim().optional().or(z.literal("")),
  notes: z.string().trim().max(4000).optional().or(z.literal("")),
  source: z.string().trim().max(120).optional().or(z.literal("")),
  // Moving `stageId` to a won stage triggers the Closed-Won → Project
  // automation inline, in the same request/transaction — see
  // `@/lib/services/crm`'s `updateOpportunity` doc comment.
  stageId: z.uuid().optional(),
});
export type CrmOpportunityUpdateInput = z.infer<typeof crmOpportunityUpdateSchema>;
