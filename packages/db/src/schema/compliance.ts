/**
 * Compliance: withholding certificates, PILA, tax vault — app_spec.md §
 * "Data Model & Schema" → "Compliance: withholding certificates, PILA,
 * tax vault".
 *
 * Financial/tax-relevant: soft-delete + DIAN warning applies to every
 * table in this domain except the config/regulatory tables and the join
 * table, which have no user-facing "delete" concept.
 *
 * `regulatory_config_versions` backs the config-driven PILA/DIAN rules
 * engine (`packages/rules-engine`, a later phase) — never hardcode
 * PILA/DIAN formulas in application code.
 */
import { boolean, check, date, index, integer, jsonb, numeric, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { idColumn, softDelete, timestamps } from "./_helpers";
import { users } from "./identity";
import { projects } from "./business";
import { cuentasDeCobro, invoices } from "./finance";

export const withholdingCertificates = pgTable(
  "withholding_certificates",
  {
    id: idColumn(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    cuentaDeCobroId: uuid("cuenta_de_cobro_id").references(() => cuentasDeCobro.id, {
      onDelete: "set null",
    }),
    invoiceId: uuid("invoice_id").references(() => invoices.id, { onDelete: "set null" }),
    clientName: text("client_name").notNull(),
    taxYear: integer("tax_year").notNull(),
    period: text("period"), // e.g. 'annual' or a specific month, per client practice
    required: boolean("required").notNull().default(true),
    status: text("status").notNull().default("pending"), // pending | received | not_applicable
    receivedAt: date("received_at"),
    // Stage 3 (Phase 7) addition — the spec's own API contract (`GET
    // /api/v1/withholding-certificates` response shape) includes
    // `expectedAmount`, but this table never got the column. Freelancer-
    // settable manually only — there is no reliable "withholding rate"
    // computation anywhere in this app (`packages/rules-engine` is
    // PILA-only, not DIAN retention-in-source), so this is never
    // auto-computed/auto-derived, only ever set by the freelancer or left
    // null by the auto-creation hook.
    expectedAmount: numeric("expected_amount", { precision: 14, scale: 2 }),
    fileKey: text("file_key"), // uploaded copy of the certificate, once received
    ...timestamps,
    ...softDelete,
  },
  (table) => [
    index("idx_wh_certs_user_year_status")
      .on(table.userId, table.taxYear, table.status)
      .where(sql`${table.deletedAt} is null`),
    check(
      "withholding_certificates_status_check",
      sql`${table.status} in ('pending','received','not_applicable')`
    ),
  ]
);

// Versioned, config-driven regulatory parameters — never hardcode PILA/DIAN
// formulas in application code (interview §3.3/§7); keeps the door open
// for later LATAM-country config rows.
export const regulatoryConfigVersions = pgTable(
  "regulatory_config_versions",
  {
    id: idColumn(),
    country: text("country").notNull().default("CO"), // char(2)
    effectiveFrom: date("effective_from").notNull(),
    effectiveTo: date("effective_to"),
    // e.g. { smlmv, ibc_min_pct, ibc_max_smlmv, health_pct, pension_pct, arl_pct, uvt_value, dian_thresholds: {...} }
    config: jsonb("config").notNull(),
    sourceReference: text("source_reference"), // decree/resolution citation
    createdAt: timestamps.createdAt,
    updatedAt: timestamps.updatedAt,
  },
  (table) => [index("idx_regulatory_config_country_effective").on(table.country, table.effectiveFrom)]
);

/**
 * Admin-facing "new/updated normativa needs human review" alert queue.
 * Every row is created by an `AFTER INSERT` trigger on
 * `regulatory_config_versions` (migration `0020` — see that file's
 * comment), never by application code directly, so it's impossible for
 * any insertion path (today's `seed-config.ts`, a future admin-authored
 * insert) to add a regulatory config version without also raising an
 * alert. The `/admin` dashboard surfaces open rows with top priority; a
 * platform admin acknowledging one is the "human in the loop" this table
 * exists for. Same "RLS enabled, zero policies" pattern as
 * `platform_admins` — only `getDb()` (admin/background-job client) may
 * read or write this table.
 */
export const regulatoryConfigAlerts = pgTable(
  "regulatory_config_alerts",
  {
    id: idColumn(),
    regulatoryConfigVersionId: uuid("regulatory_config_version_id")
      .notNull()
      .references(() => regulatoryConfigVersions.id, { onDelete: "cascade" }),
    country: text("country").notNull(),
    effectiveFrom: date("effective_from").notNull(),
    sourceReference: text("source_reference"),
    status: text("status").notNull().default("open"), // open | acknowledged
    acknowledgedByUserId: uuid("acknowledged_by_user_id").references(() => users.id, { onDelete: "set null" }),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_regulatory_config_alerts_status").on(table.status, table.createdAt),
    check("regulatory_config_alerts_status_check", sql`${table.status} in ('open','acknowledged')`),
  ]
);

export const pilaRecords = pgTable(
  "pila_records",
  {
    id: idColumn(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    periodYear: integer("period_year").notNull(),
    periodMonth: integer("period_month").notNull(),
    // Sum of that month's cuentas de cobro/invoices used in calc.
    totalIncomeBase: numeric("total_income_base", { precision: 14, scale: 2 }).notNull(),
    ibc: numeric("ibc", { precision: 14, scale: 2 }).notNull(), // contribution base income (pension IBC under cotizante 76)
    // Nullable since Resolución 1529/2026 (cotizante tipo 76 — see below):
    // health isn't mandatory in the contributory regime for that cotizante
    // type, and `null` here means exactly that ("not applicable"), never a
    // fabricated $0 — same principle this table's service layer already
    // applies to "no income this month" (see `@/lib/services/pila`'s doc
    // comment).
    healthContribution: numeric("health_contribution", { precision: 14, scale: 2 }),
    pensionContribution: numeric("pension_contribution", { precision: 14, scale: 2 }).notNull(),
    arlContribution: numeric("arl_contribution", { precision: 14, scale: 2 }),
    // Cotizante tipo 76 addition: ARL's own base income, only ever
    // different from `ibc` under that regime (always a full-SMLMV/30-day
    // IBC there, regardless of days actually worked) — null whenever
    // `arlContribution` is null, or under the standard regime (where ARL
    // shares `ibc`).
    arlIbc: numeric("arl_ibc", { precision: 14, scale: 2 }),
    totalAmountOwed: numeric("total_amount_owed", { precision: 14, scale: 2 }).notNull(),
    // Cotizante tipo 76 addition (Resolución 1529 de 2026, MinSalud —
    // "Trabajador de tiempo parcial Independiente", periods from 2026-08):
    // which cotizante type this calculation used. Drives which of the
    // fields above are populated — see `@freeops/rules-engine`'s
    // `calculatePila` doc comment for the full regime rules.
    cotizanteType: text("cotizante_type").notNull().default("standard"), // standard | 76
    // Only set (and only meaningful) when `cotizanteType = '76'` — the
    // freelancer-declared number of days actually worked in the period,
    // which determines the pension IBC bracket. Persisted (not just used
    // transiently) so `recalculatePilaCalculation` doesn't need the
    // freelancer to re-enter it every time.
    daysWorkedInPeriod: integer("days_worked_in_period"),
    // Freelancer-declared ARL risk class (Decreto 1772 de 1994). Mandatory
    // input under cotizante 76 (enforced in `@/lib/services/pila`, not
    // here); still optional/no-UI under the standard regime — see
    // `packages/rules-engine/src/pila.ts`'s own doc comment on why ARL
    // stays opt-in there (no risk-class capture anywhere else in this
    // app yet).
    arlRiskClass: text("arl_risk_class"), // I | II | III | IV | V
    // Voluntary caja de compensación familiar contribution — only
    // possible under cotizante 76. Both null when the freelancer didn't
    // opt in (the default — never assumed).
    compensationFundRate: numeric("compensation_fund_rate", { precision: 6, scale: 4 }),
    compensationFundContribution: numeric("compensation_fund_contribution", { precision: 14, scale: 2 }),
    operator: text("operator").notNull().default("other"), // miplanilla | soi | aportes_en_linea | simple | other
    // Which rate version produced this figure.
    regulatoryConfigVersionId: uuid("regulatory_config_version_id").references(
      () => regulatoryConfigVersions.id,
      { onDelete: "restrict" }
    ),
    status: text("status").notNull().default("calculated"), // calculated | paid | overdue
    paidAt: date("paid_at"),
    deepLinkUrl: text("deep_link_url"), // guided hand-off deep link to the chosen operator's site
    // Stage 4 (Phase 7) addition — the spec's own API contract
    // (`POST /api/v1/pila/calculations/:id/confirm-paid` body) includes
    // `confirmationReference`, but this table never got the column. Same
    // category of small additive gap-fill as Stage 3's `expected_amount`/
    // `requires_withholding_certificate` additions. Freelancer self-
    // reported only (e.g. an operator receipt/reference number) — never
    // verified against any upstream operator, since none of the 4
    // operators (MiPlanilla/SOI/Aportes en Línea/Simple) expose an API.
    confirmationReference: text("confirmation_reference"),
    ...timestamps,
    ...softDelete,
  },
  (table) => [
    unique("pila_records_user_period_unique").on(table.userId, table.periodYear, table.periodMonth),
    index("idx_pila_user_period").on(table.userId, table.periodYear, table.periodMonth),
    check("pila_records_period_month_check", sql`${table.periodMonth} between 1 and 12`),
    check(
      "pila_records_operator_check",
      sql`${table.operator} in ('miplanilla','soi','aportes_en_linea','simple','other')`
    ),
    check("pila_records_status_check", sql`${table.status} in ('calculated','paid','overdue')`),
    check("pila_records_cotizante_type_check", sql`${table.cotizanteType} in ('standard','76')`),
    check(
      "pila_records_days_worked_check",
      sql`${table.daysWorkedInPeriod} is null or ${table.daysWorkedInPeriod} between 1 and 30`
    ),
    check(
      "pila_records_arl_risk_class_check",
      sql`${table.arlRiskClass} is null or ${table.arlRiskClass} in ('I','II','III','IV','V')`
    ),
  ]
);

export const taxVaultPackages = pgTable(
  "tax_vault_packages",
  {
    id: idColumn(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    periodType: text("period_type").notNull(), // 'month' | 'year'
    periodYear: integer("period_year").notNull(),
    periodMonth: integer("period_month"), // null when period_type='year'
    status: text("status").notNull().default("draft"), // draft | ready | downloaded
    generatedAt: timestamp("generated_at", { withTimezone: true }),
    archiveFileKey: text("archive_file_key"), // packaged .zip in object storage
    ...timestamps,
    ...softDelete,
  },
  (table) => [
    index("idx_tax_vault_user_period").on(table.userId, table.periodYear, table.periodMonth),
    check("tax_vault_packages_period_type_check", sql`${table.periodType} in ('month','year')`),
    check("tax_vault_packages_period_month_check", sql`${table.periodMonth} between 1 and 12`),
  ]
);

// Join table: which source documents were bundled into a given package.
// document_id references cuentas_de_cobro / invoices / pila_records /
// withholding_certificates / contract_documents depending on document_type;
// not a single enforced FK for the same reason `payments` avoids a
// polymorphic FK, but writes only ever happen from the packaging job,
// which validates existence at write time.
export const taxVaultDocuments = pgTable(
  "tax_vault_documents",
  {
    id: idColumn(),
    packageId: uuid("package_id")
      .notNull()
      .references(() => taxVaultPackages.id, { onDelete: "cascade" }),
    documentType: text("document_type").notNull(), // cuenta_de_cobro | invoice | pila_record | withholding_certificate | contract_document
    documentId: uuid("document_id").notNull(),
    createdAt: timestamps.createdAt,
  },
  (table) => [
    index("idx_tax_vault_documents_package").on(table.packageId),
    check(
      "tax_vault_documents_document_type_check",
      sql`${table.documentType} in ('cuenta_de_cobro','invoice','pila_record','withholding_certificate','contract_document')`
    ),
  ]
);
