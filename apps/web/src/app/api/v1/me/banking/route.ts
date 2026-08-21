/**
 * GET/PUT /api/v1/me/banking — app_spec.md § "API Contracts &
 * Integrations" → "1. Freelancer profile, banking & tax data" (banking
 * half). PUT requires step-up password re-authentication first (§
 * "Security & Compliance" → "Authentication & Authorization").
 */
import { NextResponse, type NextRequest } from "next/server";
import { withRlsContext } from "@freeops/db/rls-client";
import { requireUser } from "@/lib/db/rls";
import { toApiErrorResponse, apiErrorResponse } from "@/lib/api/errors";
import { bankingUpsertSchema } from "@/lib/validation/personal";
import { getBankingMasked, upsertBanking } from "@/lib/services/banking";
import { verifyPasswordStepUp } from "@/lib/auth/step-up";

const EMPTY_BANKING = {
  bankName: null,
  accountType: null,
  accountNumberMasked: null,
  accountHolderName: null,
  updatedAt: null,
};

export async function GET() {
  try {
    const { user, accessToken } = await requireUser();
    const result = await withRlsContext(accessToken, (tx) => getBankingMasked(tx, user.id));
    return NextResponse.json(result ?? EMPTY_BANKING);
  } catch (error) {
    return toApiErrorResponse(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const input = bankingUpsertSchema.parse(body);

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

    const bankingInput = {
      bankName: input.bankName,
      accountType: input.accountType,
      accountNumber: input.accountNumber,
      accountHolderName: input.accountHolderName,
      accountHolderTaxId: input.accountHolderTaxId,
    };
    const result = await withRlsContext(accessToken, (tx) => upsertBanking(tx, user.id, bankingInput));
    return NextResponse.json(result);
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
