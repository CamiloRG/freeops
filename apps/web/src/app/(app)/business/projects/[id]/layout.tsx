import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SectionTabs } from "@/components/layout/section-tabs";
import { withUserDb } from "@/lib/db/rls";
import { getOwnedProject } from "@/lib/services/projects";
import { ProjectHeaderProvider } from "./project-header-context";

/**
 * Shared shell for a single project's Overview / Documents / Kanban
 * sub-routes — route-based tabs (not client-state `Tabs`) so each section
 * is deep-linkable. Mirrors Personal's `SectionTabs` layout pattern
 * (`(app)/personal/layout.tsx`), the module that established it.
 *
 * "Ledger Quiet" restyle (stage 3): dropped the `mx-auto max-w-4xl`
 * centering — nothing in this system is centered, same change Stage 2
 * made to `(app)/personal/layout.tsx`. Content padding matches the
 * handoff's own `content-padding: 26px top / 36px sides / 32px bottom`
 * constant, same value Personal uses. The back-link no longer carries a
 * `ChevronLeft` icon (the handoff's "Assets" section forbids icons) — a
 * plain mono arrow, styled like the handoff's own `← anterior ·
 * siguiente →` pagination convention. Breadcrumb is `NEGOCIO / PROYECTOS /
 * <TÍTULO DEL PROYECTO>` (one static string covering all 3 tabs — the
 * active tab is already legible from `SectionTabs` itself, so unlike
 * Personal's per-tab breadcrumb there was no need to vary this by route).
 */
const PADDING = "px-9 pt-[26px] pb-8";

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
    { href: `/business/projects/${id}/overview`, label: "Resumen" },
    { href: `/business/projects/${id}/documents`, label: "Documentos" },
    { href: `/business/projects/${id}/kanban`, label: "Kanban" },
  ];

  return (
    <div className={PADDING}>
      <Link
        href="/business/projects"
        className="mb-5 inline-block font-mono text-[11px] text-ink-muted transition-colors duration-fast ease-out hover:text-ink"
      >
        ← Todos los proyectos
      </Link>
      <ProjectHeaderProvider breadcrumb={`NEGOCIO / PROYECTOS / ${project.title.toUpperCase()}`}>
        <div className="mt-5">
          <SectionTabs items={tabs} />
        </div>
        <div className="mt-[26px]">{children}</div>
      </ProjectHeaderProvider>
    </div>
  );
}
