/**
 * Session-refresh + route-protection logic, invoked from `src/proxy.ts` on
 * every request (Next.js 16 renamed the `middleware.ts` file convention to
 * `proxy.ts` — see `node_modules/next/dist/docs/.../proxy.md` — this file
 * is plain shared logic, not itself a Next.js file convention).
 *
 * Mirrors Supabase's official `@supabase/ssr` Next.js App Router pattern:
 * a request-scoped Supabase client backed by the *request's* cookies is
 * used to call `getUser()` (which revalidates the session against
 * Supabase, unlike decoding the JWT locally) so expiring/rotating session
 * cookies get refreshed before the request reaches a Server Component.
 */
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// (app) route group — personal/business/finance — requires a session.
// /admin also requires a session here, but this is only the "signed in at
// all" check — the real "is this person a platform admin" authorization
// happens in (admin)/admin/layout.tsx via a real DB lookup (platform_admins
// has no policies, so it can't be checked from this edge-runtime layer,
// which has no Postgres access).
const PROTECTED_PREFIXES = ["/personal", "/business", "/finance", "/admin"];
// (auth) route group — signed-in users shouldn't see these.
const AUTH_PATHS = ["/sign-in", "/sign-up"];
// Where an authenticated user lands after sign-in/sign-up, and where an
// authenticated visit to /sign-in or /sign-up redirects to instead.
const AUTHENTICATED_HOME = "/personal";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          supabaseResponse = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            supabaseResponse.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  // IMPORTANT: always use getUser() here, never getSession(). getUser()
  // revalidates the access token against Supabase's Auth server on every
  // call; getSession() only reads whatever is in the (proxy-forgeable)
  // cookie, which would let a tampered/stale cookie pass as authenticated.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
  const isAuthPath = AUTH_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );

  if (!user && isProtected) {
    const redirectUrl = new URL("/sign-in", request.url);
    redirectUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (user && isAuthPath) {
    return NextResponse.redirect(new URL(AUTHENTICATED_HOME, request.url));
  }

  // IMPORTANT: `supabaseResponse` (not a fresh NextResponse) must be
  // returned so the Set-Cookie headers written by `setAll` above actually
  // reach the browser — see Supabase's SSR docs for why constructing a new
  // response here would silently drop the refreshed session.
  return supabaseResponse;
}
