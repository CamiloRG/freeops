import { notFound } from "next/navigation";
import { withUserDb } from "@/lib/db/rls";
import { listContractDocuments } from "@/lib/services/contract-documents";
import { getSignedDownloadUrl } from "@/lib/storage/r2";
import { DocumentsPanel } from "./documents-panel";

export default async function ProjectDocumentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rows = await withUserDb((tx, user) => listContractDocuments(tx, user.id, id));
  if (rows === null) notFound();

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

  return <DocumentsPanel projectId={id} initialDocuments={documents} />;
}
