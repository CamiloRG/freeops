/**
 * AI-assisted bank-certificate extraction — Aero banking multi-account
 * rollout, same "user-proposed feature beyond app_spec.md's original
 * scope" category as resume import (see `extract-resume.ts` and the
 * codebase-memory-mcp ADR). Reads a freelancer-uploaded bank certification
 * document (PDF/PNG/JPEG) and returns structured fields via Claude's
 * strict tool-use pattern, mirroring the "Agregar cuenta" form's own
 * fields so the result can pre-fill it exactly. NOTHING here writes to the
 * database or to R2 — the caller (`/api/v1/me/banking/extract`) reads the
 * upload into memory, calls this function, and separately decides whether
 * to persist the original file (it does, unlike resume import — see that
 * route's own doc comment for why banking is the one case that keeps the
 * source file).
 *
 * `BANK_CERTIFICATE_EXTRACTION_MODEL` is a second hardcoded literal model
 * constant (same value as resume's, `claude-haiku-4-5`) — kept as its own
 * named export per feature, not a shared one, so each extraction feature's
 * "only ever use the cheapest model" guarantee stays independently
 * greppable/auditable rather than hidden behind one shared indirection.
 */
import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient } from "./client";
import { looksCorrupted, sanitizeField } from "./sanitize";

export const BANK_CERTIFICATE_EXTRACTION_MODEL = "claude-haiku-4-5" as const;

export interface ExtractedBankCertificate {
  bankName: string | null;
  accountType: "savings" | "checking" | null;
  accountNumber: string | null;
  accountHolderName: string | null;
  accountHolderTaxId: string | null;
  currency: string | null;
}

export interface ExtractionUsage {
  inputTokens: number;
  outputTokens: number;
  apiCallCount: number;
}

export class BankCertificateExtractionError extends Error {
  /** See `ExtractionError.usage`'s doc comment in `extract-resume.ts` — same rationale. */
  usage?: ExtractionUsage;
  constructor(message: string, usage?: ExtractionUsage) {
    super(message);
    this.usage = usage;
  }
}

const TOOL_NAME = "record_bank_certificate_fields";

const BANK_CERTIFICATE_TOOL: Anthropic.Tool = {
  name: TOOL_NAME,
  description:
    "Records the structured account fields extracted from a Colombian bank certification document (\"certificación bancaria\"). Use an empty string for any field genuinely not present in the document — never invent, guess, or synthesize a value. Every string field must be plain text only — never include XML/HTML-like tags, angle-bracket markup, or any tool-call/parameter syntax in a field value.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      bankName: {
        type: "string",
        description: "The bank's name, e.g. 'Bancolombia', 'Davivienda'. Empty string if not found.",
      },
      accountType: {
        type: "string",
        enum: ["savings", "checking", ""],
        description:
          "'savings' for a Colombian 'cuenta de ahorros', 'checking' for a 'cuenta corriente'. Empty string if the document doesn't state a type.",
      },
      accountNumber: {
        type: "string",
        description: "The full account number, digits and dashes only. Empty string if not found.",
      },
      accountHolderName: {
        type: "string",
        description: "The account holder's full name as printed on the certificate. Empty string if not found.",
      },
      accountHolderTaxId: {
        type: "string",
        description:
          "The account holder's tax ID / cédula / NIT if printed on the certificate. Empty string if not found.",
      },
      currency: {
        type: "string",
        description: "The account currency, e.g. 'COP', 'USD'. Empty string if not stated — assume nothing.",
      },
    },
    required: ["bankName", "accountType", "accountNumber", "accountHolderName", "accountHolderTaxId", "currency"],
    additionalProperties: false,
  },
};

interface RawExtraction {
  bankName: string;
  accountType: string;
  accountNumber: string;
  accountHolderName: string;
  accountHolderTaxId: string;
  currency: string;
}

function anyFieldCorrupted(raw: RawExtraction): boolean {
  return (
    looksCorrupted(raw.bankName) ||
    looksCorrupted(raw.accountNumber) ||
    looksCorrupted(raw.accountHolderName) ||
    looksCorrupted(raw.accountHolderTaxId) ||
    looksCorrupted(raw.currency)
  );
}

