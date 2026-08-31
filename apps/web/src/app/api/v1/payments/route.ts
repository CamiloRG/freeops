/**
 * GET /api/v1/payments — app_spec.md § "API Contracts & Integrations" →
 * "11. Payments & overdue reminders". Supports a *repeated* `?status=`
 * query param (`?status=overdue&status=pending`), parsed via
 * `searchParams.getAll("status")` — filters against the read-time-
 * computed effective status (see `@/lib/services/payments`'s doc
 * comment), not the raw stored column.
 */
import { NextResponse, type NextRequest } from "next/server";
import { withUserDb } from "@/lib/db/rls";
import { toApiErrorResponse } from "@/lib/api/errors";
import { paymentListQuerySchema } from "@/lib/validation/payments";
import { listPayments } from "@/lib/services/payments";
import { serializePayment } from "@/lib/services/payments-view";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const statusValues = searchParams.getAll("status");
    const query = paymentListQuerySchema.parse({
      status: statusValues.length > 0 ? statusValues : undefined,
    });

    const rows = await withUserDb((tx, user) => listPayments(tx, user.id, query.status));
    return NextResponse.json({ data: rows.map(serializePayment) });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
