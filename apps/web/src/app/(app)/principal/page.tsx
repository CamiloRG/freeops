import { SectionPlaceholder } from "@/components/layout/section-placeholder";

export default function PrincipalPage() {
  return (
    <SectionPlaceholder
      title="Principal"
      description="Un tablero de inicio con lo que necesitas atender hoy — tareas, deals y facturas."
      phase="Aún no construido"
      screens={[
        "Tareas por vencer (kanban)",
        "Deals que necesitan seguimiento (CRM)",
        "Cuentas de cobro por emitir (Finanzas — pendiente)",
        "Bandeja por proyecto (necesita integración de correo)",
      ]}
    />
  );
}
