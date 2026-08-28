"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader } from "@/components/layout/page-header";
import { cn } from "@/lib/utils";
import { projectCreateSchema } from "@/lib/validation/business";

export interface ProjectListItem {
  id: string;
  name: string;
  clientName: string;
  clientEmail: string | null;
  status: "active" | "completed" | "archived" | "cancelled";
  startDate: string | null;
  expectedEndDate: string | null;
  value: number | null;
  currency: string;
  source: "manual" | "crm_auto";
  createdAt: string;
}

const STATUS_LABEL: Record<ProjectListItem["status"], string> = {
  active: "Activo",
  completed: "Completado",
  archived: "Archivado",
  cancelled: "Cancelado",
};

/** "Aero" status pill tint per project status (README "Status pills"). */
const STATUS_PILL: Record<ProjectListItem["status"], string> = {
  active: "bg-positive-tint text-positive-ink",
  completed: "bg-accent-tint text-accent-press",
  archived: "bg-surface-sunken text-ink-muted",
  cancelled: "bg-critical-tint text-critical-ink",
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

function formatCurrency(value: number | null, currency: string) {
  if (value == null) return null;
  try {
    return new Intl.NumberFormat("es-CO", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString()}`;
  }
}

function formatDate(value: string | null) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("es-CO", { month: "short", day: "numeric", year: "numeric" });
}

const emptyDraft = {
  name: "",
  clientName: "",
  clientEmail: "",
  description: "",
  startDate: new Date().toISOString().slice(0, 10),
  expectedEndDate: "",
  value: "",
};

/**
 * "Ledger Quiet" restyle (stage 3) — NOT pixel-mocked (only Personal's
 * Profile/Banking screens are). Extrapolated: `BreadcrumbHeader` +
 * non-centered content padding (same `content-padding` constant Personal
 * uses), card grid restyled to the flat/no-shadow/no-radius `Card`
 * primitive with plain mono status markers instead of colored badges,
 * filters/search restyled onto the bottom-border-only `Select`/`Input`.
 * Card/table view toggle stays out of scope (spec's own `[ASSUMED
 * DEFAULT]`, unchanged from Phase 5).
 */
export function ProjectList({ initialProjects }: { initialProjects: ProjectListItem[] }) {
  const router = useRouter();
  const [projects, setProjects] = useState(initialProjects);
  const [status, setStatus] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);
  const [createStatus, setCreateStatus] = useState<"idle" | "saving" | "error">("idle");
  const [createError, setCreateError] = useState<string | null>(null);

  const fetchProjects = useCallback(async (nextStatus: string, nextQuery: string) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (nextStatus !== "all") params.set("status", nextStatus);
    if (nextQuery.trim()) params.set("q", nextQuery.trim());
    const res = await fetch(`/api/v1/projects?${params.toString()}`);
    const body = await res.json().catch(() => null);
    setLoading(false);
    if (res.ok && body) setProjects(body.data);
  }, []);

  useEffect(() => {
    const handle = setTimeout(() => fetchProjects(status, query), 250);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, query]);

  async function handleCreate() {
    setCreateError(null);
    const payload = {
      name: draft.name,
      clientName: draft.clientName,
      clientEmail: draft.clientEmail || undefined,
      description: draft.description || undefined,
      startDate: draft.startDate,
      expectedEndDate: draft.expectedEndDate || undefined,
      value: draft.value ? Number(draft.value) : undefined,
    };
    const parsed = projectCreateSchema.safeParse(payload);
    if (!parsed.success) {
      setCreateStatus("error");
      setCreateError(parsed.error.issues[0]?.message ?? "Revisa el formulario e intenta de nuevo.");
      return;
    }
    setCreateStatus("saving");
    const res = await fetch("/api/v1/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body) {
      setCreateStatus("error");
      setCreateError(body?.error?.message ?? "No se pudo crear el proyecto — intenta de nuevo.");
      return;
    }
    setCreateStatus("idle");
    setDialogOpen(false);
    setDraft(emptyDraft);
    router.push(`/business/projects/${body.id}/overview`);
  }

  return (
    <div className="px-9 pt-[26px] pb-8">
      <PageHeader
        title="Proyectos"
        description="Abre un proyecto para ver sus documentos, tareas y facturación."
        action={
          <Button type="button" onClick={() => setDialogOpen(true)}>
            + Nuevo proyecto
          </Button>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-4">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-44" aria-label="Filtrar por estado">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="active">Activo</SelectItem>
            <SelectItem value="completed">Completado</SelectItem>
            <SelectItem value="archived">Archivado</SelectItem>
            <SelectItem value="cancelled">Cancelado</SelectItem>
          </SelectContent>
        </Select>
        <Input
          placeholder="Buscar por nombre o cliente…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-xs"
        />
        {loading && <span className="font-mono text-[11px] text-ink-muted">cargando…</span>}
      </div>

      {projects.length === 0 ? (
        <div className="max-w-measure py-10">
          <h3 className="text-h3 text-ink">Aún no hay proyectos</h3>
          <p className="mt-1.5 text-caption text-ink-muted">
            {status !== "all" || query
              ? "Ningún proyecto coincide con estos filtros."
              : "Crea tu primer proyecto para empezar a llevar contratos y tareas."}
          </p>
          {status === "all" && !query && (
            <Button type="button" variant="outline" className="mt-4" onClick={() => setDialogOpen(true)}>
              + Nuevo proyecto
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Link key={project.id} href={`/business/projects/${project.id}/overview`} className="block">
              <Card className="h-full transition-colors duration-fast ease-out hover:border-accent/40">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-tint text-[11px] font-semibold text-accent-press">
                      {initials(project.clientName)}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-body-sm font-semibold text-ink">{project.name}</div>
                      <div className="truncate text-[12px] text-ink-muted">{project.clientName}</div>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-pill px-[10px] py-[4px] text-[11px] font-medium",
                      STATUS_PILL[project.status]
                    )}
                  >
                    {STATUS_LABEL[project.status]}
                  </span>
                </div>

                <div className="mt-4 flex items-center justify-between gap-4 border-t border-line-soft pt-3 text-[12px] text-ink-muted">
                  <div>
                    {project.value != null ? (
                      <span className="font-mono text-data-mono text-ink">
                        {formatCurrency(project.value, project.currency)}
                      </span>
                    ) : (
                      "Sin valor registrado"
                    )}
                  </div>
                  <div className="text-right">
                    {formatDate(project.startDate) ?? "Sin fecha de inicio"}
                    {project.expectedEndDate && ` — ${formatDate(project.expectedEndDate)}`}
                  </div>
                </div>
                {project.source === "crm_auto" && (
                  <div className="mt-2 font-mono text-[11px] text-accent-press">auto · desde CRM</div>
                )}
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setCreateStatus("idle");
            setCreateError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo proyecto</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="proj-name">Nombre del proyecto</Label>
                <Input
                  id="proj-name"
                  value={draft.name}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="proj-client">Nombre del cliente</Label>
                <Input
                  id="proj-client"
                  value={draft.clientName}
                  onChange={(e) => setDraft((d) => ({ ...d, clientName: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="proj-email">Correo del cliente</Label>
                <Input
                  id="proj-email"
                  type="email"
                  value={draft.clientEmail}
                  onChange={(e) => setDraft((d) => ({ ...d, clientEmail: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="proj-value">Valor del contrato (COP)</Label>
                <Input
                  id="proj-value"
                  type="number"
                  min={0}
                  className="font-mono text-data-mono"
                  value={draft.value}
                  onChange={(e) => setDraft((d) => ({ ...d, value: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="proj-start">Fecha de inicio</Label>
                <Input
                  id="proj-start"
                  type="date"
                  value={draft.startDate}
                  onChange={(e) => setDraft((d) => ({ ...d, startDate: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="proj-end">Fecha de finalización esperada</Label>
                <Input
                  id="proj-end"
                  type="date"
                  value={draft.expectedEndDate}
                  onChange={(e) => setDraft((d) => ({ ...d, expectedEndDate: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="proj-description">Descripción</Label>
              <Textarea
                id="proj-description"
                rows={3}
                value={draft.description}
                onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
              />
            </div>
            {createError && <p className="font-mono text-[11px] text-danger">{createError}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleCreate}
              disabled={createStatus === "saving" || !draft.name || !draft.clientName || !draft.startDate}
            >
              {createStatus === "saving" ? "Creando…" : "Crear proyecto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
