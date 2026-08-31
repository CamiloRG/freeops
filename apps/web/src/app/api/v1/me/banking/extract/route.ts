/**
 * POST /api/v1/me/banking/extract — "Sube la certificación bancaria y el
 * motor de FreeOps extrae los datos por ti" (Aero multi-account rollout,
 * user-proposed feature beyond app_spec.md's original scope, same category
 * as resume import — see the codebase-memory-mcp ADR). Accepts
 * `multipart/form-data` (field `file`: PDF/PNG/JPEG, ≤10MB), extracts
 * structured account fields via Claude, and returns them as JSON for the
 * client to pre-fill the "Agregar cuenta" form as EDITABLE SUGGESTIONS —
 * same UX shape as resume's `.../resume/extract`. Nothing is auto-saved;
 * the user still clicks "Guardar cuenta" themselves.
 *
 * Unlike resume import, the uploaded file IS persisted to R2 here (see
 * `extract-bank-certificate.ts`'s doc comment) — the returned
 * `certificateFileKey`/`certificateFileName` travel with the client's
 * subsequent `POST /api/v1/me/banking` create call so the saved account
 * keeps the certificate that produced it, for the "Certificación" button.
 * If the user never saves (closes the form), the uploaded object is
 * simply orphaned in R2 — accepted as a minor, rate-limited cost rather
 * than adding upload-on-save complexity to a feature capped at a handful
 * of uses per month.
 *
 * Tier + rate limit are resolved and checked BEFORE calling Claude, so an
 * over-cap default-tier request never reaches the Anthropic API at all.
 */
import { NextResponse, type NextRequest } from "next/server";
import { withUserDb } from "@/lib/db/rls";
import { toApiErrorResponse, apiErrorResponse, ApiError } from "@/lib/api/errors";
import { FileValidationError, processAndUploadFile, sniffAndValidate } from "@/lib/storage/r2";
import { determineTier, isUnderDefaultTierLimit } from "@/lib/ai/rate-limit";
import {
  BankCertificateExtractionError,
  BANK_CERTIFICATE_EXTRACTION_MODEL,
  extractBankCertificateFromFile,
} from "@/lib/ai/extract-bank-certificate";
import { computeHaikuCostUsd } from "@/lib/ai/pricing";
import { aiExtractionLog } from "@freeops/db/schema";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return apiErrorResponse("VALIDATION_ERROR", "Missing `file` field.");
    }
    const buffer = Buffer.from(await file.arrayBuffer());

    let mimeType: "application/pdf" | "image/png" | "image/jpeg";
    try {
      const sniffed = await sniffAndValidate(buffer, "bankCertificate");
      mimeType = sniffed.mimeType as "application/pdf" | "image/png" | "image/jpeg";
    } catch (error) {
      if (error instanceof FileValidationError) {
        throw new ApiError(
          error.kind === "PAYLOAD_TOO_LARGE" ? "PAYLOAD_TOO_LARGE" : "UNSUPPORTED_MEDIA_TYPE",
          error.kind === "UNSUPPORTED_MEDIA_TYPE"
            ? "Only PDF, JPG, or PNG certifications are supported."
            : error.message
        );
      }
      throw error;
    }

    const result = await withUserDb(async (tx, user) => {
      const { tier, apiKey } = await determineTier(tx, user.id);

      if (tier === "default") {
        const { underLimit, used, limit } = await isUnderDefaultTierLimit(tx, user.id, "bank_certificate");
        if (!underLimit) {
          throw new ApiError(
            "RATE_LIMITED",
            `Ya usaste tus ${limit} extracciones gratis de certificación bancaria este mes. Conecta tu propia clave de Anthropic desde Hoja de vida para extraer sin límite mensual, o inténtalo de nuevo el próximo mes.`,
            { used, limit, tier }
          );
        }
      }

      try {
        const { extracted, usage } = await extractBankCertificateFromFile({ apiKey, buffer, mimeType });
        const { inputTokens, outputTokens, apiCallCount } = usage;
        await tx.insert(aiExtractionLog).values({
          userId: user.id,
          documentType: "bank_certificate",
          tier,
          provider: "anthropic",
          model: BANK_CERTIFICATE_EXTRACTION_MODEL,
          status: "succeeded",
          inputTokens,
          outputTokens,
          apiCallCount,
          costUsd: computeHaikuCostUsd(inputTokens, outputTokens).toFixed(6),
        });

        // Persist the certificate itself (see this file's doc comment for
        // why banking keeps the source file, unlike resume import).
        const upload = await processAndUploadFile({
          bucket: "taxDocuments",
          keyPrefix: `banking-certificates/${user.id}`,
          buffer,
          slot: "bankCertificate",
        });

        const quota =
          tier === "default"
            ? { used: (await isUnderDefaultTierLimit(tx, user.id, "bank_certificate")).used, limit: 5 }
            : null;

        return {
          extracted,
          tier,
          quota,
          certificateFileKey: upload.key,
          certificateFileName: file.name || "certificacion",
        };
      } catch (error) {
        const usage = error instanceof BankCertificateExtractionError ? error.usage : undefined;
        await tx.insert(aiExtractionLog).values({
          userId: user.id,
          documentType: "bank_certificate",
          tier,
          provider: "anthropic",
          model: BANK_CERTIFICATE_EXTRACTION_MODEL,
          status: "failed",
          inputTokens: usage?.inputTokens ?? null,
          outputTokens: usage?.outputTokens ?? null,
          apiCallCount: usage?.apiCallCount ?? 1,
          costUsd: usage ? computeHaikuCostUsd(usage.inputTokens, usage.outputTokens).toFixed(6) : null,
        });
        if (error instanceof BankCertificateExtractionError) {
          throw new ApiError(
            "UPSTREAM_ERROR",
            "No pudimos leer esa certificación — prueba con un escaneo/PDF más claro o completa los campos manualmente."
          );
        }
        throw error;
      }
    });

    return NextResponse.json({
      bankName: result.extracted.bankName,
      accountType: result.extracted.accountType,
      accountNumber: result.extracted.accountNumber,
      accountHolderName: result.extracted.accountHolderName,
      accountHolderTaxId: result.extracted.accountHolderTaxId,
      currency: result.extracted.currency,
      tier: result.tier,
      quota: result.quota,
      certificateFileKey: result.certificateFileKey,
      certificateFileName: result.certificateFileName,
    });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
