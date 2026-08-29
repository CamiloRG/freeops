import { withUserDb } from "@/lib/db/rls";
import { listCuentasDeCobro } from "@/lib/services/finance";
import { serializeCuentaDeCobro } from "@/lib/services/finance-view";
import { listProjects } from "@/lib/services/projects";
import { CuentaDeCobroList } from "./cuenta-de-cobro-list";

export default async function CuentasDeCobroPage() {
  const { rows, projects } = await withUserDb(async (tx, user) => {
    const [rows, projects] = await Promise.all([
      listCuentasDeCobro(tx, user.id, {}),
      listProjects(tx, user.id, {}),
    ]);
    return { rows, projects };
  });

  const items = rows.map(serializeCuentaDeCobro).map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));
  const projectOptions = projects.map((p) => ({ id: p.id, title: p.title, clientName: p.clientName }));

  return <CuentaDeCobroList initialItems={items} projectOptions={projectOptions} />;
}
