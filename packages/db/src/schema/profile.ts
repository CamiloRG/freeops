/**
 * Freelancer profile & sensitive data — app_spec.md § "Data Model & Schema"
 * → "Freelancer profile & sensitive data".
 *
 * `banking_details` and `tax_info` hold envelope-encrypted PII/financial
 * identifiers (see `_helpers.bytea` and the spec's encryption-at-rest
 * note) and are soft-delete only — deletes go through the DIAN-retention
 * warning flow (see `audit.ts`).
 */
import { boolean, check, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { bytea, idColumn, softDelete, timestamps } from "./_helpers";
import { users } from "./identity";

export const freelancerProfiles = pgTable("freelancer_profiles", {
  id: idColumn(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  fullName: text("full_name").notNull(),
  displayName: text("display_name"),
  phone: text("phone"),
  country: text("country").notNull().default("CO"), // char(2)
  city: text("city"),
  profilePhotoKey: text("profile_photo_key"),
  headline: text("headline"),
  bio: text("bio"),
  ...timestamps,
  ...softDelete,
});

// Sensitive: encrypted at rest (see _helpers.bytea). Soft-delete only, DIAN warning applies.
export const bankingDetails = pgTable(
  "banking_details",
  {
    id: idColumn(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    bankName: text("bank_name").notNull(),
    accountType: text("account_type").notNull(), // 'savings' | 'checking' (ahorros/corriente)
    accountNumberEncrypted: bytea("account_number_encrypted").notNull(),
    accountHolderName: text("account_holder_name").notNull(),
    accountHolderTaxIdEncrypted: bytea("account_holder_tax_id_encrypted"),
    isPrimary: boolean("is_primary").notNull().default(true),
    ...timestamps,
    ...softDelete,
  },
  (table) => [
    index("idx_banking_details_user")
      .on(table.userId)
      .where(sql`${table.deletedAt} is null`),
    check(
      "banking_details_account_type_check",
      sql`${table.accountType} in ('savings','checking')`
    ),
  ]
);

// Sensitive: encrypted at rest. Soft-delete only, DIAN warning applies.
export const taxInfo = pgTable(
  "tax_info",
  {
    id: idColumn(),
    userId: uuid("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "restrict" }),
    taxIdType: text("tax_id_type").notNull(), // 'CC' | 'NIT' | 'CE' | 'Pasaporte'
    taxIdNumberEncrypted: bytea("tax_id_number_encrypted").notNull(),
    taxRegime: text("tax_regime"), // 'regimen_simple' | 'regimen_ordinario' | 'no_responsable'
    isGranContribuyente: boolean("is_gran_contribuyente").notNull().default(false),
    isIvaResponsible: boolean("is_iva_responsible").notNull().default(false),
    ciiuCode: text("ciiu_code"), // economic activity code
    fiscalAddress: text("fiscal_address"),
    ...timestamps,
    ...softDelete,
  },
  (table) => [
    check(
      "tax_info_tax_id_type_check",
      sql`${table.taxIdType} in ('CC','NIT','CE','Pasaporte')`
    ),
    check(
      "tax_info_tax_regime_check",
      sql`${table.taxRegime} in ('regimen_simple','regimen_ordinario','no_responsable')`
    ),
  ]
);

// Uploaded supporting tax documents (RUT PDF, etc.) — separate from the vault packages (compliance.ts).
export const taxInfoDocuments = pgTable(
  "tax_info_documents",
  {
    id: idColumn(),
    taxInfoId: uuid("tax_info_id")
      .notNull()
      .references(() => taxInfo.id, { onDelete: "restrict" }),
    fileKey: text("file_key").notNull(),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type"),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamps.createdAt,
    deletedAt: softDelete.deletedAt,
  },
  (table) => [index("idx_tax_info_documents_tax_info").on(table.taxInfoId)]
);
