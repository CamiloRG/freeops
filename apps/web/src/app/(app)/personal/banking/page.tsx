import { withUserDb } from "@/lib/db/rls";
import { listBankingAccounts } from "@/lib/services/banking";
import { getConnectionSummary } from "@/lib/services/ai-connections";
import { DEFAULT_TIER_MONTHLY_LIMITS, isUnderDefaultTierLimit } from "@/lib/ai/rate-limit";
import { BankingForm } from "./banking-form";

export default async function BankingPage() {
  const { accounts, aiExtract } = await withUserDb(async (tx, user) => {
    const accounts = await listBankingAccounts(tx, user.id);

    // AI-assisted bank-certificate extraction (Aero multi-account rollout,
    // beyond app_spec.md's original scope) — same BYOK/quota surfacing as
    // Resume's own import feature, see that page.tsx for the pattern.
    const connection = await getConnectionSummary(tx, user.id, "anthropic");
    const byokConnected = Boolean(connection?.verifiedAt);
    const quota = byokConnected ? null : await isUnderDefaultTierLimit(tx, user.id, "bank_certificate");

    return {
      accounts,
      aiExtract: {
        byokConnected,
        remaining: quota ? quota.limit - quota.used : null,
        limit: DEFAULT_TIER_MONTHLY_LIMITS.bank_certificate,
      },
    };
  });

  return <BankingForm initialAccounts={accounts} aiExtract={aiExtract} />;
}
