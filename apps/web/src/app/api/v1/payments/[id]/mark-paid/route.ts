/**
 * POST /api/v1/payments/:id/mark-paid — app_spec.md § "API Contracts &
 * Integrations" → "11. Payments & overdue reminders". 422s if the payment
 * is already `paid` (see `markPaymentPaid`'s doc comment). On success,
 * also flips the parent document's own `status` to `paid` when the
 * payment amount covers the full total.
 */
import { NextResponse, type NextRequest } from "next/server";
import { withUserDb } from "@/lib/db/rls";
import { apiErrorResponse, toApiErrorResponse } from "@/lib/api/errors";
import { markPaymentPaidSchema } from "@/lib/validation/payments";
import { getOwnedPayment, markPaymentPaid } from "@/lib/services/payments";
import { serializePayment } from "@/lib/services/payments-view";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const input = markPaymentPaidSchema.parse(body);

    const result = await withUserDb(async (tx, user) => {
      const updated = await markPaymentPaid(tx, user.id, id, input);
      if (!updated) return null;
      return getOwnedPayment(tx, user.id, id);
    });

    if (!result) {
      return apiErrorResponse("NOT_FOUND", "Pago no encontrado.");
    }
    return NextResponse.json(serializePayment(result));
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
