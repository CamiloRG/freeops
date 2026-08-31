import { withUserDb } from "@/lib/db/rls";
import { listPilaCalculations } from "@/lib/services/pila";
import { serializePilaRecord } from "@/lib/services/pila-view";
import { PilaWizard } from "./pila-wizard";

export default async function PilaPage() {
  const rows = await withUserDb((tx, user) => listPilaCalculations(tx, user.id));

  const history = rows.map(serializePilaRecord).map((row) => ({
    ...row,
    paidAt: row.paidAt ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));

  return <PilaWizard initialHistory={history} />;
}
