"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { bankingUpsertSchema } from "@/lib/validation/personal";
import type { BankingMasked } from "@/lib/services/banking";

const emptyDraft = {
  bankName: "",
  accountType: "savings" as "savings" | "checking",
  accountNumber: "",
  accountHolderName: "",
  accountHolderTaxId: "",
  currentPassword: "",
};

export function BankingForm({ current }: { current: BankingMasked | null }) {
  const [saved, setSaved] = useState(current);
  const [editing, setEditing] = useState(!current);
  const [draft, setDraft] = useState(emptyDraft);
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});

  function set<K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = bankingUpsertSchema.safeParse(draft);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
      setErrors(fieldErrors);
      setStatus("error");
      return;
    }
    setErrors({});
    setStatus("saving");

    const res = await fetch("/api/v1/me/banking", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setStatus("error");
      setErrors(
        res.status === 401
          ? { currentPassword: body?.error?.message ?? "Re-authentication failed." }
          : {}
      );
      return;
    }

    const result: BankingMasked = await res.json();
    setSaved(result);
    setDraft(emptyDraft);
    setEditing(false);
    setStatus("idle");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Banking details</CardTitle>
        <CardDescription>
          Used to receive payments. Your full account number is encrypted at rest and never shown
          again after saving — only the last 4 digits are displayed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {saved && !editing && (
          <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <span className="text-muted-foreground">Bank</span>
                <p className="font-medium">{saved.bankName}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Account type</span>
                <p className="font-medium capitalize">{saved.accountType}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Account number</span>
                <p className="font-medium">{saved.accountNumberMasked}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Account holder</span>
                <p className="font-medium">{saved.accountHolderName}</p>
              </div>
            </div>
            <Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => setEditing(true)}>
              Edit banking details
            </Button>
          </div>
        )}

        {editing && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning-foreground">
              For your security, confirm your password to save changes to banking details.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="bankName">Bank name</Label>
                <Input
                  id="bankName"
                  value={draft.bankName}
                  onChange={(e) => set("bankName", e.target.value)}
                  aria-invalid={!!errors.bankName}
                />
                {errors.bankName && <p className="text-xs text-destructive">{errors.bankName}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="accountType">Account type</Label>
                <Select value={draft.accountType} onValueChange={(v) => set("accountType", v as "savings" | "checking")}>
                  <SelectTrigger id="accountType" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="savings">Ahorros (savings)</SelectItem>
                    <SelectItem value="checking">Corriente (checking)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="accountNumber">Account number</Label>
                <Input
                  id="accountNumber"
                  value={draft.accountNumber}
                  onChange={(e) => set("accountNumber", e.target.value)}
                  aria-invalid={!!errors.accountNumber}
                />
                {errors.accountNumber && <p className="text-xs text-destructive">{errors.accountNumber}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="accountHolderName">Account holder name</Label>
                <Input
                  id="accountHolderName"
                  value={draft.accountHolderName}
                  onChange={(e) => set("accountHolderName", e.target.value)}
                  aria-invalid={!!errors.accountHolderName}
                />
                {errors.accountHolderName && (
                  <p className="text-xs text-destructive">{errors.accountHolderName}</p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="accountHolderTaxId">Account holder tax ID (optional)</Label>
              <Input
                id="accountHolderTaxId"
                value={draft.accountHolderTaxId}
                onChange={(e) => set("accountHolderTaxId", e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="currentPassword">Confirm your password</Label>
              <Input
                id="currentPassword"
                type="password"
                autoComplete="current-password"
                value={draft.currentPassword}
                onChange={(e) => set("currentPassword", e.target.value)}
                aria-invalid={!!errors.currentPassword}
              />
              {errors.currentPassword && (
                <p className="text-xs text-destructive">{errors.currentPassword}</p>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Button type="submit" disabled={status === "saving"}>
                {status === "saving" ? "Saving…" : "Save banking details"}
              </Button>
              {saved && (
                <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              )}
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
