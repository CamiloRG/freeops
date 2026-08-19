import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";

// TODO (Phase 3): gate this whole route group behind Supabase Auth — redirect
// to /sign-in when there's no session. No auth check exists yet.
export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
