/**
 * Tier determination + default-tier rate limiting for AI resume
 * extraction — user-proposed feature beyond app_spec.md's original scope
 * (see the codebase-memory-mcp ADR).
 *
 * Tier rule: if the user has an active, VERIFIED `ai_provider_connections`
 * row for `'anthropic'`, tier is `'byok'` (their own key, no FreeOps-side
 * limit). Otherwise tier is `'default'` (FreeOps's own key, capped at
 * `DEFAULT_TIER_MONTHLY_LIMIT` extractions per calendar month, counted
 * from `ai_extraction_log`).
 *
 * The cap MUST be checked before calling Claude, never after — see the
 * `/api/v1/me/resume/extract` Route Handler, which calls
 * `isUnderDefaultTierLimit` and rejects with 429 before ever constructing
 * an Anthropic client for a default-tier request at/over cap.
 */
import { and, count, eq, gte } from "drizzle-orm";
import { aiExtractionLog } from "@freeops/db/schema";
import type { RlsTx } from "@freeops/db/rls-client";
import { getVerifiedApiKey } from "@/lib/services/ai-connections";

export const DEFAULT_TIER_MONTHLY_LIMIT = 5;

export type ExtractionTier = "default" | "byok";

export interface TierDecision {
  tier: ExtractionTier;
  /** Decrypted BYOK key — present only when `tier === "byok"`. */
  apiKey?: string;
}

/** Start of the current calendar month in UTC, 00:00:00. */
function startOfCurrentMonthUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
}

export async function determineTier(tx: RlsTx, userId: string): Promise<TierDecision> {
  const apiKey = await getVerifiedApiKey(tx, userId, "anthropic");
  if (apiKey) {
    return { tier: "byok", apiKey };
  }
  return { tier: "default" };
}

/** Counts `ai_extraction_log` rows for `userId` with `tier = 'default'` created within the current calendar month — the rate-limit source of truth. */
export async function countDefaultTierUsageThisMonth(tx: RlsTx, userId: string): Promise<number> {
  const monthStart = startOfCurrentMonthUtc();
  const [row] = await tx
    .select({ value: count() })
    .from(aiExtractionLog)
    .where(
      and(
        eq(aiExtractionLog.userId, userId),
        eq(aiExtractionLog.tier, "default"),
        gte(aiExtractionLog.createdAt, monthStart)
      )
    );
  return row?.value ?? 0;
}

export interface DefaultTierLimitStatus {
  underLimit: boolean;
  used: number;
  limit: number;
}

export async function isUnderDefaultTierLimit(tx: RlsTx, userId: string): Promise<DefaultTierLimitStatus> {
  const used = await countDefaultTierUsageThisMonth(tx, userId);
  return { underLimit: used < DEFAULT_TIER_MONTHLY_LIMIT, used, limit: DEFAULT_TIER_MONTHLY_LIMIT };
}
