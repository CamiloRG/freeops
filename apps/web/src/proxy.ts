/**
 * Next.js 16 renamed the `middleware.ts` file convention to `proxy.ts`
 * (functionality is identical — see
 * `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`).
 * `middleware.ts` still works but is deprecated and logs a warning on
 * every build, so this app uses the current convention.
 *
 * Refreshes the Supabase session cookie on every request and enforces
 * route protection for the (app) route group — see
 * `src/lib/supabase/middleware.ts` for the actual logic.
 */
import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Run on every route except static assets and Next internals, so the
     * session cookie stays fresh app-wide — including the (marketing) and
     * (public) route groups, which need a refreshed cookie too even though
     * they aren't gated (e.g. the top bar on a future public page reading
     * auth state). Route protection itself only fires for the (app)
     * group's paths, decided inside `updateSession`.
     */
    "/((?!_next/static|_next/image|favicon.ico|api/health|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
