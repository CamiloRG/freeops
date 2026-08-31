/**
 * AI-assisted resume import + BYOK AI provider connections — a
 * user-proposed feature scoped mid-build, NOT part of app_spec.md's
 * original "Data Model & Schema" section. See the codebase-memory-mcp ADR's
 * PATTERNS section for the full BYOK/rate-limit/extraction design this
 * schema backs.
 *
 * Two tables:
 *   - `ai_provider_connections`: one row per user per connected BYOK
 *     provider (v1: only `'anthropic'` is a valid value, but the column is
 *     named/shaped so adding another provider later is an additive
 *     CHECK-constraint migration, not a redesign).
 *   - `ai_extraction_log`: append-only audit trail AND the rate-limit
 *     source of truth for the default tier's 5/month cap (see
 *     `apps/web/src/lib/ai/rate-limit.ts`).
 *
 * Both FKs use `on delete cascade`, deliberately NOT `on delete restrict`
 * (contrast `profile.ts`'s `banking_details`/`tax_info`, which use
 * `restrict` because they're financial history under DIAN retention
 * rules). A stored BYOK API key / usage log is neither — cascading here
 * avoids the real account-deletion friction the ADR's TRADEOFFS section
 * documents for `banking_details`' restrict FK.
 */
import { check, index, integer, numeric, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { bytea, idColumn, softDelete, timestamps } from "./_helpers";
import { users } from "./identity";

export const aiProviderConnections = pgTable(
  "ai_provider_connections",
  {
    id: idColumn(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Only 'anthropic' is valid in v1 — CHECK-constrained, not a free
    // string, same forward-compatible pattern as every other enum-like
    // column in this codebase (see _helpers.ts's doc comment).
    provider: text("provider").notNull(),
    // Envelope-encrypted via the EXISTING apps/web/src/lib/encryption.ts
    // encryptField/decryptField (AES-256-GCM) — same mechanism as
    // banking_details/tax_info, no new crypto code.
    apiKeyEncrypted: bytea("api_key_encrypted").notNull(),
    // Display-safe hint computed ONCE at write time (never by decrypting on
    // read): `sk-ant-...` + the last 4 characters of the real key, e.g.
    // `sk-ant-...ntFm`. See ai-connections.ts's `computeApiKeyHint` for the
    // exact format. Lets the UI show "which key is connected" without ever
    // decrypting purely to render a masked value.
    apiKeyHint: text("api_key_hint").notNull(),
    // Set when the key was last confirmed to actually work (a real
    // Anthropic API call succeeded) — see ai-connections.ts's
    // `verifyAnthropicKey`. Null if never verified (should not normally
    // happen — every upsert verifies before saving) or if verification
    // becomes stale in a future revocation-detection feature.
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    ...timestamps,
    ...softDelete,
  },
  (table) => [
    unique("ai_provider_connections_user_provider_unique").on(table.userId, table.provider),
    check("ai_provider_connections_provider_check", sql`${table.provider} in ('anthropic')`),
  ]
);

export const aiExtractionLog = pgTable(
  "ai_extraction_log",
  {
    id: idColumn(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // 'resume' (v1) + 'bank_certificate' (Aero banking multi-account
    // rollout) — same forward-compatible CHECK pattern.
    documentType: text("document_type").notNull(),
    // Which tier served the call — determines whether this row counts
    // against the default tier's monthly cap (see rate-limit.ts).
    tier: text("tier").notNull(),
    // Which provider actually served the call (always 'anthropic' in v1,
    // recorded per-call for when more providers exist).
    provider: text("provider").notNull(),
    // Exact model string used, for audit/debugging — NOT configurable, see
    // apps/web/src/lib/ai/extract-resume.ts's hardcoded MODEL constant.
    model: text("model").notNull(),
    status: text("status").notNull(),
    // Real token usage from the Anthropic response — added for cost
    // tracking/quota tuning (is DEFAULT_TIER_MONTHLY_LIMIT calibrated
    // right, are we pricing FreeOps's own plans to actually cover AI
    // spend). Nullable: a call that fails before Claude ever responds
    // (network/API error) has no usage to report. A call that DID get a
    // response but couldn't be parsed still has real usage — see
    // extract-resume.ts's `ExtractionError.usage`, which is captured in
    // that case too, so this column is only null for genuine no-response
    // failures.
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    // How many raw `messages.create` calls this row's usage/cost covers —
    // almost always 1, but extract-resume.ts's tool-artifact-leak retry can
    // make one logical extraction cost 2 real API calls. Recording this
    // separately from inputTokens/outputTokens (which are already the SUM
    // across those calls) makes retry-driven cost inflation visible instead
    // of silently doubling the average without a way to see why.
    apiCallCount: integer("api_call_count").notNull().default(1),
    // Computed at write time from apps/web/src/lib/ai/pricing.ts's
    // hardcoded Haiku 4.5 rates — NOT recomputed from tokens at query time,
    // so a historical row stays accurate even if pricing.ts's constants
    // are later updated for a price change. Null only when inputTokens/
    // outputTokens are also null (nothing to price).
    costUsd: numeric("cost_usd", { precision: 10, scale: 6 }),
    // Append-only log — no updated_at/soft-delete, matches audit.ts's
    // deletion_warnings convention for the same reason.
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Backs the rate-limit query: count rows for (user_id, tier='default')
    // within the current calendar month.
    index("idx_ai_extraction_log_user_tier_created").on(table.userId, table.tier, table.createdAt),
    check(
      "ai_extraction_log_document_type_check",
      sql`${table.documentType} in ('resume','bank_certificate')`
    ),
    check("ai_extraction_log_tier_check", sql`${table.tier} in ('default','byok')`),
    check("ai_extraction_log_status_check", sql`${table.status} in ('succeeded','failed')`),
  ]
);
