/**
 * Banking Details — app_spec.md § "API Contracts & Integrations" → "1.
 * Freelancer profile, banking & tax data" (banking half) + § "Sensitive-
 * data / encryption-at-rest note".
 *
 * `account_number_encrypted` / `account_holder_tax_id_encrypted` are
 * AES-256-GCM envelope-encrypted (see `@/lib/encryption`) and decrypted
 * only in application memory, never in-query. The full account number is
 * never returned by any function here that's meant to feed an API
 * response — only `getBankingMasked` does, and it returns the masked form
 * only.
 *
 * Step-up re-authentication (password re-entry) for edits is enforced at
 * the Route Handler layer (needs the Supabase auth client, not just a DB
 * transaction) — see `app/api/v1/me/banking/route.ts`.
 */
import { and, eq, isNull } from "drizzle-orm";
import { bankingDetails } from "@freeops/db/schema";
import type { RlsTx } from "@freeops/db/rls-client";
import { decryptField, encryptField, maskLastDigits } from "@/lib/encryption";
import type { BankingUpsertInput } from "@/lib/validation/personal";

export interface BankingMasked {
  bankName: string;
  accountType: "savings" | "checking";
  accountNumberMasked: string;
  accountHolderName: string;
  updatedAt: Date;
}

async function findActiveBankingRow(tx: RlsTx, userId: string) {
  return tx.query.bankingDetails.findFirst({
    where: and(eq(bankingDetails.userId, userId), isNull(bankingDetails.deletedAt)),
  });
}

export async function getBankingMasked(tx: RlsTx, userId: string): Promise<BankingMasked | null> {
  const row = await findActiveBankingRow(tx, userId);
  if (!row) return null;

  const accountNumber = decryptField(row.accountNumberEncrypted);
  return {
    bankName: row.bankName,
    accountType: row.accountType as "savings" | "checking",
    accountNumberMasked: maskLastDigits(accountNumber),
    accountHolderName: row.accountHolderName,
    updatedAt: row.updatedAt,
  };
}

export async function upsertBanking(
  tx: RlsTx,
  userId: string,
  input: Omit<BankingUpsertInput, "currentPassword">
): Promise<BankingMasked> {
  const existing = await findActiveBankingRow(tx, userId);

  const accountNumberEncrypted = encryptField(input.accountNumber);
  const accountHolderTaxIdEncrypted = input.accountHolderTaxId
    ? encryptField(input.accountHolderTaxId)
    : null;

  if (existing) {
    const [updated] = await tx
      .update(bankingDetails)
      .set({
        bankName: input.bankName,
        accountType: input.accountType,
        accountNumberEncrypted,
        accountHolderName: input.accountHolderName,
        accountHolderTaxIdEncrypted,
        updatedAt: new Date(),
      })
      .where(eq(bankingDetails.id, existing.id))
      .returning();

    return {
      bankName: updated.bankName,
      accountType: updated.accountType as "savings" | "checking",
      accountNumberMasked: maskLastDigits(input.accountNumber),
      accountHolderName: updated.accountHolderName,
      updatedAt: updated.updatedAt,
    };
  }

  const [created] = await tx
    .insert(bankingDetails)
    .values({
      userId,
      bankName: input.bankName,
      accountType: input.accountType,
      accountNumberEncrypted,
      accountHolderName: input.accountHolderName,
      accountHolderTaxIdEncrypted,
      isPrimary: true,
    })
    .returning();

  return {
    bankName: created.bankName,
    accountType: created.accountType as "savings" | "checking",
    accountNumberMasked: maskLastDigits(input.accountNumber),
    accountHolderName: created.accountHolderName,
    updatedAt: created.updatedAt,
  };
}
