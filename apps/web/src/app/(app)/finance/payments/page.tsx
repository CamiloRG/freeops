import { withUserDb } from "@/lib/db/rls";
import { getOverdueDashboard, listPayments } from "@/lib/services/payments";
import { serializePayment } from "@/lib/services/payments-view";
import { PaymentsList } from "./payments-list";

export default async function PaymentsPage() {
  const { rows, dashboard } = await withUserDb(async (tx, user) => {
    const [rows, dashboard] = await Promise.all([listPayments(tx, user.id), getOverdueDashboard(tx, user.id)]);
    return { rows, dashboard };
  });

  const items = rows.map(serializePayment).map((row) => ({
    ...row,
    paidAt: row.paidAt ? row.paidAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));

  return <PaymentsList initialItems={items} dashboard={dashboard} />;
}
