/**
 * App's own subscription billing (Stripe) — app_spec.md § "Data Model &
 * Schema" → "App's own subscription billing (Stripe)".
 *
 * Fed by Stripe webhooks (`customer.subscription.*`, `invoice.*`) — this
 * is the persistence side only.
 */
import { boolean, char, check, index, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { idColumn, softDelete, timestamps } from "./_helpers";
import { users } from "./identity";

// Financial/tax-relevant (it's still money/billing history): soft-delete applies.
export const appSubscriptions = pgTable(
  "app_subscriptions",
  {
    id: idColumn(),
    userId: uuid("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "restrict" }),
    stripeCustomerId: text("stripe_customer_id").notNull(),
    stripeSubscriptionId: text("stripe_subscription_id").unique(),
    plan: text("plan").notNull().default("monthly"), // [ASSUMED DEFAULT] 'monthly' | 'annual'
    status: text("status").notNull().default("incomplete"), // trialing | active | past_due | canceled | incomplete
    currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
    ...timestamps,
    ...softDelete,
  },
  (table) => [
    check("app_subscriptions_plan_check", sql`${table.plan} in ('monthly','annual')`),
    check(
      "app_subscriptions_status_check",
      sql`${table.status} in ('trialing','active','past_due','canceled','incomplete')`
    ),
  ]
);

export const appSubscriptionInvoices = pgTable(
  "app_subscription_invoices",
  {
    id: idColumn(),
    subscriptionId: uuid("subscription_id")
      .notNull()
      .references(() => appSubscriptions.id, { onDelete: "restrict" }),
    stripeInvoiceId: text("stripe_invoice_id").notNull().unique(),
    amountDue: numeric("amount_due", { precision: 10, scale: 2 }).notNull(),
    amountPaid: numeric("amount_paid", { precision: 10, scale: 2 }).notNull().default("0"),
    // [ASSUMED DEFAULT] dossier cites $20-30/month; USD assumed pending Stripe-account currency decision.
    currency: char("currency", { length: 3 }).notNull().default("usd"),
    status: text("status").notNull().default("open"), // paid | open | void | uncollectible
    invoicePdfUrl: text("invoice_pdf_url"),
    periodStart: timestamp("period_start", { withTimezone: true }),
    periodEnd: timestamp("period_end", { withTimezone: true }),
    createdAt: timestamps.createdAt,
  },
  (table) => [
    index("idx_app_sub_invoices_subscription").on(table.subscriptionId),
    check(
      "app_subscription_invoices_status_check",
      sql`${table.status} in ('paid','open','void','uncollectible')`
    ),
  ]
);
