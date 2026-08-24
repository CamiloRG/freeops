import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isPlatformAdmin } from "@/lib/admin/is-admin";

/**
 * Real authorization gate for the whole `/admin` route group. `proxy.ts`
 * (via `middleware.ts`'s `PROTECTED_PREFIXES`) already ensures a request
 * gets this far only with a valid session — that's an "is signed in"
 * check, not "is this person a platform admin". This layout does the real
 * check: a `platform_admins` lookup via `getDb()`, since that table's RLS
 * has no policies and can't be evaluated from the edge-runtime proxy layer
 * anyway (no Postgres access there).
 *
 * A signed-in NON-admin is redirected to `/personal` rather than shown a
 * 404/403 — same "don't reveal what exists" instinct as the rest of this
 * app's route protection, and `/admin` isn't linked from anywhere a
 * regular freelancer account would stumble into it.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const isAdmin = await isPlatformAdmin(user.id);
  if (!isAdmin) {
    redirect("/personal");
  }

  return <div className="min-h-screen bg-paper">{children}</div>;
}
