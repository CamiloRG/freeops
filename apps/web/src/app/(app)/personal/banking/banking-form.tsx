"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InlineNotice } from "@/components/ui/inline-notice";
import { SaveStatusLine } from "@/components/ui/save-status-line";
import { SummaryEditCard } from "@/components/personal/summary-edit-card";
import { SummaryField, SummaryGrid } from "@/components/personal/summary-grid";
import { PageHeader } from "@/components/layout/page-header";
import { useEditToggle } from "@/components/personal/use-edit-toggle";
import { useSaveStatus } from "@/hooks/use-save-status";
import { bankingUpsertSchema } from "@/lib/validation/personal";
import type { BankingMasked } from "@/lib/services/banking";

const ACCOUNT_TYPE_LABEL: Record<"savings" | "checking", string> = {
  savings: "Ahorros",
  checking: "Corriente",
};

const emptyDraft = {
  bankName: "",
  accountType: "savings" as "savings" | "checking",
  accountNumber: "",
  accountHolderName: "",
  accountHolderTaxId: "",
  currentPassword: "",
};

/**
 * Personal / Banca — the second screen pixel-mocked in the design handoff
 * (README "Screens" → "4. App — Personal / Banking"). The top-right status
 * defaults to the static "cifrado en reposo" accent label until a save
 * actually succeeds this session, per the mock and this stage's own
 * instructions — it then hands off permanently to `<SaveStatusLine>`'s
 * `guardado HH:MM`. Step-up re-authentication (password confirm) is
 * untouched — only the shell around it was restyled.
 */
export function BankingForm({ current }: { current: BankingMasked | null }) {
  const [saved, setSaved] = useState(current);
  const { editing, setEditing, toggle } = useEditToggle(!current);
  const [draft, setDraft] = useState(emptyDraft);
  const saveStatus = useSaveStatus();
  const [errors, setErrors] = useState<Record<string, string>>({});

  function set<K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function handleToggle() {
    if (editing && saved) {
      setDraft(emptyDraft);
      setErrors({});
      saveStatus.reset();
    }
    toggle();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = bankingUpsertSchema.safeParse(draft);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
      setErrors(fieldErrors);
      saveStatus.markError();
      return;
    }
    setErrors({});
    saveStatus.markSaving();

    const res = await fetch("/api/v1/me/banking", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      const message = body?.error?.message ?? "No se pudo verificar tu contraseña.";
      setErrors(res.status === 401 ? { currentPassword: message } : {});
      saveStatus.markError(message);
      return;
    }

    const result: BankingMasked = await res.json();
    setSaved(result);
    setDraft(emptyDraft);
    setEditing(false);
    saveStatus.markSaved();
  }

  return (
    <div className="flex flex-col gap-9">
    <PageHeader
      title="Información bancaria"
      description="Cuentas que se adjuntan automáticamente a tus cuentas de cobro."
    />
    <SummaryEditCard
      title="Datos bancarios"
      description={
        <span className="max-w-[460px] text-caption text-ink-muted">
          Se usan para recibir pagos. Guardamos el número cifrado; después de guardar solo verás los últimos 4
          dígitos.
        </span>
      }
      editing={editing}
      onToggleEdit={handleToggle}
      cancelLabel={null}
      contentClassName="pt-[28px]"
      summary={
        saved ? (
          <SummaryGrid>
            <SummaryField label="Banco" value={saved.bankName} />
            <SummaryField label="Tipo de cuenta" value={ACCOUNT_TYPE_LABEL[saved.accountType]} />
            <SummaryField label="Número de cuenta" value={saved.accountNumberMasked} mono />
            <SummaryField label="Titular de la cuenta" value={saved.accountHolderName} />
          </SummaryGrid>
        ) : (
          <p className="text-body text-ink-soft">Todavía no hay datos bancarios guardados.</p>
        )
      }
    >
      <form onSubmit={handleSubmit}>
        <SummaryGrid>
          <div className="space-y-1.5">
            <Label htmlFor="bankName">Banco</Label>
            <Input
              id="bankName"
              value={draft.bankName}
              onChange={(e) => set("bankName", e.target.value)}
              aria-invalid={!!errors.bankName}
            />
            {errors.bankName && <p className="mt-1.5 font-mono text-[11px] text-danger">{errors.bankName}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="accountType">Tipo de cuenta</Label>
            <Select value={draft.accountType} onValueChange={(v) => set("accountType", v as "savings" | "checking")}>
              <SelectTrigger id="accountType" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="savings">Ahorros</SelectItem>
                <SelectItem value="checking">Corriente</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="accountNumber">Número de cuenta</Label>
            <Input
              id="accountNumber"
              value={draft.accountNumber}
              onChange={(e) => set("accountNumber", e.target.value)}
              aria-invalid={!!errors.accountNumber}
              className="font-mono text-data-mono"
            />
            {errors.accountNumber && (
              <p className="mt-1.5 font-mono text-[11px] text-danger">{errors.accountNumber}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="accountHolderName">Titular de la cuenta</Label>
            <Input
              id="accountHolderName"
              value={draft.accountHolderName}
              onChange={(e) => set("accountHolderName", e.target.value)}
              aria-invalid={!!errors.accountHolderName}
            />
            {errors.accountHolderName && (
              <p className="mt-1.5 font-mono text-[11px] text-danger">{errors.accountHolderName}</p>
            )}
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="accountHolderTaxId">NIT/Cédula del titular — opcional</Label>
            <Input
              id="accountHolderTaxId"
              value={draft.accountHolderTaxId}
              onChange={(e) => set("accountHolderTaxId", e.target.value)}
            />
          </div>
        </SummaryGrid>

        <InlineNotice
          title="VERIFICACIÓN REQUERIDA"
          description="Confirma tu contraseña para modificar datos bancarios."
          className="mt-[28px]"
        >
          <div className="mt-3 max-w-[280px] space-y-1.5">
            <Input
              id="currentPassword"
              type="password"
              autoComplete="current-password"
              value={draft.currentPassword}
              onChange={(e) => set("currentPassword", e.target.value)}
              aria-invalid={!!errors.currentPassword}
            />
            {errors.currentPassword && (
              <p className="font-mono text-[11px] text-danger">{errors.currentPassword}</p>
            )}
          </div>
        </InlineNotice>

        {saveStatus.status === "error" && !errors.currentPassword && (
          <InlineNotice
            variant="danger"
            title="ERROR"
            description={saveStatus.errorMessage ?? "No se pudo guardar. Intenta de nuevo."}
            className="mt-[26px]"
          />
        )}

        <div className="mt-[26px] flex items-center gap-4">
          <Button type="submit" disabled={!draft.currentPassword || saveStatus.status === "saving"}>
            {saveStatus.status === "saving" ? "Guardando…" : "Guardar datos bancarios"}
          </Button>
          {saved && (
            <Button type="button" variant="ghost" onClick={handleToggle}>
              Cancelar
            </Button>
          )}
          {saveStatus.status === "saved" ? (
            <SaveStatusLine status={saveStatus} className="ml-auto" />
          ) : (
            <span className="ml-auto font-mono text-[11px] text-accent">cifrado en reposo</span>
          )}
        </div>
      </form>
    </SummaryEditCard>
    </div>
  );
}
