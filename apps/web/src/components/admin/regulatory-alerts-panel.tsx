"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface RegulatoryAlertItem {
  id: string;
  country: string;
  effectiveFrom: string;
  sourceReference: string | null;
  createdAt: string;
  config: unknown;
}

/**
 * Top-priority "new/updated normativa needs review" banner for `/admin` —
 * fed by `@/lib/admin/regulatory-alerts`'s `getOpenRegulatoryConfigAlerts`
 * (server-fetched, passed in as `initialAlerts`), same SSR-props-then-
 * hydrate pattern `PilaWizard` uses for its own history. Every alert here
 * exists because a Postgres trigger raised it on `regulatory_config_versions`
 * insert (migration `0020`) — this panel is purely the review/acknowledge
 * surface, it never creates alerts itself. Renders nothing when there are
 * no open alerts.
 */
export function RegulatoryAlertsPanel({ initialAlerts }: { initialAlerts: RegulatoryAlertItem[] }) {
  const [alerts, setAlerts] = useState(initialAlerts);
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function acknowledge(id: string) {
    setAcknowledgingId(id);
    setError(null);
    const res = await fetch(`/api/v1/admin/regulatory-config-alerts/${id}/acknowledge`, { method: "POST" });
    setAcknowledgingId(null);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error?.message ?? "No se pudo marcar como revisado — intenta de nuevo.");
      return;
    }
    setAlerts((arr) => arr.filter((a) => a.id !== id));
  }

  if (alerts.length === 0) return null;

  return (
    <section className="mb-12 rounded-tile bg-critical-tint px-6 py-5">
      <div className="flex items-center gap-2 text-[15px] font-semibold text-critical-ink">
        <AlertTriangle className="size-4" aria-hidden="true" />
        Nueva normativa detectada — revisión requerida ({alerts.length})
      </div>
      <p className="mt-1 max-w-measure text-body-sm text-ink-soft">
        Cada fila corresponde a una versión de normatividad recién insertada (p. ej. por el seed de{" "}
        <span className="font-mono text-data-mono">packages/rules-engine</span>). Revísala contra la fuente citada
        antes de marcarla como revisada — esto no valida el contenido automáticamente, solo confirma que un humano
        la vio.
      </p>
      <div className="mt-4 space-y-4">
        {alerts.map((alert) => (
          <div key={alert.id} className="rounded-tile bg-paper px-4 py-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-mono text-body-sm text-ink">
                  {alert.country} · vigente desde {alert.effectiveFrom}
                </div>
                {alert.sourceReference && (
                  <p className="mt-1 max-w-measure text-caption text-ink-soft">{alert.sourceReference}</p>
                )}
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => acknowledge(alert.id)}
                disabled={acknowledgingId === alert.id}
              >
                {acknowledgingId === alert.id ? "Guardando…" : "Marcar como revisado"}
              </Button>
            </div>
            <details className="mt-3">
              <summary className="cursor-pointer text-caption text-ink-muted">Ver configuración completa</summary>
              <pre className="mt-2 max-h-64 overflow-auto rounded-tile bg-surface-sunken p-3 text-[11px] leading-relaxed text-ink-soft">
                {JSON.stringify(alert.config, null, 2)}
              </pre>
            </details>
          </div>
        ))}
      </div>
      {error && <p className="mt-3 text-body-sm text-critical-ink">{error}</p>}
    </section>
  );
}
