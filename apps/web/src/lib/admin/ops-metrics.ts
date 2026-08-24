/**
 * Read-only aggregate queries for the `/admin` operations dashboard —
 * platform-wide numbers, never scoped to one user, so every query here
 * goes through `getDb()` (the RLS-bypassing admin/background-job client),
 * never `withUserDb`/`withRlsContext`. Nothing in this file writes.
 *
 * Scope for this first cut (see the conversation this was built from):
 * the "cost & quota tuning" pillar — is `DEFAULT_TIER_MONTHLY_LIMIT`
 * (lib/ai/rate-limit.ts) calibrated right, and what is FreeOps's own AI
 * spend actually costing. `costUsd` on a BYOK-tier row is informational
 * only (what the call would have cost at FreeOps's rate) — BYOK calls are
 * paid by the user's own Anthropic key, not FreeOps's, so they're
 * deliberately excluded from `defaultTierCostUsd`.
 */
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { getDb } from "@freeops/db/client";
import { aiExtractionLog, users } from "@freeops/db/schema";
import { DEFAULT_TIER_MONTHLY_LIMIT } from "@/lib/ai/rate-limit";

function startOfCurrentMonthUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export interface MonthlyAiSummary {
  defaultTierCostUsd: number;
  defaultTierExtractions: number;
  defaultTierFailures: number;
  defaultTierApiCalls: number;
  byokExtractions: number;
  /** Distinct default-tier users this month who hit or exceeded the cap. */
  usersAtCap: number;
  /** Distinct default-tier users this month who stayed under the cap. */
  usersUnderCap: number;
  capLimit: number;
}

/** This month's default-tier AI spend + the quota-tuning signal (how many users are actually hitting the cap). */
export async function getMonthlyAiSummary(): Promise<MonthlyAiSummary> {
  const db = getDb();
  const monthStart = startOfCurrentMonthUtc();

  const [defaultAgg] = await db
    .select({
      costUsd: sql<string>`coalesce(sum(${aiExtractionLog.costUsd}), 0)`,
      extractions: sql<number>`count(*) filter (where ${aiExtractionLog.status} = 'succeeded')`,
      failures: sql<number>`count(*) filter (where ${aiExtractionLog.status} = 'failed')`,
      apiCalls: sql<number>`coalesce(sum(${aiExtractionLog.apiCallCount}), 0)`,
    })
    .from(aiExtractionLog)
    .where(and(eq(aiExtractionLog.tier, "default"), gte(aiExtractionLog.createdAt, monthStart)));

  const [byokAgg] = await db
    .select({ extractions: sql<number>`count(*) filter (where ${aiExtractionLog.status} = 'succeeded')` })
    .from(aiExtractionLog)
    .where(and(eq(aiExtractionLog.tier, "byok"), gte(aiExtractionLog.createdAt, monthStart)));

  // Per default-tier user, how many calls (success or fail, matching
  // rate-limit.ts's own countDefaultTierUsageThisMonth) they've made this
  // month — the actual "is the cap right" signal.
  const perUser = await db
    .select({ userId: aiExtractionLog.userId, used: sql<number>`count(*)` })
    .from(aiExtractionLog)
    .where(and(eq(aiExtractionLog.tier, "default"), gte(aiExtractionLog.createdAt, monthStart)))
    .groupBy(aiExtractionLog.userId);

  const usersAtCap = perUser.filter((u) => Number(u.used) >= DEFAULT_TIER_MONTHLY_LIMIT).length;

  return {
    defaultTierCostUsd: Number(defaultAgg?.costUsd ?? 0),
    defaultTierExtractions: Number(defaultAgg?.extractions ?? 0),
    defaultTierFailures: Number(defaultAgg?.failures ?? 0),
    defaultTierApiCalls: Number(defaultAgg?.apiCalls ?? 0),
    byokExtractions: Number(byokAgg?.extractions ?? 0),
    usersAtCap,
    usersUnderCap: perUser.length - usersAtCap,
    capLimit: DEFAULT_TIER_MONTHLY_LIMIT,
  };
}

