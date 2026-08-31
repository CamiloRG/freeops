/**
 * PILA operator hand-off deep links — app_spec.md § "API Contracts &
 * Integrations" → "13. PILA calculation (+ guided hand-off)": "guided
 * hand-off panel with deep-link(s) to the freelancer's chosen PILA
 * operator (MiPlanilla, SOI, Aportes en Línea, Simple)".
 *
 * These are the operators' own plain marketing/login homepages, confirmed
 * via live web search this session (real operator homepages, not
 * guessed):
 *   - Mi Planilla   → https://www.miplanilla.com
 *   - SOI            → https://www.soi.com.co
 *   - Aportes en Línea → https://www.aportesenlinea.com
 *   - Simple          → https://www.pagosimple.com
 *
 * None of the 4 operators expose a query-param prefill scheme for period/
 * IBC/amount — their sites don't support it — so these are deliberately
 * plain homepage links, never invented "?period=..." query strings. No
 * data is ever transmitted to the operator; the freelancer completes the
 * actual submission on the operator's own site and self-reports back via
 * `confirm-paid`.
 *
 * Kept here (in `apps/web`, not `packages/rules-engine`) because
 * `packages/rules-engine` is pure/no-I/O by its own doc comment
 * (`packages/rules-engine/src/index.ts`) — this is static UI-facing data,
 * not a calculation rule.
 */
/** Matches `pila_records_operator_check` in `packages/db/src/schema/compliance.ts`. */
export type PilaOperator = "miplanilla" | "soi" | "aportes_en_linea" | "simple" | "other";

export interface PilaOperatorLink {
  operator: Exclude<PilaOperator, "other">;
  label: string;
  url: string;
}

export const PILA_OPERATOR_LINKS: PilaOperatorLink[] = [
  { operator: "miplanilla", label: "Mi Planilla", url: "https://www.miplanilla.com" },
  { operator: "soi", label: "SOI", url: "https://www.soi.com.co" },
  { operator: "aportes_en_linea", label: "Aportes en Línea", url: "https://www.aportesenlinea.com" },
  { operator: "simple", label: "Simple", url: "https://www.pagosimple.com" },
];

export const PILA_OPERATOR_LABEL: Record<PilaOperator, string> = {
  miplanilla: "Mi Planilla",
  soi: "SOI",
  aportes_en_linea: "Aportes en Línea",
  simple: "Simple",
  other: "Otro",
};
