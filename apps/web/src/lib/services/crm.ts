/**
 * CRM: Pipeline stages, Opportunities, Closed-Won → Project automation —
 * app_spec.md § "API Contracts & Integrations" → "8. CRM pipeline /
 * opportunities", § "Data Model & Schema" → "CRM / Pipeline" (default stage
 * seed), § "UX & Frontend" → "5.4/5.5 CRM Pipeline Board / Opportunity
 * Detail" (Closed-Won confirmation flow).
 *
 * Ownership: same convention as `@/lib/services/kanban`'s doc comment —
 * `crm_opportunities`/`crm_pipeline_stages` rows are scoped by RLS
 * (`user_id = auth.uid()` directly, no join chain needed since both tables
 * carry `user_id` themselves), so a plain `findFirst({ where: eq(id,...) })`
 * already returns nothing for another user's row. No extra manual
 * ownership check is layered on top.
 *
 * Default stage seeding (spec: "on user signup, insert six
 * crm_pipeline_stages rows for that user_id") is done LAZILY here
 * (`ensureDefaultStages`, called at the top of `listPipelineStages`) rather
 * than by extending the Supabase `handle_new_user()` trigger
 * (`packages/db/migrations/0003_auth_trigger.sql`). Two reasons: it covers
 * every user who signed up before this phase shipped with zero backfill
 * migration needed, and it keeps a security-definer DB trigger — already a
 * sensitive, hand-audited piece of SQL — untouched. Idempotent (checks for
 * zero existing stages first), matching `createProject`'s own
 * seed-at-creation-time convention for kanban's default columns.
 */
import { and, asc, eq, ilike, isNull, or } from "drizzle-orm";
import { crmOpportunities, crmPipelineStages } from "@freeops/db/schema";
import type { RlsTx } from "@freeops/db/rls-client";
import { ApiError } from "@/lib/api/errors";
import { createProjectFromOpportunity } from "@/lib/services/projects";
import type {
  CrmOpportunityCreateInput,
  CrmOpportunityUpdateInput,
  CrmStageCreateInput,
  CrmStageUpdateInput,
} from "@/lib/validation/crm";

/** app_spec.md's `[ASSUMED DEFAULT]` 6-stage starter pipeline. */
const DEFAULT_STAGES = [
  { name: "Lead", isWonStage: false, isLostStage: false },
  { name: "Contacted", isWonStage: false, isLostStage: false },
  { name: "Proposal Sent", isWonStage: false, isLostStage: false },
  { name: "Negotiation", isWonStage: false, isLostStage: false },
  { name: "Closed Won", isWonStage: true, isLostStage: false },
  { name: "Closed Lost", isWonStage: false, isLostStage: true },
] as const;

// --- Pipeline stages -------------------------------------------------------

async function ensureDefaultStages(tx: RlsTx, userId: string) {
  const existing = await tx.query.crmPipelineStages.findFirst({ where: eq(crmPipelineStages.userId, userId) });
  if (existing) return;

  await tx.insert(crmPipelineStages).values(
    DEFAULT_STAGES.map((stage, index) => ({
      userId,
      name: stage.name,
      position: index,
      isWonStage: stage.isWonStage,
      isLostStage: stage.isLostStage,
      isDefault: true,
    }))
  );
}

export async function listPipelineStages(tx: RlsTx, userId: string) {
  await ensureDefaultStages(tx, userId);
  return tx.query.crmPipelineStages.findMany({
    where: eq(crmPipelineStages.userId, userId),
    orderBy: [asc(crmPipelineStages.position)],
  });
}

export async function getOwnedStage(tx: RlsTx, userId: string, stageId: string) {
  return tx.query.crmPipelineStages.findFirst({
    where: and(eq(crmPipelineStages.id, stageId), eq(crmPipelineStages.userId, userId)),
  });
}

