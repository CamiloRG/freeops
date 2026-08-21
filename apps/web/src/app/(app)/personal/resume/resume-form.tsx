"use client";

import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { CollapsibleEntryRow } from "@/components/personal/collapsible-entry-row";
import { useSingleOpen } from "@/components/personal/use-single-open";
import { AiProcessingCard, type AiProcessingStatus } from "@/components/ai/ai-processing-card";
import { resumeUpdateSchema } from "@/lib/validation/personal";

interface ResumeEntry {
  id?: string;
  source: "manual" | "project";
  projectId: string | null;
  title: string;
  clientName: string;
  description: string;
  startDate: string;
  endDate: string;
  displayOrder: number;
}

interface ResumeValues {
  headline: string;
  summary: string;
  skills: string[];
  entries: ResumeEntry[];
  lastGeneratedPdfUrl: string | null;
}

/**
 * AI-assisted resume import — user-proposed feature beyond app_spec.md's
 * original scope (see the codebase-memory-mcp ADR). Server-computed
 * quota/BYOK status, passed from `page.tsx`'s data load.
 */
interface AiImportStatus {
  byokConnected: boolean;
  byokKeyHint: string | null;
  /** Remaining default-tier imports this month; null when BYOK-connected (no cap). */
  remaining: number | null;
  limit: number;
}

const ACCEPTED_IMPORT_TYPES = "application/pdf,image/png,image/jpeg";

// Staged copy for AiProcessingCard — reflects the real rough order of
// work (read the file → extract fields → wrap up), never a fabricated
// percentage.
const IMPORT_STAGES = ["Reading your document…", "Extracting skills & experience…", "Almost done…"];

function emptyEntry(order: number): ResumeEntry {
  return {
    source: "manual",
    projectId: null,
    title: "",
    clientName: "",
    description: "",
    startDate: "",
    endDate: "",
    displayOrder: order,
  };
}

function entryKey(entry: ResumeEntry, index: number) {
  return entry.id ?? `new-${index}`;
}

