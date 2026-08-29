/**
 * GET/POST /api/v1/invoices — app_spec.md § "API Contracts & Integrations"
 * → "10. Invoices". `/send` is explicitly NOT built this stage (Phase 9's
 * Resend/Twilio integration isn't available yet). DIAN e-invoicing
 * (`eInvoicingStatus`) is v2 scope — every invoice stays `not_applicable`.
 */
import { NextResponse, type NextRequest } from "next/server";
import { withUserDb } from "@/lib/db/rls";
import { toApiErrorResponse } from "@/lib/api/errors";
import { invoiceCreateSchema } from "@/lib/validation/finance";
import { createInvoice, listInvoices } from "@/lib/services/finance";
import { serializeInvoice } from "@/lib/services/finance-view";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const status = searchParams.get("status") ?? undefined;
    const projectId = searchParams.get("projectId") ?? undefined;

    const rows = await withUserDb((tx, user) => listInvoices(tx, user.id, { status, projectId }));
    return NextResponse.json({ data: rows.map(serializeInvoice) });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input = invoiceCreateSchema.parse(body);

    const created = await withUserDb((tx, user) => createInvoice(tx, user.id, input));
    return NextResponse.json(serializeInvoice(created), { status: 201 });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