/** Two-phase renumber (temp negative positions, then final 0..n-1) — avoids `crm_pipeline_stages_user_position_unique` firing on a transient duplicate mid-reorder, same technique `kanban.ts`'s `reorderColumns` uses. */
async function reorderStages(tx: RlsTx, orderedStageIds: string[]) {
  for (let i = 0; i < orderedStageIds.length; i++) {
    await tx.update(crmPipelineStages).set({ position: -(i + 1) }).where(eq(crmPipelineStages.id, orderedStageIds[i]));
  }
  for (let i = 0; i < orderedStageIds.length; i++) {
    await tx
      .update(crmPipelineStages)
      .set({ position: i, updatedAt: new Date() })
      .where(eq(crmPipelineStages.id, orderedStageIds[i]));
  }
}

export async function createStage(tx: RlsTx, userId: string, input: CrmStageCreateInput) {
  await ensureDefaultStages(tx, userId);
  const existing = await tx.query.crmPipelineStages.findMany({
    where: eq(crmPipelineStages.userId, userId),
    orderBy: [asc(crmPipelineStages.position)],
  });

  const [created] = await tx
    .insert(crmPipelineStages)
    .values({
      userId,
      name: input.name,
      position: existing.length, // see kanban.ts's createColumn doc comment for why this placeholder is safe against reorderStages's own temp-negative phase
      isWonStage: input.isWonStage ?? false,
      isLostStage: input.isLostStage ?? false,
      isDefault: false,
    })
    .returning();

  const targetIndex = Math.min(Math.max(input.position ?? existing.length, 0), existing.length);
  const orderedIds = existing.map((s) => s.id);
  orderedIds.splice(targetIndex, 0, created.id);
  await reorderStages(tx, orderedIds);

  return tx.query.crmPipelineStages.findFirst({ where: eq(crmPipelineStages.id, created.id) });
}

export async function updateStage(tx: RlsTx, userId: string, stageId: string, input: CrmStageUpdateInput) {
  const stage = await getOwnedStage(tx, userId, stageId);
  if (!stage) return null;

  if (input.position !== undefined) {
    const siblings = await tx.query.crmPipelineStages.findMany({
      where: eq(crmPipelineStages.userId, userId),
      orderBy: [asc(crmPipelineStages.position)],
    });
    const withoutMoved = siblings.filter((s) => s.id !== stageId).map((s) => s.id);
    const targetIndex = Math.min(Math.max(input.position, 0), withoutMoved.length);
    withoutMoved.splice(targetIndex, 0, stageId);
    await reorderStages(tx, withoutMoved);
  }

  const patch: Partial<typeof crmPipelineStages.$inferInsert> = { updatedAt: new Date() };
  if (input.name !== undefined) patch.name = input.name;
  if (input.isWonStage !== undefined) patch.isWonStage = input.isWonStage;
  if (input.isLostStage !== undefined) patch.isLostStage = input.isLostStage;
  await tx.update(crmPipelineStages).set(patch).where(eq(crmPipelineStages.id, stageId));

  return tx.query.crmPipelineStages.findFirst({ where: eq(crmPipelineStages.id, stageId) });
}

/** Same "reassign-or-reject" shape as `kanban.ts`'s `deleteColumn` — a stage with open opportunities needs an explicit `moveOpportunitiesToStageId` before it can go. */
export async function deleteStage(tx: RlsTx, userId: string, stageId: string, moveOpportunitiesToStageId?: string) {
  const stage = await getOwnedStage(tx, userId, stageId);
  if (!stage) return { status: "not_found" as const };

  const remaining = await tx.query.crmOpportunities.findMany({
    where: and(eq(crmOpportunities.stageId, stageId), isNull(crmOpportunities.deletedAt)),
  });

  if (remaining.length > 0) {
    if (!moveOpportunitiesToStageId) {
      return { status: "needs_target" as const };
    }
    const target = await getOwnedStage(tx, userId, moveOpportunitiesToStageId);
    if (!target) {
      throw new ApiError("VALIDATION_ERROR", "`moveOpportunitiesToStageId` must be another stage you own.");
    }
    for (const opportunity of remaining) {
      await tx
        .update(crmOpportunities)
        .set({ stageId: moveOpportunitiesToStageId, updatedAt: new Date() })
        .where(eq(crmOpportunities.id, opportunity.id));
    }
  }

  await tx.delete(crmPipelineStages).where(eq(crmPipelineStages.id, stageId));
  return { status: "deleted" as const };
}

// --- Opportunities -----------------------------------------------------

