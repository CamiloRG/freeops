import { SectionPlaceholder } from "@/components/layout/section-placeholder";

export default function SettingsCalendarPage() {
  return (
    <SectionPlaceholder
      title="Calendario"
      description="Conecta tu calendario para agendar reuniones y sesiones de booking."
      phase="Fase 8"
      screens={["Conexión con Google Calendar / Microsoft Graph", "Enlace de agenda pública"]}
    />
  );
}
