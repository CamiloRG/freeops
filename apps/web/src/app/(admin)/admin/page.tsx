import { BreadcrumbHeader } from "@/components/layout/breadcrumb-header";
import { StatTile, StatTileGrid } from "@/components/admin/stat-tile";
import {
  getDailyAiCost,
  getHeaviestQueries,
  getMonthlyAiSummary,
  getTopAiUsersThisMonth,
} from "@/lib/admin/ops-metrics";
import { getPlatformSummary } from "@/lib/admin/platform-metrics";

export const runtime = "nodejs";

function formatUsd(value: number): string {
  return `$${value.toFixed(value < 1 ? 4 : 2)}`;
}

function formatPct(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}

/**
 * Platform-operator dashboard. Two sections: "Plataforma" (platform.ts —
 * signups/activity/adoption, everything buildable today from existing
 * tables, zero new schema) and "Extracción de hoja de vida" (ops-
 * metrics.ts — the cost & quota-tuning pillar this page started with).
 * Deliberately NOT here, per the feasibility discussion this was built
 * from: tier/MRR (blocked on Phase 12 Stripe), real event-level "most-used
 * features" and true engagement-based "active users" (both blocked on a
 * PostHog/event-log decision — "active" below is a last-login proxy, not
 * true engagement), and kanban task completion rate (no reliable "done"
 * signal in the schema — columns are freely renamed per board, unlike
 * CRM's `isWonStage`/`isLostStage`). Server Component: every query runs
 * server-side via `getDb()` (RLS-bypassing, admin-only), nothing here is
 * fetched client-side.
 */
