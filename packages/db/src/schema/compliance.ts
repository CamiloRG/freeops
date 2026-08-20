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
    ibc: numeric("ibc", { precision: 14, scale: 2 }).notNull(), // contribution base income
    healthContribution: numeric("health_contribution", { precision: 14, scale: 2 }).notNull(),
    pensionContribution: numeric("pension_contribution", { precision: 14, scale: 2 }).notNull(),
    arlContribution: numeric("arl_contribution", { precision: 14, scale: 2 }),
    totalAmountOwed: numeric("total_amount_owed", { precision: 14, scale: 2 }).notNull(),
    operator: text("operator").notNull().default("other"), // miplanilla | soi | aportes_en_linea | simple | other
    // Which rate version produced this figure.
    regulatoryConfigVersionId: uuid("regulatory_config_version_id").references(
      () => regulatoryConfigVersions.id,
      { onDelete: "restrict" }
    ),
    status: text("status").notNull().default("calculated"), // calculated | paid | overdue
    paidAt: date("paid_at"),
    deepLinkUrl: text("deep_link_url"), // guided hand-off deep link to the chosen operator's site
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
