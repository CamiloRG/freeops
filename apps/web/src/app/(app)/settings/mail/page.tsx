import { SectionPlaceholder } from "@/components/layout/section-placeholder";

export default function SettingsMailPage() {
  return (
    <SectionPlaceholder
      title="Correo"
      description="Cuentas conectadas y reglas de clasificación por proyecto."
      phase="Aún no construido"
      screens={["Conectar Gmail / Microsoft 365", "Reglas de clasificación por remitente"]}
    />
  );
}
