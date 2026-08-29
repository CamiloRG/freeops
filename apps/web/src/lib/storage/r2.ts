/**
 * Cloudflare R2 file storage client — app_spec.md § "API Contracts &
 * Integrations" → "5. File storage — Cloudflare R2" + § "Security &
 * Compliance" → "Input Validation Strategy" (file upload rules) and "Data
 * Protection" (private buckets, signed URLs, non-guessable keys).
 *
 * R2 is S3-compatible; real credentials already live in
 * `apps/web/.env.local` (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
 * `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`, `R2_BUCKET_*`), previously
 * verified working against the real `branding-logos` bucket.
 *
 * Buckets are private — every read goes through a short-lived signed GET
 * URL generated server-side per request, never a public ACL. Object keys
 * are UUID-based (never original filenames or sequential IDs), per the
 * spec's "non-guessable identifiers" requirement.
 *
 * Spec deviation: the spec's bucket list (`branding-logos`,
 * `contract-documents`, `tax-documents`, `withholding-certificates`,
 * `vault-exports`, `resume-exports`) has no dedicated bucket for profile
 * photos. Rather than provisioning a new bucket for one small use case,
 * profile photos are stored in the `branding-logos` bucket under a
 * distinct `profile-photos/<userId>/...` key prefix, separate from
 * `logos/<userId>/...` — flagged here and in this phase's report.
 *
 * Phase 7 Stage 2 addition: `financeDocuments` (`R2_BUCKET_FINANCE_
 * DOCUMENTS`) is a genuinely NEW bucket — unlike the profile-photos case
 * above, cuentas de cobro/invoice PDFs are a first-class, high-volume
 * document type (every issued document gets one), not a "small use case"
 * that should be squeezed into an existing bucket's key-prefix namespace.
 * Key prefixes: `cuentas-de-cobro/<userId>/...` and `invoices/<userId>/...`.
 * This bucket is NOT yet provisioned in the real Cloudflare account as of
 * this stage — `bucketNameFor` throws the same clear "env var not set"
 * error every other bucket already throws when misconfigured; there is
 * deliberately no fallback-bucket workaround for its absence.
 */
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { fileTypeFromBuffer } from "file-type";
import DOMPurify from "isomorphic-dompurify";
import sharp from "sharp";
import { randomUUID } from "crypto";

export type BucketName =
  | "brandingLogos"
  | "taxDocuments"
  | "contractDocuments"
  | "withholdingCertificates"
  | "vaultExports"
  | "resumeExports"
  | "financeDocuments";

const BUCKET_ENV_VAR: Record<BucketName, string> = {
  brandingLogos: "R2_BUCKET_BRANDING_LOGOS",
  taxDocuments: "R2_BUCKET_TAX_DOCUMENTS",
  contractDocuments: "R2_BUCKET_CONTRACT_DOCUMENTS",
  withholdingCertificates: "R2_BUCKET_WITHHOLDING_CERTIFICATES",
  vaultExports: "R2_BUCKET_VAULT_EXPORTS",
  resumeExports: "R2_BUCKET_RESUME_EXPORTS",
  financeDocuments: "R2_BUCKET_FINANCE_DOCUMENTS",
};

function bucketNameFor(bucket: BucketName): string {
  const envVar = BUCKET_ENV_VAR[bucket];
  const value = process.env[envVar];
  if (!value) {
    throw new Error(`${envVar} is not set — required to use the "${bucket}" R2 bucket.`);
  }
  return value;
}

let cachedClient: S3Client | undefined;

function getR2Client(): S3Client {
  if (cachedClient) return cachedClient;
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const endpoint = process.env.R2_ENDPOINT;
  if (!accountId || !accessKeyId || !secretAccessKey || !endpoint) {
    throw new Error("R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_ENDPOINT must all be set.");
  }
  cachedClient = new S3Client({
    region: "auto",
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  });
  return cachedClient;
}

// --- Upload-slot allow-lists & size limits (spec's per-endpoint values win
// over the general 15MB default where they differ) -------------------------

export const UPLOAD_SLOTS = {
  logo: {
    allowedMimeTypes: ["image/png", "image/jpeg", "image/svg+xml"] as const,
    maxSizeBytes: 5 * 1024 * 1024, // 5MB, per POST /api/v1/me/branding/logo
  },
  taxDocument: {
    allowedMimeTypes: [
      "application/pdf",
      "image/png",
      "image/jpeg",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
    ] as const,
    maxSizeBytes: 10 * 1024 * 1024, // 10MB, per POST /api/v1/me/tax-info/documents
  },
  profilePhoto: {
    allowedMimeTypes: ["image/png", "image/jpeg"] as const,
    maxSizeBytes: 5 * 1024 * 1024,
  },
  // Contract & amendment documents (Phase 5, Business module) — POST
  // /api/v1/projects/:projectId/documents. Spec: "PDF/DOCX, ≤25MB". DOCX
  // mime type reuses the same constant already used for tax documents.
  contractDocument: {
    allowedMimeTypes: [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
    ] as const,
    maxSizeBytes: 25 * 1024 * 1024, // 25MB, per POST /api/v1/projects/:projectId/documents
  },
  // AI-assisted resume import (user-proposed feature beyond app_spec.md's
  // original scope, see the codebase-memory-mcp ADR) — POST
  // /api/v1/me/resume/extract. DOCX deliberately unsupported: Claude
  // cannot read it directly as either a `document` or `image` content
  // block. This slot is validation-only — the uploaded file is never
  // persisted to R2 (read into memory, sent to Claude, then discarded).
  resumeImport: {
    allowedMimeTypes: ["application/pdf", "image/png", "image/jpeg"] as const,
    maxSizeBytes: 10 * 1024 * 1024,
  },
} satisfies Record<string, { allowedMimeTypes: readonly string[]; maxSizeBytes: number }>;

