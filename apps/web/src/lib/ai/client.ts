/**
 * Anthropic SDK client factory for the AI-assisted resume import feature —
 * a user-proposed addition beyond app_spec.md's original scope (see the
 * codebase-memory-mcp ADR).
 *
 * Two tiers share this one factory:
 *   - Default tier: no `apiKey` argument — falls back to FreeOps's own
 *     `ANTHROPIC_API_KEY` (already verified working in
 *     `apps/web/.env.local`), read from env only, never hardcoded.
 *   - BYOK tier: caller passes the user's own *decrypted* key (decrypted
 *     just-in-time by the caller via `@/lib/encryption`'s `decryptField` —
 *     never persisted decrypted, never logged).
 */
import Anthropic from "@anthropic-ai/sdk";

export function getAnthropicClient(apiKey?: string): Anthropic {
  if (apiKey) {
    return new Anthropic({ apiKey });
  }

  const defaultKey = process.env.ANTHROPIC_API_KEY;
  if (!defaultKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. See apps/web/.env.example — required for the default-tier AI resume import."
    );
  }
  return new Anthropic({ apiKey: defaultKey });
}
