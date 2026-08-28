import { notFound } from "next/navigation";
import { withUserDb } from "@/lib/db/rls";
import { listContractDocuments } from "@/lib/services/contract-documents";
import { getOwnedProject } from "@/lib/services/projects";
import { serializeProject } from "@/lib/services/project-view";
import { getSignedDownloadUrl } from "@/lib/storage/r2";
import { DocumentsPanel } from "./documents-panel";
import { ContractValidityPanel } from "./contract-validity-panel";

export default async function ProjectDocumentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { rows, project } = await withUserDb(async (tx, user) => {
    const rows = await listContractDocuments(tx, user.id, id);
    const projectRow = await getOwnedProject(tx, user.id, id);
    return { rows, project: projectRow ? serializeProject(projectRow) : null };
  });
  if (rows === null || project === null) notFound();

  const documents = await Promise.all(
    rows.map(async (doc) => ({
      id: doc.id,
      type: doc.documentType as "executed_contract" | "amendment" | "appendix" | "change_order",
      label: doc.title,
      fileName: doc.fileName,
      fileUrl: await getSignedDownloadUrl("contractDocuments", doc.fileKey),
      fileSizeBytes: doc.fileSizeBytes,
      uploadedAt: doc.uploadedAt.toISOString(),
    }))
  );

  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
      <div className="min-w-0 flex-1">
        <DocumentsPanel projectId={id} initialDocuments={documents} />
      </div>
      <ContractValidityPanel
        value={project.value}
        currency={project.currency}
        startDate={project.startDate}
        expectedEndDate={project.expectedEndDate}
      />
    </div>
  );
}
