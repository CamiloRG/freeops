/**
 * Browser Supabase client — for Client Components. Uses the publishable
 * (client-safe) key; session/cookies are managed by `@supabase/ssr` so
 * this stays in sync with the server client (see `server.ts`) and the
 * proxy (see `src/proxy.ts`).
 */
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}
