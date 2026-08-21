"use client";

import { useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  executed_contract: "Executed contract",
  amendment: "Amendment",
  appendix: "Appendix",
  change_order: "Change order",
};

function formatSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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
      setUploadError("Choose a file first.");
      return;
    }
    if (!label.trim()) {
      setUploadError("Enter a label for this document.");
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
      setUploadError(body?.error?.message ?? "Upload failed.");
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
          <CardTitle>Contract & amendment documents</CardTitle>
          <CardDescription>
            Executed contracts, amendments, appendices, and change orders (PDF/DOCX, ≤25MB). Viewing only —
            not e-signature.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-[160px_1fr]">
            <Select value={uploadType} onValueChange={(v) => setUploadType(v as DocumentType)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="executed_contract">Executed contract</SelectItem>
                <SelectItem value="amendment">Amendment</SelectItem>
                <SelectItem value="appendix">Appendix</SelectItem>
                <SelectItem value="change_order">Change order</SelectItem>
              </SelectContent>
            </Select>
            <div className="space-y-1.5">
              <Label htmlFor="doc-label" className="sr-only">
                Document label
              </Label>
              <Input
                id="doc-label"
                placeholder="Label, e.g. 'Master services agreement'"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx"
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
                    <a
                      href={`/api/v1/projects/${projectId}/documents/${doc.id}/download`}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate text-primary hover:underline"
                    >
                      {doc.label}
                    </a>
                    {doc.fileSizeBytes != null && (
                      <span className="shrink-0 text-xs text-muted-foreground">{formatSize(doc.fileSizeBytes)}</span>
                    )}
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
