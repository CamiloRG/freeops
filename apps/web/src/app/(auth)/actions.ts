"use server";

/**
 * Email/password auth Server Actions — app_spec.md § "API Contracts &
 * Integrations" → "1. Auth — Supabase Auth" and § "Security & Compliance"
 * → "Authentication & Authorization". Google/Microsoft OAuth is an
 * explicit, deliberate scope boundary deferred to a later phase (the
 * sign-in/sign-up UI shows those buttons disabled) — only email/password
 * is wired here.
 *
 * Every input is re-validated here with the same Zod schema the client
 * form uses (`lib/validation/auth.ts`) — the client-side check is only for
 * immediate feedback, this is the actual boundary per the spec's Input
 * Validation Strategy.
 */
import { redirect } from "next/navigation";
import { signInSchema, signUpSchema } from "@/lib/validation/auth";
import { createClient } from "@/lib/supabase/server";
import type { AuthActionState } from "./action-state";

function firstFieldErrors(
  flattened: Record<string, string[] | undefined>
): Partial<Record<string, string>> {
  const out: Partial<Record<string, string>> = {};
  for (const [key, messages] of Object.entries(flattened)) {
    if (messages && messages.length > 0) out[key] = messages[0];
  }
  return out;
}

export async function signIn(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      fieldErrors: firstFieldErrors(parsed.error.flatten().fieldErrors),
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    // Supabase's own copy for this case; surface it distinctly so the
    // freelancer knows to check their inbox rather than assuming a wrong
    // password. See app_spec.md's "Handle Supabase's email-confirmation
    // flow appropriately" requirement.
    if (error.code === "email_not_confirmed") {
      return {
        status: "check-email",
        email: parsed.data.email,
        formError: "Confirm your email address before signing in.",
      };
    }
    return {
      status: "error",
      formError: "Incorrect email or password.",
    };
  }

  const redirectTo = formData.get("redirectTo");
  redirect(typeof redirectTo === "string" && redirectTo ? redirectTo : "/personal");
}

export async function signUp(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const parsed = signUpSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      fieldErrors: firstFieldErrors(parsed.error.flatten().fieldErrors),
    };
  }

  const supabase = await createClient();
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${origin}/auth/confirm?next=/personal`,
    },
  });

  if (error) {
    return { status: "error", formError: error.message };
  }

  // Supabase returns a user with no identities when the email is already
  // registered (its documented anti-enumeration behavior for signUp) —
  // surface that as a normal form error rather than a false "check your
  // email".
  if (data.user && data.user.identities && data.user.identities.length === 0) {
    return {
      status: "error",
      formError: "An account with this email already exists. Try signing in instead.",
    };
  }

  // A session comes back immediately only if the project's Auth settings
  // don't require email confirmation; otherwise `session` is null and the
  // freelancer must click the confirmation link first.
  if (data.session) {
    redirect("/personal");
  }

  return { status: "check-email", email: parsed.data.email };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/sign-in");
}

export async function resendConfirmation(email: string): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const { error } = await supabase.auth.resend({ type: "signup", email });
  return { ok: !error };
}
