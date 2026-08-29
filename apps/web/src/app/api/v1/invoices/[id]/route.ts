/**
 * GET/PATCH/DELETE /api/v1/invoices/:id — app_spec.md § "API Contracts &
 * Integrations" → "10. Invoices". Same shape as
 * `app/api/v1/cuentas-de-cobro/[id]/route.ts` (see that file's doc
 * comment) — entityType `"invoice"` for the DIAN delete flow.
 */
import { NextResponse, type NextRequest } from "next/server";
import { withUserDb } from "@/lib/db/rls";
import { apiErrorResponse, toApiErrorResponse } from "@/lib/api/errors";
import { invoiceUpdateSchema } from "@/lib/validation/finance";
import { getOwnedInvoice, softDeleteInvoice, updateInvoice } from "@/lib/services/finance";
import { serializeInvoice } from "@/lib/services/finance-view";
import { getSignedDownloadUrl } from "@/lib/storage/r2";
import { DIAN_RETENTION_WARNING, isWithinDianWindow, logDeletionWarning } from "@/lib/services/deletion-warnings";

export const runtime = "nodejs";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const row = await withUserDb((tx, user) => getOwnedInvoice(tx, user.id, id));
    if (!row) {
      return apiErrorResponse("NOT_FOUND", "Factura no encontrada.");
    }
    const pdfUrl = row.pdfFileKey ? await getSignedDownloadUrl("financeDocuments", row.pdfFileKey) : null;
    return NextResponse.json({ ...serializeInvoice(row), pdfUrl });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const input = invoiceUpdateSchema.parse(body);

    const updated = await withUserDb((tx, user) => updateInvoice(tx, user.id, id, input));
    if (!updated) {
      return apiErrorResponse("NOT_FOUND", "Factura no encontrada.");
    }
    return NextResponse.json(serializeInvoice(updated));
  } catch (error) {
    return toApiErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const confirm = request.nextUrl.searchParams.get("confirm") === "true";

    const result = await withUserDb(async (tx, user) => {
      const invoice = await getOwnedInvoice(tx, user.id, id);
      if (!invoice) return { status: "not_found" as const };

      if (invoice.status === "draft") {
        await softDeleteInvoice(tx, invoice.id);
        return { status: "deleted" as const };
      }

      const withinDianWindow = isWithinDianWindow(new Date(`${invoice.issueDate}T00:00:00`));

      if (!confirm) {
        await logDeletionWarning(tx, {
          userId: user.id,
          entityType: "invoice",
          entityId: invoice.id,
          action: "soft_delete_requested",
          withinDianWindow,
        });
        return { status: "needs_confirm" as const };
      }

      await logDeletionWarning(tx, {
        userId: user.id,
        entityType: "invoice",
        entityId: invoice.id,
        action: "soft_delete_confirmed",
        withinDianWindow,
        acknowledged: true,
      });
      await softDeleteInvoice(tx, invoice.id);
      return { status: "deleted" as const };
    });

    if (result.status === "not_found") {
      return apiErrorResponse("NOT_FOUND", "Factura no encontrada.");
    }
    if (result.status === "needs_confirm") {
      return NextResponse.json({
        warning: DIAN_RETENTION_WARNING,
        confirmUrl: `${request.nextUrl.pathname}?confirm=true`,
      });
    }
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
