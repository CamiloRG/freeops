/**
 * Step-up re-authentication — app_spec.md § "Security & Compliance" →
 * "Authentication & Authorization": "require a step-up re-auth / password
 * re-entry before *editing* banking details... protects against a stolen/
 * replayed session on a shared device."
 *
 * Verifies the freelancer's current password via
 * `supabase.auth.signInWithPassword` using a throwaway, non-persisting
 * Supabase client (`persistSession: false`, its own isolated in-memory
 * auth state) — deliberately NOT the cookie-backed server client from
 * `@/lib/supabase/server`, so a failed (or even successful) re-auth check
 * never touches the caller's real session cookies. On failure this simply
 * returns `false`; the caller's existing session is completely
 * undisturbed either way.
 */
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export async function verifyPasswordStepUp(email: string, password: string): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be set.");
  }

  const client = createSupabaseClient(url, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  return !error;
}
