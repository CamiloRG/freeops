"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { InlineNotice } from "@/components/ui/inline-notice";
import { SaveStatusLine } from "@/components/ui/save-status-line";
import { SummaryEditCard } from "@/components/personal/summary-edit-card";
import { SummaryField, SummaryGrid } from "@/components/personal/summary-grid";
import { useEditToggle } from "@/components/personal/use-edit-toggle";
import { useSaveStatus } from "@/hooks/use-save-status";
import { isDirty } from "@/lib/form-dirty";
import { profileUpdateSchema } from "@/lib/validation/personal";
import { usePersonalHeaderStatus } from "../personal-header-context";

interface ProfileFormValues {
  fullName: string;
  displayName: string;
  phone: string;
  city: string;
  country: string;
  headline: string;
  bio: string;
}

/**
 * Personal / Perfil — one of the two screens pixel-mocked in the design
 * handoff (README "Screens" → "3. App — Personal / Profile"). Fields,
 * grid layout, and action row match the mock exactly; the collapsed
 * "Editar" button (SummaryEditCard's header, shown when not editing) is
 * an extrapolation the mock doesn't capture — its own frozen frame only
 * shows the editing state.
 */
export function ProfileForm({ initial }: { initial: ProfileFormValues }) {
  const [saved, setSaved] = useState(initial);
  const [values, setValues] = useState(initial);
  const { editing, setEditing, toggle } = useEditToggle(false);
  const saveStatus = useSaveStatus();
  const [errors, setErrors] = useState<Record<string, string>>({});

  usePersonalHeaderStatus(<SaveStatusLine status={saveStatus} />);

  const dirty = isDirty(values, saved);

  function set<K extends keyof ProfileFormValues>(key: K, value: ProfileFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function handleToggle() {
    if (editing) {
      // Cancel — discard any unsaved edits.
      setValues(saved);
      setErrors({});
      saveStatus.reset();
    }
    toggle();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = profileUpdateSchema.safeParse(values);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        fieldErrors[String(issue.path[0])] = issue.message;
      }
      setErrors(fieldErrors);
      saveStatus.markError();
      return;
    }
    setErrors({});
    saveStatus.markSaving();
    const res = await fetch("/api/v1/me/profile", {
      method: "PATCH",
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

  return (
    <SummaryEditCard
      title={<span className="text-h2 font-medium text-ink">Perfil y datos personales</span>}
      description={<span className="text-caption text-ink-muted">Aparecen en cada documento que generas.</span>}
      editing={editing}
      onToggleEdit={handleToggle}
      cancelLabel={null}
      contentClassName="pt-[30px]"
      summary={
        <SummaryGrid>
          <SummaryField label="Nombre completo" value={saved.fullName} />
          <SummaryField label="Nombre visible" value={saved.displayName} />
          <SummaryField label="Teléfono" value={saved.phone} mono />
          <SummaryField label="Ciudad" value={saved.city} />
          <SummaryField label="Titular" value={saved.headline} full />
          <SummaryField label="Bio" value={saved.bio} full />
        </SummaryGrid>
      }
    >
      <form onSubmit={handleSubmit}>
        <SummaryGrid>
          <div className="space-y-1.5">
            <Label htmlFor="fullName">Nombre completo</Label>
            <Input
              id="fullName"
              value={values.fullName}
              onChange={(e) => set("fullName", e.target.value)}
              aria-invalid={!!errors.fullName}
            />
            {errors.fullName && <p className="mt-1.5 font-mono text-[11px] text-danger">{errors.fullName}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="displayName">Nombre visible</Label>
            <Input
              id="displayName"
              placeholder="Opcional — se muestra en vez del nombre completo"
              value={values.displayName}
              onChange={(e) => set("displayName", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Teléfono</Label>
            <Input
              id="phone"
              placeholder="+57 300 000 0000"
              value={values.phone}
              onChange={(e) => set("phone", e.target.value)}
              aria-invalid={!!errors.phone}
              className="font-mono text-data-mono"
            />
            {errors.phone && <p className="mt-1.5 font-mono text-[11px] text-danger">{errors.phone}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="city">Ciudad</Label>
            <Input id="city" value={values.city} onChange={(e) => set("city", e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="headline">Titular</Label>
            <Input
              id="headline"
              placeholder="p. ej. Desarrollador full-stack & consultor de producto"
              value={values.headline}
              onChange={(e) => set("headline", e.target.value)}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              rows={4}
              value={values.bio}
              onChange={(e) => set("bio", e.target.value)}
              aria-invalid={!!errors.bio}
            />
            {errors.bio && <p className="mt-1.5 font-mono text-[11px] text-danger">{errors.bio}</p>}
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
        </div>
      </form>
    </SummaryEditCard>
  );
}
