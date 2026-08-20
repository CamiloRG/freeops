/**
 * Server Supabase client — for Server Components, Server Actions, and
 * Route Handlers. Reads/writes the session via Next's `cookies()` API
 * (async as of Next.js 15+ — see `node_modules/next/dist/docs/.../cookies.md`).
 *
 * `setAll` is wrapped in a try/catch because Server *Components* are
 * allowed to read cookies but not write them (Next.js docs, "Understanding
 * Cookie Behavior in Server Components") — writes only succeed from a
 * Server Action or Route Handler. When called from a plain Server
 * Component the write throws; the proxy (`src/proxy.ts`) is what actually
 * keeps the session cookie refreshed on every request, so a swallowed
 * write here is safe rather than silently broken.
 */
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component — safe to ignore, see
            // module doc comment above.
          }
        },
      },
    }
  );
}
