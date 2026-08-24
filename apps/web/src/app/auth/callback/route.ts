/**
 * OAuth login callback — the `redirectTo` target passed to
 * `supabase.auth.signInWithOAuth()` in `(auth)/actions.ts`. Supabase
 * redirects here with `?code=` after the freelancer completes consent at
 * Google/Microsoft; exchanging it via `exchangeCodeForSession` establishes
 * the session, matching Supabase's documented `@supabase/ssr` + Next.js App
 * Router PKCE callback pattern. Distinct from `app/auth/confirm/route.ts`
 * (email-link confirmation, `token_hash`-based, not PKCE code-based).
 *
 * NOTE: this only works end-to-end once (a) the Supabase project's Auth ->
 * URL Configuration "Redirect URLs" allow-list includes this exact route
 * (`http://localhost:3000/auth/callback` for local dev, the production
 * origin's equivalent for prod), and (b) Google/Microsoft (Azure) are
 * enabled as providers in Supabase's Auth -> Providers with real OAuth
 * client credentials — both are Supabase/vendor dashboard configuration,
 * not something this repo's code controls.
 */
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/personal";

  // The provider itself can redirect back with an error instead of a code —
  // most commonly the freelancer declining consent at the provider's screen.
  const providerError = searchParams.get("error");
  if (providerError) {
    return NextResponse.redirect(`${origin}/sign-in?error=oauth-denied`);
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/sign-in?error=oauth-failed`);
}
