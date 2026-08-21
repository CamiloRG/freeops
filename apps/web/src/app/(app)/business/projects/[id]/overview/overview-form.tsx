"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SummaryEditCard } from "@/components/personal/summary-edit-card";
import { useEditToggle } from "@/components/personal/use-edit-toggle";
import { SummaryField, SummaryGrid } from "@/components/personal/summary-grid";
import { projectUpdateSchema } from "@/lib/validation/business";
import type { ProjectListItem } from "../../project-list";

type ProjectStatus = ProjectListItem["status"];

const STATUS_LABEL: Record<ProjectStatus, string> = {
  active: "Active",
  completed: "Completed",
  archived: "Archived",
  cancelled: "Cancelled",
};

function formatCurrency(value: number | null, currency: string) {
  if (value == null) return "—";
  try {
    return new Intl.NumberFormat("es-CO", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString()}`;
  }
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

interface ProjectOverview {
  id: string;
  name: string;
  clientName: string;
  clientEmail: string | null;
  clientTaxId: string | null;
  description: string | null;
  scopeNotes: string | null;
  status: ProjectStatus;
  startDate: string | null;
  expectedEndDate: string | null;
  value: number | null;
  currency: string;
  source: "manual" | "crm_auto";
}

export function OverviewForm({ projectId, initial }: { projectId: string; initial: ProjectOverview }) {
  const router = useRouter();
  const { editing, setEditing, toggle } = useEditToggle(false);
  const [saved, setSaved] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteWarning, setDeleteWarning] = useState<string | null>(null);
  const [deleteStatus, setDeleteStatus] = useState<"idle" | "deleting" | "error">("idle");

  function handleToggle() {
    if (editing) setDraft(saved); // restore on cancel
    toggle();
  }

  async function handleSave() {
    setError(null);
    const payload = {
      name: draft.name,
      clientName: draft.clientName,
      clientEmail: draft.clientEmail || undefined,
      clientTaxId: draft.clientTaxId || undefined,
      description: draft.description || undefined,
      scopeNotes: draft.scopeNotes || undefined,
      status: draft.status,
      startDate: draft.startDate || undefined,
      expectedEndDate: draft.expectedEndDate || undefined,
      value: draft.value ?? undefined,
    };
    const parsed = projectUpdateSchema.safeParse(payload);
    if (!parsed.success) {
      setStatus("error");
      setError(parsed.error.issues[0]?.message ?? "Check the form and try again.");
      return;
    }
    setStatus("saving");
    const res = await fetch(`/api/v1/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body) {
      setStatus("error");
      setError(body?.error?.message ?? "Couldn't save — try again.");
      return;
    }
    setStatus("idle");
    setSaved(draft);
    setEditing(false);
  }

  async function handleDelete(confirm: boolean) {
    setDeleteStatus("deleting");
    const res = await fetch(`/api/v1/projects/${projectId}${confirm ? "?confirm=true" : ""}`, {
      method: "DELETE",
    });
    if (res.status === 204) {
      router.push("/business/projects");
      return;
    }
    const body = await res.json().catch(() => null);
    if (res.ok && body?.warning) {
      setDeleteWarning(body.warning);
      setDeleteStatus("idle");
      return;
    }
    setDeleteStatus("error");
  }

  return (
    <div className="space-y-6">
      <SummaryEditCard
        title="Overview"
        description="Client info, scope, value, and dates."
        editing={editing}
        onToggleEdit={handleToggle}
        summary={
          <div className="space-y-4">
            <SummaryGrid>
              <SummaryField label="Project name" value={saved.name} />
              <SummaryField label="Status" value={<Badge>{STATUS_LABEL[saved.status]}</Badge>} />
              <SummaryField label="Client" value={saved.clientName} />
              <SummaryField label="Client email" value={saved.clientEmail || "—"} />
              <SummaryField label="Client tax ID" value={saved.clientTaxId || "—"} />
              <SummaryField label="Deal value" value={formatCurrency(saved.value, saved.currency)} />
              <SummaryField label="Start date" value={formatDate(saved.startDate)} />
              <SummaryField label="Expected end date" value={formatDate(saved.expectedEndDate)} />
              {saved.source === "crm_auto" && (
                <SummaryField label="Source" value={<Badge variant="secondary">Auto-created from CRM</Badge>} />
              )}
            </SummaryGrid>
            {saved.description && (
              <div>
                <div className="text-xs text-muted-foreground">Description</div>
                <p className="mt-0.5 text-sm leading-relaxed">{saved.description}</p>
              </div>
            )}
            {saved.scopeNotes && (
              <div>
                <div className="text-xs text-muted-foreground">Scope notes</div>
                <p className="mt-0.5 text-sm leading-relaxed">{saved.scopeNotes}</p>
              </div>
            )}
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ov-name">Project name</Label>
              <Input id="ov-name" value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ov-status">Status</Label>
              <Select value={draft.status} onValueChange={(v) => setDraft((d) => ({ ...d, status: v as ProjectStatus }))}>
                <SelectTrigger id="ov-status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ov-client">Client name</Label>
              <Input
                id="ov-client"
                value={draft.clientName}
                onChange={(e) => setDraft((d) => ({ ...d, clientName: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ov-client-email">Client email</Label>
              <Input
                id="ov-client-email"
                type="email"
                value={draft.clientEmail ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, clientEmail: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ov-client-tax">Client tax ID</Label>
              <Input
                id="ov-client-tax"
                value={draft.clientTaxId ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, clientTaxId: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ov-value">Deal value (COP)</Label>
              <Input
                id="ov-value"
                type="number"
                min={0}
                value={draft.value ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, value: e.target.value ? Number(e.target.value) : null }))}
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ov-start">Start date</Label>
              <Input
                id="ov-start"
                type="date"
                value={draft.startDate ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, startDate: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ov-end">Expected end date</Label>
              <Input
                id="ov-end"
                type="date"
                value={draft.expectedEndDate ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, expectedEndDate: e.target.value }))}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ov-description">Description</Label>
            <Textarea
              id="ov-description"
              rows={3}
              value={draft.description ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ov-scope">Scope notes</Label>
            <Textarea
              id="ov-scope"
              rows={3}
              value={draft.scopeNotes ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, scopeNotes: e.target.value }))}
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button type="button" onClick={handleSave} disabled={status === "saving"}>
            {status === "saving" ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </SummaryEditCard>

      <Card>
        <CardHeader>
          <CardTitle className="text-base text-destructive">Danger zone</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">
            Deleting a project soft-deletes it — it stops appearing in your project list, but is not
            permanently destroyed.
          </p>
          <Button type="button" variant="destructive" onClick={() => setDeleteOpen(true)}>
            Delete project
          </Button>
        </CardContent>
      </Card>

      <AlertDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) {
            setDeleteWarning(null);
            setDeleteStatus("idle");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this project?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteWarning ?? "This will remove the project from your active list."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteStatus === "error" && <p className="text-xs text-destructive">Couldn&apos;t delete — try again.</p>}
          <AlertDialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteStatus === "deleting"}
              onClick={() => handleDelete(!!deleteWarning)}
            >
              {deleteStatus === "deleting" ? "Deleting…" : deleteWarning ? "Delete anyway" : "Delete"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