export type UploadSlot = keyof typeof UPLOAD_SLOTS;

export class FileValidationError extends Error {
  kind: "PAYLOAD_TOO_LARGE" | "UNSUPPORTED_MEDIA_TYPE";
  constructor(kind: "PAYLOAD_TOO_LARGE" | "UNSUPPORTED_MEDIA_TYPE", message: string) {
    super(message);
    this.name = "FileValidationError";
    this.kind = kind;
  }
}

const SVG_SNIFF_PATTERN = /^\s*(<\?xml[^>]*\?>\s*)?(<!--[\s\S]*?-->\s*)*(<!doctype svg[^>]*>\s*)?<svg[\s>]/i;

function looksLikeSvg(buffer: Buffer): boolean {
  // SVG is plain-text XML, so magic-byte sniffers (file-type) can't detect
  // it — sniff the leading bytes as UTF-8 text instead. Cap the scan
  // window so a huge non-SVG file can't force a large decode.
  const head = buffer.subarray(0, 4096).toString("utf8");
  return SVG_SNIFF_PATTERN.test(head);
}

/**
 * Content-sniffs `buffer` (magic bytes, not extension/client
 * Content-Type) and confirms the detected type is in `slot`'s allow-list.
 * Throws `FileValidationError` (413/415-shaped) on any violation.
 */
export async function sniffAndValidate(
  buffer: Buffer,
  slot: UploadSlot
): Promise<{ mimeType: string; extension: string }> {
  const { allowedMimeTypes, maxSizeBytes } = UPLOAD_SLOTS[slot];

  if (buffer.byteLength === 0) {
    throw new FileValidationError("UNSUPPORTED_MEDIA_TYPE", "Uploaded file is empty.");
  }
  if (buffer.byteLength > maxSizeBytes) {
    throw new FileValidationError(
      "PAYLOAD_TOO_LARGE",
      `File exceeds the ${Math.round(maxSizeBytes / (1024 * 1024))}MB limit for this upload.`
    );
  }

  if ((allowedMimeTypes as readonly string[]).includes("image/svg+xml") && looksLikeSvg(buffer)) {
    return { mimeType: "image/svg+xml", extension: "svg" };
  }

  const detected = await fileTypeFromBuffer(buffer);
  if (!detected || !(allowedMimeTypes as readonly string[]).includes(detected.mime)) {
    throw new FileValidationError(
      "UNSUPPORTED_MEDIA_TYPE",
      `Unsupported file type${detected ? ` (${detected.mime})` : ""}. Allowed: ${allowedMimeTypes.join(", ")}.`
    );
  }
  return { mimeType: detected.mime, extension: detected.ext };
}

/**
 * Strips embedded scripts/event handlers from an SVG via DOMPurify (SVGs
 * are XML and can carry XSS payloads — spec's explicit call-out). Returns
 * the sanitized SVG as a UTF-8 buffer.
 */
export function sanitizeSvg(buffer: Buffer): Buffer {
  const clean = DOMPurify.sanitize(buffer.toString("utf8"), {
    USE_PROFILES: { svg: true, svgFilters: true },
  });
  return Buffer.from(clean, "utf8");
}

/**
 * Re-encodes a raster image through sharp to strip EXIF metadata (GPS/
 * location, camera info, etc. the freelancer likely didn't intend to
 * share) while preserving visible orientation. No-op passthrough for
 * non-raster types (SVG) — callers should sanitize those separately.
 */
export async function stripImageMetadata(buffer: Buffer, mimeType: string): Promise<Buffer> {
  if (mimeType === "image/svg+xml") return buffer;
  const image = sharp(buffer).rotate(); // bakes in EXIF orientation before metadata is dropped
  if (mimeType === "image/png") return image.png().toBuffer();
  return image.jpeg({ quality: 90 }).toBuffer();
}

export interface UploadResult {
  key: string;
  mimeType: string;
}

/**
 * Full pipeline for an uploaded file destined for R2: sniff + validate,
 * sanitize (SVG) or strip metadata (raster images), then PUT under a
 * UUID-based key. `keyPrefix` should already be scoped to the resource
 * (e.g. `logos/<userId>` or `tax-documents/<userId>`).
 */
