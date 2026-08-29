import { withUserDb } from "@/lib/db/rls";
import { listInvoices } from "@/lib/services/finance";
import { serializeInvoice } from "@/lib/services/finance-view";
import { listProjects } from "@/lib/services/projects";
import { InvoiceList } from "./invoice-list";

export default async function InvoicesPage() {
  const { rows, projects } = await withUserDb(async (tx, user) => {
    const [rows, projects] = await Promise.all([listInvoices(tx, user.id, {}), listProjects(tx, user.id, {})]);
    return { rows, projects };
  });

  const items = rows.map(serializeInvoice).map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));
  const projectOptions = projects.map((p) => ({ id: p.id, title: p.title, clientName: p.clientName }));

  return <InvoiceList initialItems={items} projectOptions={projectOptions} />;
}
