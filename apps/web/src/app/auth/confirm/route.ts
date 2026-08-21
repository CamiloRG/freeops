/**
 * Email confirmation landing route — the target of the `emailRedirectTo`
 * passed to `supabase.auth.signUp()` in `(auth)/actions.ts`. Supabase's
 * confirmation email links here with `token_hash` + `type` query params;
 * exchanging them via `verifyOtp` establishes the session, matching
 * Supabase's documented `@supabase/ssr` + Next.js App Router pattern for
 * the token-hash (PKCE-adjacent) email confirmation flow.
 *
 * NOTE: this only works end-to-end once the Supabase project's Auth ->
 * URL Configuration "Redirect URLs" allow-list includes this app's origin
 * (e.g. `http://localhost:3000/**` for local dev, the production domain
 * for prod) — that's Supabase dashboard configuration, not something this
 * repo's code controls.
 */
import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/personal";

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(
    `${origin}/sign-in?error=confirmation-failed`
  );
}