export async function listOpportunities(
  tx: RlsTx,
  userId: string,
  filters: { stageId?: string; q?: string } = {}
) {
  const conditions = [eq(crmOpportunities.userId, userId), isNull(crmOpportunities.deletedAt)];
  if (filters.stageId) {
    conditions.push(eq(crmOpportunities.stageId, filters.stageId));
  }
  if (filters.q) {
    const term = `%${filters.q}%`;
    conditions.push(or(ilike(crmOpportunities.title, term), ilike(crmOpportunities.clientName, term))!);
  }
  return tx.query.crmOpportunities.findMany({
    where: and(...conditions),
    orderBy: [asc(crmOpportunities.createdAt)],
  });
}

export async function getOwnedOpportunity(tx: RlsTx, userId: string, opportunityId: string) {
  return tx.query.crmOpportunities.findFirst({
    where: and(eq(crmOpportunities.id, opportunityId), eq(crmOpportunities.userId, userId), isNull(crmOpportunities.deletedAt)),
  });
}

export async function createOpportunity(tx: RlsTx, userId: string, input: CrmOpportunityCreateInput) {
  let stageId = input.stageId;
  if (!stageId) {
    await ensureDefaultStages(tx, userId);
    const first = await tx.query.crmPipelineStages.findFirst({
      where: eq(crmPipelineStages.userId, userId),
      orderBy: [asc(crmPipelineStages.position)],
    });
    if (!first) {
      throw new ApiError("UNPROCESSABLE_ENTITY", "No hay ninguna etapa en tu pipeline todavía.");
    }
    stageId = first.id;
  } else {
    const stage = await getOwnedStage(tx, userId, stageId);
    if (!stage) {
      throw new ApiError("VALIDATION_ERROR", "`stageId` no corresponde a una etapa que te pertenezca.");
    }
  }

  const [created] = await tx
    .insert(crmOpportunities)
    .values({
      userId,
      stageId,
      title: input.title,
      clientName: input.clientName,
      clientEmail: input.clientEmail || null,
      clientPhone: input.clientPhone || null,
      dealValue: input.estimatedValue != null ? String(input.estimatedValue) : null,
      currency: input.currency ?? "COP",
      expectedCloseDate: input.expectedCloseDate || null,
      notes: input.notes || null,
      source: input.source || null,
    })
    .returning();

  return created;
}

/**
 * Edits and/or moves an opportunity's stage. A `stageId` change is what
 * both the pipeline board's drag-and-drop AND its accessible "Mover a"
 * menu call — same shared-mutation-path convention as
 * `kanban.ts`'s `moveOrUpdateTask`.
 *
 * **Closed-Won → Project automation** (app_spec.md §3.2, §8): when the
 * destination stage's `isWonStage` is true, this same call atomically (1)
 * moves the opportunity into that stage, (2) stamps `closedAt`, (3) creates
 * a new project pre-filled from the opportunity's own fields via
 * `createProjectFromOpportunity`, and (4) records the link both directions
 * (`crmOpportunities.convertedProjectId` / `projects.opportunityId`) — see
 * `crm.ts`'s schema doc comment for why both ends exist. Returns
 * `{ opportunity, createdProject }`, `createdProject` non-null only on this
 * branch. Moving into an `isLostStage` stage just stamps `closedAt` with no
 * project. Moving between two OPEN stages (neither flag set) clears
 * `closedAt`/`convertedProjectId` back to null — reopening a previously
 * closed deal is a real, intentional scenario (e.g. undoing a mis-click),
 * not treated as an error.
 *
 * The UI-side "always confirms via modal" requirement for Closed-Won
 * (app_spec.md's explicit "Silent move confirm; Closed-Won always confirms
 * via modal") is enforced entirely client-side, BEFORE this endpoint is
 * ever called — see `close-won-confirm-dialog.tsx`. This function has no
 * own confirmation step; by the time it runs, the user has already
 * confirmed.
 */
