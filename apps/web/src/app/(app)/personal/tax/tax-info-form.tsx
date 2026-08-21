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
import { SummaryEditCard } from "@/components/personal/summary-edit-card";
import { SummaryField, SummaryGrid } from "@/components/personal/summary-grid";
import { useEditToggle } from "@/components/personal/use-edit-toggle";
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
  other: "Other",
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
  if (!taxIdNumber) return "—";
  const last4 = taxIdNumber.slice(-4);
  return `••• ${last4}`;
}

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
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [docs, setDocs] = useState(documents);
  const [uploadType, setUploadType] = useState<TaxDocument["type"]>("rut");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; warning: string; confirmUrl: string } | null>(
    null
  );

  function set<K extends keyof TaxInfoValues>(key: K, value: TaxInfoValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
    setStatus("idle");
  }

  function handleToggle() {
    if (editing && saved) {
      setValues(saved);
      setErrors({});
      setStatus("idle");
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
      setStatus("error");
      return;
    }
    setErrors({});
    setStatus("saving");
    const res = await fetch("/api/v1/me/tax-info", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    });
    if (!res.ok) {
      setStatus("error");
      return;
    }
    setStatus("saved");
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
      setUploadError(body?.error?.message ?? "Upload failed.");
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
    <div className="space-y-6">
      <SummaryEditCard
        title="Tax information"
        description="Your tax ID and DIAN-relevant details, used on generated documents."
        editing={editing}
        onToggleEdit={handleToggle}
        cancelLabel={saved ? "Cancel" : null}
        summary={
          saved ? (
            <SummaryGrid>
              <SummaryField label="Tax ID type" value={saved.taxIdType} />
              <SummaryField label="Tax ID number" value={maskTaxId(saved.taxIdNumber)} />
              <SummaryField label="Tax regime" value={saved.taxRegime ? TAX_REGIME_LABEL[saved.taxRegime] : "—"} />
              <SummaryField label="IVA responsible" value={saved.isIvaResponsible ? "Yes" : "No"} />
              <SummaryField label="Gran contribuyente" value={saved.isGranContribuyente ? "Yes" : "No"} />
              <SummaryField label="CIIU code" value={saved.ciiuCode || "—"} />
            </SummaryGrid>
          ) : (
            <p className="text-sm text-muted-foreground">No tax information saved yet.</p>
          )
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="taxIdType">Tax ID type</Label>
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
              <Label htmlFor="taxIdNumber">Tax ID number</Label>
              <Input
                id="taxIdNumber"
                value={values.taxIdNumber}
                onChange={(e) => set("taxIdNumber", e.target.value)}
                aria-invalid={!!errors.taxIdNumber}
              />
              {errors.taxIdNumber && <p className="text-xs text-destructive">{errors.taxIdNumber}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="taxRegime">Tax regime</Label>
            <Select
              value={values.taxRegime ?? undefined}
              onValueChange={(v) => set("taxRegime", v as TaxRegime)}
            >
              <SelectTrigger id="taxRegime" className="w-full">
                <SelectValue placeholder="Select a regime" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="regimen_simple">Régimen Simple</SelectItem>
                <SelectItem value="regimen_ordinario">Régimen Ordinario</SelectItem>
                <SelectItem value="no_responsable">No responsable</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:gap-8">
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
              <Label htmlFor="isIvaResponsible">IVA responsible</Label>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ciiuCode">CIIU code</Label>
              <Input id="ciiuCode" value={values.ciiuCode} onChange={(e) => set("ciiuCode", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fiscalAddress">Fiscal address</Label>
              <Input
                id="fiscalAddress"
                value={values.fiscalAddress}
                onChange={(e) => set("fiscalAddress", e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button type="submit" disabled={status === "saving"}>
              {status === "saving" ? "Saving…" : "Save tax information"}
            </Button>
            {/* No inline "Saved." message — a successful save collapses this
                form back to the summary view, and the refreshed summary IS
                the confirmation (same convention as Banking). */}
            {status === "error" && Object.keys(errors).length === 0 && (
              <span className="text-sm text-destructive">Couldn&apos;t save — try again.</span>
            )}
          </div>
        </form>
      </SummaryEditCard>

      <Card>
        <CardHeader>
          <CardTitle>Supporting documents</CardTitle>
          <CardDescription>Upload your RUT, Cámara de Comercio, or other tax documents (PDF/JPG/PNG/DOCX, ≤10MB).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Select value={uploadType} onValueChange={(v) => setUploadType(v as TaxDocument["type"])}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rut">RUT</SelectItem>
                <SelectItem value="camara_comercio">Cámara de Comercio</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.docx"
              className="w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium"
            />
            <Button type="button" onClick={handleUpload} disabled={uploading}>
              {uploading ? "Uploading…" : "Upload"}
            </Button>
          </div>
          {uploadError && <p className="text-sm text-destructive">{uploadError}</p>}

          {docs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {docs.map((doc) => (
                <li key={doc.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Badge variant="secondary">{DOCUMENT_TYPE_LABEL[doc.type]}</Badge>
                    <a href={doc.fileUrl} target="_blank" rel="noreferrer" className="truncate text-primary hover:underline">
                      {doc.fileName}
                    </a>
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => requestDelete(doc.id)}>
                    Delete
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
            <AlertDialogTitle>Delete this document?</AlertDialogTitle>
            <AlertDialogDescription>{pendingDelete?.warning}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete anyway</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
