/**
 * Banking Details — app_spec.md § "API Contracts & Integrations" → "1.
 * Freelancer profile, banking & tax data" (banking half) + § "Sensitive-
 * data / encryption-at-rest note".
 *
 * Aero multi-account rollout: a freelancer may now hold more than one
 * account (mirrors real practice — e.g. a primary account for day-to-day
 * pay plus a secondary one for a specific client) — this file went from a
 * single upsert to real list/create/update CRUD. `isPrimary` flags exactly
 * one active row per user as the one that would auto-attach to a new
 * cuenta de cobro/invoice; `setPrimaryAccount` below is the only place
 * that flips it, so "exactly one primary" is enforced in application code,
 * not a DB constraint (see `packages/db/src/schema/profile.ts`'s doc
 * comment on why a partial-unique-index flip wasn't worth it here).
 *
 * `account_number_encrypted` / `account_holder_tax_id_encrypted` are
 * AES-256-GCM envelope-encrypted (see `@/lib/encryption`) and decrypted
 * only in application memory, never in-query. The full account number is
 * never returned by any function here that's meant to feed an API
 * response — only the masked form is.
 *
 * Deletion is deliberately NOT built (no screen shows it) — a freelancer
 * can add and edit accounts, but removing one would need the same DIAN
 * two-step retention-warning flow banking's `restrict` FK implies for
 * every other financial record here, and nothing in this rollout's scope
 * asked for it.
 *
 * Step-up re-authentication (password re-entry) for create/edit is
 * enforced at the Route Handler layer (needs the Supabase auth client, not
 * just a DB transaction) — see `app/api/v1/me/banking/route.ts` and
 * `[id]/route.ts`.
 */
import { and, eq, isNull } from "drizzle-orm";
import { bankingDetails } from "@freeops/db/schema";
import type { RlsTx } from "@freeops/db/rls-client";
import { decryptField, encryptField, maskLastDigits } from "@/lib/encryption";
import { ApiError } from "@/lib/api/errors";
import type { BankingCreateInput, BankingUpdateInput } from "@/lib/validation/personal";

export interface BankingAccountMasked {
  id: string;
  bankName: string;
  accountType: "savings" | "checking";
  accountNumberMasked: string;
  accountHolderName: string;
  accountHolderTaxIdMasked: string | null;
  currency: string;
  isPrimary: boolean;
  hasCertificate: boolean;
  certificateFileName: string | null;
  updatedAt: Date;
}

function toMasked(row: typeof bankingDetails.$inferSelect): BankingAccountMasked {
  const accountNumber = decryptField(row.accountNumberEncrypted);
  return {
    id: row.id,
    bankName: row.bankName,
    accountType: row.accountType as "savings" | "checking",
    accountNumberMasked: maskLastDigits(accountNumber),
    accountHolderName: row.accountHolderName,
    accountHolderTaxIdMasked: row.accountHolderTaxIdEncrypted
      ? maskLastDigits(decryptField(row.accountHolderTaxIdEncrypted))
      : null,
    currency: row.currency,
    isPrimary: row.isPrimary,
    hasCertificate: Boolean(row.certificateFileKey),
    certificateFileName: row.certificateFileName,
    updatedAt: row.updatedAt,
  };
}

async function findActiveAccount(tx: RlsTx, userId: string, accountId: string) {
  return tx.query.bankingDetails.findFirst({
    where: and(
      eq(bankingDetails.id, accountId),
      eq(bankingDetails.userId, userId),
      isNull(bankingDetails.deletedAt)
    ),
  });
}

/** All active accounts for a user, primary first, then most-recently-created. */
export async function listBankingAccounts(tx: RlsTx, userId: string): Promise<BankingAccountMasked[]> {
  const rows = await tx.query.bankingDetails.findMany({
    where: and(eq(bankingDetails.userId, userId), isNull(bankingDetails.deletedAt)),
  });
  return rows
    .sort((a, b) => {
      if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
      return b.createdAt.getTime() - a.createdAt.getTime();
    })
    .map(toMasked);
}

/** Unsets `isPrimary` on every other active account for this user — called before a row is inserted/updated as primary. */
async function clearOtherPrimaries(tx: RlsTx, userId: string, exceptAccountId?: string): Promise<void> {
  const rows = await tx.query.bankingDetails.findMany({
    where: and(eq(bankingDetails.userId, userId), isNull(bankingDetails.deletedAt)),
  });
  for (const row of rows) {
    if (row.isPrimary && row.id !== exceptAccountId) {
      await tx.update(bankingDetails).set({ isPrimary: false, updatedAt: new Date() }).where(eq(bankingDetails.id, row.id));
    }
  }
}