export async function processAndUploadFile(params: {
  bucket: BucketName;
  keyPrefix: string;
  buffer: Buffer;
  slot: UploadSlot;
}): Promise<UploadResult> {
  const { bucket, keyPrefix, slot } = params;
  let { buffer } = params;

  const { mimeType, extension } = await sniffAndValidate(buffer, slot);

  if (mimeType === "image/svg+xml") {
    buffer = sanitizeSvg(buffer);
  } else if (mimeType.startsWith("image/")) {
    buffer = await stripImageMetadata(buffer, mimeType);
  }

  const key = `${keyPrefix}/${randomUUID()}.${extension}`;
  const client = getR2Client();
  await client.send(
    new PutObjectCommand({
      Bucket: bucketNameFor(bucket),
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    })
  );

  return { key, mimeType };
}

/** Generates a short-lived signed GET URL for a private-bucket object. */
export async function getSignedDownloadUrl(
  bucket: BucketName,
  key: string,
  expiresInSeconds = 600
): Promise<string> {
  const client = getR2Client();
  const command = new GetObjectCommand({ Bucket: bucketNameFor(bucket), Key: key });
  return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}

/** Permanently deletes an object from R2 (used for hard-purge flows and cleanup — not the DIAN soft-delete path). */
export async function deleteFile(bucket: BucketName, key: string): Promise<void> {
  const client = getR2Client();
  await client.send(new DeleteObjectCommand({ Bucket: bucketNameFor(bucket), Key: key }));
}

/**
 * Uploads a server-generated PDF (not a freelancer-submitted upload, so it
 * skips `sniffAndValidate`/EXIF stripping) to the `resume-exports` bucket
 * under `resumes/<userId>/...`. Used by the resume export Route Handler —
 * see that file's doc comment for why this runs synchronously today
 * rather than through a real job queue.
 */
export async function putResumeExportPdf(userId: string, pdfBuffer: Buffer): Promise<string> {
  const key = `resumes/${userId}/${randomUUID()}.pdf`;
  const client = getR2Client();
  await client.send(
    new PutObjectCommand({
      Bucket: bucketNameFor("resumeExports"),
      Key: key,
      Body: pdfBuffer,
      ContentType: "application/pdf",
    })
  );
  return key;
}

/**
 * Uploads a server-generated cuenta de cobro PDF to the `financeDocuments`
 * bucket under `cuentas-de-cobro/<userId>/...` — same synchronous-
 * generation-behind-an-async-shaped-contract pattern as
 * `putResumeExportPdf` (see that function's doc comment and the
 * `POST .../issue` Route Handler for the full flow).
 */
export async function putCuentaDeCobroPdf(userId: string, pdfBuffer: Buffer): Promise<string> {
  const key = `cuentas-de-cobro/${userId}/${randomUUID()}.pdf`;
  const client = getR2Client();
  await client.send(
    new PutObjectCommand({
      Bucket: bucketNameFor("financeDocuments"),
      Key: key,
      Body: pdfBuffer,
      ContentType: "application/pdf",
    })
  );
  return key;
}

/** Same as `putCuentaDeCobroPdf`, for invoices — `invoices/<userId>/...` prefix. */
export async function putInvoicePdf(userId: string, pdfBuffer: Buffer): Promise<string> {
  const key = `invoices/${userId}/${randomUUID()}.pdf`;
  const client = getR2Client();
  await client.send(
    new PutObjectCommand({
      Bucket: bucketNameFor("financeDocuments"),
      Key: key,
      Body: pdfBuffer,
      ContentType: "application/pdf",
    })
  );
  return key;
}

/**
 * Reads an object's raw bytes back out of R2 — used by
 * `@/lib/services/finance-pdf` to fetch a freelancer's branding logo
 * (`brandingLogos` bucket) so it can be embedded into a generated PDF via
 * pdfkit's `doc.image()`, which needs bytes, not a key/URL. Every other
 * R2 read in this app only ever needs a signed URL (`getSignedDownloadUrl`)
 * for the browser to fetch directly — this is the one server-side
 * exception, so it's kept separate rather than overloading that helper.
 */
export async function getFileBuffer(bucket: BucketName, key: string): Promise<Buffer> {
  const client = getR2Client();
  const result = await client.send(new GetObjectCommand({ Bucket: bucketNameFor(bucket), Key: key }));
  if (!result.Body) {
    throw new Error(`getFileBuffer: no body returned for ${bucket}/${key}.`);
  }
  const bytes = await result.Body.transformToByteArray();
  return Buffer.from(bytes);
}

/** Checks whether `key` exists in `bucket` (used by the resume-export poll endpoint). */
export async function objectExists(bucket: BucketName, key: string): Promise<boolean> {
  const client = getR2Client();
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucketNameFor(bucket), Key: key }));
    return true;
  } catch {
    return false;
  }
}
