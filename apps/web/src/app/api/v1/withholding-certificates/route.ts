/**
 * GET/POST /api/v1/withholding-certificates — app_spec.md § "API
 * Contracts & Integrations" → "12. Withholding certificates". Tracking
 * only — see `@/lib/services/withholding-certificates`'s doc comment. The
 * auto-creation path (from cuentas-de-cobro/invoices POST) lives in
 * `@/lib/services/finance`, not here — this `POST` is the manual-create
 * path only.
 */
import { NextResponse, type NextRequest } from "next/server";
import { withUserDb } from "@/lib/db/rls";
import { toApiErrorResponse } from "@/lib/api/errors";
import { withholdingCertificateCreateSchema } from "@/lib/validation/withholding";
import { createWithholdingCertificate, listWithholdingCertificates } from "@/lib/services/withholding-certificates";
import { serializeWithholdingCertificate } from "@/lib/services/withholding-view";
import { getSignedDownloadUrl } from "@/lib/storage/r2";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const status = searchParams.get("status") ?? undefined;
    const projectId = searchParams.get("projectId") ?? undefined;

    const rows = await withUserDb((tx, user) => listWithholdingCertificates(tx, user.id, { status, projectId }));
    const data = await Promise.all(
      rows.map(async (row) => ({
        ...serializeWithholdingCertificate(row),
        fileUrl: row.fileKey ? await getSignedDownloadUrl("withholdingCertificates", row.fileKey) : null,
      }))
    );
    return NextResponse.json({ data });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input = withholdingCertificateCreateSchema.parse(body);

    const created = await withUserDb((tx, user) => createWithholdingCertificate(tx, user.id, input));
    return NextResponse.json(serializeWithholdingCertificate(created), { status: 201 });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
