"use client";

import { useRef, useState } from "react";
import { Card, CardAction, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { InlineNotice } from "@/components/ui/inline-notice";
import { SaveStatusLine } from "@/components/ui/save-status-line";
import { SummaryEditCard } from "@/components/personal/summary-edit-card";
import { useEditToggle } from "@/components/personal/use-edit-toggle";
import { CollapsibleEntryRow } from "@/components/personal/collapsible-entry-row";
import { useSingleOpen } from "@/components/personal/use-single-open";
import { AiProcessingCard, type AiProcessingStatus } from "@/components/ai/ai-processing-card";
import { useSaveStatus } from "@/hooks/use-save-status";
import { isDirty } from "@/lib/form-dirty";
import { resumeUpdateSchema } from "@/lib/validation/personal";
import { usePersonalHeaderStatus } from "../personal-header-context";

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
const IMPORT_STAGES = ["Leyendo tu documento…", "Extrayendo habilidades y experiencia…", "Casi listo…"];

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
  return date.toLocaleDateString("es-CO", { month: "short", year: "numeric" });
}

function formatEntryDates(entry: ResumeEntry) {
  const start = formatEntryDate(entry.startDate);
  const end = formatEntryDate(entry.endDate);
  if (!start && !end) return "Sin fechas";
  return `${start ?? "—"} — ${end ?? "Presente"}`;
}

/**
 * Personal / Hoja de vida — NOT pixel-mocked in the design handoff.
 * Extrapolated onto the same tokens/patterns as Profile/Banking. The
 * Experience list's `CollapsibleEntryRow` and the AI-import flow's
 * `AiProcessingCard` are the two components this screen restyles beyond a
 * plain field grid — see each component's own file for its "no icons"
 * restyle rationale.
 */
