import { notFound } from "next/navigation";
import { withUserDb } from "@/lib/db/rls";
import { getProjectDetail } from "@/lib/services/projects";
import { getBoardForProject } from "@/lib/services/kanban";
import { listContractDocuments } from "@/lib/services/contract-documents";
import { serializeProject } from "@/lib/services/project-view";
import { OverviewForm } from "./overview-form";
import { ProjectOverviewDashboard } from "./overview-dashboard";

export default async function ProjectOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { detail, board, documents } = await withUserDb(async (tx, user) => {
    const detail = await getProjectDetail(tx, user.id, id);
    if (!detail) return { detail: null, board: null, documents: null };
    const [board, documents] = await Promise.all([
      getBoardForProject(tx, user.id, id),
      listContractDocuments(tx, user.id, id),
    ]);
    return { detail, board, documents };
  });
  if (!detail) notFound();

  const project = serializeProject(detail.project);

  return (
    <>
      <ProjectOverviewDashboard
        projectId={id}
        value={project.value}
        currency={project.currency}
        startDate={project.startDate}
        expectedEndDate={project.expectedEndDate}
        columns={board?.columns.map((c) => ({ id: c.id, name: c.name, tasks: c.tasks })) ?? null}
        documents={documents?.map((d) => ({ documentType: d.documentType })) ?? null}
      />
      <OverviewForm projectId={id} initial={project} />
    </>
  );
}
