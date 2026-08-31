/**
 * POST /api/v1/payments/:id/send-reminder-now — app_spec.md § "API
 * Contracts & Integrations" → "11. Payments & overdue reminders".
 * Deliberately NOT a real integration: Resend/Twilio don't exist until
 * Phase 9 (same precedent as Stage 2's disabled "Enviar" button on
 * cuentas de cobro/invoices). Always returns an honest "próximamente"
 * `ApiError` — never `{ sent: true }`. See
 * `@/lib/services/payments`'s `sendReminderNow` doc comment.
 */
import { type NextRequest } from "next/server";
import { withUserDb } from "@/lib/db/rls";
import { apiErrorResponse, toApiErrorResponse } from "@/lib/api/errors";
import { sendReminderNow } from "@/lib/services/payments";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    // `sendReminderNow` always throws an honest "próximamente" `ApiError`
    // once ownership is confirmed — it only ever returns (`null`) when the
    // payment isn't found/owned, never a success value.
    const result = await withUserDb((tx, user) => sendReminderNow(tx, user.id, id));
    if (!result) {
      return apiErrorResponse("NOT_FOUND", "Pago no encontrado.");
    }
    return apiErrorResponse("UNPROCESSABLE_ENTITY", "No se pudo enviar el recordatorio.");
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
