import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { createClient } from "@/lib/supabase/server";

/**
 * Gates the whole (app) route group (Personal/Business/Finance) behind a
 * verified Supabase session. `src/proxy.ts` already redirects unauthenticated
 * requests before they get this far, but that's an "optimistic" check
 * (Next.js's own proxy/middleware docs are explicit that it isn't a
 * substitute for real session verification) — this server-side `getUser()`
 * call is the real, request-scoped check per app_spec.md's two-layer
 * session-scoping requirement.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  return (
    <AppShell userEmail={user.email ?? undefined}>
      {children}
    </AppShell>
  );
}
