import { notFound } from "next/navigation";
import { withUserDb } from "@/lib/db/rls";
import { getOwnedCuentaDeCobro } from "@/lib/services/finance";
import { serializeCuentaDeCobro } from "@/lib/services/finance-view";
import { listProjects } from "@/lib/services/projects";
import { getSignedDownloadUrl } from "@/lib/storage/r2";
import { CuentaDeCobroDetail } from "./cuenta-de-cobro-detail";

export default async function CuentaDeCobroDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const result = await withUserDb(async (tx, user) => {
    const row = await getOwnedCuentaDeCobro(tx, user.id, id);
    if (!row) return null;
    const projects = await listProjects(tx, user.id, {});
    const pdfUrl = row.pdfFileKey ? await getSignedDownloadUrl("financeDocuments", row.pdfFileKey) : null;
    return { row, projects, pdfUrl };
  });

  if (!result) notFound();

  const cdc = {
    ...serializeCuentaDeCobro(result.row),
    createdAt: result.row.createdAt.toISOString(),
    updatedAt: result.row.updatedAt.toISOString(),
    pdfUrl: result.pdfUrl,
  };
  const projectOptions = result.projects.map((p) => ({ id: p.id, title: p.title, clientName: p.clientName }));

  return <CuentaDeCobroDetail cdc={cdc} projectOptions={projectOptions} />;
}
