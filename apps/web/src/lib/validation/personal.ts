/**
 * Zod schemas for the Personal module (profile, banking, tax info,
 * branding, resume/CV) — shared between client forms and the
 * `/api/v1/me/...` Route Handlers, per app_spec.md's Input Validation
 * Strategy ("every entity type gets an explicit schema... schemas shared
 * between frontend and backend so client-side and server-side validation
 * can never drift").
 */
import { z } from "zod";

// --- Colombia-specific format validators -----------------------------------
// [ASSUMED DEFAULT] — the spec flags that exact formats weren't specified
// in the interview; these are reasonable, permissive country-aware
// validators (digits + Colombia's optional NIT check-digit suffix) rather
// than a generic "any string" field, per the spec's explicit call-out that
// malformed tax IDs would corrupt downstream PILA/DIAN calculations.
const cedulaPattern = /^\d{6,10}$/;
const nitPattern = /^\d{9,10}(-\d)?$/;
const phonePattern = /^(\+?57)?[ -]?\d{7,10}$/;

export const taxIdTypeSchema = z.enum(["CC", "NIT", "CE", "Pasaporte"]);

export function validateTaxIdFormat(taxIdType: z.infer<typeof taxIdTypeSchema>, value: string): boolean {
  const trimmed = value.trim();
  switch (taxIdType) {
    case "CC":
    case "CE":
      return cedulaPattern.test(trimmed);
    case "NIT":
      return nitPattern.test(trimmed);
    case "Pasaporte":
      return trimmed.length >= 5 && trimmed.length <= 20;
    default:
      return false;
  }
}

// --- 1. Profile & Personal Data ---------------------------------------------

export const profileUpdateSchema = z.object({
  fullName: z.string().trim().min(1, "Enter your full name.").max(200).optional(),
  displayName: z.string().trim().max(200).optional().nullable(),
  phone: z
    .string()
    .trim()
    .regex(phonePattern, "Enter a valid Colombian phone number.")
    .optional()
    .nullable()
    .or(z.literal("")),
  city: z.string().trim().max(120).optional().nullable(),
  country: z.string().trim().length(2, "Use a 2-letter country code.").optional(),
  headline: z.string().trim().max(200).optional().nullable(),
  bio: z.string().trim().max(2000, "Bio is too long.").optional().nullable(),
});
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;

// --- 2. Banking Details ------------------------------------------------------

export const bankingUpsertSchema = z.object({
  bankName: z.string().trim().min(1, "Enter the bank name.").max(200),
  accountType: z.enum(["savings", "checking"]),
  accountNumber: z
    .string()
    .trim()
    .min(4, "Enter a valid account number.")
    .max(34, "Account number is too long.")
    .regex(/^[0-9-]+$/, "Account number should contain only digits and dashes."),
  accountHolderName: z.string().trim().min(1, "Enter the account holder's name.").max(200),
  accountHolderTaxId: z.string().trim().max(20).optional().or(z.literal("")),
  // Step-up re-authentication (app_spec.md § "Authentication & Authorization"
  // — re-confirm identity before editing banking details). Not a literal
  // field in the spec's PUT body prose, but required by the same section's
  // step-up mandate; documented here as the concrete mechanism.
  currentPassword: z.string().min(1, "Re-enter your password to confirm this change."),
});
export type BankingUpsertInput = z.infer<typeof bankingUpsertSchema>;

// --- 3. Tax Information -------------------------------------------------------

export const taxInfoUpsertSchema = z
  .object({
    taxIdType: taxIdTypeSchema,
    taxIdNumber: z.string().trim().min(1, "Enter your tax ID."),
    taxRegime: z.enum(["regimen_simple", "regimen_ordinario", "no_responsable"]).optional().nullable(),
    isGranContribuyente: z.boolean().optional(),
    isIvaResponsible: z.boolean().optional(),
    ciiuCode: z.string().trim().max(10).optional().nullable(),
    fiscalAddress: z.string().trim().max(300).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (!validateTaxIdFormat(data.taxIdType, data.taxIdNumber)) {
      ctx.addIssue({
        code: "custom",
        path: ["taxIdNumber"],
        message: `"${data.taxIdNumber}" doesn't look like a valid ${data.taxIdType}.`,
      });
    }
  });
export type TaxInfoUpsertInput = z.infer<typeof taxInfoUpsertSchema>;

export const taxDocumentTypeSchema = z.enum(["rut", "camara_comercio", "other"]);

// --- 4. Branding ---------------------------------------------------------------

const hexColorSchema = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, "Use a 6-digit hex color, e.g. #6C5CE7.");

export const brandingUpdateSchema = z.object({
  primaryColor: hexColorSchema.optional().nullable(),
  secondaryColor: hexColorSchema.optional().nullable(),
});
export type BrandingUpdateInput = z.infer<typeof brandingUpdateSchema>;

// --- 5. Resume / CV builder -----------------------------------------------------

export const resumeSkillSchema = z.string().trim().min(1).max(60);

export const resumeEntrySchema = z.object({
  id: z.uuid().optional(),
  source: z.enum(["manual", "project"]).default("manual"),
  projectId: z.uuid().optional().nullable(),
  title: z.string().trim().min(1, "Enter a title.").max(200),
  clientName: z.string().trim().max(200).optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
  startDate: z.string().trim().optional().nullable(), // ISO date (YYYY-MM-DD)
  endDate: z.string().trim().optional().nullable(),
  displayOrder: z.number().int().min(0).default(0),
});
export type ResumeEntryInput = z.infer<typeof resumeEntrySchema>;

export const resumeUpdateSchema = z.object({
  headline: z.string().trim().max(200).optional().nullable(),
  summary: z.string().trim().max(4000).optional().nullable(),
  skills: z.array(resumeSkillSchema).max(50).default([]),
  entries: z.array(resumeEntrySchema).max(100).default([]),
});
export type ResumeUpdateInput = z.infer<typeof resumeUpdateSchema>;

export const resumeSyncProjectsSchema = z.object({
  projectIds: z.array(z.uuid()).optional(),
});

export const resumeExportSchema = z.object({
  format: z.literal("pdf").default("pdf"),
});
