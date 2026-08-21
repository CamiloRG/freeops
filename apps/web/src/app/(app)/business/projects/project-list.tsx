"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  active: "Active",
  completed: "Completed",
  archived: "Archived",
  cancelled: "Cancelled",
};

const STATUS_BADGE_VARIANT: Record<ProjectListItem["status"], "default" | "secondary" | "outline" | "destructive"> = {
  active: "default",
  completed: "secondary",
  archived: "outline",
  cancelled: "destructive",
};

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
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
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
      setCreateError(parsed.error.issues[0]?.message ?? "Check the form and try again.");
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
      setCreateError(body?.error?.message ?? "Couldn't create the project — try again.");
      return;
    }
    setCreateStatus("idle");
    setDialogOpen(false);
    setDraft(emptyDraft);
    router.push(`/business/projects/${body.id}/overview`);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Projects</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Client projects, contracts, and their kanban boards.
          </p>
        </div>
        <Button type="button" onClick={() => setDialogOpen(true)}>
          + New Project
        </Button>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Input
          placeholder="Search by name or client…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-xs"
        />
        {loading && <span className="text-xs text-muted-foreground">Loading…</span>}
      </div>

      {projects.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-sm font-medium">No projects yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {status !== "all" || query
                ? "No projects match these filters."
                : "Create your first project to start tracking contracts and tasks."}
            </p>
            {status === "all" && !query && (
              <Button type="button" className="mt-4" onClick={() => setDialogOpen(true)}>
                + New Project
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Link key={project.id} href={`/business/projects/${project.id}/overview`} className="block">
              <Card className="h-full transition-colors hover:border-primary/40">
                <CardHeader className="flex-row items-start justify-between space-y-0 gap-2">
                  <div className="min-w-0">
                    <CardTitle className="truncate text-base">{project.name}</CardTitle>
                    <CardDescription className="truncate">{project.clientName}</CardDescription>
                  </div>
                  <Badge variant={STATUS_BADGE_VARIANT[project.status]} className="shrink-0">
                    {STATUS_LABEL[project.status]}
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-1.5 text-sm text-muted-foreground">
                  {project.value != null && (
                    <div className="font-medium text-foreground">
                      {formatCurrency(project.value, project.currency)}
                    </div>
                  )}
                  <div>
                    {formatDate(project.startDate) ?? "No start date"}
                    {project.expectedEndDate && ` — ${formatDate(project.expectedEndDate)}`}
                  </div>
                  {project.source === "crm_auto" && <Badge variant="secondary">From CRM</Badge>}
                </CardContent>
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
            <DialogTitle>New Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="proj-name">Project name</Label>
                <Input
                  id="proj-name"
                  value={draft.name}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="proj-client">Client name</Label>
                <Input
                  id="proj-client"
                  value={draft.clientName}
                  onChange={(e) => setDraft((d) => ({ ...d, clientName: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="proj-email">Client email</Label>
                <Input
                  id="proj-email"
                  type="email"
                  value={draft.clientEmail}
                  onChange={(e) => setDraft((d) => ({ ...d, clientEmail: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="proj-value">Deal value (COP)</Label>
                <Input
                  id="proj-value"
                  type="number"
                  min={0}
                  value={draft.value}
                  onChange={(e) => setDraft((d) => ({ ...d, value: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="proj-start">Start date</Label>
                <Input
                  id="proj-start"
                  type="date"
                  value={draft.startDate}
                  onChange={(e) => setDraft((d) => ({ ...d, startDate: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="proj-end">Expected end date</Label>
                <Input
                  id="proj-end"
                  type="date"
                  value={draft.expectedEndDate}
                  onChange={(e) => setDraft((d) => ({ ...d, expectedEndDate: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="proj-description">Description</Label>
              <Textarea
                id="proj-description"
                rows={3}
                value={draft.description}
                onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
              />
            </div>
            {createError && <p className="text-xs text-destructive">{createError}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleCreate}
              disabled={createStatus === "saving" || !draft.name || !draft.clientName || !draft.startDate}
            >
              {createStatus === "saving" ? "Creating…" : "Create project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
