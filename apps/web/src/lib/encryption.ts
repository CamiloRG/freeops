/**
 * Application-layer envelope encryption for the schema's `*_encrypted
 * bytea` columns (`banking_details.account_number_encrypted`,
 * `banking_details.account_holder_tax_id_encrypted`,
 * `tax_info.tax_id_number_encrypted`) — app_spec.md § "Sensitive-data /
 * encryption-at-rest note".
 *
 * The spec explicitly prefers application-memory decryption over
 * in-query `pgcrypto` (`pgp_sym_encrypt`/`pgp_sym_decrypt`) because
 * in-query decryption risks leaking plaintext into query logs /
 * `pg_stat_statements` / replication tooling. This is the spec's own
 * sanctioned interim fallback — full KMS-managed envelope encryption is a
 * Phase 13 hardening item, not this phase's job — but it's implemented as
 * real authenticated encryption (AES-256-GCM via Node's built-in `crypto`,
 * random IV per call, auth tag verified on decrypt), not a placeholder.
 *
 * Packed layout written to the `bytea` column: `iv (12 bytes) || authTag
 * (16 bytes) || ciphertext`. IV is regenerated on every encrypt call (GCM
 * requires a unique IV per key — reuse breaks the authentication
 * guarantee), so encrypting the same plaintext twice yields different
 * bytes.
 *
 * `ENCRYPTION_KEY` (32 random bytes, base64) already exists in
 * `apps/web/.env.local` — read here, never generated or logged.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH_BYTES = 12; // NIST-recommended IV length for GCM
const AUTH_TAG_LENGTH_BYTES = 16;
const KEY_LENGTH_BYTES = 32; // AES-256

let cachedKey: Buffer | undefined;

function getEncryptionKey(): Buffer {
  if (cachedKey) return cachedKey;
  const b64 = process.env.ENCRYPTION_KEY;
  if (!b64) {
    throw new Error(
      "ENCRYPTION_KEY is not set. See apps/web/.env.example — required for banking/tax field encryption."
    );
  }
  const key = Buffer.from(b64, "base64");
  if (key.length !== KEY_LENGTH_BYTES) {
    throw new Error(
      `ENCRYPTION_KEY must decode to exactly ${KEY_LENGTH_BYTES} bytes (got ${key.length}) — check it wasn't truncated or re-encoded.`
    );
  }
  cachedKey = key;
  return key;
}

/**
 * Encrypts `plaintext` for storage in a `*_encrypted bytea` column.
 * Never call with an already-empty/undefined value — callers should treat
 * "no value" as "don't write the column" at the schema/service layer.
 */
export function encryptField(plaintext: string): Buffer {
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]);
}

/**
 * Decrypts a value previously written by `encryptField`. Throws if the
 * auth tag doesn't verify (tampered/corrupted ciphertext, or wrong key —
 * e.g. `ENCRYPTION_KEY` was rotated without a re-encryption migration).
 * Only ever call this server-side; the decrypted value must never be sent
 * to the client directly (see `maskAccountNumber`/`maskTaxId` below for
 * the client-safe derived values).
 */
export function decryptField(packed: Buffer): string {
  if (packed.length < IV_LENGTH_BYTES + AUTH_TAG_LENGTH_BYTES) {
    throw new Error("decryptField: packed buffer too short to contain iv + authTag + ciphertext.");
  }
  const iv = packed.subarray(0, IV_LENGTH_BYTES);
  const authTag = packed.subarray(IV_LENGTH_BYTES, IV_LENGTH_BYTES + AUTH_TAG_LENGTH_BYTES);
  const ciphertext = packed.subarray(IV_LENGTH_BYTES + AUTH_TAG_LENGTH_BYTES);
  const decipher = createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

/**
 * Masks a decrypted value down to its last `visibleCount` characters
 * (default 4), e.g. `"•••• 1234"`. Computed server-side from the
 * decrypted value and is the ONLY form of a banking account number / tax
 * ID that may ever reach the client after initial save — per the API
 * contract's "full account number never returned after creation."
 * (`GET /api/v1/me/banking`). This is a deliberately conservative reading
 * of the UX section's "full value only on explicit reveal" language — see
 * this phase's report for the reasoning.
 */
export function maskLastDigits(plaintext: string, visibleCount = 4): string {
  const trimmed = plaintext.trim();
  const visible = trimmed.slice(-visibleCount);
  return `•••• ${visible}`;
}
