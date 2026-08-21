import { withUserDb } from "@/lib/db/rls";
import { listProjects } from "@/lib/services/projects";
import { serializeProject } from "@/lib/services/project-view";
import { ProjectList, type ProjectListItem } from "./project-list";

export default async function ProjectsPage() {
  const rows = await withUserDb((tx, user) => listProjects(tx, user.id, {}));
  const projects: ProjectListItem[] = rows.map(serializeProject).map((p) => ({
    ...p,
    createdAt: p.createdAt.toISOString(),
  }));

  return <ProjectList initialProjects={projects} />;
}
