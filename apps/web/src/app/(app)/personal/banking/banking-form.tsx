"use client";

import { useRef, useState } from "react";
import { Upload, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InlineNotice } from "@/components/ui/inline-notice";
import { AiProcessingCard, type AiProcessingStatus } from "@/components/ai/ai-processing-card";
import { PageHeader } from "@/components/layout/page-header";
import { cn } from "@/lib/utils";
import { bankingCreateSchema, bankingUpdateSchema } from "@/lib/validation/personal";
import type { BankingAccountMasked } from "@/lib/services/banking";

// Real Colombian banks (not fabricated) — the same set a "Selecciona un
// banco" dropdown would realistically offer a freelancer here.
const COLOMBIAN_BANKS = [
  "Bancolombia",
  "Davivienda",
  "Banco de Bogotá",
  "BBVA Colombia",
  "Banco Popular",
  "Banco Caja Social",
  "Scotiabank Colpatria",
  "Banco Agrario de Colombia",
  "Banco AV Villas",
  "Banco Falabella",
  "Banco Pichincha",
  "Nequi",
  "Daviplata",
  "Otro",
];

const ACCOUNT_TYPE_LABEL: Record<"savings" | "checking", string> = {
  savings: "Cuenta de ahorros",
  checking: "Cuenta corriente",
};

const ACCEPTED_CERT_TYPES = "application/pdf,image/png,image/jpeg";

const EXTRACT_STAGES = ["Leyendo tu certificación…", "Extrayendo los datos de la cuenta…", "Casi listo…"];

interface AiExtractStatus {
  byokConnected: boolean;
  /** Remaining default-tier extractions this month; null when BYOK-connected (no cap). */
  remaining: number | null;
  limit: number;
}

interface Draft {
  bankName: string;
  accountType: "savings" | "checking";
  accountNumber: string;
  accountHolderName: string;
  accountHolderTaxId: string;
  currency: string;
  isPrimary: boolean;
  certificateFileKey: string | null;
  certificateFileName: string | null;
  currentPassword: string;
}

const emptyDraft: Draft = {
  bankName: "",
  accountType: "savings",
  accountNumber: "",
  accountHolderName: "",
  accountHolderTaxId: "",
  currency: "COP",
  isPrimary: false,
  certificateFileKey: null,
  certificateFileName: null,
  currentPassword: "",
};

