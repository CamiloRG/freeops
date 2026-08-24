/**
 * Hardcoded Anthropic pricing for cost tracking — mirrors extract-resume.ts's
 * hardcoded-model enforcement pattern (`RESUME_EXTRACTION_MODEL`): FreeOps's
 * default tier only ever calls Claude Haiku 4.5 server-side, so only its
 * rate needs to live here. If a future feature adds another model or BYOK
 * cost tracking, add a sibling constant/function rather than parameterizing
 * this one — same "one literal, not a config knob" reasoning as the model
 * string itself.
 *
 * Rates as of 2026-08-24: $1.00 / 1M input tokens, $5.00 / 1M output
 * tokens for `claude-haiku-4-5`. Update these two numbers (and this date)
 * if Anthropic changes Haiku 4.5 pricing — nothing else in the cost-
 * tracking pipeline needs to change. Deliberately NOT applied
 * retroactively: `ai_extraction_log.cost_usd` is computed once at write
 * time (see the `/api/v1/me/resume/extract` route), so historical rows
 * stay accurate to what was actually charged even after this constant is
 * later updated.
 */
const HAIKU_4_5_INPUT_USD_PER_MTOK = 1.0;
const HAIKU_4_5_OUTPUT_USD_PER_MTOK = 5.0;

/**
 * Computes the $ cost of a Haiku 4.5 call from its token usage. Returns a
 * plain USD number — callers writing to `ai_extraction_log.cost_usd`
 * (a `numeric(10,6)` column) should format it with `.toFixed(6)` before
 * inserting, since drizzle expects numeric columns as strings.
 */
export function computeHaikuCostUsd(inputTokens: number, outputTokens: number): number {
  return (
    (inputTokens / 1_000_000) * HAIKU_4_5_INPUT_USD_PER_MTOK +
    (outputTokens / 1_000_000) * HAIKU_4_5_OUTPUT_USD_PER_MTOK
  );
}