export async function createBankingAccount(
  tx: RlsTx,
  userId: string,
  input: Omit<BankingCreateInput, "currentPassword">
): Promise<BankingAccountMasked> {
  const existing = await listBankingAccounts(tx, userId);
  // The very first account is always primary, regardless of what the
  // client sent — there's no meaningful "secondary" with zero other
  // accounts on file.
  const isPrimary = existing.length === 0 ? true : Boolean(input.isPrimary);

  if (isPrimary) await clearOtherPrimaries(tx, userId);

  const accountNumberEncrypted = encryptField(input.accountNumber);
  const accountHolderTaxIdEncrypted = input.accountHolderTaxId
    ? encryptField(input.accountHolderTaxId)
    : null;

  const [created] = await tx
    .insert(bankingDetails)
    .values({
      userId,
      bankName: input.bankName,
      accountType: input.accountType,
      accountNumberEncrypted,
      accountHolderName: input.accountHolderName,
      accountHolderTaxIdEncrypted,
      currency: input.currency?.trim() || "COP",
      isPrimary,
      certificateFileKey: input.certificateFileKey ?? null,
      certificateFileName: input.certificateFileName ?? null,
    })
    .returning();

  return toMasked(created);
}

export async function updateBankingAccount(
  tx: RlsTx,
  userId: string,
  accountId: string,
  input: Omit<BankingUpdateInput, "currentPassword">
): Promise<BankingAccountMasked> {
  const existing = await findActiveAccount(tx, userId, accountId);
  if (!existing) {
    throw new ApiError("NOT_FOUND", "Bank account not found.");
  }

  const makingPrimary = input.isPrimary === true && !existing.isPrimary;
  if (makingPrimary) await clearOtherPrimaries(tx, userId, accountId);
  // A lone account can't be un-primaried by unchecking the box — there
  // must always be exactly one primary among any active accounts.
  const isPrimary = existing.isPrimary && input.isPrimary === false ? true : input.isPrimary ?? existing.isPrimary;

  const accountNumberEncrypted = encryptField(input.accountNumber);
  const accountHolderTaxIdEncrypted = input.accountHolderTaxId
    ? encryptField(input.accountHolderTaxId)
    : null;

  const [updated] = await tx
    .update(bankingDetails)
    .set({
      bankName: input.bankName,
      accountType: input.accountType,
      accountNumberEncrypted,
      accountHolderName: input.accountHolderName,
      accountHolderTaxIdEncrypted,
      currency: input.currency?.trim() || existing.currency,
      isPrimary,
      // Only replaces the certificate when the client actually sent a new
      // one — editing bank details shouldn't silently drop an existing
      // certification.
      ...(input.certificateFileKey ? { certificateFileKey: input.certificateFileKey } : {}),
      ...(input.certificateFileName ? { certificateFileName: input.certificateFileName } : {}),
      updatedAt: new Date(),
    })
    .where(eq(bankingDetails.id, accountId))
    .returning();

  return toMasked(updated);
}

/** Attaches/replaces just the certificate file on an existing account (the "Certificación" dialog's upload path). */
export async function attachCertificate(
  tx: RlsTx,
  userId: string,
  accountId: string,
  file: { fileKey: string; fileName: string }
): Promise<BankingAccountMasked> {
  const existing = await findActiveAccount(tx, userId, accountId);
  if (!existing) {
    throw new ApiError("NOT_FOUND", "Bank account not found.");
  }
  const [updated] = await tx
    .update(bankingDetails)
    .set({ certificateFileKey: file.fileKey, certificateFileName: file.fileName, updatedAt: new Date() })
    .where(eq(bankingDetails.id, accountId))
    .returning();
  return toMasked(updated);
}

/** Raw R2 key for an account's certificate, for generating a signed download URL — throws if the account has none. */
export async function getCertificateFileKey(tx: RlsTx, userId: string, accountId: string): Promise<string> {
  const existing = await findActiveAccount(tx, userId, accountId);
  if (!existing || !existing.certificateFileKey) {
    throw new ApiError("NOT_FOUND", "No certificate on file for this account.");
  }
  return existing.certificateFileKey;
}
