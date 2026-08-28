import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/**
 * Facturación — shown in the new project-detail mocks with real cuentas-
 * de-cobro data (emitidas/pagadas/por cobrar, a per-invoice table). None
 * of that exists yet: invoicing is Finance's own Phase 7, not built. Kept
 * as an honest placeholder rather than fabricated numbers, same call as
 * the top-level `/finance` placeholder this project already has.
 */
export default function ProjectBillingPage() {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-body-sm">Próximamente — Fase 7 (Finanzas)</CardTitle>
        <Badge variant="secondary">Aún no construido</Badge>
      </CardHeader>
      <CardContent>
        <p className="text-body-sm text-ink-soft">
          Cuentas de cobro emitidas para este proyecto, pagos recibidos, saldo pendiente y facturación por
          periodo — depende del módulo de Finanzas, que aún no está construido.
        </p>
        <ul className="mt-3 list-inside list-disc space-y-1.5 text-body-sm text-ink-soft">
          <li>Generador de cuentas de cobro</li>
          <li>Seguimiento de pagos y saldo por cobrar</li>
          <li>Historial de facturación por periodo</li>
        </ul>
      </CardContent>
    </Card>
  );
}
