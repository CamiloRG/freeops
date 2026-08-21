"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

export function ResumeForm({ initial }: { initial: ResumeValues }) {
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

  function addSkill() {
    const trimmed = skillDraft.trim();
    if (trimmed && !skills.includes(trimmed)) setSkills((s) => [...s, trimmed]);
    setSkillDraft("");
  }

  function updateEntry(index: number, patch: Partial<ResumeEntry>) {
    setEntries((list) => list.map((e, i) => (i === index ? { ...e, ...patch } : e)));
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
        <CardHeader>
          <CardTitle>Resume / CV</CardTitle>
          <CardDescription>Sectioned editor — summary, skills, experience. Export as PDF when ready.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Experience</CardTitle>
            <CardDescription>Manual entries or pulled in from completed Business-section projects.</CardDescription>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={handlePullFromProjects} disabled={syncing}>
            {syncing ? "Pulling…" : "Pull from Projects"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {entries.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No experience entries yet. Add one manually, or use &quot;Pull from Projects&quot; once you
              have completed projects in the Business section.
            </p>
          )}
          {entries.map((entry, index) => (
            <div key={entry.id ?? index} className="space-y-3 rounded-lg border border-border p-4">
              <div className="flex items-center justify-between">
                {entry.source === "project" && <Badge variant="secondary">From project</Badge>}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="ml-auto"
                  onClick={() => setEntries((list) => list.filter((_, i) => i !== index))}
                >
                  Remove
                </Button>
              </div>
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
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={() => setEntries((list) => [...list, emptyEntry(list.length)])}
          >
            Add entry
          </Button>
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
    </div>
  );
}