export async function updateOpportunity(
  tx: RlsTx,
  userId: string,
  opportunityId: string,
  input: CrmOpportunityUpdateInput
) {
  const existing = await getOwnedOpportunity(tx, userId, opportunityId);
  if (!existing) return null;

  const patch: Partial<typeof crmOpportunities.$inferInsert> = { updatedAt: new Date() };
  if (input.title !== undefined) patch.title = input.title;
  if (input.clientName !== undefined) patch.clientName = input.clientName;
  if (input.clientEmail !== undefined) patch.clientEmail = input.clientEmail || null;
  if (input.clientPhone !== undefined) patch.clientPhone = input.clientPhone || null;
  if (input.estimatedValue !== undefined) patch.dealValue = input.estimatedValue != null ? String(input.estimatedValue) : null;
  if (input.currency !== undefined) patch.currency = input.currency;
  if (input.expectedCloseDate !== undefined) patch.expectedCloseDate = input.expectedCloseDate || null;
  if (input.notes !== undefined) patch.notes = input.notes || null;
  if (input.source !== undefined) patch.source = input.source || null;

  let createdProject: Awaited<ReturnType<typeof createProjectFromOpportunity>>["project"] | null = null;

  if (input.stageId !== undefined && input.stageId !== existing.stageId) {
    const targetStage = await getOwnedStage(tx, userId, input.stageId);
    if (!targetStage) {
      throw new ApiError("VALIDATION_ERROR", "`stageId` no corresponde a una etapa que te pertenezca.");
    }
    patch.stageId = targetStage.id;

    if (targetStage.isWonStage) {
      if (existing.convertedProjectId) {
        throw new ApiError("CONFLICT", "Esta oportunidad ya generó un proyecto.");
      }
      patch.closedAt = new Date();

      // Field mapping per app_spec.md §8's example response: client info
      // carries over directly, `notes` becomes the new project's scope
      // notes, `expectedCloseDate` becomes the project's expected start
      // date. Reads from `existing` (the pre-patch row) merged with
      // whatever this same request also changed, so a single call that
      // both edits a field AND moves to Closed-Won uses the fresh values.
      const finalTitle = (input.title ?? existing.title).trim() || existing.title;
      const finalClientName = input.clientName ?? existing.clientName;
      const finalClientEmail = input.clientEmail !== undefined ? input.clientEmail || null : existing.clientEmail;
      const finalNotes = input.notes !== undefined ? input.notes || null : existing.notes;
      const finalDealValue =
        input.estimatedValue !== undefined
          ? input.estimatedValue != null
            ? String(input.estimatedValue)
            : null
          : existing.dealValue;
      const finalCurrency = input.currency ?? existing.currency;
      const finalExpectedCloseDate =
        input.expectedCloseDate !== undefined ? input.expectedCloseDate || null : existing.expectedCloseDate;

      const valueNote =
        finalDealValue != null ? `Valor del trato: ${finalCurrency} ${finalDealValue}. ` : "";
      const scopeNoteSuffix = finalNotes ? `Notas de alcance trasladadas de la oportunidad: ${finalNotes}` : "";
      const autoNote = `Auto-creado desde la oportunidad de CRM ${existing.id}. ${valueNote}${scopeNoteSuffix}`.trim();

      const result = await createProjectFromOpportunity(tx, userId, existing.id, {
        clientName: finalClientName,
        clientEmail: finalClientEmail,
        title: finalTitle,
        scopeNotes: autoNote,
        dealValue: finalDealValue,
        currency: finalCurrency,
        expectedStartDate: finalExpectedCloseDate,
      });
      createdProject = result.project;
      patch.convertedProjectId = result.project.id;
    } else if (targetStage.isLostStage) {
      patch.closedAt = new Date();
    } else {
      // Moving between two open stages — reopens a previously closed deal.
      patch.closedAt = null;
    }
  }

  const [updated] = await tx.update(crmOpportunities).set(patch).where(eq(crmOpportunities.id, opportunityId)).returning();
  return { opportunity: updated, createdProject };
}

export async function softDeleteOpportunity(tx: RlsTx, userId: string, opportunityId: string) {
  const existing = await getOwnedOpportunity(tx, userId, opportunityId);
  if (!existing) return null;
  const [updated] = await tx
    .update(crmOpportunities)
    .set({ deletedAt: new Date() })
    .where(eq(crmOpportunities.id, opportunityId))
    .returning();
  return updated;
}
