/**
 * Finance: cuentas de cobro, invoices, payments — app_spec.md § "Data
 * Model & Schema" → "Finance: cuentas de cobro, invoices, payments".
 *
 * Financial/tax-relevant: soft-delete + DIAN warning applies to every
 * table in this domain (see `audit.ts` for the warning log).
 */
import { boolean, char, check, date, index, jsonb, numeric, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { idColumn, softDelete, timestamps } from "./_helpers";
import { users } from "./identity";
import { projects } from "./business";

// Stage 2 (Phase 7) addition: itemized line items, an alternative to the
// flat `concept`+`amount` entry. Shape deliberately clearer than
// app_spec.md's ambiguous `items: [{description, amount, quantity}]` —
// `lineTotal` is never stored (computed as `quantity * unitAmount` at read
// time) to avoid drift; `amount`/`totalAmount` stay the source of truth,
// kept in sync by the service layer whenever `items` is present.
export type FinanceLineItem = {
  description: string;
  quantity: number;
  unitAmount: number;
};

export const cuentasDeCobro = pgTable(
  "cuentas_de_cobro",
  {
    id: idColumn(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    number: text("number").notNull(), // e.g. CDC-2026-0001, sequential per user
    clientName: text("client_name").notNull(),
    clientTaxId: text("client_tax_id"),
    concept: text("concept").notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    // Nullable — absent/null means the classic flat concept+amount entry;
    // present+non-empty means `amount` above is the app-computed sum of
    // each item's `quantity * unitAmount` (see doc comment above).
    items: jsonb("items").$type<FinanceLineItem[]>(),
    currency: char("currency", { length: 3 }).notNull().default("COP"),
    issueDate: date("issue_date").notNull(),
    dueDate: date("due_date").notNull(),
    status: text("status").notNull().default("draft"), // draft | issued | paid | overdue | cancelled
    requiresWithholdingCertificate: boolean("requires_withholding_certificate").notNull().default(false),
    pdfFileKey: text("pdf_file_key"),
    ...timestamps,
    ...softDelete,
  },
  (table) => [
    unique("cuentas_de_cobro_user_number_unique").on(table.userId, table.number),
    index("idx_cdc_user_status_due")
      .on(table.userId, table.status, table.dueDate)
      .where(sql`${table.deletedAt} is null`),
    check(
      "cuentas_de_cobro_status_check",
      sql`${table.status} in ('draft','issued','paid','overdue','cancelled')`
    ),
  ]
);

export const invoices = pgTable(
  "invoices",
  {
    id: idColumn(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    // An invoice may originate from a cuenta de cobro.
    cuentaDeCobroId: uuid("cuenta_de_cobro_id").references(() => cuentasDeCobro.id, {
      onDelete: "set null",
    }),
    number: text("number").notNull(),
    clientName: text("client_name").notNull(),
    clientTaxId: text("client_tax_id"),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(), // pre-tax
    // Same itemization convention as `cuentas_de_cobro.items` above — when
    // present+non-empty, `amount` (pre-tax) is the app-computed sum of each
    // item's `quantity * unitAmount`.
    items: jsonb("items").$type<FinanceLineItem[]>(),
    taxAmount: numeric("tax_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    totalAmount: numeric("total_amount", { precision: 14, scale: 2 }).notNull(),
    currency: char("currency", { length: 3 }).notNull().default("COP"),
    issueDate: date("issue_date").notNull(),
    dueDate: date("due_date").notNull(),
    status: text("status").notNull().default("draft"), // draft | issued | paid | overdue | cancelled
    // v2 placeholder: DIAN facturación electrónica connector.
    eInvoicingStatus: text("e_invoicing_status").notNull().default("not_applicable"),
    pdfFileKey: text("pdf_file_key"),
    ...timestamps,
    ...softDelete,
  },
  (table) => [
    unique("invoices_user_number_unique").on(table.userId, table.number),
    index("idx_invoices_user_status_due")
      .on(table.userId, table.status, table.dueDate)
      .where(sql`${table.deletedAt} is null`),
    check("invoices_status_check", sql`${table.status} in ('draft','issued','paid','overdue','cancelled')`),
    check(
      "invoices_e_invoicing_status_check",
      sql`${table.eInvoicingStatus} in ('not_applicable','pending','submitted','accepted','rejected')`
    ),
  ]
);

// [OVERRIDE: per spec] Two nullable FK columns + a CHECK guard instead of a
// polymorphic (payable_type, payable_id) pair — keeps real FK referential
// integrity, which matters for the audit trail on financial records.
export const payments = pgTable(
  "payments",
  {
    id: idColumn(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    cuentaDeCobroId: uuid("cuenta_de_cobro_id").references(() => cuentasDeCobro.id, {
      onDelete: "restrict",
    }),
    invoiceId: uuid("invoice_id").references(() => invoices.id, { onDelete: "restrict" }),
    amountPaid: numeric("amount_paid", { precision: 14, scale: 2 }),
    currency: char("currency", { length: 3 }).notNull().default("COP"),
    status: text("status").notNull().default("pending"), // pending | partial | paid | overdue | failed
    paidAt: timestamp("paid_at", { withTimezone: true }),
    paymentMethod: text("payment_method"),
    ...timestamps,
    ...softDelete,
  },
  (table) => [
    check(
      "payments_exactly_one_payable_check",
      sql`num_nonnulls(${table.cuentaDeCobroId}, ${table.invoiceId}) = 1`
    ),
    check("payments_status_check", sql`${table.status} in ('pending','partial','paid','overdue','failed')`),
    index("idx_payments_user_status")
      .on(table.userId, table.status)
      .where(sql`${table.deletedAt} is null`),
    index("idx_payments_cdc").on(table.cuentaDeCobroId),
    index("idx_payments_invoice").on(table.invoiceId),
  ]
);

// Log of automated reminder sends, driving the overdue-payments dashboard.
export const paymentReminders = pgTable(
  "payment_reminders",
  {
    id: idColumn(),
    paymentId: uuid("payment_id")
      .notNull()
      .references(() => payments.id, { onDelete: "cascade" }),
    channel: text("channel").notNull(), // 'email' | 'whatsapp'
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
    status: text("status").notNull().default("sent"), // sent | failed
    createdAt: timestamps.createdAt,
  },
  (table) => [
    index("idx_payment_reminders_payment").on(table.paymentId),
    check("payment_reminders_channel_check", sql`${table.channel} in ('email','whatsapp')`),
    check("payment_reminders_status_check", sql`${table.status} in ('sent','failed')`),
  ]
);
