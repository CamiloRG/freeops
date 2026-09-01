/**
 * Round-trips the REAL relocated encryption module (`@freeops/db/encryption`),
 * not a copy. This suite is the regression guard for the Phase 8 Stage 1
 * relocation out of `apps/web/src/lib/encryption.ts`: the packed layout
 * must be byte-compatible, because `apps/web` and this service now read
 * and write the same `*_encrypted bytea` columns with the same key.
 */
import { describe, expect, it } from "vitest";
import { decryptField, encryptField } from "@freeops/db/encryption";

const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

describe("@freeops/db/encryption", () => {
  it("round-trips an OAuth refresh token", () => {
    const token = "1//0gLONG-refresh-token_value.with-punctuation";
    expect(decryptField(encryptField(token))).toBe(token);
  });

  it("round-trips non-ASCII text (tokens are opaque; never assume ASCII)", () => {
    const value = "señor-ñandú-✓-日本語";
    expect(decryptField(encryptField(value))).toBe(value);
  });

  it("produces a different ciphertext each call (fresh IV per encrypt)", () => {
    const a = encryptField("same-plaintext");
    const b = encryptField("same-plaintext");
    expect(a.equals(b)).toBe(false);
    // …but both still decrypt to the same value.
    expect(decryptField(a)).toBe(decryptField(b));
  });

  it("keeps the iv || authTag || ciphertext packed layout", () => {
    const plaintext = "abcdef";
    const packed = encryptField(plaintext);
    // AES-GCM ciphertext is the same length as the plaintext.
    expect(packed.length).toBe(IV_LENGTH + AUTH_TAG_LENGTH + Buffer.byteLength(plaintext, "utf8"));
  });

  it("rejects tampered ciphertext instead of returning garbage", () => {
    const packed = encryptField("sensitive");
    // Flip one bit in the ciphertext body.
    packed[packed.length - 1] ^= 0x01;
    expect(() => decryptField(packed)).toThrow();
  });

  it("rejects a buffer too short to contain iv + authTag", () => {
    expect(() => decryptField(Buffer.alloc(8))).toThrow(/too short/i);
  });
});
