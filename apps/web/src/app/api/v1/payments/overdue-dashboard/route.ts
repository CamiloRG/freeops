/**
 * GET /api/v1/payments/overdue-dashboard — app_spec.md § "API Contracts &
 * Integrations" → "11. Payments & overdue reminders". Computed at read
 * time over payments whose *effective* status is `overdue` — see
 * `@/lib/services/payments`'s `getOverdueDashboard` doc comment.
 */
import { NextResponse } from "next/server";
import { withUserDb } from "@/lib/db/rls";
import { toApiErrorResponse } from "@/lib/api/errors";
import { getOverdueDashboard } from "@/lib/services/payments";

export async function GET() {
  try {
    const dashboard = await withUserDb((tx, user) => getOverdueDashboard(tx, user.id));
    return NextResponse.json(dashboard);
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
