import { SectionPlaceholder } from "@/components/layout/section-placeholder";

/**
 * Not actually unbuilt — BYOK connect/disconnect is a real, working
 * feature today, just still located on the Hoja de vida screen (where it
 * was built alongside AI resume import) rather than here. Relocating it
 * is real work (extracting a step-up-password-gated dialog cleanly), so
 * it's deliberately left where it is for this pass — this page just
 * points people to it rather than duplicating or half-porting it.
 */
export default function SettingsByokPage() {
  return (
    <SectionPlaceholder
      title="BYOK"
      description="Usa tu propia clave de Anthropic para las extracciones con IA."
      phase="Ya existe — pendiente de mover aquí"
      screens={["Conectar/gestionar tu clave: por ahora en Personal → Hoja de vida"]}
    />
  );
}