interface ApiCallResult {
  raw: RawExtraction;
  usage: ExtractionUsage;
}

async function callExtractionApi(
  client: Anthropic,
  documentBlock: Anthropic.Messages.ContentBlockParam
): Promise<ApiCallResult> {
  let response: Anthropic.Message;
  try {
    response = await client.messages.create({
      model: BANK_CERTIFICATE_EXTRACTION_MODEL,
      max_tokens: 1024,
      tools: [BANK_CERTIFICATE_TOOL],
      tool_choice: { type: "tool", name: TOOL_NAME },
      messages: [
        {
          role: "user",
          content: [
            documentBlock,
            {
              type: "text",
              text: `Extract this Colombian bank certification document's account details into the ${TOOL_NAME} tool. Only use information actually present in the document.`,
            },
          ],
        },
      ],
    });
  } catch (error) {
    throw new BankCertificateExtractionError(
      `Anthropic API call failed: ${error instanceof Error ? error.message : "unknown error"}`
    );
  }

  const usage: ExtractionUsage = {
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    apiCallCount: 1,
  };

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use" && block.name === TOOL_NAME
  );
  if (!toolUse) {
    throw new BankCertificateExtractionError("Claude did not return structured account data for this file.", usage);
  }

  return { raw: toolUse.input as RawExtraction, usage };
}

/**
 * Extracts structured bank-account fields from an uploaded certification
 * PDF/PNG/JPEG buffer. Only throws for genuine failures (the API call
 * itself failing, or Claude not returning the tool call) — a partial
 * document (e.g. no tax ID printed) is returned as-is with those fields
 * null.
 */
export async function extractBankCertificateFromFile(params: {
  /** Decrypted BYOK key, or undefined to use FreeOps's default-tier key. */
  apiKey?: string;
  buffer: Buffer;
  mimeType: "application/pdf" | "image/png" | "image/jpeg";
}): Promise<{ extracted: ExtractedBankCertificate; usage: ExtractionUsage }> {
  const { apiKey, buffer, mimeType } = params;
  const client = getAnthropicClient(apiKey);
  const base64Data = buffer.toString("base64");

  const documentBlock: Anthropic.Messages.ContentBlockParam =
    mimeType === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64Data } }
      : { type: "image", source: { type: "base64", media_type: mimeType, data: base64Data } };

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let apiCallCount = 0;

  async function callAndTrackUsage(): Promise<RawExtraction> {
    apiCallCount++;
    try {
      const result = await callExtractionApi(client, documentBlock);
      totalInputTokens += result.usage.inputTokens;
      totalOutputTokens += result.usage.outputTokens;
      return result.raw;
    } catch (error) {
      if (error instanceof BankCertificateExtractionError) {
        if (error.usage) {
          totalInputTokens += error.usage.inputTokens;
          totalOutputTokens += error.usage.outputTokens;
        }
        error.usage = { inputTokens: totalInputTokens, outputTokens: totalOutputTokens, apiCallCount };
      }
      throw error;
    }
  }

  let raw = await callAndTrackUsage();

  // Same one-retry defense as resume import — see extract-resume.ts's own
  // comment for why this is "improves completeness" only, never load-
  // bearing for safety by itself (sanitizeField below runs regardless).
  if (anyFieldCorrupted(raw)) {
    const retried = await callAndTrackUsage();
    if (!anyFieldCorrupted(retried)) {
      raw = retried;
    }
  }

  const accountType = raw.accountType === "savings" || raw.accountType === "checking" ? raw.accountType : null;

  return {
    extracted: {
      bankName: sanitizeField(raw.bankName),
      accountType,
      // Account numbers only ever legitimately contain digits/dashes —
      // stripped of anything else rather than dropped wholesale, since a
      // stray OCR-adjacent character is a more likely failure mode here
      // than a full tool-artifact leak (which `sanitizeField` still
      // catches first).
      accountNumber: sanitizeField(raw.accountNumber)?.replace(/[^0-9-]/g, "") || null,
      accountHolderName: sanitizeField(raw.accountHolderName),
      accountHolderTaxId: sanitizeField(raw.accountHolderTaxId),
      currency: sanitizeField(raw.currency)?.toUpperCase() || null,
    },
    usage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens, apiCallCount },
  };
}
