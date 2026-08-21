/**
 * Zod schemas for email/password auth — app_spec.md § "Security &
 * Compliance" → "Input Validation Strategy": every input is validated at
 * the boundary with a schema validator, shared between client and server
 * so the two can never drift. The sign-in/sign-up Server Actions
 * (`app/(auth)/actions.ts`) are the authoritative boundary; the client
 * forms parse with the same schema first purely for immediate inline
 * feedback, never as a substitute for the server-side check.
 */
import { z } from "zod";

export const signInSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Enter your email address.")
    .email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

export type SignInInput = z.infer<typeof signInSchema>;

export const signUpSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, "Enter your full name.")
    .max(200, "Full name is too long."),
  email: z
    .string()
    .trim()
    .min(1, "Enter your email address.")
    .email("Enter a valid email address."),
  // Supabase's own default minimum is 6; the spec doesn't mandate a
  // specific policy, so this is a reasonable floor above that default.
  // [ASSUMED DEFAULT]
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .max(72, "Password is too long."),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
