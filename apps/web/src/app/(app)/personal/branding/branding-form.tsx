"use client";

import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { InlineNotice } from "@/components/ui/inline-notice";
import { SaveStatusLine } from "@/components/ui/save-status-line";
import { SummaryEditCard } from "@/components/personal/summary-edit-card";
import { useEditToggle } from "@/components/personal/use-edit-toggle";
import { useSaveStatus } from "@/hooks/use-save-status";
import { isDirty } from "@/lib/form-dirty";
import { brandingUpdateSchema } from "@/lib/validation/personal";
import { usePersonalHeaderStatus } from "../personal-header-context";

interface BrandingValues {
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
}

/**
 * Personal / Marca — NOT pixel-mocked in the design handoff. Extrapolated
 * onto the same tokens/patterns as Profile/Banking. The logo/swatch
 * summary is a bespoke layout (per the ADR's own note that Branding's
 * summary doesn't use `SummaryGrid`) rather than a label/value grid, since
 * a color swatch + logo thumbnail don't fit that shape. The logo preview
 * box and the cuenta-de-cobro mock-document preview each keep a single
 * `1px --line` hairline as a functional boundary (an image/document
 * preview needs some visible edge to read as a bounded object) — the same
 * narrow exception Stage 1 already made for Dialog/AlertDialog surfaces,
 * not a new deviation.
 */
