import { notFound } from "next/navigation";
import { withUserDb } from "@/lib/db/rls";
import { getOwnedInvoice } from "@/lib/services/finance";
import { serializeInvoice } from "@/lib/services/finance-view";
import { listProjects } from "@/lib/services/projects";
import { getSignedDownloadUrl } from "@/lib/storage/r2";
import { InvoiceDetail } from "./invoice-detail";

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const result = await withUserDb(async (tx, user) => {
    const row = await getOwnedInvoice(tx, user.id, id);
    if (!row) return null;
    const projects = await listProjects(tx, user.id, {});
    const pdfUrl = row.pdfFileKey ? await getSignedDownloadUrl("financeDocuments", row.pdfFileKey) : null;
    return { row, projects, pdfUrl };
  });

  if (!result) notFound();

  const invoice = {
    ...serializeInvoice(result.row),
    createdAt: result.row.createdAt.toISOString(),
    updatedAt: result.row.updatedAt.toISOString(),
    pdfUrl: result.pdfUrl,
  };
  const projectOptions = result.projects.map((p) => ({ id: p.id, title: p.title, clientName: p.clientName }));

  return <InvoiceDetail invoice={invoice} projectOptions={projectOptions} />;
}
