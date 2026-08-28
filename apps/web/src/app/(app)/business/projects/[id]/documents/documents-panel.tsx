"use client";

import { useRef, useState } from "react";
import { FileText } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

type DocumentType = "executed_contract" | "amendment" | "appendix" | "change_order";

interface ContractDocument {
  id: string;
  type: DocumentType;
  label: string;
  fileName: string;
  fileUrl: string;
  fileSizeBytes: number | null;
  uploadedAt: string;
}

const DOCUMENT_TYPE_LABEL: Record<DocumentType, string> = {
  executed_contract: "Contrato firmado",
  amendment: "Otrosí",
  appendix: "Anexo",
  change_order: "Orden de cambio",
};

function formatSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });
}

function fileExt(fileName: string) {
  return fileName.split(".").pop()?.toUpperCase() ?? "";
}

/**
 * Business / Documentos — NOT pixel-mocked (only Personal's Profile/
 * Banking are). Restyled onto the exact same DIAN two-step delete
 * convention Stage 2's `tax-info-form.tsx` established for its own
 * document list (same Spanish copy: "¿Eliminar este documento?" title,
 * "Cancelar"/"Eliminar de todos modos" buttons, plain `AlertDialogAction`
 * with no destructive-red override) and the same "Tables / record lists"
 * whitespace-separated row convention (no `rounded-lg border` box, no
 * file-input pill — `hover:bg-surface-sunken` per row instead).
 */
export function DocumentsPanel({
  projectId,
  initialDocuments,
}: {
  projectId: string;
  initialDocuments: ContractDocument[];
}) {
  const [docs, setDocs] = useState(initialDocuments);
  const [uploadType, setUploadType] = useState<DocumentType>("executed_contract");
  const [label, setLabel] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; warning: string; confirmUrl: string } | null>(
    null
  );

  async function handleUpload() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setUploadError("Elige un archivo primero.");
      return;
    }
    if (!label.trim()) {
      setUploadError("Ingresa una etiqueta para este documento.");
      return;
    }
    setUploading(true);
    setUploadError(null);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", uploadType);
    formData.append("label", label.trim());
    const res = await fetch(`/api/v1/projects/${projectId}/documents`, { method: "POST", body: formData });
    const body = await res.json().catch(() => null);
    setUploading(false);
    if (!res.ok) {
      setUploadError(body?.error?.message ?? "No se pudo subir el archivo.");
      return;
    }
    setDocs((d) => [
      {
        id: body.id,
        type: body.type,
        label: body.label,
        fileName: file.name,
        fileUrl: body.fileUrl,
        fileSizeBytes: body.fileSizeBytes,
        uploadedAt: body.uploadedAt,
      },
      ...d,
    ]);
    setLabel("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function requestDelete(docId: string) {
    const res = await fetch(`/api/v1/projects/${projectId}/documents/${docId}`, { method: "DELETE" });
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
      <Card>
        <CardHeader>
          <CardTitle className="text-h3 text-ink">Documentos del proyecto</CardTitle>
          <CardDescription>
            Contratos firmados, otrosíes, anexos y órdenes de cambio (PDF/DOCX, máx. 25MB). Solo consulta — no
            es firma electrónica.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="rounded-tile bg-surface-sunken p-4">
            <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
              <Select value={uploadType} onValueChange={(v) => setUploadType(v as DocumentType)}>
                <SelectTrigger className="w-full bg-surface">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="executed_contract">Contrato firmado</SelectItem>
                  <SelectItem value="amendment">Otrosí</SelectItem>
                  <SelectItem value="appendix">Anexo</SelectItem>
                  <SelectItem value="change_order">Orden de cambio</SelectItem>
                </SelectContent>
              </Select>
              <div className="space-y-1.5">
                <Label htmlFor="doc-label" className="sr-only">
                  Etiqueta del documento
                </Label>
                <Input
                  id="doc-label"
                  placeholder="Etiqueta, p. ej. 'Contrato de prestación de servicios'"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  className="bg-surface"
                />
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx"
              disabled={uploading}
              className="mt-3 w-full text-body-sm text-ink-soft file:mr-3 file:rounded-pill file:border-0 file:bg-surface file:px-3 file:py-1.5 file:font-sans file:text-ui-sm file:text-ink disabled:opacity-60"
              onChange={handleUpload}
            />
            {uploading && <p className="mt-2 text-[12px] text-ink-muted">Subiendo…</p>}
            {uploadError && <p className="mt-2 font-mono text-[11px] text-danger">{uploadError}</p>}
          </div>

          {docs.length === 0 ? (
            <p className="text-body-sm text-ink-soft">Todavía no hay documentos subidos.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-body-sm">
                <thead>
                  <tr className="font-mono text-label-mono tracking-[0.14em] text-ink-muted uppercase">
                    <th className="pb-2 font-normal">Documento</th>
                    <th className="pb-2 font-normal">Tipo</th>
                    <th className="pb-2 font-normal">Fecha</th>
                    <th className="pb-2 font-normal" />
                  </tr>
                </thead>
                <tbody>
                  {docs.map((doc) => (
                    <tr key={doc.id} className="border-t border-line-soft">
                      <td className="py-3 pr-4">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-[8px] bg-accent-tint text-accent-press">
                            <FileText className="size-4" aria-hidden="true" />
                          </span>
                          <div className="min-w-0">
                            <a
                              href={`/api/v1/projects/${projectId}/documents/${doc.id}/download`}
                              target="_blank"
                              rel="noreferrer"
                              className="block truncate font-medium text-ink hover:text-accent"
                            >
                              {doc.label}
                            </a>
                            <div className="font-mono text-[11px] text-ink-muted">
                              {fileExt(doc.fileName)}
                              {doc.fileSizeBytes != null && ` · ${formatSize(doc.fileSizeBytes)}`}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-ink-soft">{DOCUMENT_TYPE_LABEL[doc.type]}</td>
                      <td className="py-3 pr-4 text-ink-soft">{formatDate(doc.uploadedAt)}</td>
                      <td className="py-3 text-right">
                        <Button type="button" variant="ghost" size="sm" onClick={() => requestDelete(doc.id)}>
                          Eliminar
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
