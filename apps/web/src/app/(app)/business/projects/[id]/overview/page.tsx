import { notFound } from "next/navigation";
import { withUserDb } from "@/lib/db/rls";
import { getProjectDetail } from "@/lib/services/projects";
import { serializeProject } from "@/lib/services/project-view";
import { OverviewForm } from "./overview-form";

export default async function ProjectOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await withUserDb((tx, user) => getProjectDetail(tx, user.id, id));
  if (!detail) notFound();

  return <OverviewForm projectId={id} initial={serializeProject(detail.project)} />;
}
