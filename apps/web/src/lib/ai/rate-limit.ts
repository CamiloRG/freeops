/**
 * Tier determination + default-tier rate limiting for AI extraction
 * features — user-proposed, beyond app_spec.md's original scope (see the
 * codebase-memory-mcp ADR). Originally resume-only; generalized to a
 * per-`documentType` cap when bank-certificate extraction (Aero banking
 * multi-account rollout) reused the same BYOK/default-tier mechanism, so
 * usage from one feature never counts against another's monthly cap.
 *
 * Tier rule: if the user has an active, VERIFIED `ai_provider_connections`
 * row for `'anthropic'`, tier is `'byok'` (their own key, no FreeOps-side
 * limit). Otherwise tier is `'default'` (FreeOps's own key, capped per
 * `documentType` — see `DEFAULT_TIER_MONTHLY_LIMITS` below — counted from
 * `ai_extraction_log`).
 *
 * Both limits are currently 5/month and deliberately equal, NOT because
 * the two features are expected to cost the same — it's a placeholder
 * while FreeOps has no real subscription tiers yet (Phase 12/Stripe). Once
 * paid tiers exist, the real per-feature cap should come from the user's
 * plan, not this hardcoded constant — flagged here rather than silently
 * treated as a permanent design choice.
 *
 * The cap MUST be checked before calling Claude, never after — see the
 * `/api/v1/me/resume/extract` and `/api/v1/me/banking/extract` Route
 * Handlers, which call `isUnderDefaultTierLimit` and reject with 429
 * before ever constructing an Anthropic client for a default-tier request
 * at/over cap.
 */
import { and, count, eq, gte } from "drizzle-orm";
import { aiExtractionLog } from "@freeops/db/schema";
import type { RlsTx } from "@freeops/db/rls-client";
import { getVerifiedApiKey } from "@/lib/services/ai-connections";

export type ExtractionDocumentType = "resume" | "bank_certificate";

/** See this file's doc comment — a dev-time placeholder, not a final per-tier cap. */
export const DEFAULT_TIER_MONTHLY_LIMITS: Record<ExtractionDocumentType, number> = {
  resume: 5,
  bank_certificate: 5,
};

/** @deprecated kept for any external reference to the old resume-only constant name; use `DEFAULT_TIER_MONTHLY_LIMITS.resume`. */
export const DEFAULT_TIER_MONTHLY_LIMIT = DEFAULT_TIER_MONTHLY_LIMITS.resume;

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

/** Counts `ai_extraction_log` rows for `userId`/`documentType` with `tier = 'default'` created within the current calendar month — the rate-limit source of truth. */
export async function countDefaultTierUsageThisMonth(
  tx: RlsTx,
  userId: string,
  documentType: ExtractionDocumentType
): Promise<number> {
  const monthStart = startOfCurrentMonthUtc();
  const [row] = await tx
    .select({ value: count() })
    .from(aiExtractionLog)
    .where(
      and(
        eq(aiExtractionLog.userId, userId),
        eq(aiExtractionLog.documentType, documentType),
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

export async function isUnderDefaultTierLimit(
  tx: RlsTx,
  userId: string,
  documentType: ExtractionDocumentType
): Promise<DefaultTierLimitStatus> {
  const limit = DEFAULT_TIER_MONTHLY_LIMITS[documentType];
  const used = await countDefaultTierUsageThisMonth(tx, userId, documentType);
  return { underLimit: used < limit, used, limit };
}
