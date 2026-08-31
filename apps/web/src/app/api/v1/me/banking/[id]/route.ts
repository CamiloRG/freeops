/**
 * PUT /api/v1/me/banking/:id — edits one existing bank account (Aero
 * multi-account rollout). Same step-up password re-authentication as
 * creating a new one (see `../route.ts`).
 */
import { NextResponse, type NextRequest } from "next/server";
import { withRlsContext } from "@freeops/db/rls-client";
import { requireUser } from "@/lib/db/rls";
import { toApiErrorResponse, apiErrorResponse } from "@/lib/api/errors";
import { bankingUpdateSchema } from "@/lib/validation/personal";
import { updateBankingAccount } from "@/lib/services/banking";
import { verifyPasswordStepUp } from "@/lib/auth/step-up";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const input = bankingUpdateSchema.parse(body);

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
      currency: input.currency,
      isPrimary: input.isPrimary,
      certificateFileKey: input.certificateFileKey,
      certificateFileName: input.certificateFileName,
    };
    const result = await withRlsContext(accessToken, (tx) => updateBankingAccount(tx, user.id, id, bankingInput));
    return NextResponse.json(result);
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
