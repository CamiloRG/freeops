import { SectionPlaceholder } from "@/components/layout/section-placeholder";

/**
 * The claro/oscuro toggle already exists (sidebar footer). A live
 * accent-color + radius customizer (per the shared mock: "Ajustes en vivo
 * — todo lo que cambies aquí se aplica de inmediato") is a real runtime-
 * theming feature, not a visual restyle — deliberately not built this
 * pass per the user's own scope call.
 */
export default function SettingsThemePage() {
  return (
    <SectionPlaceholder
      title="Temas"
      description="Ajustes en vivo — todo lo que cambies aquí se aplica de inmediato a la interfaz."
      phase="Aún no construido"
      screens={[
        "Modo claro/oscuro — ya disponible en el pie de la barra lateral",
        "Color de acento personalizable",
        "Redondeo de bordes (suave/normal/amplio)",
      ]}
    />
  );
}
