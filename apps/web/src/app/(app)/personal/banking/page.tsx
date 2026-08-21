import { withRlsContext } from "@freeops/db/rls-client";
import { requireUser } from "@/lib/db/rls";
import { getBankingMasked } from "@/lib/services/banking";
import { BankingForm } from "./banking-form";

export default async function BankingPage() {
  const { user, accessToken } = await requireUser();
  const banking = await withRlsContext(accessToken, (tx) => getBankingMasked(tx, user.id));

  return <BankingForm current={banking} />;
}