export function BrandingForm({ initial, fullName }: { initial: BrandingValues; fullName: string }) {
  const [values, setValues] = useState(initial);
  const [savedColors, setSavedColors] = useState({
    primaryColor: initial.primaryColor,
    secondaryColor: initial.secondaryColor,
  });
  const { editing, setEditing, toggle } = useEditToggle(false);
  const saveStatus = useSaveStatus();
  const [logoStatus, setLogoStatus] = useState<"idle" | "uploading" | "error">("idle");
  const [logoError, setLogoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  usePersonalHeaderStatus(<SaveStatusLine status={saveStatus} />);

  const dirty = isDirty(
    { primaryColor: values.primaryColor, secondaryColor: values.secondaryColor },
    savedColors
  );

  function handleToggle() {
    if (editing) {
      // Cancel — discard unsaved color edits (logo changes already saved on upload).
      setValues((v) => ({ ...v, ...savedColors }));
      saveStatus.reset();
    }
    toggle();
  }

  async function saveColors(e: React.FormEvent) {
    e.preventDefault();
    const parsed = brandingUpdateSchema.safeParse({
      primaryColor: values.primaryColor,
      secondaryColor: values.secondaryColor,
    });
    if (!parsed.success) {
      saveStatus.markError("Usa un color hexadecimal de 6 dígitos.");
      return;
    }
    saveStatus.markSaving();
    const res = await fetch("/api/v1/me/branding", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    });
    if (!res.ok) {
      saveStatus.markError("No se pudo guardar. Intenta de nuevo.");
      return;
    }
    saveStatus.markSaved();
    setSavedColors({ primaryColor: values.primaryColor, secondaryColor: values.secondaryColor });
    setEditing(false);
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
      setLogoError(body?.error?.message ?? "No se pudo subir el archivo.");
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
    <div className="flex flex-col gap-9">
      <SummaryEditCard
        title={<span className="text-h2 font-medium text-ink">Logo y colores de marca</span>}
        description={
          <span className="text-caption text-ink-muted">Se aplican a las cuentas de cobro y facturas que generas.</span>
        }
        editing={editing}
        onToggleEdit={handleToggle}
        cancelLabel={null}
        contentClassName="pt-[28px]"
        summary={
          <div className="flex flex-wrap items-center gap-8">
            <div className="flex size-14 shrink-0 items-center justify-center border border-line bg-surface-sunken">
              {values.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={values.logoUrl} alt="Logo" className="size-full object-contain" />
              ) : (
                <span className="font-mono text-[10px] text-ink-faint">Sin logo</span>
              )}
            </div>
            <div className="flex gap-8">
              <div>
                <div className="font-mono text-label-mono tracking-[0.06em] text-ink-muted uppercase">Primario</div>
                <div className="mt-[6px] flex items-center gap-2">
                  <span className="size-3.5 shrink-0 border border-line" style={{ backgroundColor: values.primaryColor }} />
                  <span className="font-mono text-data-mono text-ink">{values.primaryColor}</span>
                </div>
              </div>
              <div>
                <div className="font-mono text-label-mono tracking-[0.06em] text-ink-muted uppercase">Secundario</div>
                <div className="mt-[6px] flex items-center gap-2">
                  <span className="size-3.5 shrink-0 border border-line" style={{ backgroundColor: values.secondaryColor }} />
                  <span className="font-mono text-data-mono text-ink">{values.secondaryColor}</span>
                </div>
              </div>
            </div>
          </div>
        }
      >
        <div className="flex flex-col gap-7">
          <div>
            <Label className="mb-2">Logo</Label>
            <div className="flex items-center gap-4">
              <div className="flex size-16 shrink-0 items-center justify-center border border-line bg-surface-sunken">
                {values.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={values.logoUrl} alt="Logo" className="size-full object-contain" />
                ) : (
                  <span className="font-mono text-[10px] text-ink-faint">Sin logo</span>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".png,.jpg,.jpeg,.svg"
                  className="w-full text-body text-ink-soft file:mr-3 file:border-0 file:bg-transparent file:font-sans file:text-ui file:text-ink"
                />
                <div className="flex gap-3">
                  <Button type="button" size="sm" onClick={handleLogoUpload} disabled={logoStatus === "uploading"}>
                    {logoStatus === "uploading" ? "Subiendo…" : "Subir"}
                  </Button>
                  {values.logoUrl && (
                    <Button type="button" variant="outline" size="sm" onClick={handleLogoDelete}>
                      Quitar
                    </Button>
                  )}
                </div>
              </div>
            </div>
            {logoError && <p className="mt-2 font-mono text-[11px] text-danger">{logoError}</p>}
            <p className="mt-2 text-caption text-ink-muted">PNG, JPG o SVG, hasta 5MB.</p>
          </div>

          <form onSubmit={saveColors} className="flex flex-col gap-6">
            <div className="grid max-w-[440px] grid-cols-1 gap-x-11 gap-y-[26px] sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="primaryColor">Color primario</Label>
                <div className="flex items-center gap-2.5">
                  <input
                    type="color"
                    aria-label="Selector de color primario"
                    value={values.primaryColor}
                    onChange={(e) => setValues((v) => ({ ...v, primaryColor: e.target.value }))}
                    className="size-8 shrink-0 cursor-pointer border border-line"
                  />
                  <Input
                    id="primaryColor"
                    value={values.primaryColor}
                    onChange={(e) => setValues((v) => ({ ...v, primaryColor: e.target.value }))}
                    className="font-mono text-data-mono"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="secondaryColor">Color secundario</Label>
                <div className="flex items-center gap-2.5">
                  <input
                    type="color"
                    aria-label="Selector de color secundario"
                    value={values.secondaryColor}
                    onChange={(e) => setValues((v) => ({ ...v, secondaryColor: e.target.value }))}
                    className="size-8 shrink-0 cursor-pointer border border-line"
                  />
                  <Input
                    id="secondaryColor"
                    value={values.secondaryColor}
                    onChange={(e) => setValues((v) => ({ ...v, secondaryColor: e.target.value }))}
                    className="font-mono text-data-mono"
                  />
                </div>
              </div>
            </div>

            {saveStatus.status === "error" && (
              <InlineNotice variant="danger" title="ERROR" description={saveStatus.errorMessage} />
            )}

            <div className="flex items-center gap-4">
              <Button type="submit" disabled={!dirty || saveStatus.status === "saving"}>
                {saveStatus.status === "saving" ? "Guardando…" : "Guardar colores"}
              </Button>
              <Button type="button" variant="ghost" onClick={handleToggle}>
                Descartar
              </Button>
            </div>
          </form>
        </div>
      </SummaryEditCard>

      <Card>
        <CardHeader>
          <CardTitle className="text-h3 text-ink">Vista previa</CardTitle>
          <CardDescription>
            Un encabezado de cuenta de cobro simulado que muestra cómo se verá tu marca — la generación de
            documentos de Finanzas todavía no está construida, así que esto es una vista previa estática, no un
            documento real.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden border border-line bg-white text-[#1a1a1a]">
            <div className="flex items-center justify-between px-6 py-5" style={{ backgroundColor: values.primaryColor }}>
              <div className="flex items-center gap-3">
                {values.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={values.logoUrl} alt="Logo" className="h-10 w-auto bg-white/90 p-1" />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center bg-white/20 font-mono text-[10px] text-white">
                    Logo
                  </div>
                )}
                <span className="text-lg font-semibold text-white">{fullName}</span>
              </div>
              <span className="font-mono text-[11px] text-white/90">Cuenta de cobro No. 0001</span>
            </div>
            <div className="space-y-3 px-6 py-5 text-body-sm">
              <div className="flex justify-between border-b pb-2" style={{ borderColor: values.secondaryColor + "33" }}>
                <span>Cliente</span>
                <span className="font-medium">Acme Co.</span>
              </div>
              <div className="flex justify-between border-b pb-2" style={{ borderColor: values.secondaryColor + "33" }}>
                <span>Concepto</span>
                <span className="font-medium">Servicios profesionales</span>
              </div>
              <div className="flex justify-between font-mono font-semibold" style={{ color: values.secondaryColor }}>
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
