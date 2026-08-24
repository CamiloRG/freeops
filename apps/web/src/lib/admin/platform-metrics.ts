/**
 * Platform-wide "at a glance" metrics for the `/admin` operations
 * dashboard — deliberately separate from `ops-metrics.ts` (which is scoped
 * to the AI cost/quota-tuning pillar). Everything here reuses tables that
 * already exist and are already populated — no new schema, no external
 * service. Per the feasibility discussion this was built from: tier/MRR
 * (blocked on Phase 12 Stripe) and real event-level "most-used features"
 * (blocked on a PostHog/event-log decision) are deliberately NOT here.
 *
 * All queries go through `getDb()` (RLS-bypassing admin client) — same
 * convention as ops-metrics.ts, never `withUserDb`/`withRlsContext`.
 */
import { eq, isNull, sql } from "drizzle-orm";
import { getDb } from "@freeops/db/client";
import { crmOpportunities, crmPipelineStages, kanbanTasks, projects, users } from "@freeops/db/schema";

/**
 * Returns an ISO string, not a `Date` — every call site interpolates this
 * into a raw `sql` template (either a `.select({...})` fragment or
 * `db.execute(sql...)`), and a bare JS `Date` object crashes there: it's
 * only Drizzle's own typed operators (`gte`, `eq`, ...) that know how to
 * serialize a `Date` for postgres.js's bind protocol — a raw `sql`
 * template interpolation does not go through that same column-aware
 * mapping and hits postgres.js's byte-encoder with an object it can't
 * handle. Confirmed by direct reproduction: `gte(col, someDate)` works,
 * `sql\`col >= ${someDate}\`` throws `ERR_INVALID_ARG_TYPE`. `ops-
 * metrics.ts` never hit this because it only ever compares dates via
 * `gte()`, never via raw `sql` interpolation.
 */
function daysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString();
}

export interface PlatformSummary {
  totalFreelancers: number;
  newUsers7d: number;
  newUsers30d: number;
  /** Proxy metric, not true engagement — see file/README doc comment on `getActiveUserCounts`. */
  activeUsers7d: number;
  activeUsers30d: number;
  totalProjects: number;
  usersWithAtLeastOneProject: number;
  avgProjectsPerUser: number;
  crmWonCount: number;
  crmLostCount: number;
  crmOpenCount: number;
  totalKanbanTasks: number;
}

/**
 * "Active users" here means "signed in recently" (Supabase Auth's
 * `last_sign_in_at`) — a login proxy, NOT true product engagement (did
 * they actually do something). Real engagement needs an event log, which
 * is the same blocker as "most-used features" — deliberately not built
 * here. `auth.users` is Supabase-managed and not part of this schema's
 * Drizzle model (see identity.ts's `authUsers` stub, which only declares
 * `id` — just enough for the `public.users` FK, not for reads), so this
 * is a raw cross-schema query, same technique as ops-metrics.ts's
 * `pg_stat_statements` read. Joined against `public.users` so an
 * account soft-deleted in-app (but not yet gone from Supabase Auth) isn't
 * counted as "active".
 */
async function getActiveUserCounts(): Promise<{ activeUsers7d: number; activeUsers30d: number }> {
  const db = getDb();
  const [row] = await db.execute<{ active_7d: string | number; active_30d: string | number }>(sql`
    select
      count(*) filter (where au.last_sign_in_at >= ${daysAgo(7)}) as active_7d,
      count(*) filter (where au.last_sign_in_at >= ${daysAgo(30)}) as active_30d
    from auth.users au
    join public.users u on u.id = au.id
    where u.deleted_at is null
  `);
  return {
    activeUsers7d: Number(row?.active_7d ?? 0),
    activeUsers30d: Number(row?.active_30d ?? 0),
  };
}

export async function getPlatformSummary(): Promise<PlatformSummary> {
  const db = getDb();

  const [userAgg] = await db
    .select({
      total: sql<number>`count(*)`,
      new7d: sql<number>`count(*) filter (where ${users.createdAt} >= ${daysAgo(7)})`,
      new30d: sql<number>`count(*) filter (where ${users.createdAt} >= ${daysAgo(30)})`,
    })
    .from(users)
    .where(isNull(users.deletedAt));

  const [projectAgg] = await db
    .select({
      total: sql<number>`count(*)`,
      distinctUsers: sql<number>`count(distinct ${projects.userId})`,
    })
    .from(projects)
    .where(isNull(projects.deletedAt));

  const [crmAgg] = await db
    .select({
      won: sql<number>`count(*) filter (where ${crmPipelineStages.isWonStage})`,
      lost: sql<number>`count(*) filter (where ${crmPipelineStages.isLostStage})`,
      open: sql<number>`count(*) filter (where not ${crmPipelineStages.isWonStage} and not ${crmPipelineStages.isLostStage})`,
    })
    .from(crmOpportunities)
    .innerJoin(crmPipelineStages, eq(crmPipelineStages.id, crmOpportunities.stageId))
    .where(isNull(crmOpportunities.deletedAt));

  const [kanbanAgg] = await db
    .select({ total: sql<number>`count(*)` })
    .from(kanbanTasks)
    .where(isNull(kanbanTasks.deletedAt));

  const { activeUsers7d, activeUsers30d } = await getActiveUserCounts();

  const totalFreelancers = Number(userAgg?.total ?? 0);
  const totalProjects = Number(projectAgg?.total ?? 0);

  return {
    totalFreelancers,
    newUsers7d: Number(userAgg?.new7d ?? 0),
    newUsers30d: Number(userAgg?.new30d ?? 0),
    activeUsers7d,
    activeUsers30d,
    totalProjects,
    usersWithAtLeastOneProject: Number(projectAgg?.distinctUsers ?? 0),
    avgProjectsPerUser: totalFreelancers > 0 ? totalProjects / totalFreelancers : 0,
    crmWonCount: Number(crmAgg?.won ?? 0),
    crmLostCount: Number(crmAgg?.lost ?? 0),
    crmOpenCount: Number(crmAgg?.open ?? 0),
    totalKanbanTasks: Number(kanbanAgg?.total ?? 0),
  };
}
