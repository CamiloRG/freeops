/**
 * PUT/DELETE /api/v1/me/ai-connections/anthropic — user-proposed feature
 * beyond app_spec.md's original scope (see the codebase-memory-mcp ADR).
 * Connect/update or disconnect the caller's own Anthropic API key (BYOK
 * tier for AI resume import). Both are gated behind step-up password
 * re-authentication — exact same pattern as banking's
 * `PUT /api/v1/me/banking` (`@/lib/auth/step-up`'s `verifyPasswordStepUp`)
 * — a stored third-party API key is a high-blast-radius credential (a leak
 * lets someone spend directly against the user's own provider bill),
 * treated with at least the same rigor as banking data.
 */
import { NextResponse, type NextRequest } from "next/server";
import { withRlsContext } from "@freeops/db/rls-client";
import { requireUser } from "@/lib/db/rls";
import { toApiErrorResponse, apiErrorResponse } from "@/lib/api/errors";
import { aiConnectionDeleteSchema, aiConnectionUpsertSchema } from "@/lib/validation/ai";
import { deleteConnection, upsertConnection } from "@/lib/services/ai-connections";
import { verifyPasswordStepUp } from "@/lib/auth/step-up";

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const input = aiConnectionUpsertSchema.parse(body);

    const { user, accessToken } = await requireUser();
    if (!user.email) {
      return apiErrorResponse("UNAUTHORIZED", "No account email on file for step-up re-authentication.");
    }

    const passwordOk = await verifyPasswordStepUp(user.email, input.currentPassword);
    if (!passwordOk) {
      return apiErrorResponse(
        "UNAUTHORIZED",
        "Re-authentication failed — check your password and try again. Your existing session is unaffected."
      );
    }

    const result = await withRlsContext(accessToken, (tx) =>
      upsertConnection(tx, user.id, "anthropic", input.apiKey)
    );
    return NextResponse.json(result);
  } catch (error) {
    return toApiErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const input = aiConnectionDeleteSchema.parse(body);

    const { user, accessToken } = await requireUser();
    if (!user.email) {
      return apiErrorResponse("UNAUTHORIZED", "No account email on file for step-up re-authentication.");
    }

    const passwordOk = await verifyPasswordStepUp(user.email, input.currentPassword);
    if (!passwordOk) {
      return apiErrorResponse(
        "UNAUTHORIZED",
        "Re-authentication failed — check your password and try again. Your existing session is unaffected."
      );
    }

    await withRlsContext(accessToken, (tx) => deleteConnection(tx, user.id, "anthropic"));
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
