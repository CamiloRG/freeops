/**
 * BYOK AI provider connections — user-proposed feature beyond
 * app_spec.md's original scope (see the codebase-memory-mcp ADR). Same
 * shape as every other Phase 4 service: plain functions taking an `RlsTx`
 * + `userId` + typed input.
 *
 * `provider` is typed as the literal `"anthropic"` today (the only value
 * the DB's CHECK constraint allows in v1) but the functions are already
 * parameterized by it so a second provider is additive later, not a
 * redesign.
 */
import { and, eq, isNull } from "drizzle-orm";
import { aiProviderConnections } from "@freeops/db/schema";
import type { RlsTx } from "@freeops/db/rls-client";
import { decryptField, encryptField } from "@/lib/encryption";
import { getAnthropicClient } from "@/lib/ai/client";
import { RESUME_EXTRACTION_MODEL } from "@/lib/ai/extract-resume";
import { ApiError } from "@/lib/api/errors";

export type AiProvider = "anthropic";

export interface AiConnectionSummary {
  provider: AiProvider;
  /** Display-safe hint only — see `computeApiKeyHint`'s doc comment. Never the real key. */
  apiKeyHint: string;
  verifiedAt: Date | null;
  connectedAt: Date;
}

/**
 * Display-safe hint computed ONCE at write time, never by decrypting on
 * read. Format: the literal `sk-ant-` prefix followed by `...` followed by
 * the real key's last 4 characters, e.g. `sk-ant-...ntFm` — enough for a
 * user to recognize "yes, that's my key" without ever reconstructing or
 * approximating the actual secret.
 */
export function computeApiKeyHint(apiKey: string): string {
  const trimmed = apiKey.trim();
  const last4 = trimmed.slice(-4);
  return `sk-ant-...${last4}`;
}

/**
 * Confirms an Anthropic API key actually works with a minimal, cheap real
 * call (same verification discipline used for every other credential in
 * this build — Supabase, R2, FreeOps's own Anthropic key). Uses the same
 * hardcoded cheapest model as extraction itself, so verification never
 * costs more than the feature it's gating.
 */
export async function verifyAnthropicKey(apiKey: string): Promise<boolean> {
  try {
    const client = getAnthropicClient(apiKey);
    await client.messages.create({
      model: RESUME_EXTRACTION_MODEL,
      max_tokens: 1,
      messages: [{ role: "user", content: "ping" }],
    });
    return true;
  } catch {
    return false;
  }
}

/** Any row for (userId, provider), including soft-deleted — internal use only (upsert needs to find a soft-deleted row to revive, since the unique constraint is not partial). */
async function findRawConnection(tx: RlsTx, userId: string, provider: AiProvider) {
  return tx.query.aiProviderConnections.findFirst({
    where: and(eq(aiProviderConnections.userId, userId), eq(aiProviderConnections.provider, provider)),
  });
}

/** Active (non-deleted) connection row, if any. */
export async function getConnection(tx: RlsTx, userId: string, provider: AiProvider) {
  return tx.query.aiProviderConnections.findFirst({
    where: and(
      eq(aiProviderConnections.userId, userId),
      eq(aiProviderConnections.provider, provider),
      isNull(aiProviderConnections.deletedAt)
    ),
  });
}

export async function getConnectionSummary(
  tx: RlsTx,
  userId: string,
  provider: AiProvider
): Promise<AiConnectionSummary | null> {
  const row = await getConnection(tx, userId, provider);
  if (!row) return null;
  return {
    provider,
    apiKeyHint: row.apiKeyHint,
    verifiedAt: row.verifiedAt,
    connectedAt: row.createdAt,
  };
}

/**
 * Connects or updates a user's BYOK key for `provider`. Verifies the key
 * actually works BEFORE saving anything — rejects with a clear error
 * rather than silently storing a broken key. Revives a soft-deleted row in
 * place rather than inserting a new one, since `(user_id, provider)` has a
 * non-partial unique constraint.
 */
export async function upsertConnection(
  tx: RlsTx,
  userId: string,
  provider: AiProvider,
  apiKey: string
): Promise<AiConnectionSummary> {
  const verified = await verifyAnthropicKey(apiKey);
  if (!verified) {
    throw new ApiError(
      "UNPROCESSABLE_ENTITY",
      "This API key doesn't seem to work — check it's correct and has available credit."
    );
  }

  const apiKeyEncrypted = encryptField(apiKey);
  const apiKeyHint = computeApiKeyHint(apiKey);
  const verifiedAt = new Date();

  const existing = await findRawConnection(tx, userId, provider);
  const row = existing
    ? (
        await tx
          .update(aiProviderConnections)
          .set({ apiKeyEncrypted, apiKeyHint, verifiedAt, updatedAt: new Date(), deletedAt: null })
          .where(eq(aiProviderConnections.id, existing.id))
          .returning()
      )[0]
    : (
        await tx
          .insert(aiProviderConnections)
          .values({ userId, provider, apiKeyEncrypted, apiKeyHint, verifiedAt })
          .returning()
      )[0];

  return { provider, apiKeyHint: row.apiKeyHint, verifiedAt: row.verifiedAt, connectedAt: row.createdAt };
}

export async function deleteConnection(tx: RlsTx, userId: string, provider: AiProvider): Promise<void> {
  await tx
    .update(aiProviderConnections)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(aiProviderConnections.userId, userId), eq(aiProviderConnections.provider, provider)));
}

/**
 * Returns the decrypted API key for an active, verified connection, or
 * `null` if the user has none — the tier-determination entry point used by
 * `@/lib/ai/rate-limit`'s `determineTier`. A connection that exists but
 * was never verified (should not normally happen — `upsertConnection`
 * always verifies before saving) is treated as absent, not BYOK-eligible.
 */
export async function getVerifiedApiKey(tx: RlsTx, userId: string, provider: AiProvider): Promise<string | null> {
  const row = await getConnection(tx, userId, provider);
  if (!row || !row.verifiedAt) return null;
  return decryptField(row.apiKeyEncrypted);
}
