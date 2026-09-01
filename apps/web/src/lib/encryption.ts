/**
 * Compatibility alias for the shared envelope-encryption helpers, which
 * now live in `@freeops/db/encryption`.
 *
 * They moved out of `apps/web` in Phase 8 Stage 1, when
 * `apps/mcp-calendar-server` (a separately deployed service) began writing
 * the same kind of `*_encrypted bytea` columns — calendar OAuth tokens —
 * and needed the byte-identical algorithm/layout/key. The algorithm is a
 * property of the schema, so it belongs beside the schema. Every existing
 * `@/lib/encryption` import site keeps working unchanged via this
 * re-export (same compatibility-alias pattern used for earlier shared-code
 * relocations in this codebase).
 *
 * `maskLastDigits` stays defined here: it is a UI-display concern of the
 * web app, not something the MCP server has any use for.
 */
export { decryptField, encryptField } from "@freeops/db/encryption";

/**
 * Masks a decrypted value down to its last `visibleCount` characters
 * (default 4), e.g. `"•••• 1234"`. Computed server-side from the
 * decrypted value and is the ONLY form of a banking account number / tax
 * ID that may ever reach the client after initial save — per the API
 * contract's "full account number never returned after creation."
 * (`GET /api/v1/me/banking`). This is a deliberately conservative reading
 * of the UX section's "full value only on explicit reveal" language — see
 * that phase's report for the reasoning.
 */
export function maskLastDigits(plaintext: string, visibleCount = 4): string {
  const trimmed = plaintext.trim();
  const visible = trimmed.slice(-visibleCount);
  return `•••• ${visible}`;
}
