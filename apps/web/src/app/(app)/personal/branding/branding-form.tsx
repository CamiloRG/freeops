"use client";

import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { brandingUpdateSchema } from "@/lib/validation/personal";

interface BrandingValues {
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
}

export function BrandingForm({ initial, fullName }: { initial: BrandingValues; fullName: string }) {
  const [values, setValues] = useState(initial);
  const [colorStatus, setColorStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [logoStatus, setLogoStatus] = useState<"idle" | "uploading" | "error">("idle");
  const [logoError, setLogoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function saveColors(e: React.FormEvent) {
    e.preventDefault();
    const parsed = brandingUpdateSchema.safeParse({
      primaryColor: values.primaryColor,
      secondaryColor: values.secondaryColor,
    });
    if (!parsed.success) {
      setColorStatus("error");
      return;
    }
    setColorStatus("saving");
    const res = await fetch("/api/v1/me/branding", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    });
    setColorStatus(res.ok ? "saved" : "error");
  }

  async function handleLogoUpload() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;
    setLogoStatus("uploading");
    setLogoError(null);
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/v1/me/branding/logo", { method: "POST", body: formData });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      setLogoStatus("error");
      setLogoError(body?.error?.message ?? "Upload failed.");
      return;
    }
    setValues((v) => ({ ...v, logoUrl: body.logoUrl }));
    setLogoStatus("idle");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleLogoDelete() {
    await fetch("/api/v1/me/branding/logo", { method: "DELETE" });
    setValues((v) => ({ ...v, logoUrl: null }));
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Logo</CardTitle>
          <CardDescription>PNG, JPG, or SVG, up to 5MB. Applied to generated cuentas de cobro and invoices.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
              {values.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={values.logoUrl} alt="Logo" className="size-full object-contain" />
              ) : (
                <span className="text-xs text-muted-foreground">No logo</span>
              )}
            </div>
            <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
              <input
                ref={fileInputRef}
                type="file"
                accept=".png,.jpg,.jpeg,.svg"
                className="w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium"
              />
              <div className="flex gap-2">
                <Button type="button" onClick={handleLogoUpload} disabled={logoStatus === "uploading"}>
                  {logoStatus === "uploading" ? "Uploading…" : "Upload"}
                </Button>
                {values.logoUrl && (
                  <Button type="button" variant="outline" onClick={handleLogoDelete}>
                    Remove
                  </Button>
                )}
              </div>
            </div>
          </div>
          {logoError && <p className="text-sm text-destructive">{logoError}</p>}
        </CardContent>
      </Card>

      <form onSubmit={saveColors}>
        <Card>
          <CardHeader>
            <CardTitle>Brand colors</CardTitle>
            <CardDescription>Used alongside your logo on generated documents.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="primaryColor">Primary color</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    aria-label="Primary color picker"
                    value={values.primaryColor}
                    onChange={(e) => setValues((v) => ({ ...v, primaryColor: e.target.value }))}
                    className="size-8 shrink-0 cursor-pointer rounded border border-border"
                  />
                  <Input
                    id="primaryColor"
                    value={values.primaryColor}
                    onChange={(e) => setValues((v) => ({ ...v, primaryColor: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="secondaryColor">Secondary color</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    aria-label="Secondary color picker"
                    value={values.secondaryColor}
                    onChange={(e) => setValues((v) => ({ ...v, secondaryColor: e.target.value }))}
                    className="size-8 shrink-0 cursor-pointer rounded border border-border"
                  />
                  <Input
                    id="secondaryColor"
                    value={values.secondaryColor}
                    onChange={(e) => setValues((v) => ({ ...v, secondaryColor: e.target.value }))}
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={colorStatus === "saving"}>
                {colorStatus === "saving" ? "Saving…" : "Save colors"}
              </Button>
              {colorStatus === "saved" && <span className="text-sm text-success">Saved.</span>}
              {colorStatus === "error" && <span className="text-sm text-destructive">Use a 6-digit hex color.</span>}
            </div>
          </CardContent>
        </Card>
      </form>

      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
          <CardDescription>
            A mock cuenta de cobro header showing how your branding will appear — Finance document
            generation (Phase 7) isn&apos;t built yet, so this is a static preview, not a real document.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-lg border border-border bg-white text-[#1a1a1a] shadow-sm">
            <div
              className="flex items-center justify-between px-6 py-5"
              style={{ backgroundColor: values.primaryColor }}
            >
              <div className="flex items-center gap-3">
                {values.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={values.logoUrl} alt="Logo" className="h-10 w-auto rounded bg-white/90 p-1" />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded bg-white/20 text-xs text-white">
                    Logo
                  </div>
                )}
                <span className="text-lg font-semibold text-white">{fullName}</span>
              </div>
              <span className="text-sm font-medium text-white/90">Cuenta de cobro No. 0001</span>
            </div>
            <div className="space-y-3 px-6 py-5 text-sm">
              <div className="flex justify-between border-b pb-2" style={{ borderColor: values.secondaryColor + "33" }}>
                <span>Client</span>
                <span className="font-medium">Acme Co.</span>
              </div>
              <div className="flex justify-between border-b pb-2" style={{ borderColor: values.secondaryColor + "33" }}>
                <span>Concept</span>
                <span className="font-medium">Professional services</span>
              </div>
              <div className="flex justify-between font-semibold" style={{ color: values.secondaryColor }}>
                <span>Total</span>
                <span>$ 1.500.000 COP</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