export interface DailyAiCost {
  day: string; // YYYY-MM-DD, UTC
  costUsd: number;
  extractions: number;
}

/** Default-tier daily spend for the last `days` days (UTC calendar days), oldest first. */
export async function getDailyAiCost(days = 14): Promise<DailyAiCost[]> {
  const db = getDb();
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - (days - 1));
  since.setUTCHours(0, 0, 0, 0);

  const dayExpr = sql`to_char(${aiExtractionLog.createdAt} at time zone 'UTC', 'YYYY-MM-DD')`;
  const rows = await db
    .select({
      day: dayExpr.as("day"),
      costUsd: sql<string>`coalesce(sum(${aiExtractionLog.costUsd}), 0)`,
      extractions: sql<number>`count(*) filter (where ${aiExtractionLog.status} = 'succeeded')`,
    })
    .from(aiExtractionLog)
    .where(and(eq(aiExtractionLog.tier, "default"), gte(aiExtractionLog.createdAt, since)))
    .groupBy(dayExpr)
    .orderBy(dayExpr);

  return rows.map((r) => ({
    day: r.day as unknown as string,
    costUsd: Number(r.costUsd),
    extractions: Number(r.extractions),
  }));
}

export interface TopAiUser {
  email: string;
  tier: "default" | "byok";
  costUsd: number;
  extractions: number;
}

/** Highest-cost users this month, both tiers shown (BYOK cost is informational only — see file doc comment). */
export async function getTopAiUsersThisMonth(limit = 10): Promise<TopAiUser[]> {
  const db = getDb();
  const monthStart = startOfCurrentMonthUtc();

  const rows = await db
    .select({
      email: users.email,
      tier: aiExtractionLog.tier,
      costUsd: sql<string>`coalesce(sum(${aiExtractionLog.costUsd}), 0)`,
      extractions: sql<number>`count(*) filter (where ${aiExtractionLog.status} = 'succeeded')`,
    })
    .from(aiExtractionLog)
    .innerJoin(users, eq(users.id, aiExtractionLog.userId))
    .where(gte(aiExtractionLog.createdAt, monthStart))
    .groupBy(users.email, aiExtractionLog.tier)
    .orderBy(desc(sql`sum(${aiExtractionLog.costUsd})`))
    .limit(limit);

  return rows.map((r) => ({
    email: r.email,
    tier: r.tier as "default" | "byok",
    costUsd: Number(r.costUsd),
    extractions: Number(r.extractions),
  }));
}

export interface HeavyQuery {
  query: string;
  calls: number;
  totalExecMs: number;
  meanExecMs: number;
}

/**
 * "Heaviest queries" by total execution time, from `pg_stat_statements` —
 * the practical database-cost proxy (Postgres/Supabase bills by compute
 * size, not per query, so total/mean exec time is the closest real signal
 * to what's driving that spend). Returns `null` rather than throwing if
 * the connected role can't read the view (permissions vary by Postgres
 * setup) — this panel is a bonus, not load-bearing for the rest of the
 * dashboard.
 */
export async function getHeaviestQueries(limit = 10): Promise<HeavyQuery[] | null> {
  const db = getDb();
  try {
    const result = await db.execute<{
      query: string;
      calls: string | number;
      total_exec_time: string | number;
      mean_exec_time: string | number;
    }>(sql`
      select query, calls, total_exec_time, mean_exec_time
      from extensions.pg_stat_statements
      where query not ilike '%pg_stat_statements%'
      order by total_exec_time desc
      limit ${limit}
    `);
    return result.map((r) => ({
      query: r.query.length > 140 ? `${r.query.slice(0, 140)}…` : r.query,
      calls: Number(r.calls),
      totalExecMs: Number(r.total_exec_time),
      meanExecMs: Number(r.mean_exec_time),
    }));
  } catch (error) {
    console.error("[admin] getHeaviestQueries failed (non-fatal):", error);
    return null;
  }
}
