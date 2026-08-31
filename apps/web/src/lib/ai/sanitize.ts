/**
 * Shared defense-in-depth sanitization for forced-tool-use string fields —
 * factored out of `extract-resume.ts` (see that file's git history/the
 * codebase-memory-mcp ADR for the original discovery) so every strict
 * tool-use extraction feature in this codebase (resume, bank certificate,
 * …) gets the same protection instead of re-deriving it per feature.
 *
 * Haiku 4.5, when forced (via `tool_choice`) to fill a string field for
 * which the source document has no genuine content, can emit Anthropic's
 * own internal tool-call tag syntax (e.g. `</parameter>`, `<invoke>`) or
 * JS/JSON-fragment-shaped garbage as the literal field VALUE instead of
 * plain prose — confirmed reproducible against the real API. A stricter
 * field description alone reduces but does not reliably eliminate it, so
 * this pattern-based check is the actual backstop: any string field
 * matching it is dropped entirely (fail closed) rather than partially
 * cleaned.
 */
const TOOL_ARTIFACT_PATTERN = /<\/?[a-zA-Z_][\w:-]*(?:\s[^<>]*)?>/;
const CODE_LEAK_PATTERN = /[{}\\`]|\.concat\(|=>|\bfunction\s*\(|\btype\s*=\s*["']?|\bname\s*=\s*["']?|\$\{/i;

/** True if `value` shows signs of a tool-call-tag or code-fragment leak (see above). */
export function looksCorrupted(value: string | undefined | null): boolean {
  if (!value) return false;
  return TOOL_ARTIFACT_PATTERN.test(value) || CODE_LEAK_PATTERN.test(value);
}

/** Trims a raw string field and fails closed (drops it) if it looks corrupted. */
export function sanitizeField(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (looksCorrupted(trimmed)) return null;
  return trimmed;
}
