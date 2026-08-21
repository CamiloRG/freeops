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

export const RESUME_EXTRACTION_MODEL = "claude-haiku-4-5" as const;

export interface ExtractedResumeEntry {
  title: string;
  clientName: string | null;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
}

export interface ExtractedResume {
  headline: string | null;
  summary: string | null;
  skills: string[];
  entries: ExtractedResumeEntry[];
}

export class ExtractionError extends Error {}

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
 * Defense-in-depth against a real, deterministically-reproducible failure
 * mode: Haiku 4.5, when forced (via `tool_choice`) to fill a string field
 * for which the source document has no genuine content (most often
 * `summary` on a resume with no bio/objective paragraph), can emit
 * Anthropic's own internal tool-call tag syntax (e.g. `</parameter>`,
 * `<parameter name="...">`, `<invoke>`) as the literal field VALUE instead
 * of plain prose. Confirmed 5/5 reproducible against the real API with a
 * synthetic no-bio resume; a stricter field description alone (see
 * `RESUME_EXTRACTION_TOOL`'s `summary` description) reduced but did NOT
 * reliably eliminate it, so this pattern-based check is the actual
 * backstop — any string field matching it is treated as corrupted and
 * dropped entirely (fail closed) rather than partially cleaned, since a
 * field that has gone this wrong has no reliable prose left to salvage.
 * Deliberately broad (matches ANY tag-like `<...>` structure, attributes
 * included) — a resume field has no legitimate reason to contain markup,
 * so a false-positive strip is a far smaller cost than a leaked tag
 * reaching the user's screen unfiltered.
 *
 * A second pattern, `CODE_LEAK_PATTERN`, was added after the same live
 * verification run also produced a DIFFERENT corruption shape once (not
 * XML-tag-like at all): a `skills` entry came back as literal JS-ish
 * fragments (`").concat(records["`, `type=`) instead of a skill name —
 * evidently the same underlying "forced to emit content that isn't really
 * there" failure mode, just leaking a different internal syntax. Braces,
 * backslashes, and backticks never legitimately appear in resume field
 * text, and `.concat(`/`=>`/`function(`/`type=`/`name=`/`${` are
 * recognizable code/template-literal/JSON-attribute fragments — none of
 * which any real skill, title, or prose sentence would contain (verified
 * against ordinary tokens like "C++", "Node.js", "CI/CD" not matching).
 */
const TOOL_ARTIFACT_PATTERN = /<\/?[a-zA-Z_][\w:-]*(?:\s[^<>]*)?>/;
const CODE_LEAK_PATTERN = /[{}\\`]|\.concat\(|=>|\bfunction\s*\(|\btype\s*=\s*["']?|\bname\s*=\s*["']?|\$\{/i;

/** True if `value` shows signs of a tool-call-tag or code-fragment leak (see above). */
function looksCorrupted(value: string | undefined | null): boolean {
  if (!value) return false;
  return TOOL_ARTIFACT_PATTERN.test(value) || CODE_LEAK_PATTERN.test(value);
}

/** Trims a raw string field and fails closed (drops it) if it looks corrupted. */
function sanitizeField(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (looksCorrupted(trimmed)) return null;
  return trimmed;
}

/** True if any string field anywhere in a raw extraction result looks corrupted. */
function anyFieldCorrupted(raw: RawExtraction): boolean {
  if (looksCorrupted(raw.headline) || looksCorrupted(raw.summary)) return true;
  if ((raw.skills ?? []).some(looksCorrupted)) return true;
  return (raw.entries ?? []).some(
    (entry) =>
      looksCorrupted(entry.title) || looksCorrupted(entry.clientName) || looksCorrupted(entry.description)
  );
}

/** One raw `messages.create` call against the extraction tool, unsanitized. */
async function callExtractionApi(
  client: Anthropic,
  documentBlock: Anthropic.Messages.ContentBlockParam
): Promise<RawExtraction> {
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
    throw new ExtractionError(
      `Anthropic API call failed: ${error instanceof Error ? error.message : "unknown error"}`
    );
  }

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use" && block.name === RESUME_TOOL_NAME
  );
  if (!toolUse) {
    throw new ExtractionError("Claude did not return structured resume data for this file.");
  }

  return toolUse.input as RawExtraction;
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

  let raw = await callExtractionApi(client, documentBlock);

  // Defense-in-depth: if the tool-call-tag leak (see TOOL_ARTIFACT_PATTERN's
  // doc comment) shows up anywhere in the result, retry the request once —
  // cheap insurance since it's a single extra Haiku call, and occasionally
  // resolves it outright. Whether or not the retry comes back clean, every
  // string field still goes through `sanitizeField` below, so a corrupted
  // field NEVER reaches the caller either way — the retry only improves
  // completeness, it is never relied on for safety by itself.
  if (anyFieldCorrupted(raw)) {
    const retried = await callExtractionApi(client, documentBlock);
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
  };
}