function initials(bankName: string) {
  const parts = bankName.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

/**
 * Personal / Info Bancaria — Aero multi-account rollout. Matches the
 * target screenshot: a card per account (masked number, TITULAR/MONEDA
 * meta row, Principal/Secondaria badge, Editar/Certificación), then an
 * "Agregar cuenta" panel whose upload zone runs the real AI-extraction
 * request through `AiProcessingCard` before pre-filling the manual fields
 * below it — nothing saves until "Guardar cuenta" is clicked.
 *
 * Step-up password re-authentication (required by every create/edit call,
 * see `/api/v1/me/banking`) isn't shown in the mock's "Agregar cuenta"
 * panel — kept anyway as a deliberate own-extension, same as this app's
 * established precedent of never dropping a real security requirement to
 * match a mock's simplified surface.
 */
export function BankingForm({
  initialAccounts,
  aiExtract,
}: {
  initialAccounts: BankingAccountMasked[];
  aiExtract: AiExtractStatus;
}) {
  const [accounts, setAccounts] = useState(initialAccounts);

  // --- "Agregar cuenta" panel state --------------------------------------
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [addErrors, setAddErrors] = useState<Record<string, string>>({});
  const [addStatus, setAddStatus] = useState<"idle" | "saving" | "error">("idle");
  const [addError, setAddError] = useState<string | null>(null);

  const [aiStatus, setAiStatus] = useState(aiExtract);
  const [extractStatus, setExtractStatus] = useState<AiProcessingStatus>("idle");
  const [extractFileName, setExtractFileName] = useState<string | null>(null);
  const [extractError, setExtractError] = useState<string | null>(null);
  const quotaExhausted = !aiStatus.byokConnected && aiStatus.remaining !== null && aiStatus.remaining <= 0;

  // --- Edit dialog state (one account at a time) -------------------------
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(emptyDraft);
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [editStatus, setEditStatus] = useState<"idle" | "saving" | "error">("idle");
  const [editError, setEditError] = useState<string | null>(null);

  // --- Certificate dialog state --------------------------------------------
  const [certAccountId, setCertAccountId] = useState<string | null>(null);
  const [certUrl, setCertUrl] = useState<string | null>(null);
  const [certStatus, setCertStatus] = useState<"idle" | "loading" | "uploading" | "error">("idle");
  const [certError, setCertError] = useState<string | null>(null);
  const certFileInputRef = useRef<HTMLInputElement>(null);

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  async function handleExtract(file: File) {
    setExtractError(null);
    setExtractFileName(file.name);
    setExtractStatus("processing");
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/v1/me/banking/extract", { method: "POST", body: formData });
    const body = await res.json().catch(() => null);

    if (!res.ok || !body) {
      setExtractStatus("error");
      setExtractError(
        body?.error?.message ?? "No pudimos leer esa certificación — prueba con un escaneo/PDF más claro o completa los campos manualmente."
      );
      return;
    }

    setDraft((d) => ({
      ...d,
      bankName: body.bankName ?? d.bankName,
      accountType: body.accountType ?? d.accountType,
      accountNumber: body.accountNumber ?? d.accountNumber,
      accountHolderName: body.accountHolderName ?? d.accountHolderName,
      accountHolderTaxId: body.accountHolderTaxId ?? d.accountHolderTaxId,
      currency: body.currency ?? d.currency,
      certificateFileKey: body.certificateFileKey ?? d.certificateFileKey,
      certificateFileName: body.certificateFileName ?? d.certificateFileName,
    }));

    if (body.quota) {
      setAiStatus((s) => ({ ...s, remaining: s.limit - body.quota.used }));
    }
    setExtractStatus("done");
  }

  function resetAddPanel() {
    setDraft(emptyDraft);
    setAddErrors({});
    setAddStatus("idle");
    setAddError(null);
    setExtractStatus("idle");
    setExtractFileName(null);
    setExtractError(null);
  }

  async function handleSaveNewAccount() {
    const payload = {
      bankName: draft.bankName,
      accountType: draft.accountType,
      accountNumber: draft.accountNumber,
      accountHolderName: draft.accountHolderName,
      accountHolderTaxId: draft.accountHolderTaxId || undefined,
      currency: draft.currency || "COP",
      isPrimary: draft.isPrimary,
      certificateFileKey: draft.certificateFileKey,
      certificateFileName: draft.certificateFileName,
      currentPassword: draft.currentPassword,
    };
    const parsed = bankingCreateSchema.safeParse(payload);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
      setAddErrors(fieldErrors);
      return;
    }
    setAddErrors({});
    setAddStatus("saving");
    setAddError(null);

    const res = await fetch("/api/v1/me/banking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body) {
      setAddStatus("error");
      const message = body?.error?.message ?? "No se pudo guardar la cuenta.";
      setAddError(message);
      if (res.status === 401) setAddErrors({ currentPassword: message });
      return;
    }

    setAccounts((list) => {
      const next = body.isPrimary ? list.map((a) => ({ ...a, isPrimary: false })) : list;
      return [body, ...next];
    });
    resetAddPanel();
  }

  function openEdit(account: BankingAccountMasked) {
    setEditingId(account.id);
    setEditDraft({
      bankName: account.bankName,
      accountType: account.accountType,
      accountNumber: "",
      accountHolderName: account.accountHolderName,
      accountHolderTaxId: "",
      currency: account.currency,
      isPrimary: account.isPrimary,
      certificateFileKey: null,
      certificateFileName: null,
      currentPassword: "",
    });
    setEditErrors({});
    setEditStatus("idle");
    setEditError(null);
  }

  async function handleSaveEdit() {
    if (!editingId) return;
    const payload = {
      bankName: editDraft.bankName,
      accountType: editDraft.accountType,
      accountNumber: editDraft.accountNumber,
      accountHolderName: editDraft.accountHolderName,
      accountHolderTaxId: editDraft.accountHolderTaxId || undefined,
      currency: editDraft.currency || "COP",
      isPrimary: editDraft.isPrimary,
      currentPassword: editDraft.currentPassword,
    };
    const parsed = bankingUpdateSchema.safeParse(payload);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
      setEditErrors(fieldErrors);
      return;
    }
    setEditErrors({});
    setEditStatus("saving");
    setEditError(null);

    const res = await fetch(`/api/v1/me/banking/${editingId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body) {
      setEditStatus("error");
      const message = body?.error?.message ?? "No se pudo guardar. Intenta de nuevo.";
      setEditError(message);
      if (res.status === 401) setEditErrors({ currentPassword: message });
      return;
    }

    setAccounts((list) => {
      const next = body.isPrimary ? list.map((a) => ({ ...a, isPrimary: false })) : list;
      return next.map((a) => (a.id === body.id ? body : a));
    });
    setEditingId(null);
  }

  function openCertificate(account: BankingAccountMasked) {
    setCertAccountId(account.id);
    setCertUrl(null);
    setCertError(null);
    if (account.hasCertificate) {
      setCertStatus("loading");
      fetch(`/api/v1/me/banking/${account.id}/certificate`)
        .then((res) => res.json())
        .then((body) => {
          setCertUrl(body?.fileUrl ?? null);
          setCertStatus("idle");
        })
        .catch(() => setCertStatus("idle"));
    } else {
      setCertStatus("idle");
    }
  }

  async function handleUploadCertificate(file: File) {
    if (!certAccountId) return;
    setCertStatus("uploading");
    setCertError(null);
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`/api/v1/me/banking/${certAccountId}/certificate`, { method: "POST", body: formData });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body) {
      setCertStatus("error");
      setCertError(body?.error?.message ?? "No se pudo subir el archivo.");
      return;
    }
    setAccounts((list) => list.map((a) => (a.id === body.id ? body : a)));
    setCertStatus("loading");
    const urlRes = await fetch(`/api/v1/me/banking/${certAccountId}/certificate`);
    const urlBody = await urlRes.json().catch(() => null);
    setCertUrl(urlBody?.fileUrl ?? null);
    setCertStatus("idle");
  }

  const editingAccount = accounts.find((a) => a.id === editingId) ?? null;
  const certAccount = accounts.find((a) => a.id === certAccountId) ?? null;

  return (
    <div className="flex flex-col gap-9">
      <PageHeader title="Información bancaria" description="Cuentas que se adjuntan automáticamente a tus cuentas de cobro." />

      {accounts.length > 0 && (
        <div className="grid gap-5 sm:grid-cols-2">
          {accounts.map((account) => (
            <Card key={account.id} className={cn(account.isPrimary && "border-accent")}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-tint text-[11px] font-semibold text-accent-press">
                    {initials(account.bankName)}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-body-sm font-semibold text-ink">{account.bankName}</div>
                    <div className="truncate text-[12px] text-ink-muted">{ACCOUNT_TYPE_LABEL[account.accountType]}</div>
                  </div>
                </div>
                <Badge variant={account.isPrimary ? "default" : "secondary"}>
                  {account.isPrimary ? "Principal" : "Secundaria"}
                </Badge>
              </div>

              <div className="mt-4 font-mono text-h3 text-ink">{account.accountNumberMasked}</div>

              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-line-soft pt-3">
                <div>
                  <div className="font-mono text-[10px] tracking-wide text-ink-muted uppercase">Titular</div>
                  <div className="truncate text-[13px] text-ink">{account.accountHolderName}</div>
                </div>
                <div>
                  <div className="font-mono text-[10px] tracking-wide text-ink-muted uppercase">Moneda</div>
                  <div className="text-[13px] text-ink">{account.currency}</div>
                </div>
              </div>

              <div className="mt-4 flex gap-3">
                <Button type="button" variant="outline" size="sm" onClick={() => openEdit(account)}>
                  Editar
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => openCertificate(account)}>
                  Certificación
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <div>
          <h3 className="text-h3 text-ink">Agregar cuenta</h3>
          <p className="mt-1 text-caption text-ink-soft">
            Sube la certificación bancaria y el motor de FreeOps extrae los datos por ti.
          </p>
        </div>

        <div className="mt-5 flex flex-col gap-4">
          <AiProcessingCard
            status={extractStatus}
            stages={EXTRACT_STAGES}
            fileName={extractFileName ?? undefined}
            idle={
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={quotaExhausted}
                className="flex w-full items-center justify-between gap-3 rounded-tile border border-dashed border-line bg-surface-sunken p-4 text-left transition-colors duration-fast ease-out hover:border-accent/40 disabled:pointer-events-none disabled:opacity-60"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-accent text-white">
                    <Upload className="size-4" aria-hidden="true" />
                  </span>
                  <div>
                    <div className="text-body-sm font-medium text-ink">Subir certificación bancaria</div>
                    <div className="text-caption text-ink-soft">Arrastra el PDF y haz clic para buscarlo · máx. 10 MB</div>
                  </div>
                </div>
                <span className="shrink-0 text-[13px] font-medium text-accent">Extracción con IA</span>
              </button>
            }
            done={
              <div className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-3 rounded-tile bg-positive-tint p-4">
                <div className="flex min-w-0 items-start gap-3">
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-positive-ink" aria-hidden="true" />
                  <div>
                    <div className="text-body-sm font-medium text-positive-ink">Datos extraídos — revísalos abajo</div>
                    <div className="text-caption text-ink-soft">{extractFileName}</div>
                  </div>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                  Subir otra
                </Button>
              </div>
            }
            error={
              <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-3 rounded-tile bg-critical-tint p-4">
                <div>
                  <div className="text-body-sm font-medium text-critical-ink">No pudimos leer esa certificación</div>
                  <div className="text-caption text-ink-soft">{extractError}</div>
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
            accept={ACCEPTED_CERT_TYPES}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) handleExtract(file);
            }}
          />

          {aiStatus.byokConnected ? (
            <Badge variant="secondary">Usando tu propia clave de Anthropic</Badge>
          ) : (
            aiStatus.remaining !== null && (
              <Badge variant="secondary">
                {aiStatus.remaining} de {aiStatus.limit} extracciones gratis restantes este mes
              </Badge>
            )
          )}
          {quotaExhausted && (
            <InlineNotice
              title="LÍMITE ALCANZADO"
              description="Ya usaste todas tus extracciones gratis de certificación bancaria este mes — conecta tu propia clave de Anthropic desde Hoja de vida para seguir sin límite, o completa los campos manualmente."
            />
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="add-bankName">Banco</Label>
              <Select value={draft.bankName} onValueChange={(v) => set("bankName", v)}>
                <SelectTrigger id="add-bankName" className="w-full" aria-invalid={!!addErrors.bankName}>
                  <SelectValue placeholder="Selecciona un banco" />
                </SelectTrigger>
                <SelectContent>
                  {COLOMBIAN_BANKS.map((bank) => (
                    <SelectItem key={bank} value={bank}>
                      {bank}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {addErrors.bankName && <p className="font-mono text-[11px] text-danger">{addErrors.bankName}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="add-accountType">Tipo de cuenta</Label>
              <Select value={draft.accountType} onValueChange={(v) => set("accountType", v as "savings" | "checking")}>
                <SelectTrigger id="add-accountType" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="savings">Ahorros</SelectItem>
                  <SelectItem value="checking">Corriente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="add-accountNumber">Número de cuenta</Label>
              <Input
                id="add-accountNumber"
                value={draft.accountNumber}
                onChange={(e) => set("accountNumber", e.target.value)}
                aria-invalid={!!addErrors.accountNumber}
                className="font-mono text-data-mono"
              />
              {addErrors.accountNumber && <p className="font-mono text-[11px] text-danger">{addErrors.accountNumber}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="add-accountHolderName">Titular</Label>
              <Input
                id="add-accountHolderName"
                value={draft.accountHolderName}
                onChange={(e) => set("accountHolderName", e.target.value)}
                aria-invalid={!!addErrors.accountHolderName}
              />
              {addErrors.accountHolderName && (
                <p className="font-mono text-[11px] text-danger">{addErrors.accountHolderName}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="add-accountHolderTaxId">Documento del titular</Label>
              <Input
                id="add-accountHolderTaxId"
                value={draft.accountHolderTaxId}
                onChange={(e) => set("accountHolderTaxId", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="add-currency">Moneda</Label>
              <Input id="add-currency" value={draft.currency} onChange={(e) => set("currency", e.target.value)} />
            </div>
          </div>

          {accounts.length > 0 && (
            <label className="flex items-center gap-2 text-[13px] text-ink-soft">
              <input
                type="checkbox"
                checked={draft.isPrimary}
                onChange={(e) => set("isPrimary", e.target.checked)}
                className="size-4 rounded-[4px] border-line"
              />
              Marcar como cuenta principal
            </label>
          )}

          <InlineNotice title="VERIFICACIÓN REQUERIDA" description="Confirma tu contraseña para guardar esta cuenta.">
            <div className="mt-3 max-w-[280px] space-y-1.5">
              <Input
                id="add-currentPassword"
                type="password"
                autoComplete="current-password"
                value={draft.currentPassword}
                onChange={(e) => set("currentPassword", e.target.value)}
                aria-invalid={!!addErrors.currentPassword}
              />
              {addErrors.currentPassword && <p className="font-mono text-[11px] text-danger">{addErrors.currentPassword}</p>}
            </div>
          </InlineNotice>

          {addStatus === "error" && !addErrors.currentPassword && (
            <InlineNotice variant="danger" title="ERROR" description={addError ?? "No se pudo guardar. Intenta de nuevo."} />
          )}

          <div className="flex items-center gap-4">
            <Button type="button" onClick={handleSaveNewAccount} disabled={!draft.currentPassword || addStatus === "saving"}>
              {addStatus === "saving" ? "Guardando…" : "Guardar cuenta"}
            </Button>
            <Button type="button" variant="ghost" onClick={resetAddPanel}>
              Cancelar
            </Button>
          </div>
        </div>
      </Card>

      {/* --- Edit dialog ------------------------------------------------ */}
      <Dialog open={!!editingId} onOpenChange={(open) => !open && setEditingId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar {editingAccount?.bankName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="edit-bankName">Banco</Label>
                <Select value={editDraft.bankName} onValueChange={(v) => setEditDraft((d) => ({ ...d, bankName: v }))}>
                  <SelectTrigger id="edit-bankName" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COLOMBIAN_BANKS.map((bank) => (
                      <SelectItem key={bank} value={bank}>
                        {bank}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-accountType">Tipo de cuenta</Label>
                <Select
                  value={editDraft.accountType}
                  onValueChange={(v) => setEditDraft((d) => ({ ...d, accountType: v as "savings" | "checking" }))}
                >
                  <SelectTrigger id="edit-accountType" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="savings">Ahorros</SelectItem>
                    <SelectItem value="checking">Corriente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-accountNumber">Nuevo número de cuenta</Label>
              <Input
                id="edit-accountNumber"
                placeholder={`Actual: ${editingAccount?.accountNumberMasked ?? ""}`}
                value={editDraft.accountNumber}
                onChange={(e) => setEditDraft((d) => ({ ...d, accountNumber: e.target.value }))}
                aria-invalid={!!editErrors.accountNumber}
                className="font-mono text-data-mono"
              />
              {editErrors.accountNumber && <p className="font-mono text-[11px] text-danger">{editErrors.accountNumber}</p>}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="edit-accountHolderName">Titular</Label>
                <Input
                  id="edit-accountHolderName"
                  value={editDraft.accountHolderName}
                  onChange={(e) => setEditDraft((d) => ({ ...d, accountHolderName: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-currency">Moneda</Label>
                <Input
                  id="edit-currency"
                  value={editDraft.currency}
                  onChange={(e) => setEditDraft((d) => ({ ...d, currency: e.target.value }))}
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-[13px] text-ink-soft">
              <input
                type="checkbox"
                checked={editDraft.isPrimary}
                onChange={(e) => setEditDraft((d) => ({ ...d, isPrimary: e.target.checked }))}
                className="size-4 rounded-[4px] border-line"
              />
              Cuenta principal
            </label>

            <InlineNotice title="VERIFICACIÓN REQUERIDA" description="Confirma tu contraseña para modificar esta cuenta.">
              <div className="mt-3 max-w-[280px] space-y-1.5">
                <Input
                  id="edit-currentPassword"
                  type="password"
                  autoComplete="current-password"
                  value={editDraft.currentPassword}
                  onChange={(e) => setEditDraft((d) => ({ ...d, currentPassword: e.target.value }))}
                  aria-invalid={!!editErrors.currentPassword}
                />
                {editErrors.currentPassword && (
                  <p className="font-mono text-[11px] text-danger">{editErrors.currentPassword}</p>
                )}
              </div>
            </InlineNotice>

            {editStatus === "error" && !editErrors.currentPassword && (
              <InlineNotice variant="danger" title="ERROR" description={editError ?? "No se pudo guardar. Intenta de nuevo."} />
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setEditingId(null)}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleSaveEdit} disabled={!editDraft.currentPassword || editStatus === "saving"}>
              {editStatus === "saving" ? "Guardando…" : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- Certificate dialog ------------------------------------------ */}
      <Dialog open={!!certAccountId} onOpenChange={(open) => !open && setCertAccountId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Certificación — {certAccount?.bankName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {certStatus === "loading" && <p className="text-body-sm text-ink-soft">Cargando…</p>}
            {certUrl && certStatus !== "loading" && (
              <a
                href={certUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-block font-mono text-[12px] text-accent underline"
              >
                Ver certificación actual
              </a>
            )}
            {!certAccount?.hasCertificate && certStatus === "idle" && (
              <p className="text-body-sm text-ink-soft">Todavía no hay una certificación guardada para esta cuenta.</p>
            )}
            {certError && <p className="font-mono text-[11px] text-danger">{certError}</p>}
            <input
              ref={certFileInputRef}
              type="file"
              accept={ACCEPTED_CERT_TYPES}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) handleUploadCertificate(file);
              }}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => certFileInputRef.current?.click()}
              disabled={certStatus === "uploading"}
            >
              {certStatus === "uploading" ? "Subiendo…" : certAccount?.hasCertificate ? "Reemplazar archivo" : "Subir certificación"}
            </Button>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setCertAccountId(null)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
