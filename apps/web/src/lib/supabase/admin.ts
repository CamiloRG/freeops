/**
 * Privileged Supabase client — server-only, uses `SUPABASE_SECRET_KEY`
 * (bypasses RLS, per Supabase's key model documented in the ADR). Never
 * import this from a Client Component or anything that ships to the
 * browser; there is no `NEXT_PUBLIC_` prefix on the secret key precisely
 * to make that a build-time error if attempted.
 *
 * Scope so far: nothing in product code uses this yet (Phase 3 only needs
 * it for one-off admin operations, e.g. test-user cleanup via scripts).
 * Future privileged server-side operations (Stripe webhooks, background
 * jobs) should create their own client the same way rather than reusing a
 * shared singleton across unrelated request lifecycles.
 */
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must both be set to create an admin Supabase client."
    );
  }
  return createSupabaseClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