function formatEntryDate(value: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

function formatEntryDates(entry: ResumeEntry) {
  const start = formatEntryDate(entry.startDate);
  const end = formatEntryDate(entry.endDate);
  if (!start && !end) return "No dates";
  return `${start ?? "—"} — ${end ?? "Present"}`;
}

export function ResumeForm({ initial, aiImport }: { initial: ResumeValues; aiImport: AiImportStatus }) {
  const [headline, setHeadline] = useState(initial.headline);
  const [summary, setSummary] = useState(initial.summary);
  const [skills, setSkills] = useState(initial.skills);
  const [skillDraft, setSkillDraft] = useState("");
  const [entries, setEntries] = useState(initial.entries);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [exportState, setExportState] = useState<"idle" | "generating" | "done" | "error">("idle");
  const [pdfUrl, setPdfUrl] = useState(initial.lastGeneratedPdfUrl);

  const { editing: editingBasics, toggle: toggleBasics } = useEditToggle(false);
  const { isOpen: isEntryOpen, toggle: toggleEntry, setOpenKey: setOpenEntryKey } = useSingleOpen<string>(null);

  // --- AI-assisted resume import state (user-proposed feature beyond
  // app_spec.md's original scope, see the codebase-memory-mcp ADR). The
  // AiProcessingCard's `status` is driven entirely by this real request's
  // actual lifecycle below — never a scripted timer. -------------------
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [aiStatus, setAiStatus] = useState(aiImport);
  const [importStatus, setImportStatus] = useState<AiProcessingStatus>("idle");
  const [importError, setImportError] = useState<string | null>(null);
  const [byokDialogOpen, setByokDialogOpen] = useState(false);
  const [byokApiKey, setByokApiKey] = useState("");
  const [byokPassword, setByokPassword] = useState("");
  const [byokStatus, setByokStatus] = useState<"idle" | "saving" | "error">("idle");
  const [byokError, setByokError] = useState<string | null>(null);

  const quotaExhausted = !aiStatus.byokConnected && aiStatus.remaining !== null && aiStatus.remaining <= 0;

  async function handleImportResume(file: File) {
    setImportError(null);
    // Flips the moment the real request starts — AiProcessingCard's stage
    // clock begins ticking here, not on a fixed demo duration.
    setImportStatus("processing");
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/v1/me/resume/extract", { method: "POST", body: formData });
    const body = await res.json().catch(() => null);

    if (!res.ok || !body) {
      setImportStatus("error");
      setImportError(
        body?.error?.message ?? "Couldn't read that file — try a clearer scan/PDF or fill in the fields manually."
      );
      return;
    }

    // Merge extracted fields into the same React state as manual editing —
    // same replace-wholesale pattern as `handlePullFromProjects` below.
    // Nothing is saved yet; the user still needs to click "Save resume".
    setHeadline(body.headline ?? "");
    setSummary(body.summary ?? "");
    setSkills(body.skills ?? []);
    setEntries(
      (body.entries ?? []).map((item: Record<string, unknown>, i: number) => ({
        source: "manual" as const,
        projectId: null,
        title: (item.title as string) ?? "",
        clientName: (item.clientName as string) ?? "",
        description: (item.description as string) ?? "",
        startDate: (item.startDate as string) ?? "",
        endDate: (item.endDate as string) ?? "",
        displayOrder: i,
      }))
    );

    if (body.quota) {
      setAiStatus((s) => ({ ...s, remaining: s.limit - body.quota.used }));
    }
    // Transitions to "done" only now that the real response has actually
    // arrived.
    setImportStatus("done");
  }

  async function handleConnectByok() {
    setByokError(null);
    setByokStatus("saving");
    const res = await fetch("/api/v1/me/ai-connections/anthropic", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: byokApiKey, currentPassword: byokPassword }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      setByokStatus("error");
      setByokError(body?.error?.message ?? "Couldn't connect that key — check it and try again.");
      return;
    }
    setByokStatus("idle");
    setByokApiKey("");
    setByokPassword("");
    setByokDialogOpen(false);
    setAiStatus((s) => ({ ...s, byokConnected: true, byokKeyHint: body.apiKeyHint ?? null, remaining: null }));
  }

  async function handleDisconnectByok() {
    setByokError(null);
    setByokStatus("saving");
    const res = await fetch("/api/v1/me/ai-connections/anthropic", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: byokPassword }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setByokStatus("error");
      setByokError(body?.error?.message ?? "Couldn't disconnect — check your password and try again.");
      return;
    }
    setByokStatus("idle");
    setByokPassword("");
    setByokDialogOpen(false);
    setAiStatus((s) => ({ ...s, byokConnected: false, byokKeyHint: null }));
  }

  function addSkill() {
    const trimmed = skillDraft.trim();
    if (trimmed && !skills.includes(trimmed)) setSkills((s) => [...s, trimmed]);
    setSkillDraft("");
  }

  function updateEntry(index: number, patch: Partial<ResumeEntry>) {
    setEntries((list) => list.map((e, i) => (i === index ? { ...e, ...patch } : e)));
  }

  function addEntry() {
    setEntries((list) => {
      const next = [...list, emptyEntry(list.length)];
      setOpenEntryKey(entryKey(next[next.length - 1], next.length - 1));
      return next;
    });
  }

  function removeEntry(index: number) {
    setEntries((list) => list.filter((_, i) => i !== index));
    setOpenEntryKey(null);
  }

  async function handleSave() {
    setErrorMessage(null);
    const payload = {
      headline: headline || null,
      summary: summary || null,
      skills,
      entries: entries.map((e, i) => ({ ...e, displayOrder: i, projectId: e.projectId ?? undefined })),
    };
    const parsed = resumeUpdateSchema.safeParse(payload);
    if (!parsed.success) {
      setStatus("error");
      setErrorMessage(parsed.error.issues[0]?.message ?? "Invalid resume data.");
      return;
    }
    setStatus("saving");
    const res = await fetch("/api/v1/me/resume", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    });
    setStatus(res.ok ? "saved" : "error");
  }

  async function handlePullFromProjects() {
    setSyncing(true);
    const res = await fetch("/api/v1/me/resume/sync-projects", { method: "POST" });
    const body = await res.json().catch(() => null);
    setSyncing(false);
    if (!res.ok || !body) return;
    setHeadline(body.headline ?? "");
    setSummary(body.summary ?? "");
    setSkills(body.skills ?? []);
    setEntries(
      (body.sections?.[0]?.items ?? []).map((item: Record<string, unknown>, i: number) => ({
        id: item.id as string | undefined,
        source: (item.source as "manual" | "project") ?? "manual",
        projectId: (item.projectId as string | null) ?? null,
        title: (item.title as string) ?? "",
        clientName: (item.clientName as string) ?? "",
        description: (item.description as string) ?? "",
        startDate: (item.startDate as string) ?? "",
        endDate: (item.endDate as string) ?? "",
        displayOrder: i,
      }))
    );
  }

  async function handleExport() {
    setExportState("generating");
    const startRes = await fetch("/api/v1/me/resume/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ format: "pdf" }),
    });
    if (!startRes.ok) {
      setExportState("error");
      return;
    }
    const { jobId } = await startRes.json();

    for (let attempt = 0; attempt < 10; attempt++) {
      const pollRes = await fetch(`/api/v1/me/resume/export/${jobId}`);
      const body = await pollRes.json().catch(() => null);
      if (body?.status === "done") {
        setPdfUrl(body.fileUrl);
        setExportState("done");
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    setExportState("error");
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-3 pt-4">
          <AiProcessingCard
            status={importStatus}
            stages={IMPORT_STAGES}
            idle={
              <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">Import from resume</div>
                  <div className="text-sm text-muted-foreground">
                    Upload a PDF, JPG, or PNG and we&apos;ll fill in the fields below for you to review.
                  </div>
                </div>
                <Button type="button" onClick={() => fileInputRef.current?.click()} disabled={quotaExhausted}>
                  Upload resume
                </Button>
              </div>
            }
            done={
              <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">Fields updated below</div>
                  <div className="text-sm text-muted-foreground">
                    Nothing&apos;s saved yet — review and edit before saving.
                  </div>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()}>
                  Import another
                </Button>
              </div>
            }
            error={
              <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-destructive">Couldn&apos;t import that file</div>
                  <div className="text-sm text-muted-foreground">{importError}</div>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                  Try again
                </Button>
              </div>
            }
          />
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_IMPORT_TYPES}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) handleImportResume(file);
            }}
          />
          <div className="flex flex-wrap items-center gap-3 pt-1">
            {aiStatus.byokConnected ? (
              <Badge variant="secondary">Using your own Anthropic key ({aiStatus.byokKeyHint})</Badge>
            ) : (
              aiStatus.remaining !== null && (
                <Badge variant="secondary">
                  {aiStatus.remaining} of {aiStatus.limit} free imports left this month
                </Badge>
              )
            )}
            <Button type="button" variant="ghost" size="sm" onClick={() => setByokDialogOpen(true)}>
              {aiStatus.byokConnected ? "Manage AI key" : "Connect your own AI key"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Your resume is sent to Anthropic&apos;s AI to extract these fields, then discarded — nothing is
            saved until you click &quot;Save resume&quot;. PDF, JPG, or PNG only.
          </p>
          {quotaExhausted && (
            <p className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning-foreground">
              You&apos;ve used all your free imports this month.{" "}
              <button type="button" className="underline" onClick={() => setByokDialogOpen(true)}>
                Connect your own Anthropic key
              </button>{" "}
              to keep importing without a monthly limit.
            </p>
          )}
        </CardContent>
      </Card>

      <SummaryEditCard
        title="Basics"
        description="Headline, summary, and skills."
        editing={editingBasics}
        onToggleEdit={toggleBasics}
        editLabel="Edit"
        cancelLabel="Done"
        summary={
          <div>
            <div className="text-sm font-semibold">{headline || "No headline yet"}</div>
            {summary && <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted-foreground">{summary}</p>}
            {skills.length > 0 && (
              <div className="mt-3.5 flex flex-wrap gap-1.5">
                {skills.map((skill) => (
                  <Badge key={skill} variant="secondary">
                    {skill}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        }
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="headline">Headline</Label>
            <Input id="headline" value={headline} onChange={(e) => setHeadline(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="summary">Summary</Label>
            <Textarea id="summary" rows={4} value={summary} onChange={(e) => setSummary(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="skillDraft">Skills</Label>
            <div className="flex flex-wrap gap-2">
              {skills.map((skill) => (
                <Badge key={skill} variant="secondary" className="gap-1.5">
                  {skill}
                  <button
                    type="button"
                    aria-label={`Remove ${skill}`}
                    onClick={() => setSkills((s) => s.filter((x) => x !== skill))}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                id="skillDraft"
                placeholder="Add a skill and press Enter"
                value={skillDraft}
                onChange={(e) => setSkillDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addSkill();
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={addSkill}>
                Add
              </Button>
            </div>
          </div>
        </div>
      </SummaryEditCard>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Experience</CardTitle>
            <CardDescription>Click an entry to edit it. Most recent first.</CardDescription>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={handlePullFromProjects} disabled={syncing}>
            {syncing ? "Pulling…" : "Pull from Projects"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-1">
          {entries.length === 0 && (
            <p className="px-1 pb-2 text-sm text-muted-foreground">
              No experience entries yet. Add one manually, or use &quot;Pull from Projects&quot; once you
              have completed projects in the Business section.
            </p>
          )}
          {entries.map((entry, index) => {
            const key = entryKey(entry, index);
            return (
              <CollapsibleEntryRow
                key={key}
                expanded={isEntryOpen(key)}
                onToggle={() => toggleEntry(key)}
                summary={
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-semibold">{entry.title || "Untitled role"}</span>
                      {entry.clientName && (
                        <span className="text-sm text-muted-foreground"> · {entry.clientName}</span>
                      )}
                      {entry.source === "project" && (
                        <Badge variant="secondary" className="ml-2 align-middle">
                          From project
                        </Badge>
                      )}
                    </div>
                    <div className="shrink-0 text-xs text-muted-foreground">{formatEntryDates(entry)}</div>
                  </div>
                }
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Title</Label>
                    <Input value={entry.title} onChange={(e) => updateEntry(index, { title: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Client</Label>
                    <Input
                      value={entry.clientName}
                      onChange={(e) => updateEntry(index, { clientName: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Start date</Label>
                    <Input
                      type="date"
                      value={entry.startDate}
                      onChange={(e) => updateEntry(index, { startDate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>End date</Label>
                    <Input
                      type="date"
                      value={entry.endDate}
                      onChange={(e) => updateEntry(index, { endDate: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Description</Label>
                  <Textarea
                    rows={3}
                    value={entry.description}
                    onChange={(e) => updateEntry(index, { description: e.target.value })}
                  />
                </div>
                <div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="pl-0 text-destructive hover:text-destructive"
                    onClick={() => removeEntry(index)}
                  >
                    Remove entry
                  </Button>
                </div>
              </CollapsibleEntryRow>
            );
          })}
          <div className="pt-2">
            <Button type="button" variant="outline" onClick={addEntry}>
              + Add entry
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={handleSave} disabled={status === "saving"}>
          {status === "saving" ? "Saving…" : "Save resume"}
        </Button>
        {status === "saved" && <span className="text-sm text-success">Saved.</span>}
        {status === "error" && (
          <span className="text-sm text-destructive">{errorMessage ?? "Couldn't save — try again."}</span>
        )}

        <Button type="button" variant="outline" onClick={handleExport} disabled={exportState === "generating"}>
          {exportState === "generating" ? "Generating PDF…" : "Export PDF"}
        </Button>
        {exportState === "done" && pdfUrl && (
          <a href={pdfUrl} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline">
            Download PDF
          </a>
        )}
        {exportState === "error" && <span className="text-sm text-destructive">Export failed — try again.</span>}
      </div>

      <AlertDialog
        open={byokDialogOpen}
        onOpenChange={(open) => {
          setByokDialogOpen(open);
          if (!open) {
            setByokError(null);
            setByokStatus("idle");
            setByokApiKey("");
            setByokPassword("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{aiStatus.byokConnected ? "Manage your AI key" : "Connect your own AI key"}</AlertDialogTitle>
            <AlertDialogDescription>
              {aiStatus.byokConnected
                ? `Connected: ${aiStatus.byokKeyHint}. Disconnect to go back to FreeOps's free monthly imports.`
                : "Use your own Anthropic API key for resume imports — no monthly limit, billed to your own Anthropic account."}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4">
            <p className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning-foreground">
              For your security, confirm your password to {aiStatus.byokConnected ? "disconnect" : "connect"} this key.
            </p>

            {!aiStatus.byokConnected && (
              <div className="space-y-1.5">
                <Label htmlFor="byokApiKey">Anthropic API key</Label>
                <Input
                  id="byokApiKey"
                  placeholder="sk-ant-..."
                  value={byokApiKey}
                  onChange={(e) => setByokApiKey(e.target.value)}
                  autoComplete="off"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="byokPassword">Confirm your password</Label>
              <Input
                id="byokPassword"
                type="password"
                autoComplete="current-password"
                value={byokPassword}
                onChange={(e) => setByokPassword(e.target.value)}
              />
            </div>

            {byokError && <p className="text-xs text-destructive">{byokError}</p>}
          </div>

          <AlertDialogFooter>
            <Button type="button" variant="outline" onClick={() => setByokDialogOpen(false)}>
              Cancel
            </Button>
            {aiStatus.byokConnected ? (
              <Button type="button" variant="destructive" onClick={handleDisconnectByok} disabled={byokStatus === "saving"}>
                {byokStatus === "saving" ? "Disconnecting…" : "Disconnect"}
              </Button>
            ) : (
              <Button type="button" onClick={handleConnectByok} disabled={byokStatus === "saving" || !byokApiKey}>
                {byokStatus === "saving" ? "Connecting…" : "Connect key"}
              </Button>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
