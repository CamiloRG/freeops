/**
 * Projects — app_spec.md § "API Contracts & Integrations" → "5. Projects".
 * Same `RlsTx` + `userId` + typed-input shape as every other service (see
 * `@/lib/services/tax-info` for the closest existing reference).
 *
 * `opportunityId` is a real FK to `crm_opportunities`. `createProject`
 * below always leaves it null (`source: "manual"`); Phase 6's
 * `@/lib/services/crm`'s Closed-Won automation is the only thing that ever
 * populates it, via `seedProjectDefaults` — the board+4-default-columns
 * insert this file already did for manual creation, extracted so both
 * paths share exactly one implementation of "what a brand-new project's
 * kanban board looks like" rather than drifting out of sync.
 */
import { and, desc, eq, ilike, isNull, or } from "drizzle-orm";
import { contractDocuments, kanbanBoards, kanbanColumns, projects } from "@freeops/db/schema";
import type { RlsTx } from "@freeops/db/rls-client";
import { ApiError } from "@/lib/api/errors";
import type { ProjectCreateInput, ProjectUpdateInput } from "@/lib/validation/business";

/** The 4 default columns seeded on every new project's kanban board — app_spec.md's `[ASSUMED DEFAULT]`. */
const DEFAULT_COLUMNS = ["Backlog", "In Progress", "Review", "Done"] as const;

export async function listProjects(
  tx: RlsTx,
  userId: string,
  filters: { status?: string; q?: string } = {}
) {
  const conditions = [eq(projects.userId, userId), isNull(projects.deletedAt)];
  if (filters.status) {
    conditions.push(eq(projects.status, filters.status));
  }
  if (filters.q) {
    const term = `%${filters.q}%`;
    conditions.push(or(ilike(projects.title, term), ilike(projects.clientName, term))!);
  }
  return tx.query.projects.findMany({
    where: and(...conditions),
    orderBy: [desc(projects.createdAt)],
  });
}

/** Returns the project row only if it belongs to `userId` — RLS also enforces this; this is the 404-vs-403 existence check. */
export async function getOwnedProject(tx: RlsTx, userId: string, projectId: string) {
  return tx.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.userId, userId), isNull(projects.deletedAt)),
  });
}

export async function getProjectDetail(tx: RlsTx, userId: string, projectId: string) {
  const project = await getOwnedProject(tx, userId, projectId);
  if (!project) return null;

  const [documents, board] = await Promise.all([
    tx.query.contractDocuments.findMany({
      where: and(eq(contractDocuments.projectId, project.id), isNull(contractDocuments.deletedAt)),
      orderBy: [desc(contractDocuments.uploadedAt)],
    }),
    tx.query.kanbanBoards.findFirst({ where: eq(kanbanBoards.projectId, project.id) }),
  ]);

  return { project, contractDocuments: documents, kanbanBoardId: board?.id ?? null };
}

/** Inserts the `kanban_boards` row plus the 4 seeded default columns for a just-created project — app_spec.md's explicit "Default columns seeded on project creation" requirement, shared by every project-creation path. */
async function seedProjectDefaults(tx: RlsTx, projectId: string) {
  const [board] = await tx.insert(kanbanBoards).values({ projectId }).returning();

  await tx.insert(kanbanColumns).values(
    DEFAULT_COLUMNS.map((name, index) => ({
      boardId: board.id,
      name,
      position: index,
      isDefault: true,
    }))
  );

  return board;
}

/**
 * Creates a project and, in the same transaction, its default kanban board
 * (see `seedProjectDefaults`). `tx` is already transaction-scoped (see
 * `withRlsContext`), so plain sequential inserts here are already atomic
 * with the rest of the request.
 */
export async function createProject(tx: RlsTx, userId: string, input: ProjectCreateInput) {
  const [project] = await tx
    .insert(projects)
    .values({
      userId,
      clientName: input.clientName,
      clientEmail: input.clientEmail || null,
      clientTaxId: input.clientTaxId || null,
      title: input.name,
      description: input.description || null,
      scopeNotes: input.scopeNotes || null,
      dealValue: input.value != null ? String(input.value) : null,
      currency: input.currency ?? "COP",
      startDate: input.startDate,
      endDate: input.expectedEndDate || null,
    })
    .returning();

  const board = await seedProjectDefaults(tx, project.id);

  return { project, kanbanBoardId: board.id };
}

/**
 * Creates a project pre-filled from a closed-won CRM opportunity —
 * `@/lib/services/crm`'s `updateOpportunity` is the only caller. Same
 * default-board seeding as `createProject`; the only structural difference
 * is `opportunityId` being set and every field coming from the opportunity
 * rather than a user-submitted form. `startDate` is deliberately left null
 * (the freelancer fills it in manually once real work begins — only
 * `expectedStartDate` is known at close-won time); `status` stays the
 * table's own default (`active`).
 */
export async function createProjectFromOpportunity(
  tx: RlsTx,
  userId: string,
  opportunityId: string,
  values: {
    clientName: string;
    clientEmail: string | null;
    title: string;
    scopeNotes: string | null;
    dealValue: string | null;
    currency: string;
    expectedStartDate: string | null;
  }
) {
  const [project] = await tx
    .insert(projects)
    .values({
      userId,
      opportunityId,
      clientName: values.clientName,
      clientEmail: values.clientEmail,
      title: values.title,
      scopeNotes: values.scopeNotes,
      dealValue: values.dealValue,
      currency: values.currency,
      expectedStartDate: values.expectedStartDate,
    })
    .returning();

  const board = await seedProjectDefaults(tx, project.id);

  return { project, kanbanBoardId: board.id };
}

export async function updateProject(tx: RlsTx, userId: string, projectId: string, input: ProjectUpdateInput) {
  const existing = await getOwnedProject(tx, userId, projectId);
  if (!existing) return null;

  const patch: Partial<typeof projects.$inferInsert> = {};
  if (input.name !== undefined) patch.title = input.name;
  if (input.clientName !== undefined) patch.clientName = input.clientName;
  if (input.clientEmail !== undefined) patch.clientEmail = input.clientEmail || null;
  if (input.clientTaxId !== undefined) patch.clientTaxId = input.clientTaxId || null;
  if (input.description !== undefined) patch.description = input.description || null;
  if (input.scopeNotes !== undefined) patch.scopeNotes = input.scopeNotes || null;
  if (input.status !== undefined) patch.status = input.status;
  if (input.startDate !== undefined) patch.startDate = input.startDate || null;
  if (input.expectedEndDate !== undefined) patch.endDate = input.expectedEndDate || null;
  if (input.value !== undefined) patch.dealValue = input.value != null ? String(input.value) : null;
  if (input.currency !== undefined) patch.currency = input.currency;
  patch.updatedAt = new Date();

  const [updated] = await tx.update(projects).set(patch).where(eq(projects.id, projectId)).returning();
  return updated;
}

/** Whether `projectId` has any non-deleted contract documents (drives the DIAN-warning delete gate). */
export async function projectHasContractDocuments(tx: RlsTx, projectId: string): Promise<boolean> {
  const doc = await tx.query.contractDocuments.findFirst({
    where: and(eq(contractDocuments.projectId, projectId), isNull(contractDocuments.deletedAt)),
  });
  return !!doc;
}

export async function softDeleteProject(tx: RlsTx, projectId: string) {
  const [updated] = await tx
    .update(projects)
    .set({ deletedAt: new Date() })
    .where(eq(projects.id, projectId))
    .returning();
  if (!updated) {
    throw new ApiError("NOT_FOUND", "Project not found.");
  }
  return updated;
}
