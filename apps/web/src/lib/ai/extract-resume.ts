/**
 * AI-assisted resume extraction — user-proposed feature beyond
 * app_spec.md's original scope (see the codebase-memory-mcp ADR). Reads a
 * freelancer-uploaded resume file (PDF/PNG/JPEG) and returns structured
 * fields via Claude's strict tool-use pattern, mirroring
 * `resumeUpdateSchema`'s shape (`@/lib/validation/personal`) so the
 * result can pre-fill the resume form exactly like "Pull from Projects"
 * already does. NOTHING here writes to the database or to R2 — the caller
 * (the `/api/v1/me/resume/extract` Route Handler) reads the upload into
 * memory, calls this function, and discards the buffer.
 *
 * `RESUME_EXTRACTION_MODEL` is the ONE hardcoded literal model string used
 * by both extraction and BYOK key verification (`@/lib/services/
 * ai-connections`'s `verifyAnthropicKey`) — never accepted as a request
 * parameter, never exposed in any request/response schema, no UI control
 * for it. This is the actual enforcement mechanism for "only ever use the
 * cheapest model."
 */
import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient } from "./client";
import { looksCorrupted, sanitizeField } from "./sanitize";

export const RESUME_EXTRACTION_MODEL = "claude-haiku-4-5" as const;

export interface ExtractedResumeEntry {
  title: string;
  clientName: string | null;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
}

export interface ExtractionUsage {
  inputTokens: number;
  outputTokens: number;
  /** How many raw `messages.create` calls this usage total covers — see ai.ts's `apiCallCount` doc comment. */
  apiCallCount: number;
}

export interface ExtractedResume {
  headline: string | null;
  summary: string | null;
  skills: string[];
  entries: ExtractedResumeEntry[];
  usage: ExtractionUsage;
}

export class ExtractionError extends Error {
  /**
   * Set whenever the failing call actually got a response from Claude (real
   * tokens were spent) even though extraction itself failed — e.g. no
   * tool_use block came back. Undefined only for genuine no-response
   * failures (network/API error), where nothing was actually billed.
   */
  usage?: ExtractionUsage;

  constructor(message: string, usage?: ExtractionUsage) {
    super(message);
    this.usage = usage;
  }
}

const RESUME_TOOL_NAME = "record_resume_fields";

/**
 * Strict tool-use definition — `strict: true` + `additionalProperties:
 * false` + a full `required` array forces Claude to return exactly this
 * shape, no partial/extra fields. Confirmed working well against real
 * Haiku 4.5 output prior to this build (correct skills array split,
 * correct multi-entry work history, no hallucinated fields).
 */
const RESUME_EXTRACTION_TOOL: Anthropic.Tool = {
  name: RESUME_TOOL_NAME,
  description:
    "Records the structured fields extracted from a freelancer's resume/CV document. Use an empty string or empty array for any field genuinely not present in the document — never invent, guess, or synthesize a value that isn't explicitly present. Every string field must be plain prose text only — never include XML/HTML-like tags, angle-bracket markup, or any tool-call/parameter syntax in a field value.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      headline: {
        type: "string",
        description:
          "A short professional headline/title, e.g. 'Full-Stack Developer'. Empty string if the document has none. Plain text only, no markup.",
      },
      summary: {
        type: "string",
        description:
          "A short professional summary/bio paragraph — copy or lightly condense it ONLY if the document actually contains one (an explicit bio, objective, or 'about' section). If the document has no such paragraph, use an empty string. Do NOT compose, infer, or synthesize a summary out of other fields like the skills list or job titles — an empty string is the correct, expected answer for a resume with no bio section, not a failure. Plain prose text only, no markup.",
      },
      skills: {
        type: "array",
        items: { type: "string" },
        description: "A flat list of individual skills/technologies mentioned. Empty array if none found.",
      },
      entries: {
        type: "array",
        description: "Work/project experience entries, most recent first. Empty array if none found.",
        items: {
          type: "object",
          properties: {
            title: { type: "string", description: "Job title or role. Empty string if not found." },
            clientName: { type: "string", description: "Company or client name. Empty string if not found." },
            description: {
              type: "string",
              description: "Description of the role/responsibilities. Empty string if not found.",
            },
            startDate: {
              type: "string",
              description:
                "Start date as an ISO date 'YYYY-MM-DD' (use the 1st of the month if only month/year is known, e.g. '2022-03-01'). Empty string if not found.",
            },
            endDate: {
              type: "string",
              description:
                "End date, same format as startDate. Empty string if not found OR if the role is ongoing/current.",
            },
          },
          required: ["title", "clientName", "description", "startDate", "endDate"],
          additionalProperties: false,
        },
      },
    },
    required: ["headline", "summary", "skills", "entries"],
    additionalProperties: false,
  },
};

interface RawExtractionEntry {
  title: string;
  clientName: string;
  description: string;
  startDate: string;
  endDate: string;
}

interface RawExtraction {
  headline: string;
  summary: string;
  skills: string[];
  entries: RawExtractionEntry[];
}

