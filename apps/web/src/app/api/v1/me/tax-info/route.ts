/**
 * GET/PUT /api/v1/me/tax-info — app_spec.md § "API Contracts &
 * Integrations" → "1. Freelancer profile, banking & tax data" (tax-info
 * half).
 *
 * The contract's `dianResponsibilityCodes[]` has no dedicated column in
 * the schema (`tax_info` only has boolean `is_gran_contribuyente` /
 * `is_iva_responsible` flags) — derived here as a small string-code array
 * from those booleans rather than adding a new column for what's
 * ultimately the same two facts.
 */
import { NextResponse, type NextRequest } from "next/server";
import { withUserDb } from "@/lib/db/rls";
import { toApiErrorResponse } from "@/lib/api/errors";
import { taxInfoUpsertSchema } from "@/lib/validation/personal";
import { getTaxInfoDecrypted, listTaxDocuments, upsertTaxInfo } from "@/lib/services/tax-info";
import { getSignedDownloadUrl } from "@/lib/storage/r2";

export const runtime = "nodejs";

function dianResponsibilityCodes(row: { isGranContribuyente: boolean; isIvaResponsible: boolean }) {
  const codes: string[] = [];
  if (row.isGranContribuyente) codes.push("gran_contribuyente");
  if (row.isIvaResponsible) codes.push("iva_responsable");
  return codes;
}

export async function GET() {
  try {
    const result = await withUserDb(async (tx, user) => {
      const info = await getTaxInfoDecrypted(tx, user.id);
      const documents = await listTaxDocuments(tx, user.id);
      const documentsWithUrls = await Promise.all(
        documents.map(async (doc) => ({
          id: doc.id,
          type: doc.documentType,
          fileUrl: await getSignedDownloadUrl("taxDocuments", doc.fileKey),
          uploadedAt: doc.uploadedAt,
        }))
      );

      if (!info) {
        return {
          taxId: null,
          taxIdType: null,
          taxRegime: null,
          dianResponsibilityCodes: [],
          fiscalAddress: null,
          ciiuCode: null,
          documents: documentsWithUrls,
        };
      }

      return {
        taxId: info.taxIdNumber,
        taxIdType: info.taxIdType,
        taxRegime: info.taxRegime,
        dianResponsibilityCodes: dianResponsibilityCodes(info),
        fiscalAddress: info.fiscalAddress,
        ciiuCode: info.ciiuCode,
        documents: documentsWithUrls,
      };
    });
    return NextResponse.json(result);
  } catch (error) {
    return toApiErrorResponse(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const input = taxInfoUpsertSchema.parse(body);
    const result = await withUserDb(async (tx, user) => {
      const info = await upsertTaxInfo(tx, user.id, input);
      return {
        taxId: info.taxIdNumber,
        taxIdType: info.taxIdType,
        taxRegime: info.taxRegime,
        dianResponsibilityCodes: dianResponsibilityCodes(info),
        fiscalAddress: info.fiscalAddress,
        ciiuCode: info.ciiuCode,
      };
    });
    return NextResponse.json(result);
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
