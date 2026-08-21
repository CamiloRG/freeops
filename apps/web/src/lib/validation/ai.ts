/**
 * Zod schemas for the AI-assisted resume import + BYOK AI provider
 * connections feature — a user-proposed addition beyond app_spec.md's
 * original scope (see the codebase-memory-mcp ADR). Kept in its own file
 * rather than added to `personal.ts` since this isn't part of the
 * Personal module's spec-defined domains (profile/banking/tax/branding/
 * resume) — it's a cross-cutting AI-provider concern that happens to be
 * surfaced from the Resume screen in v1.
 */
import { z } from "zod";

// Loose first-pass check ("looks like an Anthropic key") before ever
// attempting the real verification call (see
// `@/lib/services/ai-connections`'s `verifyAnthropicKey`) — real
// Anthropic API keys look like `sk-ant-api03-<long random string>`.
export const anthropicApiKeyPattern = /^sk-ant-[A-Za-z0-9_-]{20,}$/;

export const aiConnectionUpsertSchema = z.object({
  apiKey: z
    .string()
    .trim()
    .regex(anthropicApiKeyPattern, "That doesn't look like a valid Anthropic API key (should start with sk-ant-)."),
  // Step-up re-authentication, same mechanism/rationale as banking's
  // `currentPassword` (app_spec.md § "Authentication & Authorization") — a
  // stored third-party API key is a high-blast-radius credential.
  currentPassword: z.string().min(1, "Re-enter your password to confirm this change."),
});
export type AiConnectionUpsertInput = z.infer<typeof aiConnectionUpsertSchema>;

export const aiConnectionDeleteSchema = z.object({
  currentPassword: z.string().min(1, "Re-enter your password to confirm this change."),
});
export type AiConnectionDeleteInput = z.infer<typeof aiConnectionDeleteSchema>;
