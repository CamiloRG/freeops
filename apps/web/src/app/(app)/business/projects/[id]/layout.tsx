import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { RouteTabs } from "@/components/layout/route-tabs";
import { withUserDb } from "@/lib/db/rls";
import { getOwnedProject } from "@/lib/services/projects";
import { serializeProject } from "@/lib/services/project-view";

const STATUS_LABEL: Record<string, string> = {
  active: "Activo",
  completed: "Completado",
  archived: "Archivado",
  cancelled: "Cancelado",
};

const STATUS_PILL: Record<string, string> = {
  active: "bg-positive-tint text-positive-ink",
  completed: "bg-accent-tint text-accent-press",
  archived: "bg-surface-sunken text-ink-muted",
  cancelled: "bg-critical-tint text-critical-ink",
};

function formatCurrency(value: number | null, currency: string) {
  if (value == null) return null;
  try {
    return new Intl.NumberFormat("es-CO", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString()}`;
  }
}

/**
 * Shared shell for a single project's Resumen / Documentos / Tareas /
 * Facturación sub-routes — route-based pill tabs (`RouteTabs`, matching
 * the new project-detail mocks) so each section stays deep-linkable.
 *
 * The mocks also show "Compartir" and "Emitir cuenta" buttons in this
 * shared header, on every tab — deliberately dropped here: neither has a
 * real feature behind it (no sharing/public-link system, and "Emitir
 * cuenta" needs the invoicing feature Facturación itself doesn't have
 * yet — see that tab's own placeholder). Showing them on every tab as
 * dead buttons would be worse than the mocks' single Facturación-specific
 * placeholder card explaining why.
 */
export default async function ProjectDetailLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const row = await withUserDb((tx, user) => getOwnedProject(tx, user.id, id));
  if (!row) {
    notFound();
  }
  const project = serializeProject(row);

  const tabs = [
    { href: `/business/projects/${id}/overview`, label: "Resumen" },
    { href: `/business/projects/${id}/documents`, label: "Documentos" },
    { href: `/business/projects/${id}/kanban`, label: "Tareas" },
    { href: `/business/projects/${id}/billing`, label: "Facturación" },
  ];

  return (
    <div className="px-9 pt-[26px] pb-8">
      <Link
        href="/business/projects"
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-ink-muted transition-colors duration-fast ease-out hover:text-ink"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        Todos los proyectos
      </Link>

      <div className="mb-5 flex flex-wrap items-center gap-2.5">
        <h1 className="text-h2 text-ink">{project.name}</h1>
        <span className={`rounded-pill px-[10px] py-[4px] text-[12px] font-medium ${STATUS_PILL[project.status]}`}>
          {STATUS_LABEL[project.status]}
        </span>
      </div>
      <p className="-mt-3 mb-5 text-body-sm text-ink-soft">
        {project.clientName}
        {project.value != null && ` · ${formatCurrency(project.value, project.currency)}`}
      </p>

      <RouteTabs items={tabs} />
      <div className="mt-[26px]">{children}</div>
    </div>
  );
}
