"use client";

import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { InlineNotice } from "@/components/ui/inline-notice";
import { SaveStatusLine } from "@/components/ui/save-status-line";
import { SummaryEditCard } from "@/components/personal/summary-edit-card";
import { SummaryField, SummaryGrid } from "@/components/personal/summary-grid";
import { PageHeader } from "@/components/layout/page-header";
import { useEditToggle } from "@/components/personal/use-edit-toggle";
import { useSaveStatus } from "@/hooks/use-save-status";
import { isDirty } from "@/lib/form-dirty";
import { taxInfoUpsertSchema } from "@/lib/validation/personal";

type TaxIdType = "CC" | "NIT" | "CE" | "Pasaporte";
type TaxRegime = "regimen_simple" | "regimen_ordinario" | "no_responsable";

interface TaxInfoValues {
  taxIdType: TaxIdType;
  taxIdNumber: string;
  taxRegime: TaxRegime | null;
  isGranContribuyente: boolean;
  isIvaResponsible: boolean;
  ciiuCode: string;
  fiscalAddress: string;
}

interface TaxDocument {
  id: string;
  type: "rut" | "camara_comercio" | "other";
  fileName: string;
  fileUrl: string;
  uploadedAt: string;
}

const DOCUMENT_TYPE_LABEL: Record<TaxDocument["type"], string> = {
  rut: "RUT",
  camara_comercio: "Cámara de Comercio",
  other: "Otro",
};

const TAX_REGIME_LABEL: Record<TaxRegime, string> = {
  regimen_simple: "Régimen Simple",
  regimen_ordinario: "Régimen Ordinario",
  no_responsable: "No responsable",
};

const EMPTY_VALUES: TaxInfoValues = {
  taxIdType: "NIT",
  taxIdNumber: "",
  taxRegime: null,
  isGranContribuyente: false,
  isIvaResponsible: false,
  ciiuCode: "",
  fiscalAddress: "",
};

function maskTaxId(taxIdNumber: string) {
  if (!taxIdNumber) return "";
  const last4 = taxIdNumber.slice(-4);
  return `••• ${last4}`;
}

/**
 * Personal / Tributario — NOT pixel-mocked in the design handoff (only
 * Profile and Banking are). Extrapolated using the exact same tokens,
 * `SummaryEditCard`/`SummaryGrid` field-grid conventions, `SaveStatusLine`/
 * `InlineNotice` save-feedback pattern, and Spanish copy the two mocked
 * screens establish — field labels/layout below are this stage's own
 * judgment call, not invented visual patterns. RUT/Cámara de Comercio/NIT
 * terminology matches what's already used elsewhere in this codebase.
 */
