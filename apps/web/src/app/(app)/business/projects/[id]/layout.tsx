import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { SectionTabs } from "@/components/layout/section-tabs";
import { withUserDb } from "@/lib/db/rls";
import { getOwnedProject } from "@/lib/services/projects";

/**
 * Shared shell for a single project's Overview / Documents / Kanban
 * sub-routes — route-based tabs (not client-state `Tabs`) so each section
 * is deep-linkable, e.g. bookmarking straight to a project's kanban board.
 * Mirrors Personal's `SectionTabs` layout pattern (`(app)/personal/
 * layout.tsx`), the first module to reuse it per that phase's own note.
 */
export default async function ProjectDetailLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await withUserDb((tx, user) => getOwnedProject(tx, user.id, id));
  if (!project) {
    notFound();
  }

  const tabs = [
    { href: `/business/projects/${id}/overview`, label: "Overview" },
    { href: `/business/projects/${id}/documents`, label: "Documents" },
    { href: `/business/projects/${id}/kanban`, label: "Kanban" },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:px-8">
      <Link
        href="/business/projects"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" /> All projects
      </Link>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">{project.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{project.clientName}</p>
      </div>
      <SectionTabs items={tabs} />
      <div className="mt-6">{children}</div>
    </div>
  );
}
