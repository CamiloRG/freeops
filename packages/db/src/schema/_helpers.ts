/**
 * Shared column helpers used across every domain schema file, so the
 * spec's table-level conventions (uuid PKs via pgcrypto, created_at /
 * updated_at, soft-delete, case-insensitive email, encrypted-at-rest
 * bytea columns) are defined once instead of repeated per table.
 *
 * See app_spec.md § "Data Model & Schema" → "Conventions used throughout
 * this schema" for the source of these conventions.
 */
import { customType, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Case-insensitive text column (Postgres `citext` extension), used for
 * every email column in the schema (users.email, bookings.guest_email, …)
 * per the spec's bootstrap migration enabling `citext`.
 */
export const citext = customType<{ data: string }>({
  dataType() {
    return "citext";
  },
});

/**
 * Raw encrypted bytes column (Postgres `bytea`), used for every
 * `*_encrypted` column holding envelope-encrypted PII/financial secrets
 * (banking account numbers, tax IDs, OAuth tokens). The application layer
 * is responsible for encrypting before write / decrypting after read —
 * see app_spec.md's "Sensitive-data / encryption-at-rest note".
 */
export const bytea = customType<{ data: Buffer }>({
  dataType() {
    return "bytea";
  },
});

/** `id uuid primary key default gen_random_uuid()` */
export const idColumn = () => uuid("id").primaryKey().defaultRandom();

/** `created_at` / `updated_at`, both `timestamptz not null default now()`. */
export const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

/**
 * `deleted_at timestamptz null` — applied per the spec to every
 * financial/tax-relevant table (DIAN-retention warning flow) and, for
 * consistency, to most other domain tables as well.
 */
export const softDelete = {
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
};