export function TaxInfoForm({
  initial,
  documents,
}: {
  initial: TaxInfoValues | null;
  documents: TaxDocument[];
}) {
  const [saved, setSaved] = useState<TaxInfoValues | null>(initial);
  const [values, setValues] = useState<TaxInfoValues>(initial ?? EMPTY_VALUES);
  const { editing, setEditing, toggle } = useEditToggle(!initial);
  const saveStatus = useSaveStatus();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [docs, setDocs] = useState(documents);
  const [uploadType, setUploadType] = useState<TaxDocument["type"]>("rut");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; warning: string; confirmUrl: string } | null>(
    null
  );

  const dirty = isDirty(values, saved ?? EMPTY_VALUES);

  function set<K extends keyof TaxInfoValues>(key: K, value: TaxInfoValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function handleToggle() {
    if (editing && saved) {
      setValues(saved);
      setErrors({});
      saveStatus.reset();
    }
    toggle();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = taxInfoUpsertSchema.safeParse(values);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
      setErrors(fieldErrors);
      saveStatus.markError();
      return;
    }
    setErrors({});
    saveStatus.markSaving();
    const res = await fetch("/api/v1/me/tax-info", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    });
    if (!res.ok) {
      saveStatus.markError("No se pudo guardar. Intenta de nuevo.");
      return;
    }
    saveStatus.markSaved();
    setSaved(values);
    setEditing(false);
  }

  async function handleUpload() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", uploadType);
    const res = await fetch("/api/v1/me/tax-info/documents", { method: "POST", body: formData });
    const body = await res.json().catch(() => null);
    setUploading(false);
    if (!res.ok) {
      setUploadError(body?.error?.message ?? "No se pudo subir el archivo.");
      return;
    }
    setDocs((d) => [
      { id: body.id, type: body.type, fileName: file.name, fileUrl: body.fileUrl, uploadedAt: body.uploadedAt },
      ...d,
    ]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function requestDelete(docId: string) {
    const res = await fetch(`/api/v1/me/tax-info/documents/${docId}`, { method: "DELETE" });
    if (res.status === 204) {
      setDocs((d) => d.filter((doc) => doc.id !== docId));
      return;
    }
    const body = await res.json().catch(() => null);
    if (body?.confirmUrl) {
      setPendingDelete({ id: docId, warning: body.warning, confirmUrl: body.confirmUrl });
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const res = await fetch(pendingDelete.confirmUrl, { method: "DELETE" });
    if (res.status === 204) {
      setDocs((d) => d.filter((doc) => doc.id !== pendingDelete.id));
    }
    setPendingDelete(null);
  }

  return (
    <div className="flex flex-col gap-9">
      <PageHeader
        title="Información tributaria"
        description="Datos del RUT y responsabilidades fiscales aplicadas a tu facturación."
      />
      <SummaryEditCard
        title="Identificación"
        editing={editing}
        onToggleEdit={handleToggle}
        cancelLabel={null}
        contentClassName="pt-[28px]"
        summary={
          saved ? (
            <SummaryGrid>
              <SummaryField label="Tipo de identificación" value={saved.taxIdType} />
              <SummaryField label="Número de identificación" value={maskTaxId(saved.taxIdNumber)} mono />
              <SummaryField label="Régimen tributario" value={saved.taxRegime ? TAX_REGIME_LABEL[saved.taxRegime] : ""} />
              <SummaryField label="Responsable de IVA" value={saved.isIvaResponsible ? "Sí" : "No"} />
              <SummaryField label="Gran contribuyente" value={saved.isGranContribuyente ? "Sí" : "No"} />
              <SummaryField label="Código CIIU" value={saved.ciiuCode} />
            </SummaryGrid>
          ) : (
            <p className="text-body text-ink-soft">Todavía no hay información tributaria guardada.</p>
          )
        }
      >
        <form onSubmit={handleSubmit}>
          <SummaryGrid>
            <div className="space-y-1.5">
              <Label htmlFor="taxIdType">Tipo de identificación</Label>
              <Select value={values.taxIdType} onValueChange={(v) => set("taxIdType", v as TaxIdType)}>
                <SelectTrigger id="taxIdType" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CC">Cédula de ciudadanía (CC)</SelectItem>
                  <SelectItem value="NIT">NIT</SelectItem>
                  <SelectItem value="CE">Cédula de extranjería (CE)</SelectItem>
                  <SelectItem value="Pasaporte">Pasaporte</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="taxIdNumber">Número de identificación</Label>
              <Input
                id="taxIdNumber"
                value={values.taxIdNumber}
                onChange={(e) => set("taxIdNumber", e.target.value)}
                aria-invalid={!!errors.taxIdNumber}
                className="font-mono text-data-mono"
              />
              {errors.taxIdNumber && <p className="mt-1.5 font-mono text-[11px] text-danger">{errors.taxIdNumber}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="taxRegime">Régimen tributario</Label>
              <Select value={values.taxRegime ?? undefined} onValueChange={(v) => set("taxRegime", v as TaxRegime)}>
                <SelectTrigger id="taxRegime" className="w-full">
                  <SelectValue placeholder="Selecciona un régimen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="regimen_simple">Régimen Simple</SelectItem>
                  <SelectItem value="regimen_ordinario">Régimen Ordinario</SelectItem>
                  <SelectItem value="no_responsable">No responsable</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ciiuCode">Código CIIU</Label>
              <Input id="ciiuCode" value={values.ciiuCode} onChange={(e) => set("ciiuCode", e.target.value)} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="fiscalAddress">Dirección fiscal</Label>
              <Input
                id="fiscalAddress"
                value={values.fiscalAddress}
                onChange={(e) => set("fiscalAddress", e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2.5">
              <Switch
                id="isGranContribuyente"
                checked={values.isGranContribuyente}
                onCheckedChange={(v) => set("isGranContribuyente", v)}
              />
              <Label htmlFor="isGranContribuyente">Gran contribuyente</Label>
            </div>
            <div className="flex items-center gap-2.5">
              <Switch
                id="isIvaResponsible"
                checked={values.isIvaResponsible}
                onCheckedChange={(v) => set("isIvaResponsible", v)}
              />
              <Label htmlFor="isIvaResponsible">Responsable de IVA</Label>
            </div>
          </SummaryGrid>

          {saveStatus.status === "error" && (
            <InlineNotice
              variant="danger"
              title="ERROR"
              description={saveStatus.errorMessage ?? "Revisa los campos marcados."}
              className="mt-[26px]"
            />
          )}

          <div className="mt-8 flex items-center gap-4">
            <Button type="submit" disabled={!dirty || saveStatus.status === "saving"}>
              {saveStatus.status === "saving" ? "Guardando…" : "Guardar"}
            </Button>
            <Button type="button" variant="ghost" onClick={handleToggle}>
              Descartar
            </Button>
            <SaveStatusLine status={saveStatus} className="ml-auto" />
          </div>
        </form>
      </SummaryEditCard>

      <Card>
        <CardHeader>
          <CardTitle className="text-h3 text-ink">Documentos de soporte</CardTitle>
          <CardDescription>
            Sube tu RUT, Cámara de Comercio, u otros documentos tributarios (PDF/JPG/PNG/DOCX, máx. 10MB).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Select value={uploadType} onValueChange={(v) => setUploadType(v as TaxDocument["type"])}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rut">RUT</SelectItem>
                <SelectItem value="camara_comercio">Cámara de Comercio</SelectItem>
                <SelectItem value="other">Otro</SelectItem>
              </SelectContent>
            </Select>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.docx"
              className="w-full text-body text-ink-soft file:mr-3 file:border-0 file:bg-transparent file:font-sans file:text-ui file:text-ink"
            />
            <Button type="button" onClick={handleUpload} disabled={uploading}>
              {uploading ? "Subiendo…" : "Subir"}
            </Button>
          </div>
          {uploadError && <p className="font-mono text-[11px] text-danger">{uploadError}</p>}

          {docs.length === 0 ? (
            <p className="text-body text-ink-soft">Todavía no hay documentos subidos.</p>
          ) : (
            <ul>
              {docs.map((doc) => (
                <li
                  key={doc.id}
                  className="flex items-center justify-between gap-3 px-1 py-[14px] text-body-sm transition-colors duration-fast ease-out hover:bg-surface-sunken"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Badge variant="secondary">{DOCUMENT_TYPE_LABEL[doc.type]}</Badge>
                    <a href={doc.fileUrl} target="_blank" rel="noreferrer" className="truncate text-ink underline decoration-line underline-offset-2 hover:text-accent">
                      {doc.fileName}
                    </a>
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => requestDelete(doc.id)}>
                    Eliminar
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este documento?</AlertDialogTitle>
            <AlertDialogDescription>{pendingDelete?.warning}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Eliminar de todos modos</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