function normalizeDate(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  // Basic ISO-date sanity check (YYYY-MM-DD); anything else (e.g. a
  // hallucinated non-date string) is dropped rather than passed through to
  // the date-typed form field.
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

/**
 * `looksCorrupted`/`sanitizeField` now live in `./sanitize` (shared with
 * `extract-bank-certificate.ts`) — see that file's doc comment for the
 * full discovery story (deterministically-reproducible against a synthetic
 * no-bio resume, both the tool-call-tag and code-fragment leak shapes).
 *
 * True if any string field anywhere in a raw extraction result looks corrupted.
 */
function anyFieldCorrupted(raw: RawExtraction): boolean {
  if (looksCorrupted(raw.headline) || looksCorrupted(raw.summary)) return true;
  if ((raw.skills ?? []).some(looksCorrupted)) return true;
  return (raw.entries ?? []).some(
    (entry) =>
      looksCorrupted(entry.title) || looksCorrupted(entry.clientName) || looksCorrupted(entry.description)
  );
}

interface ApiCallResult {
  raw: RawExtraction;
  usage: ExtractionUsage;
}

/** One raw `messages.create` call against the extraction tool, unsanitized. */
async function callExtractionApi(
  client: Anthropic,
  documentBlock: Anthropic.Messages.ContentBlockParam
): Promise<ApiCallResult> {
  let response: Anthropic.Message;
  try {
    response = await client.messages.create({
      model: RESUME_EXTRACTION_MODEL,
      max_tokens: 4096,
      tools: [RESUME_EXTRACTION_TOOL],
      tool_choice: { type: "tool", name: RESUME_TOOL_NAME },
      messages: [
        {
          role: "user",
          content: [
            documentBlock,
            {
              type: "text",
              text: `Extract this person's resume/CV into the ${RESUME_TOOL_NAME} tool. Only use information actually present in the document.`,
            },
          ],
        },
      ],
    });
  } catch (error) {
    // No response at all — nothing was actually billed, so no usage to
    // attach (ExtractionError.usage stays undefined).
    throw new ExtractionError(
      `Anthropic API call failed: ${error instanceof Error ? error.message : "unknown error"}`
    );
  }

  // Captured immediately once a response exists, BEFORE any further check
  // that might throw — a response with no usable tool_use block still cost
  // real tokens and must not be tracked as free.
  const usage: ExtractionUsage = {
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    apiCallCount: 1,
  };

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use" && block.name === RESUME_TOOL_NAME
  );
  if (!toolUse) {
    throw new ExtractionError("Claude did not return structured resume data for this file.", usage);
  }

  return { raw: toolUse.input as RawExtraction, usage };
}

/**
 * Extracts structured resume fields from an uploaded PDF/PNG/JPEG buffer.
 * Never throws just because some fields came back empty — a low-
 * confidence or partial document (e.g. skills found but no work history)
 * is returned as-is. Only throws `ExtractionError` for genuine failures:
 * the Anthropic API call itself failing, or Claude not returning the tool
 * call at all.
 */
export async function extractResumeFromFile(params: {
  /** Decrypted BYOK key, or undefined to use FreeOps's default-tier key. */
  apiKey?: string;
  buffer: Buffer;
  /** Must be one of the `resumeImport` upload slot's allowed types (see `@/lib/storage/r2`). */
  mimeType: "application/pdf" | "image/png" | "image/jpeg";
}): Promise<ExtractedResume> {
  const { apiKey, buffer, mimeType } = params;
  const client = getAnthropicClient(apiKey);
  const base64Data = buffer.toString("base64");

  const documentBlock: Anthropic.Messages.ContentBlockParam =
    mimeType === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64Data } }
      : { type: "image", source: { type: "base64", media_type: mimeType, data: base64Data } };

  // Running usage total across every raw API call this extraction attempt
  // makes (1 normally, 2 if the corruption retry below fires) — the real
  // cost of ONE logical "import from resume" action, not just one HTTP
  // call. See ai.ts's `apiCallCount` doc comment for why these are summed
  // rather than only the last call's usage being kept.
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
      if (error instanceof ExtractionError) {
        if (error.usage) {
          totalInputTokens += error.usage.inputTokens;
          totalOutputTokens += error.usage.outputTokens;
        }
        // Overwrite with the running total so the caller sees the full cost
        // of this extraction attempt so far, not just this one call's usage.
        error.usage = { inputTokens: totalInputTokens, outputTokens: totalOutputTokens, apiCallCount };
      }
      throw error;
    }
  }

  let raw = await callAndTrackUsage();

  // Defense-in-depth: if the tool-call-tag leak (see TOOL_ARTIFACT_PATTERN's
  // doc comment) shows up anywhere in the result, retry the request once —
  // cheap insurance since it's a single extra Haiku call, and occasionally
  // resolves it outright. Whether or not the retry comes back clean, every
  // string field still goes through `sanitizeField` below, so a corrupted
  // field NEVER reaches the caller either way — the retry only improves
  // completeness, it is never relied on for safety by itself.
  if (anyFieldCorrupted(raw)) {
    const retried = await callAndTrackUsage();
    if (!anyFieldCorrupted(retried)) {
      raw = retried;
    }
  }

  return {
    headline: sanitizeField(raw.headline),
    summary: sanitizeField(raw.summary),
    skills: (raw.skills ?? []).map((skill) => sanitizeField(skill)).filter((skill): skill is string => Boolean(skill)),
    entries: (raw.entries ?? [])
      .map((entry) => ({
        title: sanitizeField(entry.title),
        clientName: sanitizeField(entry.clientName),
        description: sanitizeField(entry.description),
        startDate: normalizeDate(entry.startDate),
        endDate: normalizeDate(entry.endDate),
      }))
      .filter((entry) => Boolean(entry.title))
      .map((entry) => ({ ...entry, title: entry.title as string }) satisfies ExtractedResumeEntry),
    usage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens, apiCallCount },
  };
}
