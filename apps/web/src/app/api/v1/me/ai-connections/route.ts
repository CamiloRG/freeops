/**
 * GET /api/v1/me/ai-connections — user-proposed feature beyond
 * app_spec.md's original scope (see the codebase-memory-mcp ADR). Lists
 * the caller's connected BYOK AI provider connections. Masked hint only —
 * the real key is never returned once saved, same conservative rule as
 * banking's account number.
 */
import { NextResponse } from "next/server";
import { withUserDb } from "@/lib/db/rls";
import { toApiErrorResponse } from "@/lib/api/errors";
import { getConnectionSummary } from "@/lib/services/ai-connections";

export async function GET() {
  try {
    const result = await withUserDb(async (tx, user) => {
      const anthropic = await getConnectionSummary(tx, user.id, "anthropic");
      return { connections: anthropic ? [anthropic] : [] };
    });
    return NextResponse.json(result);
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