export function ResumeForm({ initial, aiImport }: { initial: ResumeValues; aiImport: AiImportStatus }) {
  const [headline, setHeadline] = useState(initial.headline);
  const [summary, setSummary] = useState(initial.summary);
  const [skills, setSkills] = useState(initial.skills);
  const [skillDraft, setSkillDraft] = useState("");
  const [entries, setEntries] = useState(initial.entries);
  const [saved, setSaved] = useState({
    headline: initial.headline,
    summary: initial.summary,
    skills: initial.skills,
    entries: initial.entries,
  });
  const saveStatus = useSaveStatus();
  const [syncing, setSyncing] = useState(false);
  const [exportState, setExportState] = useState<"idle" | "generating" | "done" | "error">("idle");
  const [pdfUrl, setPdfUrl] = useState(initial.lastGeneratedPdfUrl);

  usePersonalHeaderStatus(<SaveStatusLine status={saveStatus} />);

  const dirty = isDirty({ headline, summary, skills, entries }, saved);

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
        body?.error?.message ?? "No pudimos leer ese archivo — prueba con un escaneo/PDF más claro o completa los campos manualmente."
      );
      return;
    }

    // Merge extracted fields into the same React state as manual editing —
    // same replace-wholesale pattern as `handlePullFromProjects` below.
    // Nothing is saved yet; the user still needs to click "Guardar hoja de vida".
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
      setByokError(body?.error?.message ?? "No pudimos conectar esa clave — revísala e intenta de nuevo.");
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
      setByokError(body?.error?.message ?? "No pudimos desconectar — revisa tu contraseña e intenta de nuevo.");
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
    const payload = {
      headline: headline || null,
      summary: summary || null,
      skills,
      entries: entries.map((e, i) => ({ ...e, displayOrder: i, projectId: e.projectId ?? undefined })),
    };
    const parsed = resumeUpdateSchema.safeParse(payload);
    if (!parsed.success) {
      saveStatus.markError(parsed.error.issues[0]?.message ?? "Datos de la hoja de vida inválidos.");
      return;
    }
    saveStatus.markSaving();
    const res = await fetch("/api/v1/me/resume", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    });
    if (!res.ok) {
      saveStatus.markError("No se pudo guardar. Intenta de nuevo.");
      return;
    }
    saveStatus.markSaved();
    setSaved({ headline, summary, skills, entries });
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
    <div className="flex flex-col gap-9">
      <div>
        <h2 className="text-h2 font-medium text-ink">Hoja de vida</h2>
        <p className="mt-[5px] text-caption text-ink-muted">Estos datos se usan para generar tu hoja de vida en PDF.</p>
      </div>

      <Card>
        <CardContent className="space-y-4">
          <AiProcessingCard
            status={importStatus}
            stages={IMPORT_STAGES}
            idle={
              <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-body text-ink">Importar desde currículum</div>
                  <div className="text-caption text-ink-soft">
                    Sube un PDF, JPG o PNG y completamos los campos de abajo para que los revises.
                  </div>
                </div>
                <Button type="button" onClick={() => fileInputRef.current?.click()} disabled={quotaExhausted}>
                  Subir currículum
                </Button>
              </div>
            }
            done={
              <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-body text-ink">Campos actualizados abajo</div>
                  <div className="text-caption text-ink-soft">Nada se ha guardado aún — revisa y edita antes de guardar.</div>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()}>
                  Importar otro
                </Button>
              </div>
            }
            error={
              <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-body text-danger">No pudimos importar ese archivo</div>
                  <div className="text-caption text-ink-soft">{importError}</div>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                  Intentar de nuevo
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
          <div className="flex flex-wrap items-center gap-4">
            {aiStatus.byokConnected ? (
              <Badge variant="secondary">Usando tu propia clave de Anthropic ({aiStatus.byokKeyHint})</Badge>
            ) : (
              aiStatus.remaining !== null && (
                <Badge variant="secondary">
                  {aiStatus.remaining} de {aiStatus.limit} importaciones gratis restantes este mes
                </Badge>
              )
            )}
            <Button type="button" variant="ghost" size="sm" onClick={() => setByokDialogOpen(true)}>
              {aiStatus.byokConnected ? "Administrar clave de IA" : "Conectar tu propia clave de IA"}
            </Button>
          </div>
          <p className="text-caption text-ink-muted">
            Tu currículum se envía a la IA de Anthropic para extraer estos campos y luego se descarta — nada se
            guarda hasta que hagas clic en &quot;Guardar hoja de vida&quot;. Solo PDF, JPG o PNG.
          </p>
          {quotaExhausted && (
            <InlineNotice
              title="LÍMITE ALCANZADO"
              description={
                <>
                  Ya usaste todas tus importaciones gratis este mes.{" "}
                  <button type="button" className="underline" onClick={() => setByokDialogOpen(true)}>
                    Conecta tu propia clave de Anthropic
                  </button>{" "}
                  para seguir importando sin límite mensual.
                </>
              }
            />
          )}
        </CardContent>
      </Card>

      <SummaryEditCard
        title={<span className="text-h3 text-ink">Datos básicos</span>}
        description={<span className="text-caption text-ink-soft">Titular, resumen y habilidades.</span>}
        editing={editingBasics}
        onToggleEdit={toggleBasics}
        editLabel="Editar"
        cancelLabel="Listo"
        summary={
          <div>
            <div className="text-body text-ink">{headline || "Todavía no hay titular"}</div>
            {summary && <p className="mt-[6px] max-w-xl text-body text-ink-soft">{summary}</p>}
            {skills.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-x-3 gap-y-1.5">
                {skills.map((skill) => (
                  <span key={skill} className="font-mono text-[11px] text-ink-muted">
                    {skill}
                  </span>
                ))}
              </div>
            )}
          </div>
        }
      >
        <div className="flex flex-col gap-5">
          <div className="space-y-1.5">
            <Label htmlFor="headline">Titular</Label>
            <Input id="headline" value={headline} onChange={(e) => setHeadline(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="summary">Resumen</Label>
            <Textarea id="summary" rows={4} value={summary} onChange={(e) => setSummary(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="skillDraft">Habilidades</Label>
            <div className="flex flex-wrap gap-2">
              {skills.map((skill) => (
                <Badge key={skill} variant="secondary" className="gap-1.5">
                  {skill}
                  <button
                    type="button"
                    aria-label={`Quitar ${skill}`}
                    onClick={() => setSkills((s) => s.filter((x) => x !== skill))}
                    className="text-ink-muted hover:text-ink"
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-3">
              <Input
                id="skillDraft"
                placeholder="Agrega una habilidad y presiona Enter"
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
                Agregar
              </Button>
            </div>
          </div>
        </div>
      </SummaryEditCard>

      <Card>
        <CardHeader>
          <div>
            <CardTitle className="text-h3 text-ink">Experiencia</CardTitle>
            <CardDescription>Haz clic en una entrada para editarla. La más reciente primero.</CardDescription>
          </div>
          {/* `CardAction` (card.tsx's grid-column-2/justify-self-end slot)
              keeps this button top-right instead of stretching to the
              header's full grid-cell width — see SummaryEditCard's own
              header for the same fix. */}
          <CardAction>
            <Button type="button" variant="outline" size="sm" onClick={handlePullFromProjects} disabled={syncing}>
              {syncing ? "Trayendo…" : "Traer de Proyectos"}
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          {entries.length === 0 && (
            <p className="px-1 pb-2 text-body text-ink-soft">
              Todavía no hay entradas de experiencia. Agrega una manualmente, o usa &quot;Traer de Proyectos&quot;
              cuando tengas proyectos completados en la sección Negocio.
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
                      <span className="text-body text-ink">{entry.title || "Cargo sin título"}</span>
                      {entry.clientName && <span className="text-body text-ink-soft"> · {entry.clientName}</span>}
                      {entry.source === "project" && (
                        <span className="ml-2 font-mono text-[11px] text-ink-muted align-middle">de proyecto</span>
                      )}
                    </div>
                    <div className="shrink-0 font-mono text-[11px] text-ink-muted">{formatEntryDates(entry)}</div>
                  </div>
                }
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Título</Label>
                    <Input value={entry.title} onChange={(e) => updateEntry(index, { title: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Cliente</Label>
                    <Input
                      value={entry.clientName}
                      onChange={(e) => updateEntry(index, { clientName: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Fecha de inicio</Label>
                    <Input
                      type="date"
                      value={entry.startDate}
                      onChange={(e) => updateEntry(index, { startDate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Fecha de fin</Label>
                    <Input
                      type="date"
                      value={entry.endDate}
                      onChange={(e) => updateEntry(index, { endDate: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Descripción</Label>
                  <Textarea
                    rows={3}
                    value={entry.description}
                    onChange={(e) => updateEntry(index, { description: e.target.value })}
                  />
                </div>
                <div>
                  <Button type="button" variant="destructive" size="sm" onClick={() => removeEntry(index)}>
                    Eliminar entrada
                  </Button>
                </div>
              </CollapsibleEntryRow>
            );
          })}
          <div className="pt-3">
            <Button type="button" variant="outline" onClick={addEntry}>
              + Agregar entrada
            </Button>
          </div>
        </CardContent>
      </Card>

      {saveStatus.status === "error" && (
        <InlineNotice variant="danger" title="ERROR" description={saveStatus.errorMessage ?? "No se pudo guardar. Intenta de nuevo."} />
      )}

      <div className="flex flex-wrap items-center gap-4">
        <Button type="button" onClick={handleSave} disabled={!dirty || saveStatus.status === "saving"}>
          {saveStatus.status === "saving" ? "Guardando…" : "Guardar hoja de vida"}
        </Button>

        <Button type="button" variant="outline" onClick={handleExport} disabled={exportState === "generating"}>
          {exportState === "generating" ? "Generando PDF…" : "Exportar PDF"}
        </Button>
        {exportState === "done" && pdfUrl && (
          <a href={pdfUrl} target="_blank" rel="noreferrer" className="font-mono text-[11px] text-accent underline">
            Descargar PDF
          </a>
        )}
        {exportState === "error" && <span className="font-mono text-[11px] text-danger">La exportación falló — intenta de nuevo.</span>}
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
            <AlertDialogTitle>{aiStatus.byokConnected ? "Administra tu clave de IA" : "Conecta tu propia clave de IA"}</AlertDialogTitle>
            <AlertDialogDescription>
              {aiStatus.byokConnected
                ? `Conectada: ${aiStatus.byokKeyHint}. Desconéctala para volver a las importaciones gratis mensuales de FreeOps.`
                : "Usa tu propia clave de API de Anthropic para importar currículums — sin límite mensual, facturado a tu propia cuenta de Anthropic."}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="flex flex-col gap-4">
            <InlineNotice
              title="VERIFICACIÓN REQUERIDA"
              description={`Confirma tu contraseña para ${aiStatus.byokConnected ? "desconectar" : "conectar"} esta clave.`}
            />

            {!aiStatus.byokConnected && (
              <div className="space-y-1.5">
                <Label htmlFor="byokApiKey">Clave de API de Anthropic</Label>
                <Input
                  id="byokApiKey"
                  placeholder="sk-ant-..."
                  value={byokApiKey}
                  onChange={(e) => setByokApiKey(e.target.value)}
                  autoComplete="off"
                  className="font-mono text-data-mono"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="byokPassword">Confirma tu contraseña</Label>
              <Input
                id="byokPassword"
                type="password"
                autoComplete="current-password"
                value={byokPassword}
                onChange={(e) => setByokPassword(e.target.value)}
              />
            </div>

            {byokError && <p className="font-mono text-[11px] text-danger">{byokError}</p>}
          </div>

          <AlertDialogFooter>
            <Button type="button" variant="outline" onClick={() => setByokDialogOpen(false)}>
              Cancelar
            </Button>
            {aiStatus.byokConnected ? (
              <Button type="button" variant="destructive" onClick={handleDisconnectByok} disabled={byokStatus === "saving"}>
                {byokStatus === "saving" ? "Desconectando…" : "Desconectar"}
              </Button>
            ) : (
              <Button type="button" onClick={handleConnectByok} disabled={byokStatus === "saving" || !byokApiKey}>
                {byokStatus === "saving" ? "Conectando…" : "Conectar clave"}
              </Button>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