export default async function AdminOperationsPage() {
  const [platform, summary, dailyCost, topUsers, heaviestQueries] = await Promise.all([
    getPlatformSummary(),
    getMonthlyAiSummary(),
    getDailyAiCost(14),
    getTopAiUsersThisMonth(10),
    getHeaviestQueries(10),
  ]);

  const atCapRatio =
    summary.usersAtCap + summary.usersUnderCap > 0
      ? summary.usersAtCap / (summary.usersAtCap + summary.usersUnderCap)
      : 0;
  const projectAdoptionRatio =
    platform.totalFreelancers > 0 ? platform.usersWithAtLeastOneProject / platform.totalFreelancers : 0;
  const crmClosedTotal = platform.crmWonCount + platform.crmLostCount;
  const crmWinRatio = crmClosedTotal > 0 ? platform.crmWonCount / crmClosedTotal : null;

  return (
    <div className="mx-auto max-w-[960px] px-6 py-10 sm:px-10">
      <BreadcrumbHeader breadcrumb="ADMIN / OPERACIONES" />

      <h1 className="mt-4 text-h1 text-ink">Operaciones</h1>
      <p className="mt-2 max-w-[560px] text-body text-ink-soft">
        Uso de la plataforma, costo real de IA y señal de calibración de cuotas — solo lo que ya está instrumentado.
      </p>

      <section className="mt-12">
        <div className="font-mono text-label-mono tracking-[0.06em] text-ink-muted uppercase">Plataforma</div>
        <StatTileGrid className="mt-6">
          <StatTile label="Freelancers totales" value={platform.totalFreelancers} />
          <StatTile label="Nuevos — 7 días" value={platform.newUsers7d} />
          <StatTile label="Nuevos — 30 días" value={platform.newUsers30d} />
          <StatTile
            label="Activos — 7 días"
            value={platform.activeUsers7d}
            hint="inició sesión, no uso real"
          />
          <StatTile
            label="Activos — 30 días"
            value={platform.activeUsers30d}
            hint="inició sesión, no uso real"
          />
          <StatTile
            label="Proyectos por usuario"
            value={platform.avgProjectsPerUser.toFixed(2)}
            hint={`${formatPct(projectAdoptionRatio)} con ≥1 proyecto`}
          />
          <StatTile
            label="CRM — tasa de cierre ganado"
            value={crmWinRatio === null ? "—" : formatPct(crmWinRatio)}
            hint={`${platform.crmWonCount} ganadas · ${platform.crmLostCount} perdidas · ${platform.crmOpenCount} abiertas`}
          />
          <StatTile label="Tareas kanban totales" value={platform.totalKanbanTasks} />
        </StatTileGrid>
      </section>

      <section className="mt-12">
        <div className="font-mono text-label-mono tracking-[0.06em] text-ink-muted uppercase">
          Extracción de hoja de vida (IA) — este mes
        </div>
        <StatTileGrid className="mt-6">
          <StatTile label="Costo (tier gratuito)" value={formatUsd(summary.defaultTierCostUsd)} />
          <StatTile label="Extracciones exitosas" value={summary.defaultTierExtractions} />
          <StatTile label="Extracciones fallidas" value={summary.defaultTierFailures} />
          <StatTile
            label="Llamadas API"
            value={summary.defaultTierApiCalls}
            hint={
              summary.defaultTierApiCalls > summary.defaultTierExtractions + summary.defaultTierFailures
                ? "incluye reintentos por artefactos"
                : undefined
            }
          />
          <StatTile
            label={`Usuarios en el límite (${summary.capLimit}/mes)`}
            value={`${summary.usersAtCap} de ${summary.usersAtCap + summary.usersUnderCap}`}
            tone={atCapRatio > 0.3 ? "warning" : "default"}
            hint={atCapRatio > 0.3 ? "más de 30% — evaluar subir el límite" : undefined}
          />
          <StatTile label="Extracciones BYOK" value={summary.byokExtractions} hint="no cobradas a FreeOps" />
        </StatTileGrid>
      </section>

      <section className="mt-12">
        <div className="font-mono text-label-mono tracking-[0.06em] text-ink-muted uppercase">
          Costo diario — últimos 14 días
        </div>
        {dailyCost.length === 0 ? (
          <p className="mt-4 text-body text-ink-soft">Sin extracciones registradas en este período.</p>
        ) : (
          <table className="mt-4 w-full border-collapse text-body-sm">
            <thead>
              <tr className="border-b border-line text-left font-mono text-label-mono tracking-[0.06em] text-ink-muted uppercase">
                <th className="py-2 font-normal">Día</th>
                <th className="py-2 font-normal">Extracciones</th>
                <th className="py-2 text-right font-normal">Costo</th>
              </tr>
            </thead>
            <tbody>
              {dailyCost.map((row) => (
                <tr key={row.day} className="border-b border-line-soft">
                  <td className="py-2 font-mono text-data-mono text-ink">{row.day}</td>
                  <td className="py-2 font-mono text-data-mono text-ink">{row.extractions}</td>
                  <td className="py-2 text-right font-mono text-data-mono text-ink">{formatUsd(row.costUsd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="mt-12">
        <div className="font-mono text-label-mono tracking-[0.06em] text-ink-muted uppercase">
          Usuarios con mayor costo — este mes
        </div>
        {topUsers.length === 0 ? (
          <p className="mt-4 text-body text-ink-soft">Sin extracciones registradas este mes.</p>
        ) : (
          <table className="mt-4 w-full border-collapse text-body-sm">
            <thead>
              <tr className="border-b border-line text-left font-mono text-label-mono tracking-[0.06em] text-ink-muted uppercase">
                <th className="py-2 font-normal">Usuario</th>
                <th className="py-2 font-normal">Tier</th>
                <th className="py-2 font-normal">Extracciones</th>
                <th className="py-2 text-right font-normal">Costo</th>
              </tr>
            </thead>
            <tbody>
              {topUsers.map((row, i) => (
                <tr key={`${row.email}-${row.tier}-${i}`} className="border-b border-line-soft">
                  <td className="py-2 text-ink">{row.email}</td>
                  <td className="py-2 font-mono text-data-mono text-ink-soft uppercase">{row.tier}</td>
                  <td className="py-2 font-mono text-data-mono text-ink">{row.extractions}</td>
                  <td className="py-2 text-right font-mono text-data-mono text-ink">
                    {row.tier === "byok" ? `(${formatUsd(row.costUsd)})` : formatUsd(row.costUsd)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="mt-12">
        <div className="font-mono text-label-mono tracking-[0.06em] text-ink-muted uppercase">
          Consultas más pesadas (base de datos)
        </div>
        <p className="mt-2 max-w-[640px] text-caption text-ink-soft">
          Postgres/Supabase no cobra por consulta — esto es el proxy real: tiempo de ejecución total, que sí impulsa
          el costo de cómputo. La misma vista está disponible gratis en Supabase Studio → Reports → Query
          Performance.
        </p>
        {heaviestQueries === null ? (
          <p className="mt-4 text-body text-ink-soft">
            No disponible — el rol de conexión no tiene permiso de lectura sobre pg_stat_statements.
          </p>
        ) : heaviestQueries.length === 0 ? (
          <p className="mt-4 text-body text-ink-soft">Sin datos aún.</p>
        ) : (
          <table className="mt-4 w-full border-collapse text-body-sm">
            <thead>
              <tr className="border-b border-line text-left font-mono text-label-mono tracking-[0.06em] text-ink-muted uppercase">
                <th className="py-2 font-normal">Consulta</th>
                <th className="py-2 text-right font-normal">Llamadas</th>
                <th className="py-2 text-right font-normal">Promedio (ms)</th>
                <th className="py-2 text-right font-normal">Total (ms)</th>
              </tr>
            </thead>
            <tbody>
              {heaviestQueries.map((row, i) => (
                <tr key={i} className="border-b border-line-soft">
                  <td className="max-w-[420px] truncate py-2 font-mono text-data-mono text-ink-soft" title={row.query}>
                    {row.query}
                  </td>
                  <td className="py-2 text-right font-mono text-data-mono text-ink">{row.calls}</td>
                  <td className="py-2 text-right font-mono text-data-mono text-ink">{row.meanExecMs.toFixed(1)}</td>
                  <td className="py-2 text-right font-mono text-data-mono text-ink">{row.totalExecMs.toFixed(0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
